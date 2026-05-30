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
     * 🌟【全面升级】：统一的时间轴与详情属性更新接口
     * 完美支持：1. 鼠标拖拽位置  2. 鼠标悬停拉伸高度  3. 双击弹窗修改文本与备注
     */
    @PutMapping("/update-time")
    public ResponseEntity<?> updateTaskTime(@RequestBody TaskTimeUpdateDto dto) {
        try {
            System.out.println("📡 收到前端同步请求，任务ID: " + dto.getId());

            // 直接将承载了全套新数据的 dto 喂给 Service 层处理
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