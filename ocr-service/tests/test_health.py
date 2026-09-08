"""OCR 服务基础可用性测试。"""

from fastapi.testclient import TestClient

import main


def test_health():
    client = TestClient(main.app)
    resp = client.get("/health")
    assert resp.status_code == 200
    assert resp.json() == {"status": "ok"}


def test_parse_route_is_registered():
    client = TestClient(main.app)
    # 空文本不应触发 AI 调用,直接返回空任务
    resp = client.post("/parse", json={"text": "  ", "plain": ""})
    assert resp.status_code == 200
    assert resp.json() == {"tasks": []}
