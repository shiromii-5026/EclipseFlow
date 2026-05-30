package net.togogo.eclipseflowbackend.push;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/**
 * 推送订阅管理。
 * 前端浏览器生成 PushSubscription 后发到这里保存，
 * 定时任务根据保存的订阅列表向所有浏览器推送提醒。
 */
@RestController
@RequestMapping("/api/push")
@CrossOrigin(origins = "*")
public class PushController {

    @Autowired
    private PushService pushService;

    /**
     * 接收浏览器推送订阅，保存到内存列表。
     * 前端传的是 PushSubscription.toJSON() 的结果：{ endpoint, keys: { p256dh, auth } }
     */
    @PostMapping("/subscribe")
    public ResponseEntity<?> subscribe(@RequestBody Map<String, Object> body) {
        String endpoint = (String) body.get("endpoint");
        @SuppressWarnings("unchecked")
        Map<String, String> keys = (Map<String, String>) body.get("keys");
        if (endpoint == null || keys == null) {
            return ResponseEntity.badRequest().body(Map.of("error", "missing endpoint or keys"));
        }
        pushService.addSubscription(endpoint, keys.get("p256dh"), keys.get("auth"));
        return ResponseEntity.ok(Map.of("status", "subscribed"));
    }
}
