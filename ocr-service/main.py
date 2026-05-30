"""
EclipseFlow OCR Service
FastAPI + EasyOCR + AI parsing
"""

import io
import os
import json
import time
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

AI_API_KEY = os.environ.get("ANTHROPIC_AUTH_TOKEN", "sk-29ef71dd622d4385a41ef51e91ddd66c")
AI_BASE_URL = os.environ.get("ANTHROPIC_BASE_URL", "https://api.deepseek.com/anthropic")
AI_MODEL = os.environ.get("ANTHROPIC_MODEL", "deepseek-v4-pro")

# Kimi vision API (for images directly)
KIMI_KEY = os.environ.get("KIMI_API_KEY", "sk-TrJW6JOKFgnoZYEWKhWGeuNBhXhQT9VhCcG75r9638IodMxF")
KIMI_BASE = "https://api.moonshot.cn/v1"
KIMI_MODEL = "moonshot-v1-32k-vision-preview"

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
    contents = await file.read()
    image = Image.open(io.BytesIO(contents))
    img_array = np.array(image)

    reader = get_reader()
    results = reader.readtext(img_array)

    blocks = []
    for item in results:
        bbox = item[0]
        text = item[1].strip()
        if text:
            cx = (bbox[0][0] + bbox[2][0]) / 2
            cy = (bbox[0][1] + bbox[2][1]) / 2
            blocks.append({"text": text, "x": cx, "y": cy})

    # Group into rows by y-coordinate
    blocks.sort(key=lambda b: b["y"])
    rows = []
    cur = []
    last_y = -999
    for b in blocks:
        if cur and abs(b["y"] - last_y) > 18:
            rows.append(cur)
            cur = []
        cur.append(b)
        last_y = b["y"]
    if cur:
        rows.append(cur)

    table_lines = []
    for row in rows:
        row.sort(key=lambda b: b["x"])
        table_lines.append(" | ".join([b["text"] for b in row]))

    table_text = "\n".join(table_lines)
    plain_text = "\n".join([b["text"] for b in blocks])

    with open("last_ocr.txt", "w", encoding="utf-8") as f:
        f.write(f"=== table ===\n{table_text}\n\n=== plain ===\n{plain_text}")

    return {
        "lines": [b["text"] for b in blocks],
        "text": table_text,
        "plain": plain_text,
        "count": len(blocks),
    }


class ParseRequest(BaseModel):
    text: str
    plain: str = ""
    today: str = ""


@app.post("/parse")
async def parse_tasks(req: ParseRequest):
    combined = req.text
    if req.plain and req.plain != req.text:
        combined = (
            "=== TABLE MODE (columns separated by |) ===\n" +
            req.text +
            "\n\n=== RAW OCR (original word order) ===\n" +
            req.plain
        )

    if not combined.strip():
        return {"tasks": []}

    prompt = (
        "Extract all university courses from this weekly schedule OCR. "
        f"Current date is {req.today}. The schedule has columns Mon=周一 through Sun=周日 with dates like 04/13=Apr13. "
        "Time slots: 8:30, 10:25, 14:30, 16:25, 18:30 (each ~1.5h). "
        "Course names may be split across lines - concatenate adjacent lines in same position. "
        "Room numbers are @ followed by digits (e.g. @06409). Remove @. "
        "For each course output JSON: taskName, taskDate (YYYY-MM-DD), startTime (HH:MM), "
        "endTime (HH:MM), notes (room), color (#c1ff00aa). Return ONLY JSON array.\n\n" +
        combined
    )

    last_error = None
    for attempt in range(3):
        try:
            resp = requests.post(
                f"{AI_BASE_URL}/v1/messages",
                headers={
                    "x-api-key": AI_API_KEY,
                    "anthropic-version": "2023-06-01",
                    "Content-Type": "application/json",
                },
                json={
                    "model": AI_MODEL,
                    "max_tokens": 8192,
                    "messages": [{"role": "user", "content": prompt}],
                },
                timeout=120,
            )
            if resp.status_code == 200:
                break
            last_error = f"AI API status {resp.status_code}"
        except Exception as e:
            last_error = str(e)[:120]
            if attempt < 2:
                time.sleep(2)
    else:
        return {"tasks": [], "error": last_error or "AI API failed"}

    data = resp.json()
    ai_text = ""
    for block in data.get("content", []):
        if block.get("type") == "text":
            ai_text += block.get("text", "")

    if not ai_text.strip():
        print("[PARSE] AI empty response")
        return {"tasks": [], "error": "AI returned empty response"}

    ai_text = ai_text.strip()
    if ai_text.startswith("```json"):
        ai_text = ai_text[7:]
    elif ai_text.startswith("```"):
        ai_text = ai_text[3:]
    if ai_text.endswith("```"):
        ai_text = ai_text[:-3]
    ai_text = ai_text.strip()

    try:
        start = ai_text.index("[")
        end = ai_text.rindex("]") + 1
        ai_text = ai_text[start:end]
    except ValueError:
        pass

    try:
        tasks = json.loads(ai_text)
        if isinstance(tasks, list):
            print(f"[PARSE] Success: {len(tasks)} tasks")
            return {"tasks": tasks}
    except json.JSONDecodeError:
        pass

    print(f"[PARSE] JSON parse failed, raw: {ai_text[:300]}")
    return {"tasks": [], "error": "AI response could not be parsed", "raw": ai_text[:500]}


