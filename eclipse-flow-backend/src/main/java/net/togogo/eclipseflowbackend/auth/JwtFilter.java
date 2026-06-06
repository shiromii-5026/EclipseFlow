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

/**
 * JWT 过滤器：从请求头 Authorization: Bearer xxx 中提取 token，
 * 解析出用户 ID 并存入 request attribute，供 Controller 使用。
 * <p>
 * /api/auth/login 和 /api/auth/register 完全放行，
 * /api/auth/* 其他路径提取 token（但不强制要求），
 * 其他 /api/** 路径必须有有效 token。
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

        // 登录和注册完全放行
        if (path.equals("/api/auth/login") || path.equals("/api/auth/register")) {
            chain.doFilter(request, response);
            return;
        }

        // /api/auth/* 其他路径（profile, avatar）：尝试解析 token，不强制
        if (path.startsWith("/api/auth/")) {
            parseToken(request);
            chain.doFilter(request, response);
            return;
        }

        // 非 API 路径放行
        if (!path.startsWith("/api/")) {
            chain.doFilter(request, response);
            return;
        }

        // 其他 /api/** 路径必须有有效 token
        String header = request.getHeader("Authorization");
        if (header != null && header.startsWith("Bearer ")) {
            String token = header.substring(7);
            if (jwtUtil.validateToken(token)) {
                request.setAttribute("userId", jwtUtil.getUserId(token));
                chain.doFilter(request, response);
                return;
            }
        }

        // 无有效 token → 401
        response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        response.setCharacterEncoding(StandardCharsets.UTF_8.name());
        objectMapper.writeValue(response.getWriter(),
                ApiResponse.fail(401, "未登录或登录已过期，请重新登录"));
    }

    private void parseToken(HttpServletRequest request) {
        String header = request.getHeader("Authorization");
        if (header != null && header.startsWith("Bearer ")) {
            String token = header.substring(7);
            if (jwtUtil.validateToken(token)) {
                request.setAttribute("userId", jwtUtil.getUserId(token));
            }
        }
    }
}
