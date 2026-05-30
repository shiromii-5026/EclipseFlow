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

        // 用 MyBatis-Plus 链式更新，哪个字段有值就更新哪个，没值的跳过
        LambdaUpdateChainWrapper<Task> updateChain = this.lambdaUpdate()
                .eq(Task::getId, dto.getId());

        // 日期（拖拽跨列时变）
        if (StringUtils.hasText(dto.getDate())) {
            updateChain.set(Task::getTaskDate, dto.getDate());
        }

        // 开始时间
        if (StringUtils.hasText(dto.getStartTime())) {
            String fullTime = dto.getStartTime();
            // 前端传 "09:30"，数据库要 "09:30:00"，补一下
            if (fullTime.length() == 5) {
                fullTime += ":00";
            }
            updateChain.set(Task::getStartTime, fullTime);
        }

        // 持续时长
        if (dto.getDuration() != null) {
            updateChain.set(Task::getDuration, dto.getDuration());
        }

        // 任务名
        if (StringUtils.hasText(dto.getTaskName())) {
            updateChain.set(Task::getTaskName, dto.getTaskName());
        }

        // 备注（允许置空）
        if (dto.getNotes() != null) {
            updateChain.set(Task::getNotes, dto.getNotes());
        }

        // 截止时间
        if (dto.getDeadline() != null) {
            updateChain.set(Task::getDeadline, dto.getDeadline());
        }

        // 任务类型 DDL / BLOCK
        if (org.springframework.util.StringUtils.hasText(dto.getTaskType())) {
            updateChain.set(Task::getTaskType, dto.getTaskType());
        }

        // 颜色
        if (org.springframework.util.StringUtils.hasText(dto.getColor())) {
            updateChain.set(Task::getColor, dto.getColor());
        }

        return updateChain.update();
    }
}