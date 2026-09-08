"""ocr-service pytest 公共配置。

把 ocr-service 根目录加进 sys.path,让测试能 `import main`(服务只有一个 main.py)。
注意:main.py 顶层会 import requests/PIL/numpy(本机 base Python 都有,零安装);
easyocr 是懒加载,不进内存、不下载模型 —— 测试里一律替换 get_reader() 或 requests.post。
"""

import sys
from pathlib import Path

SERVICE_ROOT = Path(__file__).resolve().parent.parent
if str(SERVICE_ROOT) not in sys.path:
    sys.path.insert(0, str(SERVICE_ROOT))
