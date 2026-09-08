package net.togogo.eclipseflowbackend.auth;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;

import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

/**
 * AuthController 单元测试。
 * 用 Mockito 隔离 UserMapper 和 JwtUtil，验证注册/登录逻辑。
 */
@ExtendWith(MockitoExtension.class)
class AuthControllerTest {

    @Mock
    private UserMapper userMapper;

    @Mock
    private JwtUtil jwtUtil;

    @InjectMocks
    private AuthController authController;

    @BeforeEach
    void setUp() {
        // @InjectMocks 自动注入 mock 的依赖
    }

    // ===== 注册 =====

    @Test
    void registerShouldRejectNullUsername() {
        ResponseEntity<?> resp = authController.register(Map.of("password", "123456"));
        assertEquals(HttpStatus.BAD_REQUEST, resp.getStatusCode());
    }

    @Test
    void registerShouldRejectNullPassword() {
        ResponseEntity<?> resp = authController.register(Map.of("username", "test"));
        assertEquals(HttpStatus.BAD_REQUEST, resp.getStatusCode());
    }

    @Test
    void registerShouldRejectEmptyUsername() {
        ResponseEntity<?> resp = authController.register(Map.of("username", "  ", "password", "123456"));
        assertEquals(HttpStatus.BAD_REQUEST, resp.getStatusCode());
    }

    @Test
    void registerShouldRejectEmptyPassword() {
        ResponseEntity<?> resp = authController.register(Map.of("username", "test", "password", ""));
        assertEquals(HttpStatus.BAD_REQUEST, resp.getStatusCode());
    }

    @Test
    void registerSurvivesNameCollisionByAppendingUniqueSuffix() {
        // 现状:register 会先拼 #xxxx 后缀再查重;若仍撞名就换后缀重试,
        // 而不是直接返回 400。所以这里验证“撞名也能注册成功,用户名带唯一后缀”。
        User existing = new User();
        existing.setId(1L);
        existing.setUsername("new#0000");
        // 第一次查(第一个随机后缀)撞名,第二次换后缀查到 null → 唯一
        when(userMapper.selectOne(any(LambdaQueryWrapper.class))).thenReturn(existing, null);
        when(userMapper.insert(any(User.class))).thenAnswer(inv -> {
            User u = inv.getArgument(0);
            u.setId(99L);
            return 1;
        });
        when(jwtUtil.generateToken(anyLong(), anyString())).thenReturn("fake-jwt-token");

        ResponseEntity<?> resp = authController.register(Map.of("username", "new", "password", "123456"));
        assertEquals(HttpStatus.OK, resp.getStatusCode());

        @SuppressWarnings("unchecked")
        Map<String, Object> body = (Map<String, Object>) resp.getBody();
        assertNotNull(body);
        assertEquals("fake-jwt-token", body.get("token"));
        String username = (String) body.get("username");
        assertNotNull(username);
        assertTrue(username.startsWith("new#"), "撞名时应追加 #xxxx 唯一后缀,实际=" + username);
        assertNotEquals("new", username);
    }

    @Test
    void registerShouldSucceedForNewUser() {
        when(userMapper.selectOne(any(LambdaQueryWrapper.class))).thenReturn(null);
        when(jwtUtil.generateToken(anyLong(), anyString())).thenReturn("fake-jwt-token");

        // 模拟 MyBatis-Plus insert 后的 ID 回填行为：
        // insert(user) 执行后，user.setId() 被 MyBatis-Plus 调用
        when(userMapper.insert(any(User.class))).thenAnswer(inv -> {
            User u = inv.getArgument(0);
            u.setId(99L); // 模拟数据库自增 ID 回填
            return 1;
        });

        ResponseEntity<?> resp = authController.register(Map.of("username", "newuser", "password", "123456"));
        assertEquals(HttpStatus.OK, resp.getStatusCode());

        @SuppressWarnings("unchecked")
        Map<String, Object> body = (Map<String, Object>) resp.getBody();
        assertNotNull(body);
        assertEquals("fake-jwt-token", body.get("token"));
        // 现状:用户名会自动追加 #xxxx 随机后缀避免冲突
        String username = (String) body.get("username");
        assertTrue(username.startsWith("newuser#"), "用户名应带唯一后缀,实际=" + username);
    }

    // ===== 登录 =====

    @Test
    void loginShouldRejectWrongPassword() {
        User user = new User();
        user.setId(1L);
        user.setUsername("alice");
        user.setPassword(new BCryptPasswordEncoder().encode("correct"));
        when(userMapper.selectOne(any(LambdaQueryWrapper.class))).thenReturn(user);

        ResponseEntity<?> resp = authController.login(Map.of("username", "alice", "password", "wrong"));
        assertEquals(HttpStatus.UNAUTHORIZED, resp.getStatusCode());
    }

    @Test
    void loginShouldRejectNonexistentUser() {
        when(userMapper.selectOne(any(LambdaQueryWrapper.class))).thenReturn(null);

        ResponseEntity<?> resp = authController.login(Map.of("username", "ghost", "password", "123456"));
        assertEquals(HttpStatus.UNAUTHORIZED, resp.getStatusCode());
    }

    @Test
    void loginShouldReturnTokenForValidCredentials() {
        String rawPassword = "mypassword";
        User user = new User();
        user.setId(42L);
        user.setUsername("bob");
        user.setPassword(new BCryptPasswordEncoder().encode(rawPassword));
        when(userMapper.selectOne(any(LambdaQueryWrapper.class))).thenReturn(user);
        when(jwtUtil.generateToken(42L, "bob")).thenReturn("jwt-for-bob");

        ResponseEntity<?> resp = authController.login(Map.of("username", "bob", "password", rawPassword));
        assertEquals(HttpStatus.OK, resp.getStatusCode());

        @SuppressWarnings("unchecked")
        Map<String, Object> body = (Map<String, Object>) resp.getBody();
        assertNotNull(body);
        assertEquals("jwt-for-bob", body.get("token"));
    }
}
