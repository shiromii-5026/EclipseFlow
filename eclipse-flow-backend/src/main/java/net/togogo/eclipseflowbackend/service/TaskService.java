package net.togogo.eclipseflowbackend.service;

import com.baomidou.mybatisplus.extension.service.IService;
import net.togogo.eclipseflowbackend.entity.Task;
import net.togogo.eclipseflowbackend.dto.TaskTimeUpdateDto;

// 继承 IService，MyBatis Plus 会自动帮你写好 list(), removeById() 等方法
public interface TaskService extends IService<Task> {

    /**
     * @param dto 包含最新数据的传输对象
     * @return 是否更新成功
     */
    boolean updateTaskTime(TaskTimeUpdateDto dto);
}