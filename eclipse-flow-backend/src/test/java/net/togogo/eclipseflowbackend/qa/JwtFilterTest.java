package net.togogo.eclipseflowbackend.qa;

import net.togogo.eclipseflowbackend.auth.JwtFilter;
import net.togogo.eclipseflowbackend.auth.JwtUtil;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.test.util.ReflectionTestUtils;

import jakarta.servlet.FilterChain;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * JwtFilter 鉴权边界测试 —— 对应简历 EclipseFlow『JWT 鉴权边界条件』。
 *
 * 简历已由 JwtUtilTest 覆盖“过期/篡改/换钥/非法 token”的密码学层;
 * 本类补上过滤器本身的路由逻辑(哪些路径放行、哪些强制鉴权、401 如何响应、
 * userId 是否正确写入 request attribute)。纯单测,不开 Spring。
 */
@ExtendWith(MockitoExtension.class)
class JwtFilterTest {

    @Mock
    private JwtUtil jwtUtil;

    private JwtFilter filter;

    @BeforeEach
    void setUp() {
        filter = new JwtFilter();
        ReflectionTestUtils.setField(filter, "jwtUtil", jwtUtil);
    }

    // ===== login / register 完全放行 =====

    @Test
    void loginAndRegisterAreFullyPassThrough() throws Exception {
        for (String path : new String[]{"/api/auth/login", "/api/auth/register"}) {
            MockHttpServletRequest req = new MockHttpServletRequest("POST", path);
            MockHttpServletResponse res = new MockHttpServletResponse();
            FilterChain chain = mock(FilterChain.class);

            filter.doFilter(req, res, chain);

            verify(chain).doFilter(req, res);
            assertEquals(200, res.getStatus());
        }
        // 全程不该校验任何 token
        verify(jwtUtil, never()).validateToken(org.mockito.ArgumentMatchers.anyString());
    }

    // ===== /api/auth/* 软解析:没有 token 也放行 =====

    @Test
    void authProfilePassesThroughWithoutToken() throws Exception {
        MockHttpServletRequest req = new MockHttpServletRequest("GET", "/api/auth/profile");
        MockHttpServletResponse res = new MockHttpServletResponse();
        FilterChain chain = mock(FilterChain.class);

        filter.doFilter(req, res, chain);

        verify(chain).doFilter(req, res);
        assertNull(req.getAttribute("userId"));
        verify(jwtUtil, never()).validateToken(org.mockito.ArgumentMatchers.anyString());
    }

    @Test
    void authProfileWritesUserIdWhenValidTokenProvided() throws Exception {
        when(jwtUtil.validateToken("good")).thenReturn(true);
        when(jwtUtil.getUserId("good")).thenReturn(88L);

        MockHttpServletRequest req = new MockHttpServletRequest("GET", "/api/auth/profile");
        req.addHeader("Authorization", "Bearer good");
        MockHttpServletResponse res = new MockHttpServletResponse();
        FilterChain chain = mock(FilterChain.class);

        filter.doFilter(req, res, chain);

        verify(chain).doFilter(req, res);
        assertEquals(88L, req.getAttribute("userId"));
    }

    // ===== 非 API 路径放行 =====

    @Test
    void nonApiPathIsPassThrough() throws Exception {
        MockHttpServletRequest req = new MockHttpServletRequest("GET", "/favicon.ico");
        MockHttpServletResponse res = new MockHttpServletResponse();
        FilterChain chain = mock(FilterChain.class);

        filter.doFilter(req, res, chain);

        verify(chain).doFilter(req, res);
    }

    // ===== /api/** 强制鉴权 =====

    @Test
    void protectedApiWithoutTokenReturns401() throws Exception {
        MockHttpServletRequest req = new MockHttpServletRequest("GET", "/api/tasks/list");
        MockHttpServletResponse res = new MockHttpServletResponse();
        FilterChain chain = mock(FilterChain.class);

        filter.doFilter(req, res, chain);

        assertEquals(401, res.getStatus());
        verify(chain, never()).doFilter(req, res);
        assertTrue(res.getContentAsString().contains("401"));
    }

    @Test
    void protectedApiWithInvalidTokenReturns401() throws Exception {
        when(jwtUtil.validateToken("tampered")).thenReturn(false);

        MockHttpServletRequest req = new MockHttpServletRequest("GET", "/api/tasks/list");
        req.addHeader("Authorization", "Bearer tampered");
        MockHttpServletResponse res = new MockHttpServletResponse();
        FilterChain chain = mock(FilterChain.class);

        filter.doFilter(req, res, chain);

        assertEquals(401, res.getStatus());
        verify(chain, never()).doFilter(req, res);
    }

    @Test
    void protectedApiWithValidTokenPassesAndSetsUserId() throws Exception {
        when(jwtUtil.validateToken("valid-token")).thenReturn(true);
        when(jwtUtil.getUserId("valid-token")).thenReturn(42L);

        MockHttpServletRequest req = new MockHttpServletRequest("GET", "/api/tasks/list");
        req.addHeader("Authorization", "Bearer valid-token");
        MockHttpServletResponse res = new MockHttpServletResponse();
        FilterChain chain = mock(FilterChain.class);

        filter.doFilter(req, res, chain);

        verify(chain).doFilter(req, res);
        assertEquals(42L, req.getAttribute("userId"));
        assertEquals(200, res.getStatus());
    }
}
