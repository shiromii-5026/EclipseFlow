# ocr-service `tests/` — pytest 补测

> OCR 服务只有一个 `main.py`。本目录用假 reader / 假 requests 验证可离线测试的
> **容错与解析逻辑**,不会下载 EasyOCR 模型、不会调用任何真实 AI API。

## 运行

```bash
cd D:\code\EclipseFlow\ocr-service

# 本机 base Python(Anaconda)已带 fastapi/httpx/python-multipart/PIL/numpy/pytest
python -m pytest tests -q
```

## 文件 ↔ 简历对应

| 文件 | 覆盖 | 简历说法 |
|---|---|---|
| `test_health.py` | `/health`、空文本 `/parse` 不调用 AI | 服务可用性 |
| `test_ocr_grouping.py` | EasyOCR 包围盒 → 按 y 分行 / 按 x 排序的版面还原(模糊、上下抖动、空结果) | “OCR…各类异常输入…验证回退机制”(图像侧) |
| `test_parse_retry.py` | DeepSeek `/parse` 最多重试 3 次、剥围栏、非 200、三次失败降级 | “DeepSeek LLM 解析”容错 |
| `test_ocr_vision_parse.py` | Kimi `/ocr-vision` 图片 base64 上送、围栏剥离、429/超时降级 | “Kimi 视觉模型”容错 |

## 边界说明(重要,别在面试时说反)

代码现状是**三个相互独立的路由**`/ocr`(EasyOCR)、`/parse`(DeepSeek 文本)、`/ocr-vision`(Kimi),
**并没有**“EasyOCR → Kimi → DeepSeek 三级自动回退”的管道;`/parse` 的 3 次重试是
**同一个模型**重试。本目录测的就是每个端点各自的容错。简历若写“递进回退管道”会被问穿,
建议按我们简历建议稿里的核对表改成准确说法。
