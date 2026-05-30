package net.togogo.eclipseflowbackend.auth;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.springframework.stereotype.Component;

import javax.crypto.SecretKey;
import java.util.Date;

/**
 * JWT 令牌工具：生成、解析、验证。
 * 密钥硬编码（开发用），生产环境应放配置文件或环境变量。
 */
@Component
public class JwtUtil {

    private static final String SECRET = "EclipseFlow-JWT-Secret-Key-2026-Must-Be-256-Bits-Long!!";
    private static final long EXPIRATION = 7 * 24 * 60 * 60 * 1000; // 7 天

    private final SecretKey key = Keys.hmacShaKeyFor(SECRET.getBytes());

    /**
     * 根据用户 ID 和用户名生成 JWT
     */
    public String generateToken(Long userId, String username) {
        return Jwts.builder()
                .subject(String.valueOf(userId))
                .claim("username", username)
                .issuedAt(new Date())
                .expiration(new Date(System.currentTimeMillis() + EXPIRATION))
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
