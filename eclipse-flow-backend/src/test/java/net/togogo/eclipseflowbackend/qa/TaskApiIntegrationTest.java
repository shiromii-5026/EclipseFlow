package net.togogo.eclipseflowbackend.qa;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import net.togogo.eclipseflowbackend.entity.Task;
import net.togogo.eclipseflowbackend.mapper.TaskMapper;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalTime;

import static org.hamcrest.Matchers.hasSize;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Task REST 全链路集成测试 —— 对应简历 EclipseFlow 三条 claim 串起来:
 *   『REST API CRUD 功能验证』 + 『JWT 鉴权边界(无权限访问/非法 token)』
 *   + 『部分更新不覆盖未修改数据』。
 *
 * 用 @SpringBootTest + @AutoConfigureMockMvc 走真实 Spring 容器 + Security 过滤器链,
 * 连本机 MySQL;每个用例 @Transactional 回滚不污染数据。
 * MySQL 不可达时整类跳过(见 MySqlUpCondition)。
 */
@SpringBootTest
@AutoConfigureMockMvc
@Transactional
@ExtendWith(MySqlUpCondition.class)
class TaskApiIntegrationTest {

    @Autowired
    private MockMvc mvc;

    @Autowired
    private ObjectMapper om;

    @Autowired
    private TaskMapper taskMapper;

    private static long seq = 0;

    private String registerAndGetToken(String baseName) throws Exception {
        String username = baseName + "-" + System.nanoTime() + "-" + (seq++);
        MvcResult result = mvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"username\":\"" + username + "\",\"password\":\"pwd123\"}"))
                .andExpect(status().isOk())
                .andReturn();
        JsonNode body = om.readTree(result.getResponse().getContentAsString());
        return body.get("token").asText();
    }

    private long addTask(String token, String taskName, String date, String startTime,
                         double duration, String color, String notes, String taskType)
            throws Exception {
        // Task.startTime 的 @JsonFormat 是 HH:mm:ss,前端会传完整秒;这里统一兜底
        if (startTime != null && startTime.length() == 5) {
            startTime = startTime + ":00";
        }
        String body = String.format(
                "{\"taskName\":\"%s\",\"taskDate\":\"%s\",\"startTime\":\"%s\","
                        + "\"duration\":%s,\"color\":\"%s\",\"notes\":\"%s\",\"taskType\":\"%s\"}",
                taskName, date, startTime, duration, color, notes, taskType);
        MvcResult result = mvc.perform(post("/api/tasks/add")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200))
                .andReturn();
        JsonNode resp = om.readTree(result.getResponse().getContentAsString());
        long id = resp.path("data").path("id").asLong();
        if (id <= 0) {
            throw new IllegalStateException("新增任务未返回 id: " + result.getResponse().getContentAsString());
        }
        return id;
    }

    // ===== 鉴权边界:没有 / 非法 token =====

    @Test
    void tasksListWithoutTokenReturns401() throws Exception {
        mvc.perform(get("/api/tasks/list"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value(401));
    }

    @Test
    void tasksListWithTamperedTokenReturns401() throws Exception {
        mvc.perform(get("/api/tasks/list").header("Authorization", "Bearer not-a-real-token"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value(401));
    }

    // ===== CRUD + 越权:新用户数据隔离 / 删他人任务 403 / 删自己成功 =====

    @Test
    void crudFlowEnforcesOwnership() throws Exception {
        String tokenA = registerAndGetToken("alice");

        // 新用户任务列表应为空
        mvc.perform(get("/api/tasks/list").header("Authorization", "Bearer " + tokenA))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200))
                .andExpect(jsonPath("$.data", hasSize(0)));

        // A 建一个任务
        long taskId = addTask(tokenA, "早八高数", "2026-09-08", "08:30", 1.5, "#fff", "教室A", "BLOCK");

        mvc.perform(get("/api/tasks/list").header("Authorization", "Bearer " + tokenA))
                .andExpect(jsonPath("$.data", hasSize(1)))
                .andExpect(jsonPath("$.data[0].id").value(taskId));

        // B 登录,尝试删 A 的任务 → 403(无权访问)
        String tokenB = registerAndGetToken("bob");
        mvc.perform(delete("/api/tasks/delete/" + taskId).header("Authorization", "Bearer " + tokenB))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(403));

        // A 删自己的 → 成功
        mvc.perform(delete("/api/tasks/delete/" + taskId).header("Authorization", "Bearer " + tokenA))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200));

        // 数据库里确实没了
        assertEquals(null, taskMapper.selectById(taskId));
    }

    @Test
    void deleteMissingTaskReturns404ThroughApi() throws Exception {
        String tokenA = registerAndGetToken("carol");
        mvc.perform(delete("/api/tasks/delete/987654321").header("Authorization", "Bearer " + tokenA))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(404));
    }

    // ===== 部分更新不覆盖未修改字段(走真实 HTTP + 真 SQL)=====

    @Test
    void updateTimeViaApiPreservesUntouchedFields() throws Exception {
        String token = registerAndGetToken("dave");
        long taskId = addTask(token, "原始课名", "2026-09-10", "14:30", 2.0, "#123456", "原始备注", "BLOCK");

        // 只改名字和开始时间
        mvc.perform(put("/api/tasks/update-time")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"id\":" + taskId + ",\"taskName\":\"改后课名\",\"startTime\":\"16:00\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200));

        Task loaded = taskMapper.selectById(taskId);
        assertNotNull(loaded);
        assertEquals("改后课名", loaded.getTaskName());
        assertEquals(LocalTime.of(16, 0), loaded.getStartTime());
        // 未传的字段必须保持原样
        assertEquals("2026-09-10", loaded.getTaskDate().toString());
        assertEquals(2.0, loaded.getDuration());
        assertEquals("#123456", loaded.getColor());
        assertEquals("原始备注", loaded.getNotes());
        assertEquals("BLOCK", loaded.getTaskType());
    }
}
