# EclipseFlow

多平台日程助手。支持手动录入、OCR 拍照导入、AI 智能解析、浏览器提醒与实时倒计时。

## 技术栈

| 层 | 技术 |
|---|------|
| 前端 | 原生 HTML / CSS / JS + Interact.js 拖拽 |
| 后端 | Java Spring Boot + MyBatis-Plus |
| 数据库 | MySQL |
| OCR | Python FastAPI + EasyOCR |
| AI 解析 | Kimi 视觉模型 / DeepSeek |
| 通知 | Browser Notification API |

## 功能

- 周视图日程网格，拖拽调整时间，拉伸调整时长
- DDL 截止日线任务（只填开始时间）与 BLOCK 时间块任务（填开始+截止）
- 迷你日历快速跳转，有任务的日期标短横线，点击自动滚到当日任务
- 侧边栏实时倒计时：进行中的任务显示剩余时间，一小时内开始的任务显示倒计时
- 浏览器通知：任务开始前 5 分钟弹窗提醒
- 图片拖拽上传 + OCR 识别 + AI 解析为结构化任务，支持逐个确认 / 一键导入
- 暗色模式（孤星主题）与日间模式（绿野幻梦主题）
- 任务颜色自定义

## 项目结构

```
EclipseFlow/
├── front/                    # 前端页面
│   ├── index.html
│   ├── style.css
│   └── app.js
├── eclipse-flow-backend/     # Java 后端
│   └── src/main/java/net/togogo/eclipseflowbackend/
│       ├── controller/
│       ├── entity/
│       ├── dto/
│       ├── service/
│       └── mapper/
├── ocr-service/              # OCR + AI 微服务
│   ├── main.py
│   ├── requirements.txt
│   └── run.bat
└── eclipse-flow-front-vue/   # Vue 前端脚手架（未启用）
```

## 启动

### 1. 数据库

MySQL，创建库 `eclipse_flow`，编码 utf8mb4。

```sql
CREATE DATABASE eclipse_flow DEFAULT CHARSET utf8mb4;
```

表结构由 MyBatis-Plus 自动维护，首次启动后端即可。

### 2. 后端

```bash
cd eclipse-flow-backend
mvn spring-boot:run
```

默认端口 8080，配置文件 `src/main/resources/application.yml`。

### 3. OCR 服务

```bash
cd ocr-service
pip install -r requirements.txt
python main.py
```

默认端口 8000。首次启动会下载 EasyOCR 模型（约 77MB）。  
Kimi API Key 如需更换，修改 `main.py` 中的 `KIMI_KEY`。

### 4. 前端

直接用浏览器打开 `front/index.html`，或挂到任意静态服务上。

前端默认请求 `localhost:8080`（后端）和 `localhost:8000`（OCR），可在 `app.js` 顶部 `CONFIG` 中修改。

## API

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/tasks/list` | 获取所有任务 |
| POST | `/api/tasks/add` | 新增任务 |
| DELETE | `/api/tasks/delete/{id}` | 删除任务 |
| PUT | `/api/tasks/update-time` | 更新任务（拖拽/拉伸/编辑） |
| POST | `/ocr` | OCR 识别图片文字 |
| POST | `/parse` | AI 将文字解析为结构化任务 |
| POST | `/ocr-vision` | Kimi 视觉模型直接识别图片 |
| GET | `/health` | OCR 服务健康检查 |

## 任务字段

| 字段 | 类型 | 说明 |
|------|------|------|
| taskName | String | 任务名 |
| taskDate | Date | 日期 YYYY-MM-DD |
| startTime | Time | 开始时间 HH:MM:SS |
| duration | Double | 时长（小时），DDL 任务为 0 |
| deadline | Time | 截止时间 |
| taskType | String | DDL（截止线）/ BLOCK（时间块） |
| color | String | 颜色，如 #b5d528aa |
| notes | String | 备注 |
