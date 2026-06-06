<template>
  <div
    ref="cardRef"
    class="event-item"
    :class="{ 'ddl-line-task': isDDL, important: isToday && !task.color }"
    :style="cardStyle"
    :data-task-id="task.id"
    @dblclick.stop="$emit('edit')"
  >
    <template v-if="isDDL">
      <div class="ddl-label">
        <span class="event-time-tag">{{ task.time }}</span>
        <span class="event-name-text">{{ task.name }}</span>
      </div>
      <button class="del-btn-mini ddl-del" @click.stop="$emit('delete')">&times;</button>
    </template>
    <template v-else>
      <div class="resize-handle top" />
      <div class="event-time-tag">{{ task.time }}</div>
      <div class="event-name-text">{{ task.name }}</div>
      <div v-if="task.notes" class="event-note-text">{{ task.notes }}</div>
      <button class="del-btn-mini" @click.stop="$emit('delete')">&times;</button>
      <div class="resize-handle bottom" />
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import interact from 'interactjs'
import type { TaskCache } from '@/types'

const HOUR_HEIGHT = 80
const HEADER_HEIGHT = 60

const props = defineProps<{ task: TaskCache; isToday: boolean }>()
const emit = defineEmits<{
  delete: []
  edit: []
  dragend: [payload: { taskId: number; newDate: string; newStartTime: string; newDuration: number; newDeadline: string }]
  resizeend: [payload: { taskId: number; date: string; newStartTime: string; newDuration: number; newTaskType: string; newDeadline: string | null }]
}>()

const cardRef = ref<HTMLElement>()
const isDDL = computed(() => props.task.taskType === 'DDL' || props.task.duration === 0)

function parseTime(t: string): [number, number] {
  const parts = t.split(':').map(Number)
  return [parts[0] || 0, parts[1] || 0]
}

