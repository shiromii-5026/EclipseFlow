package net.togogo.eclipseflowbackend.auth;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/**
 * 登录/注册接口。
 * 密码用 BCrypt 加密存储，登录成功返回 JWT。
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

    /**
     * 注册
     */
    @PostMapping("/register")
    public ResponseEntity<?> register(@RequestBody Map<String, String> body) {
        String username = body.get("username");
        String password = body.get("password");
        if (username == null || password == null || username.trim().isEmpty() || password.trim().isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("error", "用户名和密码不能为空"));
        }

        // 检查是否已存在
        User existing = userMapper.selectOne(new LambdaQueryWrapper<User>().eq(User::getUsername, username));
        if (existing != null) {
            return ResponseEntity.badRequest().body(Map.of("error", "用户名已存在"));
        }

        User user = new User();
        user.setUsername(username);
        user.setPassword(encoder.encode(password));
        userMapper.insert(user);

        String token = jwtUtil.generateToken(user.getId(), user.getUsername());
        return ResponseEntity.ok(Map.of("token", token, "username", username));
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
}
