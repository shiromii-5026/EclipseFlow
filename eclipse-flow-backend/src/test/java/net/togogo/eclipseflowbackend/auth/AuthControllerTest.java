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
    void registerShouldRejectDuplicateUser() {
        // mock 数据库里有同名用户
        User existing = new User();
        existing.setId(1L);
        existing.setUsername("existing");
        when(userMapper.selectOne(any(LambdaQueryWrapper.class))).thenReturn(existing);

        ResponseEntity<?> resp = authController.register(Map.of("username", "existing", "password", "123456"));
        assertEquals(HttpStatus.BAD_REQUEST, resp.getStatusCode());
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
        assertEquals("newuser", body.get("username"));
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
