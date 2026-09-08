"""EasyOCR 版面还原测试 —— 对应简历 EclipseFlow 『OCR…验证每级回退机制』里的
图像识别下游:把 EasyOCR 的“包围盒列表”还原成可读文本(按 y 分行、按 x 排序)。

easyocr 依赖 PyTorch 且要下载模型,本机不可能真跑;这里用假 reader 返回预设的
包围盒,专门验证 main.py 里那段“分组/排序/拼行”的纯逻辑。模糊、倾斜、多行等
输入对应的是 EasyOCR 给出的不同坐标样本,我们用坐标差异来模拟。
"""

import io

from fastapi.testclient import TestClient
from PIL import Image

import main


class FakeReader:
    """返回固定包围盒的假 EasyOCR reader。

    readtext 每个元素: ([左上,右上,右下,左下], text, confidence)
    main.py 取 corners[0] 与 corners[2] 的中点当 (x, y)。
    """

    def __init__(self, items):
        self.items = items

    def readtext(self, img_array):
        return self.items


def _png_bytes():
    buf = io.BytesIO()
    Image.new("RGB", (8, 8), (255, 255, 255)).save(buf, format="PNG")
    return buf.getvalue()


def _post_ocr(reader, tmp_path, monkeypatch):
    monkeypatch.chdir(tmp_path)          # 避免在项目目录生成 last_ocr.txt
    monkeypatch.setattr(main, "get_reader", lambda: reader)
    client = TestClient(main.app)
    return client.post("/ocr", files={"file": ("sched.png", _png_bytes(), "image/png")})


def _bbox(cx, cy):
    # 让包围盒中点正好落在 (cx, cy)
    return [[cx - 10, cy - 10], [cx + 10, cy - 10], [cx + 10, cy + 10], [cx - 10, cy + 10]]


def test_ocr_groups_by_row_and_sorts_by_column(tmp_path, monkeypatch):
    reader = FakeReader([
        (_bbox(30, 10), "周一", 0.99),    # 第一行
        (_bbox(5, 12), "08:30", 0.98),   # 与上一项同行(Δy=2 ≤ 18)
        (_bbox(40, 60), "高等数学", 0.95), # Δy=48 > 18 → 新的一行
    ])

    resp = _post_ocr(reader, tmp_path, monkeypatch)

    assert resp.status_code == 200
    body = resp.json()
    assert body["count"] == 3
    # 同一行内按 x 排序:08:30(x=5) 在 周一(x=30) 前面
    assert body["text"] == "08:30 | 周一\n高等数学"
    # plain 保留原始(按 y)顺序
    assert body["plain"] == "周一\n08:30\n高等数学"


def test_ocr_small_y_jitter_stays_in_single_row(tmp_path, monkeypatch):
    # 模糊图片常见的“同一行字略上下抖动”:Δy 始终 ≤ 18 → 不该被拆成多行
    reader = FakeReader([
        (_bbox(10, 10), "科目", 0.9),
        (_bbox(40, 12), "日期", 0.9),
        (_bbox(80, 15), "备注", 0.9),
    ])
    body = _post_ocr(reader, tmp_path, monkeypatch).json()
    assert body["count"] == 3
    assert body["text"] == "科目 | 日期 | 备注"  # 只有一行


def test_ocr_empty_results_still_returns_ok(tmp_path, monkeypatch):
    body = _post_ocr(FakeReader([]), tmp_path, monkeypatch).json()
    assert body == {"lines": [], "text": "", "plain": "", "count": 0}
