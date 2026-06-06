import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { taskApi } from '@/services/api'
import type { TaskCache } from '@/types'

export const useTaskStore = defineStore('tasks', () => {
  // date-keyed task map: { "2026-06-06": [task, ...] }
  const storage = ref<Record<string, TaskCache[]>>({})
  const loading = ref(false)

  const allTasks = computed(() => {
    const result: Array<TaskCache & { _date: string }> = []
    for (const [date, tasks] of Object.entries(storage.value)) {
      for (const t of tasks) {
        result.push({ ...t, _date: date })
      }
    }
    return result
  })

  function getTasksByDate(dateStr: string): TaskCache[] {
    return storage.value[dateStr] || []
  }

  function getTaskById(dateStr: string, taskId: number): TaskCache | undefined {
    return (storage.value[dateStr] || []).find(t => t.id === taskId)
  }

  async function fetchTasks() {
    loading.value = true
    try {
      const tasks = await taskApi.fetchTasks()
      const map: Record<string, TaskCache[]> = {}
      for (const t of tasks) {
        const dateKey = t.taskDate
        if (dateKey) {
          if (!map[dateKey]) map[dateKey] = []
          map[dateKey].push(t)
        }
      }
      storage.value = map
    } catch {
      // silently fail, keep stale data
    } finally {
      loading.value = false
    }
  }

  async function saveTask(taskData: Record<string, unknown>): Promise<boolean> {
    const ok = await taskApi.saveTask(taskData)
    if (ok) await fetchTasks()
    return ok
  }

  async function deleteTask(id: number): Promise<boolean> {
    const ok = await taskApi.deleteTask(id)
    if (ok) await fetchTasks()
    return ok
  }

  async function updateTaskTime(id: number, date: string, startTime: string): Promise<boolean> {
    return taskApi.updateTaskTime(id, date, startTime)
  }

  // Optimistic local update (for drag/resize)
  function updateTaskLocal(taskId: number, fromDate: string, updates: Partial<TaskCache>) {
    const tasks = storage.value[fromDate]
    if (!tasks) return
    const idx = tasks.findIndex(t => t.id === taskId)
    if (idx === -1) return
    Object.assign(tasks[idx], updates)
  }

  function moveTaskLocal(taskId: number, fromDate: string, toDate: string, updates: Partial<TaskCache>) {
    const fromTasks = storage.value[fromDate]
    if (!fromTasks) return
    const idx = fromTasks.findIndex(t => t.id === taskId)
    if (idx === -1) return
    const [task] = fromTasks.splice(idx, 1)
    Object.assign(task, updates)
    if (!storage.value[toDate]) storage.value[toDate] = []
    storage.value[toDate].push(task)
  }

  return {
    storage, loading, allTasks,
    getTasksByDate, getTaskById,
    fetchTasks, saveTask, deleteTask, updateTaskTime,
    updateTaskLocal, moveTaskLocal,
  }
})
