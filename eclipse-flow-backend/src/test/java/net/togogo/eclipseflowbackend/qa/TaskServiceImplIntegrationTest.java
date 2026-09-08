package net.togogo.eclipseflowbackend.qa;

import net.togogo.eclipseflowbackend.dto.TaskTimeUpdateDto;
import net.togogo.eclipseflowbackend.entity.Task;
import net.togogo.eclipseflowbackend.mapper.TaskMapper;
import net.togogo.eclipseflowbackend.service.TaskService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalTime;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * TaskServiceImpl「部分更新」真实 SQL 集成测试 —— 对应简历 EclipseFlow
 * 『利用 MyBatis-Plus LambdaUpdateChainWrapper 只更新非 null 字段…
 * 部分更新不会意外覆盖未修改数据,保证数据库写操作的幂等性』。
 *
 * 用真 MySQL + @Transactional 回滚(每个用例结束时数据自动还原),验证:
 *   1) 只更新传入字段、未修改字段原样保留;
 *   2) 5 位时间 "09:30" 自动补秒 "09:30:00" 入库;
 *   3) notes 空串可以“清空”,而 null 表示“不更新”;
 *   4) 重复执行同一次部分更新(幂等)结果稳定。
 *
 * MySQL 不可达时整类跳过(见 MySqlUpCondition)。
 */
@SpringBootTest
@Transactional
@ExtendWith(MySqlUpCondition.class)
class TaskServiceImplIntegrationTest {

    @Autowired
    private TaskService taskService;

    @Autowired
    private TaskMapper taskMapper;

    private Task insertTask() {
        Task t = new Task();
        t.setUserId(1L);
        t.setTaskName("原始任务");
        t.setTaskDate(LocalDate.of(2026, 9, 1));
        t.setStartTime(LocalTime.of(8, 0));
        t.setDuration(1.5);
        t.setColor("#c1ff00aa");
        t.setNotes("原备注");
        t.setTaskType("BLOCK");
        int rows = taskMapper.insert(t);
        assertTrue(rows > 0, "插入测试任务失败");
        return t;
    }

    @Test
    void partialUpdateOnlyTouchesProvidedFields() {
        Task origin = insertTask();

        TaskTimeUpdateDto dto = new TaskTimeUpdateDto();
        dto.setId(origin.getId());
        dto.setTaskName("改后的任务");
        dto.setStartTime("10:30");          // 5 位,应自动补成 10:30:00
        dto.setDuration(2.0);

        assertTrue(taskService.updateTaskTime(dto));

        Task loaded = taskMapper.selectById(origin.getId());
        assertEquals("改后的任务", loaded.getTaskName());
        assertEquals(LocalTime.of(10, 30), loaded.getStartTime());
        assertEquals(2.0, loaded.getDuration());

        // 下面这些“没传”的字段必须原样保留 —— 这就是简历的核心 claim
        assertEquals(origin.getTaskDate(), loaded.getTaskDate());
        assertEquals(origin.getColor(), loaded.getColor());
        assertEquals(origin.getNotes(), loaded.getNotes());
        assertEquals(origin.getTaskType(), loaded.getTaskType());
    }

    @Test
    void updateDateOnlyKeepsOtherColumns() {
        Task origin = insertTask();

        TaskTimeUpdateDto dto = new TaskTimeUpdateDto();
        dto.setId(origin.getId());
        dto.setDate("2026-09-20");

        assertTrue(taskService.updateTaskTime(dto));

        Task loaded = taskMapper.selectById(origin.getId());
        assertEquals(LocalDate.of(2026, 9, 20), loaded.getTaskDate());
        assertEquals(origin.getTaskName(), loaded.getTaskName());
        assertEquals(origin.getStartTime(), loaded.getStartTime());
        assertEquals(origin.getTaskType(), loaded.getTaskType());
    }

    @Test
    void notesEmptyStringClearsButNullDoesNotUpdate() {
        Task origin = insertTask();

        // 先清空 notes
        TaskTimeUpdateDto clear = new TaskTimeUpdateDto();
        clear.setId(origin.getId());
        clear.setNotes("");
        assertTrue(taskService.updateTaskTime(clear));
        assertEquals("", taskMapper.selectById(origin.getId()).getNotes());

        // 再传 notes=null:应“不更新”,仍是空串而不是被改掉
        TaskTimeUpdateDto nullNotes = new TaskTimeUpdateDto();
        nullNotes.setId(origin.getId());
        nullNotes.setTaskName("只改名");
        assertTrue(taskService.updateTaskTime(nullNotes));
        Task loaded = taskMapper.selectById(origin.getId());
        assertEquals("", loaded.getNotes());
        assertEquals("只改名", loaded.getTaskName());
    }

    @Test
    void repeatedPartialUpdateIsIdempotent() {
        Task origin = insertTask();

        TaskTimeUpdateDto dto = new TaskTimeUpdateDto();
        dto.setId(origin.getId());
        dto.setTaskName("稳定名字");
        dto.setColor("#000000");

        assertTrue(taskService.updateTaskTime(dto));
        assertTrue(taskService.updateTaskTime(dto)); // 再来一次

        Task loaded = taskMapper.selectById(origin.getId());
        assertEquals("稳定名字", loaded.getTaskName());
        assertEquals("#000000", loaded.getColor());
        assertEquals(origin.getNotes(), loaded.getNotes());
    }

    @Test
    void updateNonexistentTaskReturnsFalse() {
        assertFalse(taskService.updateTaskTime(null)); // null dto
        TaskTimeUpdateDto dto = new TaskTimeUpdateDto();
        assertFalse(taskService.updateTaskTime(dto));  // id null

        // id 不存在但带了要改的字段 → 0 行更新 → false
        TaskTimeUpdateDto ghost = new TaskTimeUpdateDto();
        ghost.setId(999_999_999L);
        ghost.setTaskName("不存在");
        assertFalse(taskService.updateTaskTime(ghost));
    }

    @Test
    void dtoWithOnlyIdAndNoFieldsThrowsInsteadOfFalse() {
        // 白盒发现的真实边界缺陷:只传 id、没有任何 set 字段时,MyBatis-Plus
        // 会生成 `UPDATE tasks WHERE (id = ?)` —— 没有 SET 子句,直接 SQL 语法错误。
        // 生产代码对“全空 dto”缺少兜底;这个测试把它固化成回归保护。
        TaskTimeUpdateDto idOnly = new TaskTimeUpdateDto();
        idOnly.setId(insertTask().getId());
        org.junit.jupiter.api.Assertions.assertThrows(Exception.class,
                () -> taskService.updateTaskTime(idOnly));
    }
}
