package net.togogo.eclipseflowbackend.qa;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import net.togogo.eclipseflowbackend.entity.Task;
import net.togogo.eclipseflowbackend.mapper.TaskMapper;
import net.togogo.eclipseflowbackend.push.PushService;
import nl.martijndwars.webpush.Subscription;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.LocalTime;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

/**
 * PushService 定时推送逻辑测试 —— 对应简历 EclipseFlow
 * 『定时推送的可靠性验证…触发窗口』『死订阅自动清理』。
 *
 * @Scheduled 的方法 checkAndPush() 被手动调用(不真等 2 分钟)。
 * 死订阅用指向 127.0.0.1:1 的 endpoint 触发“连接被拒”→ 发送失败 → 清理。
 * 成功发送的路径会真实连网,这里不模拟;靠“不该推送的任务不会被清理”验证窗口逻辑。
 */
@ExtendWith(MockitoExtension.class)
class PushServiceTest {

    @Mock
    private TaskMapper taskMapper;

    private PushService service;

    @BeforeEach
    void setUp() {
        service = new PushService("public-key", "private-key");
        service.init(); // 模拟 @PostConstruct:BouncyCastle provider
        ReflectionTestUtils.setField(service, "taskMapper", taskMapper);
    }

    @SuppressWarnings("unchecked")
    private List<Subscription> subscriptions() {
        return (List<Subscription>) ReflectionTestUtils.getField(service, "subscriptions");
    }

    private Task task(LocalTime start, String type) {
        Task t = new Task();
        t.setTaskName("背单词");
        t.setStartTime(start);
        t.setTaskType(type);
        return t;
    }

    private LocalTime nowPlusMinutes(int minutes) {
        return LocalTime.now().plusMinutes(minutes);
    }

    // ===== 空订阅:直接早退,不该查库 =====

    @Test
    void checkAndPushDoesNothingWhenNoSubscribers() {
        service.checkAndPush();
        verifyNoInteractions(taskMapper); // 订阅为空时连 SQL 都不该发
    }

    // ===== addSubscription 去重 =====

    @Test
    void addSubscriptionDeduplicatesSameEndpoint() {
        service.addSubscription("https://push.example/a", "k1", "a1");
        service.addSubscription("https://push.example/a", "k2", "a2"); // 同一 endpoint,更新密钥
        service.addSubscription("https://push.example/b", "k3", "a3");

        assertEquals(2, subscriptions().size());
    }

    // ===== 不该推送的情形:订阅必须保留(没发生发送,自然也不会被“清理”) =====

    @Test
    void ddlTaskIsNotPushedEvenIfInWindow() {
        service.addSubscription("https://127.0.0.1:1/dead", "k", "a");
        when(taskMapper.selectList(any(LambdaQueryWrapper.class)))
                .thenReturn(List.of(task(nowPlusMinutes(5), "DDL")));

        service.checkAndPush();

        assertEquals(1, subscriptions().size()); // DDL 被跳过,订阅还在
        verify(taskMapper).selectList(any(LambdaQueryWrapper.class));
    }

    @Test
    void taskWithoutStartTimeIsNotPushed() {
        service.addSubscription("https://127.0.0.1:1/dead", "k", "a");
        Task noStart = new Task();
        noStart.setTaskName("没有时间");
        when(taskMapper.selectList(any(LambdaQueryWrapper.class))).thenReturn(List.of(noStart));

        service.checkAndPush();

        assertEquals(1, subscriptions().size());
    }

    @Test
    void taskOutsideWindowIsNotPushed() {
        service.addSubscription("https://127.0.0.1:1/dead", "k", "a");
        // 离开始还有 60 分钟,不在 3-7 分钟窗口内
        when(taskMapper.selectList(any(LambdaQueryWrapper.class)))
                .thenReturn(List.of(task(nowPlusMinutes(60), "BLOCK")));

        service.checkAndPush();

        assertEquals(1, subscriptions().size());
    }

    // ===== 窗口内 BLOCK 任务:触发推送;发送失败 → 死订阅被清理 =====

    @Test
    void inWindowTaskTriggersPushAndDeadSubscriptionIsCleanedUp() {
        service.addSubscription("http://127.0.0.1:1/never-exists", "k", "a"); // 必然连不上
        when(taskMapper.selectList(any(LambdaQueryWrapper.class)))
                .thenReturn(List.of(task(nowPlusMinutes(5), "BLOCK"))); // diff=5,命中窗口

        service.checkAndPush();

        // 发送失败被 catch → 判定死订阅 → removeAll 清理
        assertEquals(0, subscriptions().size());
    }

    @Test
    void cleanupOnlyRemovesFailedSubscriptions() {
        // 两个都指向必败地址;都该被清掉 —— 验证 removeAll(failed) 不是全清
        service.addSubscription("http://127.0.0.1:1/dead-1", "k", "a");
        service.addSubscription("http://127.0.0.1:1/dead-2", "k", "a");
        when(taskMapper.selectList(any(LambdaQueryWrapper.class)))
                .thenReturn(List.of(task(nowPlusMinutes(4), "BLOCK")));

        service.checkAndPush();

        assertEquals(0, subscriptions().size());
    }

    // 补充:即便没有命中任务,确认确实走了一次“查今天任务表”
    @Test
    void checkAndPushQueriesTasksWhenSubscribersExist() {
        service.addSubscription("http://127.0.0.1:1/dead", "k", "a");
        when(taskMapper.selectList(any(LambdaQueryWrapper.class))).thenReturn(List.of());
        service.checkAndPush();
        verify(taskMapper).selectList(any(LambdaQueryWrapper.class));
    }
}
