import { ref, onMounted, onUnmounted } from 'vue'
import { useTaskStore } from '@/stores/tasks'
import { useCalendarStore } from '@/stores/calendar'
import type { TaskCache } from '@/types'

export interface CountdownItem {
  id: number
  name: string
  time: string
  remaining: string // e.g. "3h 25m" or "已开始"
  isRunning: boolean
}

export function useCountdown() {
  const items = ref<CountdownItem[]>([])
  let timer: ReturnType<typeof setInterval> | null = null

  function update() {
    const taskStore = useTaskStore()
    const calendarStore = useCalendarStore()
    const today = calendarStore.getCSTDateStr(new Date())
    const now = new Date()
    const nowMin = now.getHours() * 60 + now.getMinutes()

    const todayTasks = taskStore.getTasksByDate(today)
    const upcoming: CountdownItem[] = []

    for (const t of todayTasks) {
      if (!t.time || t.taskType === 'DDL') continue
      const [h, m] = t.time.split(':').map(Number)
      const startMin = h * 60 + m
      const diff = startMin - nowMin

      if (diff >= -60) { // within 1 hour of start
        const isRunning = diff <= 0
        const absMin = Math.abs(diff)
        const remainH = Math.floor(absMin / 60)
        const remainM = absMin % 60
        const remaining = isRunning
          ? `进行中 ${remainH}h ${remainM}m`
          : `${remainH}h ${remainM}m 后开始`

        upcoming.push({
          id: t.id,
          name: t.name,
          time: t.time,
          remaining,
          isRunning,
        })
      }
    }

    upcoming.sort((a, b) => a.time.localeCompare(b.time))
    items.value = upcoming
  }

  onMounted(() => {
    update()
    timer = setInterval(update, 1000)
  })

  onUnmounted(() => {
    if (timer) clearInterval(timer)
  })

  return { items }
}
