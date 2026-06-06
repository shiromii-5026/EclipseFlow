package net.togogo.eclipseflowbackend.auth;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.crypto.SecretKey;
import java.util.Date;

/**
 * JWT 令牌工具：生成、解析、验证。
 * 密钥从配置文件读取，生产环境通过环境变量 JWT_SECRET 覆盖。
 */
@Component
public class JwtUtil {

    private final SecretKey key;
    private final long expirationMs;

    /**
     * 构造函数注入密钥和过期时间，支持环境变量覆盖。
     */
    public JwtUtil(
            @Value("${eclipse-flow.jwt.secret}") String secret,
            @Value("${eclipse-flow.jwt.expiration-days:7}") int expirationDays) {
        this.key = Keys.hmacShaKeyFor(secret.getBytes());
        this.expirationMs = (long) expirationDays * 24 * 60 * 60 * 1000;
    }

    /**
     * 根据用户 ID 和用户名生成 JWT
     */
    public String generateToken(Long userId, String username) {
        return Jwts.builder()
                .subject(String.valueOf(userId))
                .claim("username", username)
                .issuedAt(new Date())
                .expiration(new Date(System.currentTimeMillis() + expirationMs))
                .signWith(key)
                .compact();
    }

    /**
     * 从 token 中提取用户 ID
     */
    public Long getUserId(String token) {
        Claims claims = parseToken(token);
        return Long.parseLong(claims.getSubject());
    }

    /**
     * 验证 token 是否有效
     */
    public boolean validateToken(String token) {
        try {
            parseToken(token);
            return true;
        } catch (Exception e) {
            return false;
        }
    }

    private Claims parseToken(String token) {
        return Jwts.parser().verifyWith(key).build().parseSignedClaims(token).getPayload();
    }
}
