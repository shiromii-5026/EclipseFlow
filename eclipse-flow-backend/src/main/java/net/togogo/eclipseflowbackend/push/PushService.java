package net.togogo.eclipseflowbackend.push;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import net.togogo.eclipseflowbackend.entity.Task;
import net.togogo.eclipseflowbackend.mapper.TaskMapper;
import nl.martijndwars.webpush.Notification;
import nl.martijndwars.webpush.PushService;
import nl.martijndwars.webpush.Subscription;
import nl.martijndwars.webpush.Utils;
import org.bouncycastle.jce.provider.BouncyCastleProvider;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import jakarta.annotation.PostConstruct;
import java.security.Security;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.List;

/**
 * 推送服务：管理订阅列表，定时检查任务并推送提醒。
 * 每 2 分钟扫描一次，对 5 分钟内即将开始的任务推送到所有已订阅浏览器。
 */
@Service
@EnableScheduling
public class PushService {

    // VAPID 密钥对，和前端 app.js 里的公钥配对
    private static final String VAPID_PUBLIC_KEY = "BEfDYqG4eOMOiAeUNW3wfUzTPzSx1iBLgoODzGuAEoLwpsJh-VkPugQSvEY5Zu4zXZcnCUoWiaZppxWvuJECoU0";
    private static final String VAPID_PRIVATE_KEY = "MIGHAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBG0wawIBAQQgcx4Jm2fIekV_hWbalsBxCrcH0Q6r4kwrmK-3gn1nZ8WhRANCAARHw2KhuHjjDogHlDVt8H1M0z80sdYgS4KDg8xrgBKC8KbCYflZD7oEErxGOWbuM12XJwlKFommaacVr7iRAqFN";

    // 订阅列表（内存存储，服务重启后需重新订阅）
    private final List<Subscription> subscriptions = new ArrayList<>();

    @Autowired
    private TaskMapper taskMapper;

    @PostConstruct
    public void init() {
        Security.addProvider(new BouncyCastleProvider());
    }

    /**
     * 保存一个推送订阅
     */
    public void addSubscription(String endpoint, String p256dh, String auth) {
        Subscription sub = new Subscription(endpoint, new Subscription.Keys(p256dh, auth));
        // 去重：相同 endpoint 不重复添加
        subscriptions.removeIf(s -> s.endpoint.equals(endpoint));
        subscriptions.add(sub);
        System.out.println("[PUSH] 新增订阅，当前共 " + subscriptions.size() + " 个");
    }

    /**
     * 每 2 分钟扫描一次：今天有任务将在 5 分钟内开始的，推送给所有订阅
     */
    @Scheduled(fixedRate = 120_000)
    public void checkAndPush() {
        if (subscriptions.isEmpty()) return;

        LocalDate today = LocalDate.now();
        LocalTime now = LocalTime.now();
        int nowMin = now.getHour() * 60 + now.getMinute();

        // 查今天所有任务
        List<Task> tasks = taskMapper.selectList(
            new LambdaQueryWrapper<Task>().eq(Task::getTaskDate, today)
        );

        for (Task t : tasks) {
            if (t.getStartTime() == null || "DDL".equals(t.getTaskType())) continue;
            int startMin = t.getStartTime().getHour() * 60 + t.getStartTime().getMinute();
            int diff = startMin - nowMin;

            // 距离开始 3-7 分钟时推送（每2分钟扫一次刚好覆盖）
            if (diff >= 3 && diff <= 7) {
                String title = "EclipseFlow 任务提醒";
                String body = t.getTaskName() + " 将在 " + diff + " 分钟后开始";
                sendPushToAll(title, body);
            }
        }
    }

    /**
     * 向所有已订阅的浏览器发送推送
     */
    private void sendPushToAll(String title, String body) {
        String payload = "{\"title\":\"" + title + "\",\"body\":\"" + body + "\"}";
        List<Subscription> failed = new ArrayList<>();

        for (Subscription sub : subscriptions) {
            try {
                Notification notification = new Notification(sub, payload);
                PushService pushService = new PushService()
                    .setPublicKey(VAPID_PUBLIC_KEY)
                    .setPrivateKey(VAPID_PRIVATE_KEY)
                    .setSubject("mailto:eclipseflow@example.com");
                pushService.send(notification);
            } catch (Exception e) {
                // 订阅失效（浏览器关闭/换设备），标记删除
                failed.add(sub);
            }
        }
        subscriptions.removeAll(failed);
        if (!failed.isEmpty()) {
            System.out.println("[PUSH] 清理 " + failed.size() + " 个失效订阅");
        }
    }
}
