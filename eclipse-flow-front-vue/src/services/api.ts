import type { ApiResponse, Task, TaskCache } from '@/types'

// 智能检测运行环境：nginx 代理 vs 本地调试
const isProxied =
  window.location.protocol !== 'file:' &&
  (!window.location.port || window.location.port === '80' || window.location.port === '443')

const BASE = isProxied ? '/api' : 'http://localhost:8080/api'
const OCR_BASE = isProxied ? '' : 'http://localhost:8000'

function token(): string {
  return localStorage.getItem('eclipse_token') || ''
}

function authHeaders(): Record<string, string> {
  const t = token()
  return t ? { Authorization: `Bearer ${t}` } : {}
}

async function handleResponse(resp: Response): Promise<Response> {
  if (resp.status === 401) {
    localStorage.removeItem('eclipse_token')
    window.location.href = '/login'
    throw new Error('未登录')
  }
  return resp
}

// ===== 任务 API =====
export const taskApi = {
  async fetchTasks(): Promise<TaskCache[]> {
    console.log('[taskApi.fetchTasks] 发送 GET, BASE:', BASE)
    const resp = await fetch(`${BASE}/tasks/list`, { headers: authHeaders() })
    console.log('[taskApi.fetchTasks] 响应状态:', resp.status)
    await handleResponse(resp)
    const result: ApiResponse<Task[]> = await resp.json()
    console.log('[taskApi.fetchTasks] 响应体:', result)
    const data = Array.isArray(result) ? result : result.data || []
    return data.map((bt: Task) => ({
      id: bt.id,
      name: bt.taskName,
      taskName: bt.taskName,
      taskDate: bt.taskDate, // 关键：保留 taskDate 用于按日期分组
      time: bt.startTime?.substring(0, 5) || '00:00',
      startTime: bt.startTime || '00:00:00',
      duration: bt.duration != null ? bt.duration : 1,
      color: bt.color || '#b5d528aa',
      notes: bt.notes || '',
      deadline: bt.deadline || null,
      taskType: (bt.taskType as 'DDL' | 'BLOCK') || (bt.duration === 0 ? 'DDL' : 'BLOCK'),
    }))
  },

  async saveTask(task: Record<string, unknown>): Promise<boolean> {
    console.log('[taskApi.saveTask] 发送 POST, 数据:', task)
    const resp = await fetch(`${BASE}/tasks/add`, {
      method: 'POST',
      headers: { ...authHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify(task),
    })
    console.log('[taskApi.saveTask] 响应状态:', resp.status)
    await handleResponse(resp)
    return resp.ok
  },

  async deleteTask(id: number): Promise<boolean> {
    const resp = await fetch(`${BASE}/tasks/delete/${id}`, {
      method: 'DELETE',
      headers: authHeaders(),
    })
    await handleResponse(resp)
    return resp.ok
  },

  async updateTaskTime(id: number, date: string, startTime: string): Promise<boolean> {
    const resp = await fetch(`${BASE}/tasks/update-time`, {
      method: 'PUT',
      headers: { ...authHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, date, startTime }),
    })
    await handleResponse(resp)
    return resp.ok
  },

  /** 拖拽/拉伸后完整更新：时间、日期、时长、类型、截止时间等 */
  async updateTask(data: Record<string, unknown>): Promise<boolean> {
    const resp = await fetch(`${BASE}/tasks/update-time`, {
      method: 'PUT',
      headers: { ...authHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    await handleResponse(resp)
    return resp.ok
  },
}

// ===== 认证 API =====
export const authApi = {
  async login(username: string, password: string): Promise<{ token: string; username: string }> {
    const resp = await fetch(`${BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    })
    if (!resp.ok) {
      const err = await resp.json().catch(() => ({ error: '登录失败' }))
      throw new Error(err.error || '登录失败')
    }
    return resp.json()
  },

  async register(username: string, password: string): Promise<{ token: string; username: string }> {
    const resp = await fetch(`${BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    })
    if (!resp.ok) {
      const err = await resp.json().catch(() => ({ error: '注册失败' }))
      throw new Error(err.error || '注册失败')
    }
    return resp.json()
  },

  async getProfile(): Promise<{ id: number; username: string; avatarPath: string }> {
    const resp = await fetch(`${BASE}/auth/profile`, { headers: authHeaders() })
    await handleResponse(resp)
    return resp.json()
  },

  async updateProfile(data: { username?: string }): Promise<{ username: string; avatarPath: string }> {
    console.log('[authApi.updateProfile] 发送 PUT, BASE:', BASE, 'data:', data)
    const resp = await fetch(`${BASE}/auth/profile`, {
      method: 'PUT',
      headers: { ...authHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    console.log('[authApi.updateProfile] 响应状态:', resp.status)
    await handleResponse(resp)
    if (!resp.ok) {
      const err = await resp.json().catch(() => ({ error: '更新失败' }))
      throw new Error(err.error || '更新失败')
    }
    return resp.json()
  },

  async uploadAvatar(base64: string): Promise<{ avatarPath: string }> {
    console.log('[authApi.uploadAvatar] 发送 POST, 数据长度:', base64.length)
    const resp = await fetch(`${BASE}/auth/avatar`, {
      method: 'POST',
      headers: { ...authHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ image: base64 }),
    })
    console.log('[authApi.uploadAvatar] 响应状态:', resp.status)
    await handleResponse(resp)
    if (!resp.ok) {
      const err = await resp.json().catch(() => ({ error: '上传失败' }))
      throw new Error(err.error || '上传失败')
    }
    return resp.json()
  },
}

// ===== 社交 API =====
export const socialApi = {
  async request<T>(path: string, opts: RequestInit = {}): Promise<T> {
    const resp = await fetch(`${BASE}/social${path}`, {
      ...opts,
      headers: { ...authHeaders(), ...(opts.headers as Record<string, string> || {}) },
    })
    if (resp.status === 401) {
      localStorage.removeItem('eclipse_token')
      window.location.href = '/login'
      throw new Error('未登录')
    }
    const data = await resp.json()
    // 兼容 ApiResponse 包装和裸响应
    return data && data.data !== undefined ? data.data : data
  },

  searchUsers(q: string) {
    return this.request<Array<{ id: number; username: string }>>(`/search?q=${encodeURIComponent(q)}`)
  },

  addFriend(friendId: number) {
    return this.request<{ status: string }>('/add-friend', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ friendId }),
    })
  },

  getFriends() {
    return this.request<Array<{ id: number; username: string; calendarPublic: boolean }>>('/friends')
  },

  getRequests() {
    return this.request<Array<{ id: number; username: string }>>('/requests')
  },

  acceptFriend(requestId: number) {
    return this.request<{ status: string }>('/accept', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ requestId }),
    })
  },

  toggleCalendar() {
    return this.request<{ calendarPublic: boolean }>('/toggle-calendar', { method: 'POST' })
  },

  sendMessage(receiverId: number, content: string) {
    return this.request<{ status: string }>('/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ receiverId, content }),
    })
  },

  getMessages(friendId: number) {
    return this.request<Array<{ id: number; senderId: number; content: string; time: string; mine: boolean }>>(`/messages/${friendId}`)
  },

  getFriendCalendar(friendId: number) {
    return this.request<Task[]>(`/friend-calendar/${friendId}`)
  },
}

// ===== OCR API =====
export const ocrApi = {
  async uploadImage(file: File, today: string): Promise<{ tasks: Array<Record<string, unknown>>; error?: string }> {
    const formData = new FormData()
    formData.append('file', file)
    const resp = await fetch(`${OCR_BASE}/ocr-vision?today=${encodeURIComponent(today)}`, {
      method: 'POST',
      body: formData,
    })
    return resp.json()
  },
}

// ===== Push API =====
export const pushApi = {
  async subscribe(subscription: PushSubscriptionJSON): Promise<void> {
    await fetch(`${BASE}/push/subscribe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(subscription),
    })
  },
}
