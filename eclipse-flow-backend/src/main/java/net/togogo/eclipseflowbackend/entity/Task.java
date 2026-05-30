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

    @TableField("user_id")
    private Long userId;

    @TableField("task_name")
    private String taskName;

    @TableField("task_date")
    @JsonFormat(pattern = "yyyy-MM-dd")
    private LocalDate taskDate;

    @TableField("start_time")
    @JsonFormat(pattern = "HH:mm:ss")
    private LocalTime startTime;

    // Duration in hours, supports fractional values like 0.5h, 1.25h
    private Double duration;

    private String color;

    // Notes field for detailed text from quick-edit modal
    private String notes;

    @TableField("deadline")
    @JsonFormat(pattern = "HH:mm:ss")
    private LocalTime deadline;

    // Task type: DDL (deadline line) or BLOCK (time block)
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

    public String getTaskType() {
        return taskType;
    }

    public void setTaskType(String taskType) {
        this.taskType = taskType;
    }
}