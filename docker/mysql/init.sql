-- EclipseFlow 数据库初始化脚本
-- MyBatis-Plus 不会自动建表，此脚本由 docker-compose 在首次启动时执行

CREATE DATABASE IF NOT EXISTS eclipse_flow
    DEFAULT CHARACTER SET utf8mb4
    DEFAULT COLLATE utf8mb4_unicode_ci;

USE eclipse_flow;

-- 用户表
CREATE TABLE IF NOT EXISTS users (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL COMMENT 'BCrypt 加密后的密码',
    calendar_public TINYINT DEFAULT 1 COMMENT '日历是否公开：0=私密，1=公开',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 任务表
CREATE TABLE IF NOT EXISTS tasks (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT DEFAULT 1,
    task_name VARCHAR(255) NOT NULL,
    task_date DATE NOT NULL,
    start_time TIME,
    duration DOUBLE DEFAULT 1 COMMENT '持续时长（小时）',
    color VARCHAR(20),
    notes TEXT,
    deadline TIME,
    task_type VARCHAR(10) COMMENT 'DDL=截止日期线, BLOCK=时间块',
    image_url VARCHAR(500) COMMENT '已弃用',
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 好友关系表
CREATE TABLE IF NOT EXISTS friends (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT NOT NULL,
    friend_id BIGINT NOT NULL,
    status VARCHAR(10) DEFAULT 'pending' COMMENT 'pending=待接受, accepted=已接受',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 私信表
CREATE TABLE IF NOT EXISTS messages (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    sender_id BIGINT NOT NULL,
    receiver_id BIGINT NOT NULL,
    content TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
