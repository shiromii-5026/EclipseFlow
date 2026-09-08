"""Kimi 视觉解析端点 /ocr-vision 的容错测试 —— 对应简历里 OCR 的 Kimi 视觉链路。

/ocr-vision 真实行为:把图片 base64 塞给 Kimi;返回 200 时从
choices[0].message.content 里剥围栏、截 [ ... ]、json.loads;
非 200 / 抛异常时返回 {"tasks": [], "error": ...}。
"""

from fastapi.testclient import TestClient

import main

tasks_json = '[{"taskName": "数据结构", "taskDate": "2026-09-09", "startTime": "10:25"}]'

# TestClient multipart 上传参数:(文件名str, 文件内容bytes, 类型)
UPLOAD = {"file": ("sched.png", b"fake-png-image-bytes", "image/png")}


class FakeResp:
    def __init__(self, status_code=200, payload=None, text=""):
        self.status_code = status_code
        self._payload = payload if payload is not None else {}
        self.text = text

    def json(self):
        return self._payload


def _patch_post(monkeypatch, fn):
    monkeypatch.setattr(main.requests, "post", fn)
    monkeypatch.setattr(main.time, "sleep", lambda *a, **k: None)


def _vision_body(content):
    return {"choices": [{"message": {"content": content}}]}


def test_ocr_vision_parses_fenced_json(monkeypatch):
    calls = []

    def fake_post(*a, **k):
        calls.append((a, k))
        return FakeResp(payload=_vision_body("```json\n" + tasks_json + "\n```"))

    _patch_post(monkeypatch, fake_post)
    resp = TestClient(main.app).post("/ocr-vision", files=UPLOAD)

    assert resp.status_code == 200
    body = resp.json()
    assert len(body["tasks"]) == 1
    assert body["tasks"][0]["taskName"] == "数据结构"
    assert len(calls) == 1

    # 验证确实把图片 base64 塞进了请求(而不是发了个空请求)
    request_json = calls[0][1]["json"]
    content = request_json["messages"][0]["content"]
    image_part = content[1]
    assert image_part["type"] == "image_url"
    assert image_part["image_url"]["url"].startswith("data:image/png;base64,")


def test_ocr_vision_tolerates_text_around_json(monkeypatch):
    def fake_post(*a, **k):
        return FakeResp(payload=_vision_body(
            "解析结果如下\n" + tasks_json + "\n上面共 1 门课"))

    _patch_post(monkeypatch, fake_post)
    resp = TestClient(main.app).post("/ocr-vision", files=UPLOAD)
    assert len(resp.json()["tasks"]) == 1


def test_ocr_vision_non_200_returns_error_with_raw(monkeypatch):
    def fake_post(*a, **k):
        return FakeResp(status_code=429, text="rate limited")

    _patch_post(monkeypatch, fake_post)
    resp = TestClient(main.app).post("/ocr-vision", files=UPLOAD)
    body = resp.json()
    assert body["tasks"] == []
    assert "429" in body["error"]
    assert body["raw"] == "rate limited"


def test_ocr_vision_exception_is_caught(monkeypatch):
    def boom(*a, **k):
        raise TimeoutError("Kimi 超时")

    _patch_post(monkeypatch, boom)
    resp = TestClient(main.app).post("/ocr-vision", files=UPLOAD)
    body = resp.json()
    assert body["tasks"] == []
    assert "error" in body
