// 任务实体
export interface Task {
  id: number
  userId: number
  taskName: string
  taskDate: string // YYYY-MM-DD
  startTime: string | null // HH:mm:ss
  duration: number
  color: string | null
  notes: string | null
  deadline: string | null // HH:mm:ss
  taskType: 'DDL' | 'BLOCK' | null
}

// 前端任务缓存（从后端数据转换而来）
export interface TaskCache {
  id: number
  name: string
  taskName: string
  taskDate: string // YYYY-MM-DD — 必须保留用于按日期分组
  time: string // HH:mm
  startTime: string
  duration: number
  color: string
  notes: string
  deadline: string | null
  taskType: 'DDL' | 'BLOCK'
}

// API 统一响应
export interface ApiResponse<T = unknown> {
  code: number
  message: string
  data: T
}

// 好友
export interface FriendInfo {
  id: number
  username: string
  calendarPublic: boolean
}

export interface FriendRequest {
  id: number
  username: string
}

// 聊天消息
export interface ChatMessage {
  id: number
  senderId: number
  content: string
  time: string
  mine: boolean
}

// OCR 任务
export interface OcrTask {
  taskName: string
  taskDate: string
  startTime: string
  endTime: string
  notes: string
  color: string
}
