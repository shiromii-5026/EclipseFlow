<template>
  <div
    class="event-item"
    :class="{ 'ddl-line-task': isDDL, important: isToday && !task.color }"
    :style="cardStyle"
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
      <div class="event-time-tag">{{ task.time }}</div>
      <div class="event-name-text">{{ task.name }}</div>
      <div v-if="task.notes" class="event-note-text">{{ task.notes }}</div>
      <button class="del-btn-mini" @click.stop="$emit('delete')">&times;</button>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { TaskCache } from '@/types'

const props = defineProps<{ task: TaskCache; isToday: boolean }>()
defineEmits<{ delete: []; edit: [] }>()

const isDDL = computed(() => props.task.taskType==='DDL'||props.task.duration===0)

const cardStyle = computed(() => {
  const [h,m] = props.task.time.split(':').map(Number)
  const top = (h+m/60)*80+60
  const s: Record<string,string> = { top: `${top}px` }
  if (props.task.color) s['--task-color'] = props.task.color
  if (isDDL.value) {
    const c = props.task.color||'#9fc518'
    s['--ddl-color'] = c.substring(0,7)
    return {...s, height:'4px',minHeight:'4px',padding:'0',borderRadius:'0',border:'none',backgroundColor:c,boxShadow:`0 0 6px ${c.length>=7?c.substring(0,7)+'66':c}`}
  }
  s.height = `${(props.task.duration??1)*80}px`
  return s
})
</script>

<style scoped>
.event-item {
  position: absolute; left: 2px; right: 2px;
  background: var(--task-color, #b5d528aa); border-radius: 6px;
  padding: 4px 6px; font-size: 0.68rem; cursor: pointer; overflow: hidden; z-index: 2;
  transition: box-shadow 0.15s; border: 1px solid rgba(255,255,255,0.08); color: #000;
}
.event-item:hover { z-index: 5; box-shadow: 0 4px 16px rgba(0,0,0,0.35); }
.event-item.important { border-left: 3px solid #f44336; }
.ddl-line-task { cursor: pointer; }
.ddl-label { display: flex; align-items: center; gap: 4px; padding: 0 2px; height: 100%; }
.event-time-tag { font-size: 0.58rem; opacity: 0.75; font-weight: 700; white-space: nowrap; }
.event-name-text { font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.event-note-text { font-size: 0.56rem; opacity: 0.6; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.del-btn-mini { position: absolute; top: 2px; right: 4px; background: none; border: none; color: inherit; font-size: 0.75rem; cursor: pointer; opacity: 0; transition: opacity 0.15s; padding: 0 3px; }
.event-item:hover .del-btn-mini { opacity: 0.7; }
.del-btn-mini:hover { opacity: 1 !important; }
</style>
