package net.togogo.eclipseflowbackend.auth;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.web.bind.annotation.*;

import jakarta.servlet.http.HttpServletRequest;
import java.util.Map;
import java.util.Random;

/**
 * 登录/注册/个人资料接口。
 * 注册时自动给用户名追加 #xxxx 后缀避免重复。
 */
@RestController
@RequestMapping("/api/auth")
@CrossOrigin(origins = "*")
public class AuthController {

    @Autowired
    private UserMapper userMapper;

    @Autowired
    private JwtUtil jwtUtil;

    private final BCryptPasswordEncoder encoder = new BCryptPasswordEncoder();
    private final Random random = new Random();

    /**
     * 注册 —— 用户名自动追加 #xxxx 随机后缀，避免冲突
     */
    @PostMapping("/register")
    public ResponseEntity<?> register(@RequestBody Map<String, String> body) {
        String username = body.get("username");
        String password = body.get("password");
        if (username == null || password == null || username.trim().isEmpty() || password.trim().isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("error", "用户名和密码不能为空"));
        }

        // 自动追加 #xxxx 后缀保证唯一
        String suffix = String.format("#%04d", random.nextInt(10000));
        String finalName = username.trim() + suffix;

        // 检查是否已存在（概率极低，但兜底）
        User existing = userMapper.selectOne(new LambdaQueryWrapper<User>().eq(User::getUsername, finalName));
        if (existing != null) {
            // 重新生成后缀
            for (int i = 0; i < 10; i++) {
                suffix = String.format("#%04d", random.nextInt(10000));
                finalName = username.trim() + suffix;
                if (userMapper.selectOne(new LambdaQueryWrapper<User>().eq(User::getUsername, finalName)) == null) break;
            }
        }

        User user = new User();
        user.setUsername(finalName);
        user.setPassword(encoder.encode(password));
        user.setAvatarPath(null);
        userMapper.insert(user);

        String token = jwtUtil.generateToken(user.getId(), user.getUsername());
        return ResponseEntity.ok(Map.of("token", token, "username", finalName));
    }

    /**
     * 登录
     */
    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody Map<String, String> body) {
        String username = body.get("username");
        String password = body.get("password");

        User user = userMapper.selectOne(new LambdaQueryWrapper<User>().eq(User::getUsername, username));
        if (user == null || !encoder.matches(password, user.getPassword())) {
            return ResponseEntity.status(401).body(Map.of("error", "用户名或密码错误"));
        }

        String token = jwtUtil.generateToken(user.getId(), user.getUsername());
        return ResponseEntity.ok(Map.of("token", token, "username", username));
    }

    /**
     * 获取当前用户资料
     */
    @GetMapping("/profile")
    public ResponseEntity<?> getProfile(HttpServletRequest request) {
        Long userId = (Long) request.getAttribute("userId");
        if (userId == null) return ResponseEntity.status(401).body(Map.of("error", "未登录"));

        User user = userMapper.selectById(userId);
        if (user == null) return ResponseEntity.notFound().build();

        return ResponseEntity.ok(Map.of(
            "id", user.getId(),
            "username", user.getUsername(),
            "avatarPath", user.getAvatarPath() != null ? user.getAvatarPath() : ""
        ));
    }

    /**
     * 更新个人资料（用户名、头像 seed）
     */
    @PutMapping("/profile")
    public ResponseEntity<?> updateProfile(@RequestBody Map<String, String> body, HttpServletRequest request) {
        Long userId = (Long) request.getAttribute("userId");
        System.out.println("[updateProfile] 收到请求, userId=" + userId + ", body=" + body);
        if (userId == null) return ResponseEntity.status(401).body(Map.of("error", "未登录"));

        User user = userMapper.selectById(userId);
        if (user == null) return ResponseEntity.notFound().build();

        String newUsername = body.get("username");

        if (newUsername != null && !newUsername.trim().isEmpty()) {
            String oldSuffix = "";
            String currentName = user.getUsername();
            int hashIdx = currentName.lastIndexOf('#');
            if (hashIdx >= 0) {
                oldSuffix = currentName.substring(hashIdx);
            }
            String finalName = newUsername.trim() + oldSuffix;
            if (!finalName.equals(currentName)) {
                User conflict = userMapper.selectOne(new LambdaQueryWrapper<User>().eq(User::getUsername, finalName));
                if (conflict != null && !conflict.getId().equals(userId)) {
                    return ResponseEntity.badRequest().body(Map.of("error", "用户名已被占用"));
                }
                user.setUsername(finalName);
            }
        }

        userMapper.updateById(user);
        return ResponseEntity.ok(Map.of(
            "username", user.getUsername(),
            "avatarPath", user.getAvatarPath() != null ? user.getAvatarPath() : ""
        ));
    }

    /**
     * 上传头像图片
     */
    @PostMapping("/avatar")
    public ResponseEntity<?> uploadAvatar(@RequestBody Map<String, String> body, HttpServletRequest request) {
        Long userId = (Long) request.getAttribute("userId");
        System.out.println("[uploadAvatar] 收到请求, userId=" + userId + ", image数据长度=" + (body.get("image") != null ? body.get("image").length() : 0));
        if (userId == null) return ResponseEntity.status(401).body(Map.of("error", "未登录"));

        String base64 = body.get("image");
        if (base64 == null || base64.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("error", "缺少图片数据"));
        }

        // 去掉 data:image/...;base64, 前缀
        String prefix = "base64,";
        int idx = base64.indexOf(prefix);
        if (idx >= 0) {
            base64 = base64.substring(idx + prefix.length());
        }

        try {
            byte[] bytes = java.util.Base64.getDecoder().decode(base64);
            String filename = "avatar_" + userId + ".png";
            java.io.File dir = new java.io.File("uploads/avatars");
            if (!dir.exists()) dir.mkdirs();
            java.io.FileOutputStream fos = new java.io.FileOutputStream(new java.io.File(dir, filename));
            fos.write(bytes);
            fos.close();

            User user = userMapper.selectById(userId);
            user.setAvatarPath("/uploads/avatars/" + filename);
            userMapper.updateById(user);

            return ResponseEntity.ok(Map.of("avatarPath", user.getAvatarPath()));
        } catch (Exception e) {
            return ResponseEntity.status(500).body(Map.of("error", "图片保存失败"));
        }
    }
}
