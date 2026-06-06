package net.togogo.eclipseflowbackend.config;

import net.togogo.eclipseflowbackend.dto.ApiResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;

/**
 * 全局异常处理器。
 * 拦截所有 Controller 层未捕获的异常，返回统一的 { code, message } 结构，
 * 避免把堆栈跟踪直接返回给前端。
 */
@RestControllerAdvice
public class GlobalExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);

    /**
     * 参数校验失败（如 @RequestParam 缺失）
     */
    @ExceptionHandler(MissingServletRequestParameterException.class)
    public ResponseEntity<ApiResponse<Void>> handleMissingParam(MissingServletRequestParameterException e) {
        return ResponseEntity.badRequest()
                .body(ApiResponse.fail(400, "缺少必要参数: " + e.getParameterName()));
    }

    /**
     * 参数类型转换失败（如传了 "abc" 给 Long）
     */
    @ExceptionHandler(MethodArgumentTypeMismatchException.class)
    public ResponseEntity<ApiResponse<Void>> handleTypeMismatch(MethodArgumentTypeMismatchException e) {
        return ResponseEntity.badRequest()
                .body(ApiResponse.fail(400, "参数类型错误: " + e.getName()));
    }

    /**
     * JSON 请求体解析失败
     */
    @ExceptionHandler(HttpMessageNotReadableException.class)
    public ResponseEntity<ApiResponse<Void>> handleMalformedJson(HttpMessageNotReadableException e) {
        return ResponseEntity.badRequest()
                .body(ApiResponse.fail(400, "请求体格式错误，请检查 JSON"));
    }

    /**
     * 业务异常（各 Service 可以抛出 IllegalArgumentException 来表示参数不合法）
     */
    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<ApiResponse<Void>> handleIllegalArgument(IllegalArgumentException e) {
        return ResponseEntity.badRequest()
                .body(ApiResponse.fail(400, e.getMessage()));
    }

    /**
     * 兜底异常处理：记录日志，返回 500，不泄露堆栈
     */
    @ExceptionHandler(Exception.class)
    public ResponseEntity<ApiResponse<Void>> handleException(Exception e) {
        log.error("未处理的异常: {}", e.getMessage(), e);
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(ApiResponse.error("服务器内部错误，请稍后重试"));
    }
}
