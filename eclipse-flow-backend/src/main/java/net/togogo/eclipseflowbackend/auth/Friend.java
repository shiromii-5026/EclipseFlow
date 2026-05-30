package net.togogo.eclipseflowbackend.auth;

import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;
import java.time.LocalDateTime;

@Data
@TableName("friends")
public class Friend {
    @TableId
    private Long id;
    private Long userId;
    private Long friendId;
    private String status;  // pending / accepted
    private LocalDateTime createdAt;
}
