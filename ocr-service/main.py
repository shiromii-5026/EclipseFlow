"""
EclipseFlow OCR 微服务
FastAPI + EasyOCR + AI 智能解析。
图片拖进去，文字识别后 AI 自动整理成结构化任务。
"""

import io
import os
import json
import requests
from fastapi import FastAPI, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from PIL import Image
import numpy as np

app = FastAPI(title="EclipseFlow OCR Service")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# AI 配置 —— 走 DeepSeek 的 Anthropic 兼容接口
AI_API_KEY = os.environ.get("ANTHROPIC_AUTH_TOKEN", "sk-29ef71dd622d4385a41ef51e91ddd66c")
AI_BASE_URL = os.environ.get("ANTHROPIC_BASE_URL", "https://api.deepseek.com/anthropic")
AI_MODEL = os.environ.get("ANTHROPIC_MODEL", "deepseek-v4-pro")

# EasyOCR 懒加载
_reader = None


def get_reader():
    global _reader
    if _reader is None:
        import easyocr
        _reader = easyocr.Reader(["ch_sim", "en"], gpu=False, verbose=False)
    return _reader


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/ocr")
async def ocr_image(file: UploadFile = File(...)):
    """接收图片，返回 OCR 识别出的所有文字行"""
    contents = await file.read()
    image = Image.open(io.BytesIO(contents))
    img_array = np.array(image)

    reader = get_reader()
    results = reader.readtext(img_array)

    lines = [item[1].strip() for item in results if item[1].strip()]

    return {
        "lines": lines,
        "text": "\n".join(lines),
        "count": len(lines),
    }


class ParseRequest(BaseModel):
    text: str
    today: str = ""  # YYYY-MM-DD，帮 AI 理解"今天""明天"


@app.post("/parse")
async def parse_tasks(req: ParseRequest):
    """
    把 OCR 原始文字发给 AI，让 AI 整理成结构化任务列表。
    返回的 JSON 可以直接交给前端确认入库。
    """
    if not req.text.strip():
        return {"tasks": []}

    prompt = f"""你是一个任务解析助手。用户通过 OCR 识别了一段文字，请从中提取所有任务。

当前日期是 {req.today}，请根据这个日期推算"今天""明天""下周""周几"等相对时间的实际日期。

请严格返回 JSON 数组，每个任务包含以下字段：
- taskName: 任务名称（字符串）
- taskDate: 任务日期，格式 YYYY-MM-DD（字符串）
- startTime: 开始时间，如果原文没写就填 "09:00"（字符串 HH:MM）
- endTime: 截止/结束时间，如果原文没写就留空（字符串或 null）
- notes: 备注/补充信息（字符串或 null）
- color: 根据任务类型推测颜色，学习类 #c1ff00aa，工作类 #0077ffaa，生活娱乐类 #f498adaa，重要紧急 #7a5fffaa，其他 #c1ff00aa

只返回 JSON 数组，不要其他文字。

OCR 原文：
{req.text}"""

    resp = requests.post(
        f"{AI_BASE_URL}/v1/messages",
        headers={
            "x-api-key": AI_API_KEY,
            "anthropic-version": "2023-06-01",
            "Content-Type": "application/json",
        },
        json={
            "model": AI_MODEL,
            "max_tokens": 2048,
            "messages": [
                {"role": "user", "content": prompt}
            ],
        },
        timeout=90,
    )

    if resp.status_code != 200:
        return {"tasks": [], "error": f"AI API error: {resp.status_code}"}

    data = resp.json()
    content = data.get("content", [])

    ai_text = ""
    for block in content:
        if block.get("type") == "text":
            ai_text += block.get("text", "")

    if not ai_text.strip():
        return {"tasks": [], "error": "AI returned empty response"}

    # 去掉 markdown 代码块标记
    ai_text = ai_text.strip()
    if ai_text.startswith("```json"):
        ai_text = ai_text[7:]
    elif ai_text.startswith("```"):
        ai_text = ai_text[3:]
    if ai_text.endswith("```"):
        ai_text = ai_text[:-3]
    ai_text = ai_text.strip()

    # 尝试找 JSON 数组
    try:
        start = ai_text.index("[")
        end = ai_text.rindex("]") + 1
        ai_text = ai_text[start:end]
    except ValueError:
        pass

    try:
        tasks = json.loads(ai_text)
        if isinstance(tasks, list):
            return {"tasks": tasks}
    except json.JSONDecodeError:
        pass

    return {"tasks": [], "error": "AI parse failed", "raw": ai_text[:500]}


if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("OCR_PORT", "8000"))
    uvicorn.run(app, host="0.0.0.0", port=port)
