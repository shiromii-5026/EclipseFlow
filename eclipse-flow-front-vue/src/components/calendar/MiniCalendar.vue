<template>
  <div class="mini-calendar">
    <div class="month-nav">
      <button @click="cal.prevMonth()">&lt;</button>
      <span>{{ cal.miniMonthDate.getFullYear() }}.{{ String(cal.miniMonthDate.getMonth()+1).padStart(2,'0') }}</span>
      <button @click="cal.nextMonth()">&gt;</button>
    </div>
    <div class="mini-grid-head">
      <span>一</span><span>二</span><span>三</span><span>四</span><span>五</span><span>六</span><span>日</span>
    </div>
    <div class="mini-days">
      <div v-for="(s,i) in daySlots" :key="i"
        class="mini-day"
        :class="{active:s.dateStr===cal.focusDateStr, 'has-tasks':s.hasTasks, empty:!s.day}"
        @click="s.day&&selectDay(s.dateObj!)">
        {{ s.day||'' }}
      </div>
    </div>
    <button class="today-link" @click="cal.goToToday()">回到当前日期</button>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useCalendarStore } from '@/stores/calendar'
import { useTaskStore } from '@/stores/tasks'
import { useUiStore } from '@/stores/ui'

const cal = useCalendarStore()
const taskStore = useTaskStore()
const ui = useUiStore()

interface Slot { day:number|null; dateStr:string; dateObj:Date|null; hasTasks:boolean }
const daySlots = computed<Slot[]>(()=>{
  const y=cal.miniMonthDate.getFullYear(), m=cal.miniMonthDate.getMonth()
  const fd=new Date(y,m,1).getDay(), dim=new Date(y,m+1,0).getDate()
  const slots:Slot[]=[]
  const pad=fd===0?6:fd-1
  for(let i=0;i<pad;i++) slots.push({day:null,dateStr:'',dateObj:null,hasTasks:false})
  for(let d=1;d<=dim;d++){
    const dobj=new Date(y,m,d), ds=cal.getCSTDateStr(dobj)
    slots.push({day:d,dateStr:ds,dateObj:dobj,hasTasks:(taskStore.storage[ds]?.length||0)>0})
  }
  return slots
})

function selectDay(d:Date){ cal.setFocusDate(d); if(ui.isMobile) ui.closeSidebar() }
</script>

<style scoped>
.mini-calendar { font-size: 0.72rem; }
.month-nav { display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; }
.month-nav button { background: none; border: none; color: var(--black); font-size: 1rem; cursor: pointer; opacity: 0.5; }
.month-nav button:hover { opacity: 1; }
.month-nav span { font-weight: 700; font-size: 0.78rem; }
.mini-grid-head { display: grid; grid-template-columns: repeat(7,1fr); text-align: center; font-size: 0.55rem; opacity: 0.35; margin-bottom: 2px; }
.mini-days { display: grid; grid-template-columns: repeat(7,1fr); gap: 1px; }
.mini-day { aspect-ratio: 1; display: flex; align-items: center; justify-content: center; font-size: 0.68rem; border-radius: 50%; cursor: pointer; position: relative; }
.mini-day.empty { cursor: default; }
.mini-day.active { background: var(--accent); color: #000; font-weight: 700; }
.mini-day.has-tasks::after { content: ''; position: absolute; bottom: 1px; width: 3px; height: 3px; border-radius: 50%; background: var(--accent); }
.today-link { display: block; width: 100%; margin-top: 8px; padding: 4px; border-radius: 6px; border: var(--border-subtle); background: transparent; color: var(--black); cursor: pointer; font-size: 0.65rem; opacity: 0.5; }
.today-link:hover { opacity: 1; background: var(--accent-bg); }
</style>
