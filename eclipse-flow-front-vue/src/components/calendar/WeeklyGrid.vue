<template>
  <div class="weekly-scroll" id="weekly-scroll-container" ref="scrollContainer" @scroll.passive="onScroll">
    <div class="weekly-grid" id="weekly-grid" ref="gridEl">
      <!-- 时间轴 -->
      <div class="time-gutter">
        <div class="column-header">CST</div>
        <div v-for="h in 24" :key="h" class="time-slot-label">{{ h - 1 }}:00</div>
      </div>

      <!-- 7 天列 -->
      <div
        v-for="(col, ci) in columns"
        :key="ci"
        class="day-column"
        :class="{ today: col.isToday }"
        :data-date="col.dateStr"
        @dblclick="onColumnDblClick(col.dateStr, $event)"
      >
        <div class="column-header">
          {{ col.weekLabel }} <span>{{ col.month }}/{{ col.day }}</span>
        </div>

        <!-- 当前时间红线 -->
        <div
          v-if="col.isCurrentDay"
          class="current-time-line"
          :style="{ top: currentTimeTop + 'px' }"
        />

        <!-- 任务卡片 -->
        <TaskCard
          v-for="task in col.tasks"
          :key="task.id"
          :task="task"
          :is-today="col.isToday"
          :hour-height="HOUR_HEIGHT"
          :header-height="HEADER_HEIGHT"
          @delete="emit('delete-task', task.id)"
          @edit="emit('edit-task', { task, dateStr: col.dateStr })"
          @drag-end="emit('task-drag', $event)"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, nextTick } from 'vue'
import { useCalendarStore } from '@/stores/calendar'
import { useTaskStore } from '@/stores/tasks'
import TaskCard from './TaskCard.vue'
import type { TaskCache } from '@/types'

const HOUR_HEIGHT = 80
const HEADER_HEIGHT = 60

const emit = defineEmits<{
  'delete-task': [id: number]
  'edit-task': [payload: { task: TaskCache; dateStr: string }]
  'task-drag': [payload: { taskId: number; fromDate: string; toDate: string }]
}>()

const cal = useCalendarStore()
const taskStore = useTaskStore()
const scrollContainer = ref<HTMLElement | null>(null)

const weekNames = ['周一', '周二', '周三', '周四', '周五', '周六', '周日']

interface ColumnData {
  dateStr: string
  weekLabel: string
  month: number
  day: number
  isToday: boolean
  isCurrentDay: boolean
  tasks: TaskCache[]
}

const columns = computed<ColumnData[]>(() => {
  const { monday } = cal.getWeekRange(cal.currentFocusDate)
  const today = new Date()
  const todayStr = cal.getCSTDateStr(today)

  const cols: ColumnData[] = []
  for (let i = 0; i < 7; i++) {
    const cur = new Date(monday)
    cur.setDate(monday.getDate() + i)
    const dateStr = cal.getCSTDateStr(cur)
    const isCurrentDay =
      cur.getFullYear() === today.getFullYear() &&
      cur.getMonth() === today.getMonth() &&
      cur.getDate() === today.getDate()

    cols.push({
      dateStr,
      weekLabel: weekNames[i],
      month: cur.getMonth() + 1,
      day: cur.getDate(),
      isToday: dateStr === todayStr,
      isCurrentDay,
      tasks: taskStore.getTasksByDate(dateStr),
    })
  }
  return cols
})

const currentTimeTop = computed(() => {
  const now = new Date()
  return HEADER_HEIGHT + (now.getHours() + now.getMinutes() / 60) * HOUR_HEIGHT
})

function onColumnDblClick(dateStr: string, event: MouseEvent) {
  const col = (event.currentTarget as HTMLElement)
  const rect = col.getBoundingClientRect()
  const y = event.clientY - rect.top + (col.parentElement?.parentElement?.scrollTop || 0)
  const hours = (y - HEADER_HEIGHT) / HOUR_HEIGHT
  const h = Math.max(0, Math.min(23, Math.floor(hours)))
  const m = Math.floor((hours - h) * 60 / 15) * 15
  const time = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
  emit('edit-task', {
    task: {
      id: 0, name: '', taskName: '', time, startTime: time + ':00',
      duration: 1, color: '#b5d528aa', notes: '', deadline: null, taskType: 'BLOCK',
    },
    dateStr,
  })
}

// scroll to first task on mount
onMounted(() => {
  nextTick(() => {
    const col = document.querySelector('.day-column[data-date="' + cal.focusDateStr + '"]')
    if (col) {
      const firstTask = col.querySelector('.event-item')
      if (firstTask) {
        firstTask.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }
    }
  })
})

// emit scroll info for scrollToCurrentTime
function onScroll() { /* can be used for scroll state tracking */ }

defineExpose({ scrollContainer, HOUR_HEIGHT, HEADER_HEIGHT })
</script>

<style scoped>
.weekly-scroll { flex: 1; overflow-y: auto; overflow-x: auto; }
.weekly-grid { display: flex; min-width: 780px; position: relative; min-height: 100%; }
.time-gutter { width: 52px; flex-shrink: 0; border-right: 1px solid var(--border-color, rgba(255,255,255,0.06)); }
.time-slot-label { height: 80px; font-size: 0.58rem; display: flex; align-items: flex-start; justify-content: flex-end; padding-right: 6px; opacity: 0.35; }
.column-header { height: 60px; display: flex; flex-direction: column; align-items: center; justify-content: center; font-size: 0.7rem; font-weight: 600; border-bottom: 1px solid var(--border-color, rgba(255,255,255,0.06)); }
.column-header span { font-size: 0.58rem; opacity: 0.5; }
.day-column { flex: 1; min-width: 100px; position: relative; border-right: 1px solid var(--border-color, rgba(255,255,255,0.04)); }
.day-column.today { background: var(--today-bg, rgba(181,213,40,0.03)); }
.current-time-line { position: absolute; left: 0; right: 0; height: 2px; background: #f44336; z-index: 10; pointer-events: none; }
.current-time-line::before { content: ''; position: absolute; left: -4px; top: -3px; width: 8px; height: 8px; border-radius: 50%; background: #f44336; }
</style>
