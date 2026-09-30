# EclipseFlow — QA 补测导航

本次补测按“标准位置”分布在各模块自己的测试目录(生产代码零改动),本目录只放
汇总说明 + 需要人工在浏览器里执行的用例(自动测试做不了的部分)。

## 自动化补测在哪、怎么跑

| 套件 | 位置 | 运行命令(Windows) |
|---|---|---|
| 后端 JUnit/MockMvc/集成(新增 34 条) | `eclipse-flow-backend/src/test/java/net/togogo/eclipseflowbackend/qa/` | `cd eclipse-flow-backend && mvn test` |
| —— 其中“连真库”的集成测试 | `qa/TaskServiceImplIntegrationTest`、`qa/TaskApiIntegrationTest` | 需要本机 MySQL(`eclipse_flow`,root/123456);连不上会自动跳过 |
| OCR 服务 pytest(新增 15 条) | `ocr-service/tests/` | `cd ocr-service && python -m pytest tests -q`(用 base Python,零安装) |
| LearnLens pytest(新增 115 条) | `D:\code\LearnLens\qa_tests\` | `cd D:\code\LearnLens && .venv\Scripts\python.exe -m pytest qa_tests -q` |

后端全量:54 条测试(旧的 20 + 新增 34)`mvn test` 全绿。

### 新增后端 qa 测试清单 ↔ 简历 claim

| 类 | 测什么 | 简历对应 |
|---|---|---|
| `JwtFilterTest`(7) | 过滤器放行/强制/401/userId 写入 | JWT 鉴权边界 |
| `TaskControllerTest`(8) | REST CRUD + 删他人任务 403 + 404 | Spring Boot REST API 功能验证 |
| `PushServiceTest`(8) | 定时推送窗口、DDL/无时间/窗口外跳过、死订阅清理 | 定时推送可靠性 / 死订阅清理 |
| `TaskServiceImplIntegrationTest`(6) | 真 SQL:部分更新只动非 null、时间补秒、幂等、只传 id 会崩(缺陷) | 数据完整性 / 幂等性 |
| `TaskApiIntegrationTest`(5) | 无 token/篡改 token→401、删他人→403、部分更新不覆盖 | 接口 + 鉴权 + 数据完整性 |

## 为什么还有人工用例

PWA / 多浏览器 / 推送通知只有打开真实浏览器才能验证;而且仓库现状是
**PWA(manifest/service-worker)只存在于 legacy `front/`,新版 `eclipse-flow-front-vue` 并没有**。
所以在面试里不要说“前端自动化测过 PWA”——先看下面的手动清单,按它跑一遍留截图,
并想清楚要强调的是哪个前端。
