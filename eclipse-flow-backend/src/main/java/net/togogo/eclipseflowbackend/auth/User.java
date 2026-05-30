package net.togogo.eclipseflowbackend.auth;

import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;

@TableName("users")
public class User {
    @TableId
    private Long id;
    private String username;
    private String password;
    private Integer calendarPublic;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getUsername() { return username; }
    public void setUsername(String username) { this.username = username; }
    public String getPassword() { return password; }
    public void setPassword(String password) { this.password = password; }
    public Integer getCalendarPublic() { return calendarPublic; }
    public void setCalendarPublic(Integer calendarPublic) { this.calendarPublic = calendarPublic; }
}