function timeStr(h: number, m: number): string {
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

function pixelsToMinutes(y: number): number {
  let totalMinutes = (y / HOUR_HEIGHT) * 60
  totalMinutes = Math.round(totalMinutes / 15) * 15
  if (totalMinutes < 0) totalMinutes = 0
  if (totalMinutes > 23.75 * 60) totalMinutes = 23.75 * 60
  return totalMinutes
}

const cardStyle = computed(() => {
  const [h, m] = parseTime(props.task.time)
  const top = (h + m / 60) * HOUR_HEIGHT + HEADER_HEIGHT
  const s: Record<string, string> = { top: `${top}px` }
  if (props.task.color) s['--task-color'] = props.task.color
  if (isDDL.value) {
    const c = props.task.color || '#9fc518'
    return {
      ...s,
      height: '4px',
      minHeight: '4px',
      padding: '0',
      borderRadius: '0',
      border: 'none',
      backgroundColor: c,
      boxShadow: `0 0 6px ${c.substring(0, 7)}66`,
    }
  }
  s.height = `${(props.task.duration ?? 1) * HOUR_HEIGHT}px`
  return s
})

function initInteract() {
  const el = cardRef.value
  if (!el) return
  if (window.matchMedia('(max-width: 780px)').matches) return // 移动端禁用拖拽

  // BLOCK 任务：可拖拽 + 可拉伸
  if (!isDDL.value) {
    interact(el)
      .draggable({
        inertia: false,
        modifiers: [
          interact.modifiers.restrictRect({
            restriction: '#weekly-grid',
            endOnly: false,
          }),
        ],
        autoScroll: { container: '#weekly-scroll-container' },
        listeners: {
          move: dragMove,
          end: onDragEnd,
        },
      })
      .resizable({
        edges: { left: false, right: false, bottom: '.resize-handle.bottom', top: '.resize-handle.top' },
        modifiers: [
          interact.modifiers.restrictEdges({ outer: 'parent' }),
          interact.modifiers.snapSize({
            targets: [interact.createSnapGrid({ x: 1, y: HOUR_HEIGHT / 4 })],
            endOnly: true,
          }),
        ],
        listeners: {
          move: resizeMove,
          end: onResizeEnd,
        },
      })
  } else {
    // DDL 截止线：只拖拽，不拉伸
    interact(el).draggable({
      inertia: false,
      modifiers: [
        interact.modifiers.restrictRect({
          restriction: '#weekly-grid',
          endOnly: false,
        }),
      ],
      autoScroll: { container: '#weekly-scroll-container' },
      listeners: {
        move: dragMove,
        end: onDragEnd,
      },
    })
  }
}

function dragMove(event: any) {
  const target = event.target
  target.style.transition = 'none'
  target.style.animation = 'none'

  const x = (parseFloat(target.getAttribute('data-x')) || 0) + event.dx
  const y = (parseFloat(target.getAttribute('data-y')) || 0) + event.dy

  target.style.transform = `translate(${x}px, ${y}px)`
  target.setAttribute('data-x', String(x))
  target.setAttribute('data-y', String(y))

  target.style.opacity = '0.75'
  target.style.boxShadow = '0 16px 35px rgba(0,0,0,0.3)'
  target.style.zIndex = '9999'
}

function onDragEnd(event: any) {
  const target = event.target as HTMLElement
  target.style.opacity = '1'
  target.style.boxShadow = ''
  target.style.zIndex = ''

  // 找到鼠标下的日期列
  target.style.pointerEvents = 'none'
  const dropTarget = document.elementFromPoint(event.clientX, event.clientY)
  target.style.pointerEvents = 'auto'

  const newColumn = dropTarget?.closest('.day-column') as HTMLElement | null
  const currentColumn = target.closest('.day-column') as HTMLElement | null
  const dateStr = newColumn?.dataset.date || currentColumn?.dataset.date

  if (!dateStr) {
    resetCard(target)
    return
  }

  // 计算新时间
  const initialTop = parseFloat(target.style.top) || 0
  const dragY = parseFloat(target.getAttribute('data-y')) || 0
  const absoluteY = initialTop + dragY - HEADER_HEIGHT - 5
  const totalMinutes = pixelsToMinutes(absoluteY)

  const newStartH = Math.floor(totalMinutes / 60)
  const newStartM = totalMinutes % 60
  const newStartTimeStr = timeStr(newStartH, newStartM)+':00'  // full "HH:mm:ss" for API

  // DDL: deadline = start time
  const isDDLTask = isDDL.value || props.task.taskType === 'DDL' || props.task.duration === 0
  const newDeadline = isDDLTask
    ? timeStr(newStartH, newStartM) + ':00'
    : props.task.deadline || timeStr(newStartH, newStartM) + ':00'
  const newDuration = isDDLTask ? 0 : (props.task.duration || 1)

  emit('dragend', {
    taskId: props.task.id,
    newDate: dateStr,
    newStartTime: newStartTimeStr,
    newDuration,
    newDeadline,
  })

  resetCard(target)
}

function resizeMove(event: any) {
  const target = event.target
  let x = parseFloat(target.getAttribute('data-x')) || 0
  let y = parseFloat(target.getAttribute('data-y')) || 0

  target.style.height = event.rect.height + 'px'

  if (event.edges.top) {
    y += event.deltaRect.top
    target.style.transform = `translate(${x}px, ${y}px)`
    target.setAttribute('data-y', String(y))
  }
}

function onResizeEnd(event: any) {
  const target = event.target as HTMLElement
  const currentColumn = target.closest('.day-column') as HTMLElement | null
  const dateStr = currentColumn?.dataset.date || ''

  const currentHeight = parseFloat(target.style.height)
  let newDuration = currentHeight / HOUR_HEIGHT
  newDuration = Math.round(newDuration * 4) / 4 // snap to 0.25h
  if (newDuration < 0.25) newDuration = 0.25

  // 计算新的开始时间（如果顶部被拖动）
  const initialTop = parseFloat(target.style.top) || 0
  const dragY = parseFloat(target.getAttribute('data-y')) || 0
  const absoluteY = initialTop + dragY - HEADER_HEIGHT - 5
  const totalMinutes = pixelsToMinutes(absoluteY)
  const newStartH = Math.floor(totalMinutes / 60)
  const newStartM = totalMinutes % 60
  const newStartTimeStr = timeStr(newStartH, newStartM)+':00'

  // DDL 拉高了 → 自动转 BLOCK
  let newTaskType = props.task.taskType || 'BLOCK'
  let newDeadline: string | null = props.task.deadline || null
  if ((newTaskType === 'DDL' || props.task.duration === 0) && newDuration > 0) {
    newTaskType = 'BLOCK'
    const endTotalMin = totalMinutes + newDuration * 60
    const endH = Math.floor(endTotalMin / 60)
    const endM = Math.round(endTotalMin % 60)
    newDeadline = timeStr(endH, endM)+':00'
  }

  emit('resizeend', {
    taskId: props.task.id,
    date: dateStr,
    newStartTime: newStartTimeStr,
    newDuration,
    newTaskType,
    newDeadline,
  })

  resetCard(target)
}

function resetCard(target: HTMLElement) {
  target.style.transform = ''
  target.style.transition = ''
  target.style.animation = ''
  target.style.opacity = ''
  target.style.boxShadow = ''
  target.style.zIndex = ''
  target.removeAttribute('data-x')
  target.removeAttribute('data-y')
}

onMounted(() => {
  // 延迟初始化，等 DOM 渲染完毕
  requestAnimationFrame(() => initInteract())
})

onUnmounted(() => {
  const el = cardRef.value
  if (el && typeof interact !== 'undefined') {
    try { interact(el).unset() } catch { /* ignore */ }
  }
})
</script>

<style scoped>
.event-item {
  position: absolute; left: 6px; right: 6px;
  background: var(--task-color, #b5d528aa); border-radius: 6px;
  padding: 4px 6px; font-size: 0.68rem; cursor: pointer; overflow: hidden; z-index: 2;
  transition: box-shadow 0.15s; border: 1px solid rgba(255,255,255,0.08); color: #000;
}
.event-item:hover { z-index: 5; box-shadow: 0 4px 16px rgba(0,0,0,0.35); }
.event-item.important { border-left: 3px solid #f44336; }

.resize-handle {
  position: absolute; left: 0; right: 0; height: 8px; z-index: 10;
}
.resize-handle.top { top: -2px; cursor: ns-resize; }
.resize-handle.bottom { bottom: -2px; cursor: ns-resize; }

.ddl-line-task {
  cursor: pointer;
  z-index: 4;
  overflow: visible;
}
.ddl-line-task:hover { z-index: 4; filter: brightness(1.3); }

/* 浮在线上方的文字区域 */
.ddl-label {
  position: absolute;
  left: 0;
  bottom: 6px;
  display: flex;
  align-items: baseline;
  gap: 4px;
  white-space: nowrap;
}
.event-time-tag { font-size: 0.58rem; opacity: 0.75; font-weight: 700; white-space: nowrap; }
.event-name-text { font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.event-note-text { font-size: 0.56rem; opacity: 0.6; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

.del-btn-mini {
  position: absolute; top: 2px; right: 4px; background: none; border: none;
  color: inherit; font-size: 0.75rem; cursor: pointer; opacity: 0;
  transition: opacity 0.15s; padding: 0 3px;
}
.event-item:hover .del-btn-mini { opacity: 0.7; }
.del-btn-mini:hover { opacity: 1 !important; }

.ddl-del {
  right: 2px;
  top: 50%;
  transform: translateY(-50%);
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: #eee;
  color: #000;
  font-size: 0.6rem;
  display: flex;
  align-items: center;
  justify-content: center;
  line-height: 1;
}
.ddl-line-task:hover .ddl-del { opacity: 1; }
.ddl-del:hover { background: #ff5050; color: #fff; }

/* 暗色模式 */
:root.dark .ddl-del { background: #333; color: rgba(255,255,255,0.7); }
:root.dark .ddl-del:hover { background: #ff5050; color: #fff; }
</style>
