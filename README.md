# EclipseFlow

多平台日程助手。手动录入、拍照 OCR + AI 导入、浏览器提醒、实时倒计时、好友共享日历。

## 技术栈

| 层 | 技术 |
|---|------|
| 前端 | Vue 3 + Vite + TypeScript + Pinia + Interact.js 拖拽 |
| 后端 | Java Spring Boot + MyBatis-Plus + Spring Security + JWT |
| 数据库 | MySQL |
| OCR | Python FastAPI + EasyOCR |
| AI 解析 | Kimi 视觉模型 / DeepSeek |
| 推送 | Web Push (浏览器) + PWA |

## 功能

- 周视图日程网格，拖拽调整时间，拉伸调整时长
- DDL 截止日线任务 / BLOCK 时间块任务
- 迷你日历快速跳转，有任务标短横线，点击自动滚到当日
- 侧边栏实时倒计时：进行中显示剩余时间，即将开始显示倒计时
- 图片拖拽上传 + OCR + AI 解析，逐个确认 / 一键导入
- 课表截图直发 Kimi 视觉模型识别
- 浏览器通知 & PWA 推送（支持离线使用）
- 多用户登录注册（JWT），任务数据隔离
- 好友系统：搜索添加、好友列表、私聊
- 好友日历共享（可开关公开）
- 暗色模式 / 日间模式

## 项目结构

```
EclipseFlow/
├── eclipse-flow-front-vue/    # Vue 3 前端（主力）
│   ├── src/
│   │   ├── views/             # 主页面
│   │   ├── components/        # TaskCard, MiniCalendar, FriendPanel 等
│   │   ├── stores/            # Pinia 状态管理
│   │   ├── services/          # API 调用
│   │   └── types/             # TypeScript 类型
│   └── vite.config.ts
├── eclipse-flow-backend/      # Java 后端
│   └── src/main/java/net/togogo/eclipseflowbackend/
│       ├── auth/              # 登录注册、JWT、好友、聊天
│       ├── controller/        # TaskController
│       ├── entity/            # Task
│       ├── dto/               # TaskTimeUpdateDto
│       ├── service/
│       ├── mapper/
│       └── push/              # Web Push 推送
├── front/                     # 原版原生 JS 前端（已弃用）
├── ocr-service/               # OCR + AI 微服务
│   ├── main.py
│   ├── requirements.txt
│   └── run.bat
└── docker/                    # Docker 配置
```

## 快速启动

### 1. 数据库

```sql
CREATE DATABASE eclipse_flow DEFAULT CHARSET utf8mb4;
```

首次启动后端自动建表，再执行：

```sql
INSERT INTO users (id, username, password) VALUES (2, 'shiromii', '$2b$12$xbUsVDZxk9OOWC3cu0/JvepR.DQd7jrDIZu.941FoCNQoQUaKXYaC');
```

（密码 123456，bcrypt 加密）

### 2. 后端

```bash
cd eclipse-flow-backend
mvn spring-boot:run
```

端口 8080。

### 3. OCR 服务

```bash
cd ocr-service
pip install -r requirements.txt
python main.py
```

端口 8000，首次启动下载 EasyOCR 模型约 77MB。
Kimi API Key 在 `main.py` 顶部的 `KIMI_KEY` 中配置。

### 4. 前端

```bash
cd eclipse-flow-front-vue
npm install --legacy-peer-deps
npm run dev
```

开发服务器端口 5173，默认请求 `localhost:8080` 和 `localhost:8000`。
生产构建：`npm run build`，产物在 `dist/` 目录。

## 默认账号

| 用户名 | 密码 |
|--------|------|
| admin | 123456 |

## API 一览

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/auth/login` | 登录，返回 JWT |
| POST | `/api/auth/register` | 注册 |
| GET | `/api/tasks/list` | 获取当前用户任务 |
| POST | `/api/tasks/add` | 新增任务 |
| DELETE | `/api/tasks/delete/{id}` | 删除 |
| PUT | `/api/tasks/update-time` | 更新（拖拽/拉伸/编辑） |
| POST | `/api/push/subscribe` | 推送订阅 |
| GET | `/api/social/search?q=` | 搜索用户 |
| POST | `/api/social/add-friend` | 发送好友申请 |
| GET | `/api/social/friends` | 好友列表 |
| GET | `/api/social/requests` | 待处理的申请 |
| POST | `/api/social/accept` | 接受申请 |
| POST | `/api/social/send` | 发送私聊 |
| GET | `/api/social/messages/{id}` | 聊天记录 |
| GET | `/api/social/friend-calendar/{id}` | 查看好友日历 |
| POST | `/api/social/toggle-calendar` | 开关日历公开 |
| POST | `/ocr` | OCR 识别图片 |
| POST | `/ocr-vision` | Kimi 视觉直接识别 |
| POST | `/parse` | AI 解析文字为任务 |
| GET | `/health` | OCR 健康检查 |
