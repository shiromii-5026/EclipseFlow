package net.togogo.eclipseflowbackend.auth;

import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import net.togogo.eclipseflowbackend.dto.ApiResponse;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.Map;

/**
 * JWT 过滤器：从请求头 Authorization: Bearer xxx 中提取 token，
 * 解析出用户 ID 并存入 request attribute，供 Controller 使用。
 * <p>
 * 保护所有 /api/** 路径（/api/auth/** 除外），
 * 无有效 token 时返回 401 而非静默放行。
 */
@Component
public class JwtFilter extends OncePerRequestFilter {

    @Autowired
    private JwtUtil jwtUtil;

    private final ObjectMapper objectMapper = new ObjectMapper();

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {

        String path = request.getRequestURI();

        // 登录和注册不需要 token，但 profile 需要
        if (path.equals("/api/auth/login") || path.equals("/api/auth/register")) {
            chain.doFilter(request, response);
            return;
        }

        // /api/auth/profile 和 /api/social 等需要 token
        if (path.startsWith("/api/auth/profile")) {
            String header = request.getHeader("Authorization");
            if (header != null && header.startsWith("Bearer ")) {
                String token = header.substring(7);
                if (jwtUtil.validateToken(token)) {
                    request.setAttribute("userId", jwtUtil.getUserId(token));
                }
            }
            chain.doFilter(request, response);
            return;
        }

        // 非 API 路径放行（静态资源等）
        if (!path.startsWith("/api/")) {
            chain.doFilter(request, response);
            return;
        }

        // 所有 /api/** 路径（除 /api/auth/**）都需要 JWT 认证
        String header = request.getHeader("Authorization");
        if (header != null && header.startsWith("Bearer ")) {
            String token = header.substring(7);
            if (jwtUtil.validateToken(token)) {
                Long userId = jwtUtil.getUserId(token);
                request.setAttribute("userId", userId);
                chain.doFilter(request, response);
                return;
            }
        }

        // 无 token 或 token 无效 → 401
        response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        response.setCharacterEncoding(StandardCharsets.UTF_8.name());
        objectMapper.writeValue(response.getWriter(),
                ApiResponse.fail(401, "未登录或登录已过期，请重新登录"));
    }
}
