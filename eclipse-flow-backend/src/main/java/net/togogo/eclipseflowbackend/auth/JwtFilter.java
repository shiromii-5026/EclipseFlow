package net.togogo.eclipseflowbackend.auth;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;

/**
 * JWT 过滤器：从请求头 Authorization: Bearer xxx 中提取 token，
 * 解析出用户 ID 并存入 request attribute，供 Controller 使用。
 */
@Component
public class JwtFilter extends OncePerRequestFilter {

    @Autowired
    private JwtUtil jwtUtil;

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {

        String path = request.getRequestURI();

        // 登录和注册不需要 token
        if (path.startsWith("/api/auth/")) {
            chain.doFilter(request, response);
            return;
        }

        // 只有 /api/tasks 和 /api/push 需要认证
        if (!path.startsWith("/api/tasks") && !path.startsWith("/api/push")) {
            chain.doFilter(request, response);
            return;
        }

        String header = request.getHeader("Authorization");
        if (header != null && header.startsWith("Bearer ")) {
            String token = header.substring(7);
            if (jwtUtil.validateToken(token)) {
                Long userId = jwtUtil.getUserId(token);
                request.setAttribute("userId", userId);
            }
        }
        // 即使没有 token 也放行，Controller 里判断 userId 做权限控制

        chain.doFilter(request, response);
    }
}
