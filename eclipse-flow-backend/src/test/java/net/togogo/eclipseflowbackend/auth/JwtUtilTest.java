package net.togogo.eclipseflowbackend.auth;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

/**
 * JwtUtil 单元测试：验证 token 生成、解析、验证、过期检测。
 */
class JwtUtilTest {

    private JwtUtil jwtUtil;

    @BeforeEach
    void setUp() {
        // 用固定密钥构造，保证测试可复现
        jwtUtil = new JwtUtil(
            "EclipseFlow-Test-Secret-Key-For-Unit-Tests-256bit!!",
            7
        );
    }

    @Test
    void shouldGenerateAndParseToken() {
        String token = jwtUtil.generateToken(42L, "testuser");

        assertNotNull(token);
        assertFalse(token.isEmpty());

        Long userId = jwtUtil.getUserId(token);
        assertEquals(42L, userId);
    }

    @Test
    void shouldValidateValidToken() {
        String token = jwtUtil.generateToken(1L, "alice");
        assertTrue(jwtUtil.validateToken(token));
    }

    @Test
    void shouldRejectInvalidToken() {
        assertFalse(jwtUtil.validateToken("this.is.not.a.valid.jwt.token"));
        assertFalse(jwtUtil.validateToken(""));
        assertFalse(jwtUtil.validateToken(null));
    }

    @Test
    void shouldRejectExpiredToken() {
        // 用 0 天过期时间构造，token 立即过期
        JwtUtil shortLivedJwt = new JwtUtil(
            "EclipseFlow-Test-Secret-Key-For-Unit-Tests-256bit!!",
            0 // 0 days → token expires immediately
        );
        String token = shortLivedJwt.generateToken(1L, "bob");
        assertFalse(shortLivedJwt.validateToken(token));
    }

    @Test
    void shouldRejectTamperedToken() {
        String token = jwtUtil.generateToken(100L, "eve");
        // 修改 token 最后一个字符
        String tampered = token.substring(0, token.length() - 1)
                + (token.charAt(token.length() - 1) == 'A' ? 'B' : 'A');
        assertFalse(jwtUtil.validateToken(tampered));
    }

    @Test
    void shouldRejectTokenSignedWithDifferentKey() {
        JwtUtil otherJwt = new JwtUtil(
            "Another-Different-Secret-Key-For-Testing-256!!",
            7
        );
        String token = otherJwt.generateToken(1L, "mallory");
        // 用当前 jwtUtil（不同密钥）验证，应该失败
        assertFalse(jwtUtil.validateToken(token));
    }
}
