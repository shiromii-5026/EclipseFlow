# PWA 多端浏览器手动测试用例(截图留存用)

> 适用对象:仓库里 **legacy `front/`**(含 `manifest.json` + `service-worker.js`)。
> ⚠️ 现状提醒:`eclipse-flow-front-vue`(新版 Vue 前端)**没有** manifest/service-worker;
> 若简历写的是新版前端测 PWA,面试会穿帮。下面用例按 legacy `front/` 设计。

## 前置

PWA 的 Service Worker / 通知 / 安装只工作在**安全上下文**:`https://` 或 `http://localhost`。
最省事的跑法:

```bash
# 方式一(推荐,一键起全栈):需要 Docker
cd D:\code\EclipseFlow && docker-compose up -d      # nginx → http://localhost 挂载的是 front/
# 方式二(只测 PWA 静态部分):用一个静态服务器把 front/ 当站点根
cd D:\code\EclipseFlow\front && npx serve -l 5000 . # 然后访问 http://localhost:5000/login.html
```

浏览器:Chrome / Edge(桌面)+ Safari(iOS 或 macOS)+ Android Chrome(如可用)。
每跑一条记录:浏览器 | 版本 | 结果 ✅/❌ | 截图。

---

## 用例 1:PWA 可安装(桌面)

1. Chrome/Edge 打开 `http://localhost/`(或 :5000)。
2. 地址栏右侧出现安装图标(⊕),或菜单里有“安装 EclipseFlow / 创建快捷方式”。
3. 安装后从桌面/开始菜单启动,应打开独立应用窗口(非标签页)。

**预期**:地址栏出现可安装提示;安装后能独立窗口启动。

## 用例 2:manifest 元数据

DevTools → Application → Manifest 检查:
- `name`、`start_url`、`display`(standalone/fullscreen)、`icons`(≥192px、512px)齐全;
- `theme_color`/`background_color` 生效。

**预期**:Manifest 面板无红色报错,图标列表非空。

## 用例 3:离线缓存 / 二次访问可用

1. 打开页面一次(此时 Service Worker 安装并缓存资源)。
2. DevTools → Application → Service Workers 确认 `activated`。
3. DevTools → Network 勾选 Offline(或直接断网),刷新页面。
4. 应用壳(HTML/CSS/JS)应仍能加载(数据接口会失败属正常)。

**预期**:断网刷新不出现整页错误,能看到缓存的界面。

## 用例 4:消息推送通知(需要后端 + Web Push)

1. 打开站点,允许浏览器“通知”权限。
2. 建一个 `BLOCK` 任务,开始时间设为 **5 分钟内**。
3. 保持页面打开(订阅已通过 `/api/push/subscribe` 上报),等待定时推送
   (后端 `@Scheduled` 每 2 分钟扫一次,命中 3–7 分钟窗口)。
4. 桌面弹出 EclipseFlow 通知。

**预期**:收到“任务 X 将在 N 分钟后开始”的系统通知;即使不在此标签页也应收到。

## 用例 5:死订阅清理(观察)

1. 在“允许通知”后,把站点通知权限改为“阻止”,或换一台设备。
2. 等下一轮推送触发,观察后端日志出现 `清理 N 个失效订阅`。
3. 恢复权限后能再次订阅成功。

**预期**:失效 endpoint 会被自动清理,日志可见。

## 用例 6:浏览器/系统兼容矩阵

| 环境 | 安装 | 离线 | 通知 |
|---|---|---|---|
| Chrome 桌面 | | | |
| Edge 桌面 | | | |
| Safari(macOS/iOS) | | | |
| Android Chrome(若可用) | | | |

> 说明:iOS Safari 的 PWA 安装与通知限制(需添加到主屏幕、且 iOS 版本较新),记录实际表现即可,不用改产品。
