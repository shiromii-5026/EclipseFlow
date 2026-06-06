# EclipseFlow OCR 服务 Docker 镜像
# 构建：docker build -t eclipse-flow-ocr .
FROM python:3.11-slim

WORKDIR /app

# 安装系统依赖（EasyOCR 需要 libGL）
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1-mesa-glx \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

# 先复制依赖文件，利用 Docker 缓存
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# 复制应用代码
COPY main.py .

# 预下载 EasyOCR 模型到镜像中（避免首次请求时的延迟）
RUN python -c "import easyocr; easyocr.Reader(['ch_sim','en'], gpu=False, verbose=False)" || true

EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
