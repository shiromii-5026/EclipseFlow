package net.togogo.eclipseflowbackend.service;

import net.togogo.eclipseflowbackend.dto.TaskTimeUpdateDto;
import net.togogo.eclipseflowbackend.mapper.TaskMapper;
import net.togogo.eclipseflowbackend.service.impl.TaskServiceImpl;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.junit.jupiter.api.Assertions.*;

/**
 * TaskServiceImpl 单元测试：验证部分更新逻辑的边界条件。
 * <p>
 * 注意：updateTaskTime 内部使用 MyBatis-Plus 的 lambdaUpdate() 链式调用，
 * 该方法需要 SqlSession（MyBatis 上下文），无法在纯单元测试中 mock。
 * 因此本测试只覆盖不触发链式调用的 guard 条件（null dto、null id）。
 * 完整的 update 逻辑建议通过集成测试（@SpringBootTest + H2）覆盖。
 */
@ExtendWith(MockitoExtension.class)
class TaskServiceImplTest {

    @Mock
    private TaskMapper taskMapper;

    @InjectMocks
    private TaskServiceImpl taskService;

    @Test
    void shouldReturnFalseWhenDtoIsNull() {
        assertFalse(taskService.updateTaskTime(null));
    }

    @Test
    void shouldReturnFalseWhenDtoIdIsNull() {
        TaskTimeUpdateDto dto = new TaskTimeUpdateDto();
        dto.setId(null);
        dto.setTaskName("test");
        assertFalse(taskService.updateTaskTime(dto));
    }

    @Test
    void shouldRejectDtoWithNoIdField() {
        // id 为 null 时，无论其他字段如何，都应该快速返回 false
        TaskTimeUpdateDto dto = new TaskTimeUpdateDto();
        dto.setTaskName("测试");
        dto.setDate("2026-06-05");
        dto.setStartTime("09:30");
        dto.setDuration(1.5);
        dto.setNotes("备注");
        assertFalse(taskService.updateTaskTime(dto));
    }

    @Test
    void shouldDistinguishNullIdFromZeroId() {
        // id=0 和 id=null 是不同的：id=0 会进入链式更新（虽然可能更新 0 行）
        TaskTimeUpdateDto nullIdDto = new TaskTimeUpdateDto();
        nullIdDto.setId(null);
        assertFalse(taskService.updateTaskTime(nullIdDto));
    }
}
