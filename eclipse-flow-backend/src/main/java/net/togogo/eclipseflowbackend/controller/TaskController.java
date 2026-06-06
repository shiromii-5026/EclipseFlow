package net.togogo.eclipseflowbackend.controller;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import net.togogo.eclipseflowbackend.dto.ApiResponse;
import net.togogo.eclipseflowbackend.dto.TaskTimeUpdateDto;
import net.togogo.eclipseflowbackend.entity.Task;
import net.togogo.eclipseflowbackend.mapper.TaskMapper;
import net.togogo.eclipseflowbackend.service.TaskService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import jakarta.servlet.http.HttpServletRequest;
import java.util.List;

@RestController
@RequestMapping("/api/tasks")
@CrossOrigin(origins = "*")
public class TaskController {

    @Autowired
    private TaskMapper taskMapper;

    @Autowired
    private TaskService taskService;

    /**
     * 从 JWT 过滤器获取当前用户 ID。
     * 过滤器已保证此属性一定存在且有效。
     */
    private Long getUserId(HttpServletRequest request) {
        return (Long) request.getAttribute("userId");
    }

    /**
     * 获取当前用户的所有任务
     */
    @GetMapping("/list")
    public ApiResponse<List<Task>> getAllTasks(HttpServletRequest request) {
        Long userId = getUserId(request);
        List<Task> tasks = taskMapper.selectList(
            new LambdaQueryWrapper<Task>().eq(Task::getUserId, userId)
        );
        return ApiResponse.ok(tasks);
    }

    /**
     * 新增任务，自动绑定当前用户
     */
    @PostMapping("/add")
    public ApiResponse<Task> addTask(@RequestBody Task task, HttpServletRequest request) {
        task.setUserId(getUserId(request));
        System.out.println("[addTask] 收到请求, userId=" + task.getUserId() + ", taskName=" + task.getTaskName() + ", taskDate=" + task.getTaskDate());
        boolean saved = taskService.save(task);
        System.out.println("[addTask] 保存结果: " + saved + ", taskId=" + task.getId());
        if (!saved) {
            return ApiResponse.error("任务保存失败");
        }
        return ApiResponse.ok("任务创建成功", task);
    }

    /**
     * 删除任务（仅自己的）
     */
    @DeleteMapping("/delete/{id}")
    public ApiResponse<Void> deleteTask(@PathVariable Long id, HttpServletRequest request) {
        Long userId = getUserId(request);
        Task t = taskMapper.selectById(id);
        if (t == null) {
            return ApiResponse.fail(404, "任务不存在");
        }
        if (!t.getUserId().equals(userId)) {
            return ApiResponse.fail(403, "无权删除他人任务");
        }
        boolean removed = taskService.removeById(id);
        if (!removed) {
            return ApiResponse.error("删除失败");
        }
        return ApiResponse.ok("删除成功", null);
    }

    /**
     * 更新任务时间/属性（拖拽、拉伸、编辑）
     */
    @PutMapping("/update-time")
    public ApiResponse<Void> updateTaskTime(@RequestBody TaskTimeUpdateDto dto) {
        boolean success = taskService.updateTaskTime(dto);
        if (!success) {
            return ApiResponse.fail(400, "更新失败：任务不存在或参数无效");
        }
        return ApiResponse.ok("更新成功", null);
    }
}
