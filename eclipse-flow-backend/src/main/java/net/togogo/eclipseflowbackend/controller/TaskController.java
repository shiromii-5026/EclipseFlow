package net.togogo.eclipseflowbackend.controller;

import net.togogo.eclipseflowbackend.entity.Task;
import net.togogo.eclipseflowbackend.service.TaskService;
import net.togogo.eclipseflowbackend.mapper.TaskMapper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.List;
import java.util.Map;
import net.togogo.eclipseflowbackend.dto.TaskTimeUpdateDto;

@RestController
@RequestMapping("/api/tasks")
@CrossOrigin(origins = "*")
public class TaskController {

    @Autowired
    private TaskMapper taskMapper;

    @Autowired
    private TaskService taskService;

    // 获取所有任务
    @GetMapping("/list")
    public List<Task> getAllTasks() {
        // selectList(null) 表示查询所有记录
        return taskMapper.selectList(null);
    }

    // 添加任务
    @PostMapping("/add")
    public String addTask(@RequestBody Task task) {
        // 使用 MyBatis Plus 的 save 方法直接保存实体对象
        boolean saved = taskService.save(task);
        return saved ? "添加成功" : "添加失败";
    }

    // 删除任务
    @DeleteMapping("/delete/{id}")
    public String deleteTask(@PathVariable Long id) {
        // MyBatis Plus 自带的根据 ID 删除
        boolean removed = taskService.removeById(id);
        return removed ? "删除成功" : "删除失败";
    }

    /**
     * 统一更新入口：拖拽位置、拉伸时长、双击编辑都走这里。
     * 只传变了的字段，Service 层动态拼 SQL。
     */
    @PutMapping("/update-time")
    public ResponseEntity<?> updateTaskTime(@RequestBody TaskTimeUpdateDto dto) {
        try {
            boolean success = taskService.updateTaskTime(dto);

            if (success) {
                return ResponseEntity.ok(Map.of("status", "success", "message", "数据轴同步成功"));
            } else {
                return ResponseEntity.status(500).body(Map.of("status", "error", "message", "数据库更新失败"));
            }
        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.status(500).body(Map.of("status", "error", "message", e.getMessage()));
        }
    }
}