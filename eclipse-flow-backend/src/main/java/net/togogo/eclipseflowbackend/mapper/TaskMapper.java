package net.togogo.eclipseflowbackend.mapper;
import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import net.togogo.eclipseflowbackend.entity.Task;
import org.apache.ibatis.annotations.Mapper;

@Mapper
public interface TaskMapper extends BaseMapper<Task> {
    // BaseMapper 自带增删改查
}