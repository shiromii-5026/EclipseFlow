package net.togogo.eclipseflowbackend.service.impl;

import com.baomidou.mybatisplus.extension.conditions.update.LambdaUpdateChainWrapper;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import net.togogo.eclipseflowbackend.dto.TaskTimeUpdateDto;
import net.togogo.eclipseflowbackend.entity.Task;
import net.togogo.eclipseflowbackend.mapper.TaskMapper;
import net.togogo.eclipseflowbackend.service.TaskService;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

@Service
public class TaskServiceImpl extends ServiceImpl<TaskMapper, Task> implements TaskService {

    @Override
    public boolean updateTaskTime(TaskTimeUpdateDto dto) {
        if (dto == null || dto.getId() == null) {
            return false;
        }

        // 1. 初始化 MyBatis-Plus 的链式更新器，并锁定主键 WHERE id = #{id}
        LambdaUpdateChainWrapper<Task> updateChain = this.lambdaUpdate()
                .eq(Task::getId, dto.getId());

        // 2. 动态更新日期（拖拽位置改变时）
        if (StringUtils.hasText(dto.getDate())) {
            updateChain.set(Task::getTaskDate, dto.getDate());
        }

        // 3. 动态更新开始时间（拖拽、拉伸顶部时）
        if (StringUtils.hasText(dto.getStartTime())) {
            String fullTime = dto.getStartTime();
            // 如果前端传的是 "09:30" 这种不带秒的格式，自动补全为 "09:30:00" 适配数据库
            if (fullTime.length() == 5) {
                fullTime += ":00";
            }
            updateChain.set(Task::getStartTime, fullTime);
        }

        // 4. ：动态更新任务时长（拉伸网格时）
        if (dto.getDuration() != null) {
            updateChain.set(Task::getDuration, dto.getDuration());
        }

        // 5. 动态更新任务名（双击快捷编辑时）
        if (StringUtils.hasText(dto.getTaskName())) {
            updateChain.set(Task::getTaskName, dto.getTaskName());
        }

        // 6. 动态更新任务备注（双击快捷编辑时）
        if (dto.getNotes() != null) { // 注意：这里允许传空字符串，方便清除备注
            updateChain.set(Task::getNotes, dto.getNotes());
        }

        // 7. 动态更新截止时间
        if (dto.getDeadline() != null) {
            updateChain.set(Task::getDeadline, dto.getDeadline());
        }

        // 8. 🌟 动态更新任务类型 (DDL / BLOCK)
        if (org.springframework.util.StringUtils.hasText(dto.getTaskType())) {
            updateChain.set(Task::getTaskType, dto.getTaskType());
        }

        // 9. 🌟 动态更新颜色
        if (org.springframework.util.StringUtils.hasText(dto.getColor())) {
            updateChain.set(Task::getColor, dto.getColor());
        }

        // 10. 最终执行 SQL 更新操作
        return updateChain.update();
    }
}