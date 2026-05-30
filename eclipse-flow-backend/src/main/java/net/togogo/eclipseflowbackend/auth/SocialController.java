package net.togogo.eclipseflowbackend.auth;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import net.togogo.eclipseflowbackend.entity.Task;
import net.togogo.eclipseflowbackend.mapper.TaskMapper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import jakarta.servlet.http.HttpServletRequest;
import java.util.*;
import java.util.stream.Collectors;

/**
 * 好友系统 + 私聊 + 共享日历
 */
@RestController
@RequestMapping("/api/social")
@CrossOrigin(origins = "*")
public class SocialController {

    @Autowired private UserMapper userMapper;
    @Autowired private FriendMapper friendMapper;
    @Autowired private MessageMapper messageMapper;
    @Autowired private TaskMapper taskMapper;

    private Long getUserId(HttpServletRequest req) {
        Object uid = req.getAttribute("userId");
        return uid != null ? (Long) uid : 1L;
    }

    // ===== 好友管理 =====

    /** 搜索用户（按用户名模糊匹配） */
    @GetMapping("/search")
    public List<Map<String, Object>> searchUsers(@RequestParam String q, HttpServletRequest req) {
        Long me = getUserId(req);
        return userMapper.selectList(
            new LambdaQueryWrapper<User>().like(User::getUsername, q)
        ).stream().filter(u -> !u.getId().equals(me)).map(u -> {
            Map<String, Object> m = new HashMap<>();
            m.put("id", u.getId());
            m.put("username", u.getUsername());
            return m;
        }).collect(Collectors.toList());
    }

    /** 发送好友申请 */
    @PostMapping("/add-friend")
    public ResponseEntity<?> addFriend(@RequestBody Map<String, Long> body, HttpServletRequest req) {
        Long me = getUserId(req);
        Long friendId = body.get("friendId");
        if (friendId == null || friendId.equals(me)) return ResponseEntity.badRequest().body("invalid");

        Friend existing = friendMapper.selectOne(
            new LambdaQueryWrapper<Friend>().eq(Friend::getUserId, me).eq(Friend::getFriendId, friendId)
        );
        if (existing != null) return ResponseEntity.ok(Map.of("status", existing.getStatus()));

        Friend f = new Friend();
        f.setUserId(me); f.setFriendId(friendId); f.setStatus("pending");
        friendMapper.insert(f);
        return ResponseEntity.ok(Map.of("status", "pending"));
    }

    /** 好友列表 */
    @GetMapping("/friends")
    public List<Map<String, Object>> getFriends(HttpServletRequest req) {
        Long me = getUserId(req);
        List<Friend> list = friendMapper.selectList(
            new LambdaQueryWrapper<Friend>().eq(Friend::getUserId, me).eq(Friend::getStatus, "accepted")
        );
        return list.stream().map(f -> {
            User u = userMapper.selectById(f.getFriendId());
            Map<String, Object> m = new HashMap<>();
            m.put("id", u.getId());
            m.put("username", u.getUsername());
            m.put("calendarPublic", u.getCalendarPublic() != null && u.getCalendarPublic() == 1);
            return m;
        }).collect(Collectors.toList());
    }

    /** 待处理的好友申请（别人发给我的） */
    @GetMapping("/requests")
    public List<Map<String, Object>> getRequests(HttpServletRequest req) {
        Long me = getUserId(req);
        List<Friend> list = friendMapper.selectList(
            new LambdaQueryWrapper<Friend>().eq(Friend::getFriendId, me).eq(Friend::getStatus, "pending")
        );
        return list.stream().map(f -> {
            User u = userMapper.selectById(f.getUserId());
            Map<String, Object> m = new HashMap<>();
            m.put("id", f.getId());
            m.put("username", u.getUsername());
            return m;
        }).collect(Collectors.toList());
    }

    /** 接受好友申请 */
    @PostMapping("/accept")
    public ResponseEntity<?> accept(@RequestBody Map<String, Long> body, HttpServletRequest req) {
        Long requestId = body.get("requestId");
        Friend f = friendMapper.selectById(requestId);
        if (f == null) return ResponseEntity.notFound().build();
        f.setStatus("accepted");
        friendMapper.updateById(f);
        // 双向添加
        Friend reverse = friendMapper.selectOne(
            new LambdaQueryWrapper<Friend>().eq(Friend::getUserId, f.getFriendId()).eq(Friend::getFriendId, f.getUserId())
        );
        if (reverse == null) {
            reverse = new Friend();
            reverse.setUserId(f.getFriendId()); reverse.setFriendId(f.getUserId()); reverse.setStatus("accepted");
            friendMapper.insert(reverse);
        } else { reverse.setStatus("accepted"); friendMapper.updateById(reverse); }
        return ResponseEntity.ok(Map.of("status", "accepted"));
    }

    /** 切换日历公开 */
    @PostMapping("/toggle-calendar")
    public ResponseEntity<?> toggleCalendar(HttpServletRequest req) {
        Long me = getUserId(req);
        User u = userMapper.selectById(me);
        u.setCalendarPublic(u.getCalendarPublic() == null || u.getCalendarPublic() == 0 ? 1 : 0);
        userMapper.updateById(u);
        return ResponseEntity.ok(Map.of("calendarPublic", u.getCalendarPublic() == 1));
    }

    /** 查看好友日历 */
    @GetMapping("/friend-calendar/{friendId}")
    public List<Task> friendCalendar(@PathVariable Long friendId, HttpServletRequest req) {
        User friend = userMapper.selectById(friendId);
        if (friend == null || friend.getCalendarPublic() == null || friend.getCalendarPublic() == 0) {
            return Collections.emptyList();
        }
        return taskMapper.selectList(
            new LambdaQueryWrapper<Task>().eq(Task::getUserId, friendId)
        );
    }

    // ===== 私聊 =====

    /** 发送消息 */
    @PostMapping("/send")
    public ResponseEntity<?> sendMessage(@RequestBody Map<String, Object> body, HttpServletRequest req) {
        Long me = getUserId(req);
        Long to = Long.valueOf(body.get("receiverId").toString());
        String content = (String) body.get("content");
        Message msg = new Message();
        msg.setSenderId(me); msg.setReceiverId(to); msg.setContent(content);
        messageMapper.insert(msg);
        return ResponseEntity.ok(Map.of("status", "sent"));
    }

    /** 获取和某人的聊天记录 */
    @GetMapping("/messages/{friendId}")
    public List<Map<String, Object>> getMessages(@PathVariable Long friendId, HttpServletRequest req) {
        Long me = getUserId(req);
        List<Message> msgs = messageMapper.selectList(
            new LambdaQueryWrapper<Message>()
                .and(w -> w.eq(Message::getSenderId, me).eq(Message::getReceiverId, friendId)
                         .or(o -> o.eq(Message::getSenderId, friendId).eq(Message::getReceiverId, me)))
                .orderByAsc(Message::getCreatedAt)
        );
        return msgs.stream().map(m -> {
            Map<String, Object> mp = new HashMap<>();
            mp.put("id", m.getId());
            mp.put("senderId", m.getSenderId());
            mp.put("content", m.getContent());
            mp.put("time", m.getCreatedAt() != null ? m.getCreatedAt().toString() : "");
            mp.put("mine", m.getSenderId().equals(me));
            return mp;
        }).collect(Collectors.toList());
    }
}