@app.post("/ocr-vision")
async def ocr_vision(file: UploadFile = File(...), today: str = ""):
    """
    Direct vision: send image to Kimi vision model, get structured tasks back.
    For complex images like full weekly schedules that OCR can't handle.
    """
    contents = await file.read()

    # Convert image to base64
    import base64
    img_b64 = base64.b64encode(contents).decode()

    if not today:
        from datetime import date
        today = date.today().isoformat()

    prompt = (
        "Extract ALL courses from this weekly class schedule image. "
        f"Today is {today}. The schedule shows one week of courses with columns for each weekday.\n\n"
        "DATE MAPPING: Look at the column headers carefully. They show weekdays (Monday=周一, Tuesday=周二, etc.) "
        "with corresponding dates. Read the EXACT date numbers (MM/DD format) from each column header. "
        "For example if the header shows '周一 04/13', then all courses under that column have taskDate '2026-04-13'. "
        "Use the actual date from the header, not the weekday name.\n\n"
        "For each course, return a JSON object with:\n"
        '- taskName: full course name\n'
        '- taskDate: YYYY-MM-DD (read from column header, use 2026 as year)\n'
        '- startTime: HH:MM from the time column\n'
        '- endTime: HH:MM (usually 1.5h later, e.g. 08:30->10:00, 10:25->11:55, 14:30->16:00, 16:25->17:55, 18:30->20:00)\n'
        '- notes: classroom number (e.g. "06409") or "线上" if online\n'
        '- color: "#c1ff00aa"\n\n'
        "Return ONLY a valid JSON array. Every course must be included."
    )

    try:
        resp = requests.post(
            f"{KIMI_BASE}/chat/completions",
            headers={
                "Authorization": f"Bearer {KIMI_KEY}",
                "Content-Type": "application/json",
            },
            json={
                "model": KIMI_MODEL,
                "messages": [{
                    "role": "user",
                    "content": [
                        {"type": "text", "text": prompt},
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": f"data:image/png;base64,{img_b64}",
                                "detail": "high",
                            },
                        },
                    ],
                }],
                "max_tokens": 4096,
                "temperature": 0.1,
            },
            timeout=120,
        )

        if resp.status_code != 200:
            return {"tasks": [], "error": f"Kimi API error: {resp.status_code}", "raw": resp.text[:200]}

        data = resp.json()
        content = data["choices"][0]["message"]["content"]

        # Parse JSON from response
        ai_text = content.strip()
        if ai_text.startswith("```json"):
            ai_text = ai_text[7:]
        elif ai_text.startswith("```"):
            ai_text = ai_text[3:]
        if ai_text.endswith("```"):
            ai_text = ai_text[:-3]
        ai_text = ai_text.strip()

        try:
            start = ai_text.index("[")
            end = ai_text.rindex("]") + 1
            ai_text = ai_text[start:end]
        except ValueError:
            pass

        tasks = json.loads(ai_text)
        print(f"[VISION] {len(tasks)} tasks extracted")
        return {"tasks": tasks, "text": content}

    except Exception as e:
        return {"tasks": [], "error": str(e)[:200]}


if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("OCR_PORT", "8000"))
    uvicorn.run(app, host="0.0.0.0", port=port)
