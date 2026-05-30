"""
EclipseFlow OCR 微服务
用 FastAPI + EasyOCR 做图片文字识别，
供前端拖拽上传图片后自动提取文字填入任务表单。
EasyOCR 基于 PyTorch，Windows/Linux/Mac 都能跑。
"""

import io
import os
from fastapi import FastAPI, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from PIL import Image
import numpy as np

app = FastAPI(title="EclipseFlow OCR Service")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# 懒加载，第一次请求时初始化（首次下载模型可能比较慢）
_reader = None


def get_reader():
    global _reader
    if _reader is None:
        import easyocr
        # ch_sim = 简体中文，en = 英文，GPU 不可用时自动切 CPU
        _reader = easyocr.Reader(["ch_sim", "en"], gpu=False, verbose=False)
    return _reader


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/ocr")
async def ocr_image(file: UploadFile = File(...)):
    """
    接收图片，返回 OCR 识别出的所有文字行。
    """
    contents = await file.read()
    image = Image.open(io.BytesIO(contents))
    img_array = np.array(image)

    reader = get_reader()
    results = reader.readtext(img_array)

    # results 是 [(bbox, text, confidence), ...]，按 y 坐标从上到下排序
    lines = [item[1].strip() for item in results if item[1].strip()]

    return {
        "lines": lines,
        "text": "\n".join(lines),
        "count": len(lines),
    }


if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("OCR_PORT", "8000"))
    uvicorn.run(app, host="0.0.0.0", port=port)
