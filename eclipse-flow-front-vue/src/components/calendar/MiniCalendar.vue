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
.mini-calendar {
  padding: 18px; border-radius: 20px;
  background: rgba(0,0,0,0.06); border: 1px solid rgba(0,0,0,0.12);
  box-shadow: 0 4px 16px rgba(0,0,0,0.06), inset 0 1px 0 rgba(255,255,255,0.4);
}
.dark .mini-calendar {
  background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1);
  box-shadow: 0 4px 16px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.05);
}
.month-nav { display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; font-weight: 900; }
.month-nav button {
  border: none; background: var(--black); color: var(--white);
  font-weight: 900; cursor: pointer; padding: 4px 10px; border-radius: 6px;
}
.month-nav span { font-weight: 700; font-size: 0.78rem; }
.mini-grid-head { display: grid; grid-template-columns: repeat(7,1fr); text-align: center; font-size: 0.58rem; opacity: 0.35; margin-bottom: 4px; }
.mini-days { display: grid; grid-template-columns: repeat(7,1fr); gap: 1px; }
.mini-day { aspect-ratio: 1; display: flex; align-items: center; justify-content: center; font-size: 0.68rem; border-radius: 50%; cursor: pointer; position: relative; }
.mini-day.empty { cursor: default; }
.mini-day.active { background: var(--accent); color: #000; font-weight: 700; }
.mini-day.has-tasks::after { content: ''; position: absolute; bottom: 1px; width: 3px; height: 3px; border-radius: 50%; background: var(--accent); }
.today-link {
  border: none; background: var(--black); color: var(--white);
  font-weight: 900; cursor: pointer; width: 100%; margin-top: 15px;
  padding: 10px; border-radius: 10px; font-size: 0.7rem; letter-spacing: 0.04em;
}
.today-link:hover { opacity: 0.85; }
</style>
