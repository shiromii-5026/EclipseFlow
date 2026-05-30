package net.togogo.eclipseflowbackend.entity;

import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import com.fasterxml.jackson.annotation.JsonFormat;
import lombok.Data;
import java.time.LocalDate;
import java.time.LocalTime;

@Data
@TableName("tasks")
public class Task {

    @JsonFormat(shape = JsonFormat.Shape.STRING)
    @TableId
    private Long id;

    @TableField("task_name")
    private String taskName;

    @TableField("task_date")
    @JsonFormat(pattern = "yyyy-MM-dd")
    private LocalDate taskDate;

    @TableField("start_time")
    @JsonFormat(pattern = "HH:mm:ss")
    private LocalTime startTime;

    // 🌟【修改】：由 Integer 改为 Double，完美支持前端拉伸出来的 0.5h、1.25h 等小时数
    private Double duration;

    private String color;

    // 🌟【新增】：备注字段，用来存放双击弹窗输入的详细文字
    private String notes;

    @TableField("deadline")
    @JsonFormat(pattern = "HH:mm:ss")
    private LocalTime deadline;

    // 🌟【新增】：任务类型 DDL=截止日类型线任务  BLOCK=时间块任务
    @TableField("task_type")
    private String taskType;

    public LocalTime getDeadline() {
        return deadline;
    }

    public void setDeadline(LocalTime deadline) {
        this.deadline = deadline;
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getTaskName() {
        return taskName;
    }

    public void setTaskName(String taskName) {
        this.taskName = taskName;
    }

    public LocalDate getTaskDate() {
        return taskDate;
    }

    public void setTaskDate(LocalDate taskDate) {
        this.taskDate = taskDate;
    }

    public LocalTime getStartTime() {
        return startTime;
    }

    public void setStartTime(LocalTime startTime) {
        this.startTime = startTime;
    }

    public Double getDuration() {
        return duration;
    }

    public void setDuration(Double duration) {
        this.duration = duration;
    }

    public String getColor() {
        return color;
    }

    public void setColor(String color) {
        this.color = color;
    }

    public String getNotes() {
        return notes;
    }

    public void setNotes(String notes) {
        this.notes = notes;
    }
}