"""DeepSeek 文本解析端点 /parse 的容错测试 —— 对应简历『OCR…DeepSeek LLM』解析链路。

/parse 的真实行为:
  - 最多重试 3 次(同一模型重试,不是跨模型回退);
  - 剥掉 ```json 围栏、只取最外层 [ ... ]、再 json.loads;
  - 三次都失败 → 返回 {"tasks": [], "error": ...}。
全部通过替换 requests.post 来模拟 AI 响应,不联网、不花钱。
"""

from fastapi.testclient import TestClient

import main

tasks_json = '[{"taskName": "高等数学", "taskDate": "2026-09-08", "startTime": "08:30"}]'


class FakeResp:
    def __init__(self, status_code=200, payload=None, text=""):
        self.status_code = status_code
        self._payload = payload if payload is not None else {}
        self.text = text

    def json(self):
        return self._payload


def _patch_post(monkeypatch, fn):
    # requests 在 main 里是模块级 `import requests`,运行时走 requests.post
    monkeypatch.setattr(main.requests, "post", fn)
    monkeypatch.setattr(main.time, "sleep", lambda *a, **k: None)  # 跳过真实重试等待


def _client():
    return TestClient(main.app)


def test_parse_strips_fences_and_outer_text(monkeypatch):
    calls = []

    def fake_post(*a, **k):
        calls.append(a)
        return FakeResp(payload={
            "content": [{"type": "text", "text":
                '好的:\n```json\n' + tasks_json + '\n```\n以上是结果'}]
        })

    _patch_post(monkeypatch, fake_post)
    resp = _client().post("/parse", json={"text": "课表OCR文本", "plain": "课表OCR文本"})

    assert resp.status_code == 200
    body = resp.json()
    assert len(body["tasks"]) == 1
    assert body["tasks"][0]["taskName"] == "高等数学"
    assert len(calls) == 1  # 一次成功,无需重试


def test_parse_returns_empty_when_input_blank(monkeypatch):
    calls = []
    _patch_post(monkeypatch, lambda *a, **k: calls.append(a) or FakeResp())
    resp = _client().post("/parse", json={"text": "", "plain": ""})
    assert resp.json() == {"tasks": []}
    assert calls == []  # 空输入不应发任何请求


def test_parse_recovers_after_two_network_failures(monkeypatch):
    calls = {"n": 0}

    def flaky_post(*a, **k):
        calls["n"] += 1
        if calls["n"] < 3:
            raise ConnectionError("临时网络错误")
        return FakeResp(payload={
            "content": [{"type": "text", "text": tasks_json}]
        })

    _patch_post(monkeypatch, flaky_post)
    resp = _client().post("/parse", json={"text": "课表", "plain": "课表"})

    assert calls["n"] == 3  # 前 2 次失败 + 第 3 次成功
    assert len(resp.json()["tasks"]) == 1


def test_parse_returns_error_after_three_failures(monkeypatch):
    calls = {"n": 0}

    def always_fail(*a, **k):
        calls["n"] += 1
        raise ConnectionError("服务不可用")

    _patch_post(monkeypatch, always_fail)
    resp = _client().post("/parse", json={"text": "课表", "plain": "课表"})

    assert calls["n"] == 3
    body = resp.json()
    assert body["tasks"] == []
    assert body["error"]  # 带错误信息,而不是抛 500


def test_parse_handles_non_200_status(monkeypatch):
    calls = {"n": 0}

    def server_error(*a, **k):
        calls["n"] += 1
        return FakeResp(status_code=500, text="bad gateway")

    _patch_post(monkeypatch, server_error)
    resp = _client().post("/parse", json={"text": "课表", "plain": "课表"})

    assert calls["n"] == 3
    body = resp.json()
    assert "500" in body["error"]
    assert body["tasks"] == []


def test_parse_returns_raw_when_ai_text_is_not_json(monkeypatch):
    def not_json(*a, **k):
        return FakeResp(payload={
            "content": [{"type": "text", "text": "抱歉,我无法解析这张图"}]
        })

    _patch_post(monkeypatch, not_json)
    resp = _client().post("/parse", json={"text": "课表", "plain": "课表"})
    body = resp.json()
    assert body["tasks"] == []
    assert "error" in body
