package net.togogo.eclipseflowbackend.qa;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.fasterxml.jackson.databind.ObjectMapper;
import net.togogo.eclipseflowbackend.controller.TaskController;
import net.togogo.eclipseflowbackend.dto.TaskTimeUpdateDto;
import net.togogo.eclipseflowbackend.entity.Task;
import net.togogo.eclipseflowbackend.mapper.TaskMapper;
import net.togogo.eclipseflowbackend.service.TaskService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.MediaType;
import org.springframework.http.converter.json.MappingJackson2HttpMessageConverter;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.time.LocalDate;
import java.util.List;

import static org.hamcrest.Matchers.hasSize;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * TaskController(REST CRUD / 越权删除)单元测试 —— 对应简历 EclipseFlow
 * 『Spring Boot REST API 的 CRUD 接口功能验证』『无权限访问』。
 *
 * 用 MockMvc standalone + Mockito 隔离 Mapper/Service,验证路由、参数绑定、
 * 用户隔离(只能删自己的)、404/403 语义。
 */
@ExtendWith(MockitoExtension.class)
class TaskControllerTest {

    @Mock
    private TaskMapper taskMapper;

    @Mock
    private TaskService taskService;

    @InjectMocks
    private TaskController taskController;

    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        // 注册 JSR310(支持 LocalDate/LocalTime 的请求体反序列化)
        ObjectMapper om = new ObjectMapper().findAndRegisterModules();
        mockMvc = MockMvcBuilders
                .standaloneSetup(taskController)
                .setMessageConverters(new MappingJackson2HttpMessageConverter(om))
                .build();
    }

    private Task task(Long id, Long userId) {
        Task t = new Task();
        t.setId(id);
        t.setUserId(userId);
        t.setTaskName("任务" + id);
        t.setTaskDate(LocalDate.of(2026, 9, 1));
        return t;
    }

    // ===== GET /api/tasks/list =====

    @Test
    void listReturnsOnlyCurrentUsersTasks() throws Exception {
        when(taskMapper.selectList(any(LambdaQueryWrapper.class)))
                .thenReturn(List.of(task(1L, 5L), task(2L, 5L)));

        mockMvc.perform(get("/api/tasks/list").requestAttr("userId", 5L))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200))
                .andExpect(jsonPath("$.data", hasSize(2)));
    }

    // ===== POST /api/tasks/add =====

    @Test
    void addBindsCurrentUserToTask() throws Exception {
        when(taskService.save(any(Task.class))).thenReturn(true);

        mockMvc.perform(post("/api/tasks/add")
                        .requestAttr("userId", 5L)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"taskName\":\"写报告\",\"taskDate\":\"2026-09-01\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200))
                .andExpect(jsonPath("$.data.userId").value(5)); // 服务端强制绑定当前用户
    }

    @Test
    void addReportsErrorWhenSaveFails() throws Exception {
        when(taskService.save(any(Task.class))).thenReturn(false);

        mockMvc.perform(post("/api/tasks/add")
                        .requestAttr("userId", 1L)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"taskName\":\"x\",\"taskDate\":\"2026-09-01\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(500));
    }

    // ===== DELETE /api/tasks/delete/{id} =====

    @Test
    void deleteOwnTaskSucceeds() throws Exception {
        when(taskMapper.selectById(7L)).thenReturn(task(7L, 5L));
        when(taskService.removeById(7L)).thenReturn(true);

        mockMvc.perform(delete("/api/tasks/delete/7").requestAttr("userId", 5L))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200));
    }

    @Test
    void deleteOthersTaskReturns403() throws Exception {
        // 任务属于用户 99,当前登录用户是 5 —— 必须被拒
        when(taskMapper.selectById(7L)).thenReturn(task(7L, 99L));

        mockMvc.perform(delete("/api/tasks/delete/7").requestAttr("userId", 5L))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(403))
                .andExpect(jsonPath("$.message").value("无权删除他人任务"));
        verify(taskService, never()).removeById(7L);
    }

    @Test
    void deleteMissingTaskReturns404() throws Exception {
        when(taskMapper.selectById(999L)).thenReturn(null);

        mockMvc.perform(delete("/api/tasks/delete/999").requestAttr("userId", 5L))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(404));
        verify(taskService, never()).removeById(999L);
    }

    // ===== PUT /api/tasks/update-time =====

    @Test
    void updateTimeSuccessReturns200() throws Exception {
        when(taskService.updateTaskTime(any(TaskTimeUpdateDto.class))).thenReturn(true);

        mockMvc.perform(put("/api/tasks/update-time")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"id\":7,\"taskName\":\"改名\",\"startTime\":\"10:30\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200));
    }

    @Test
    void updateTimeFailureReturns400() throws Exception {
        when(taskService.updateTaskTime(any(TaskTimeUpdateDto.class))).thenReturn(false);

        mockMvc.perform(put("/api/tasks/update-time")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"id\":999,\"taskName\":\"不存在\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(400));
    }
}
