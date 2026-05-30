package net.togogo.eclipseflowbackend.dto;
import com.fasterxml.jackson.annotation.JsonFormat;
import java.time.LocalTime;

public class TaskTimeUpdateDto {
    private Long id;
    private String date;       // 对应前端传的 date (YYYY-MM-DD)
    private String startTime;  // 对应前端的 startTime (HH:MM)
    private String endTime;    // 对应前端的 endTime (HH:MM)

    // 承接前端拉伸后的最新时长
    private Double duration;

    // 承接双击修改后的新任务名
    private String taskName;

    // 承接双击修改后的新备注内容
    private String notes;

    // 承接截止时间
    @JsonFormat(pattern = "HH:mm:ss")
    private LocalTime deadline;

    // 🌟【新增】：任务类型 DDL / BLOCK
    private String taskType;

    // 承接颜色
    private String color;

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getDate() {
        return date;
    }

    public void setDate(String date) {
        this.date = date;
    }

    public String getStartTime() {
        return startTime;
    }

    public void setStartTime(String startTime) {
        this.startTime = startTime;
    }

    public String getEndTime() {
        return endTime;
    }

    public void setEndTime(String endTime) {
        this.endTime = endTime;
    }

    public Double getDuration() {
        return duration;
    }

    public void setDuration(Double duration) {
        this.duration = duration;
    }

    public String getTaskName() {
        return taskName;
    }

    public void setTaskName(String taskName) {
        this.taskName = taskName;
    }

    public String getNotes() {
        return notes;
    }

    public void setNotes(String notes) {
        this.notes = notes;
    }

    public LocalTime getDeadline() {
        return deadline;
    }

    public void setDeadline(LocalTime deadline) {
        this.deadline = deadline;
    }

    public String getTaskType() {
        return taskType;
    }

    public void setTaskType(String taskType) {
        this.taskType = taskType;
    }

    public String getColor() {
        return color;
    }

    public void setColor(String color) {
        this.color = color;
    }
}