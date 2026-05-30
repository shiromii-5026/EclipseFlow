package net.togogo.eclipseflowbackend.controller;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import net.togogo.eclipseflowbackend.entity.Task;
import net.togogo.eclipseflowbackend.service.TaskService;
import net.togogo.eclipseflowbackend.mapper.TaskMapper;
import net.togogo.eclipseflowbackend.dto.TaskTimeUpdateDto;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import jakarta.servlet.http.HttpServletRequest;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/tasks")
@CrossOrigin(origins = "*")
public class TaskController {

    @Autowired
    private TaskMapper taskMapper;

    @Autowired
    private TaskService taskService;

    // 从 JWT 过滤器取当前用户 ID，无 token 时默认用 1（兼容旧数据）
    private Long getUserId(HttpServletRequest request) {
        Object uid = request.getAttribute("userId");
        return uid != null ? (Long) uid : 1L;
    }

    /**
     * 获取当前用户的所有任务
     */
    @GetMapping("/list")
    public List<Task> getAllTasks(HttpServletRequest request) {
        Long userId = getUserId(request);
        return taskMapper.selectList(
            new LambdaQueryWrapper<Task>().eq(Task::getUserId, userId)
        );
    }

    /**
     * 新增任务，自动绑定当前用户
     */
    @PostMapping("/add")
    public String addTask(@RequestBody Task task, HttpServletRequest request) {
        task.setUserId(getUserId(request));
        boolean saved = taskService.save(task);
        return saved ? "ok" : "fail";
    }

    /**
     * 删除任务（仅自己的）
     */
    @DeleteMapping("/delete/{id}")
    public String deleteTask(@PathVariable Long id, HttpServletRequest request) {
        Long userId = getUserId(request);
        Task t = taskMapper.selectById(id);
        if (t == null || !t.getUserId().equals(userId)) {
            return "fail";
        }
        boolean removed = taskService.removeById(id);
        return removed ? "ok" : "fail";
    }

    /**
     * 更新任务时间/属性（拖拽、拉伸、编辑）
     */
    @PutMapping("/update-time")
    public ResponseEntity<?> updateTaskTime(@RequestBody TaskTimeUpdateDto dto) {
        try {
            boolean success = taskService.updateTaskTime(dto);
            if (success) {
                return ResponseEntity.ok(Map.of("status", "success"));
            } else {
                return ResponseEntity.status(500).body(Map.of("status", "error"));
            }
        } catch (Exception e) {
            return ResponseEntity.status(500).body(Map.of("status", "error", "message", e.getMessage()));
        }
    }
}
