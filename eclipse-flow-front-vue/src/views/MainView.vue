<template>
  <div class="app-shell">
    <!-- ===== 桌面侧边栏 ===== -->
    <aside v-if="!ui.isMobile" class="sidebar glass">
      <div class="logo-area">
        <span class="material-symbols-outlined filled">tonality</span>
        <span class="logo-text">EclipseFlow</span>
      </div>
      <div class="logo-divider" />

      <MiniCalendar />
      <FriendPanel />
      <CountdownList />
    </aside>

    <!-- ===== 移动端抽屉 ===== -->
    <teleport to="body">
      <div v-if="ui.isMobile && ui.sidebarOpen" class="sidebar-backdrop" @click="ui.closeSidebar()" />
      <aside v-if="ui.isMobile" class="sidebar-drawer glass" :class="{ open: ui.sidebarOpen }">
        <MiniCalendar />
        <FriendPanel />
        <CountdownList />
      </aside>
    </teleport>

    <!-- ===== 主内容 ===== -->
    <main class="main-content">
      <!-- 顶栏 -->
      <div class="top-right-nav">
        <div class="user-meta-group">
          <div class="user-text">
            <span class="u-name">{{ auth.username || 'OPERATOR_01' }}</span>
            <span class="u-status">在线 // 实时同步</span>
          </div>
          <img src="https://api.dicebear.com/7.x/pixel-art/svg?seed=Eclipse" alt="Avatar" class="avatar-pixel" />
        </div>
        <button class="theme-btn" @click="ui.toggleTheme()" :title="ui.isDark ? '切换日间' : '切换夜间'">
          <span class="material-symbols-outlined">contrast</span>
        </button>
        <button class="theme-btn logout-btn" @click="auth.logout()" title="退出登录">出</button>
      </div>

      <header>
        <div class="mobile-top-bar">
          <button v-if="ui.isMobile" class="sidebar-toggle-btn" @click="ui.openSidebar()">&#9776;</button>
          <h1 id="range-title">日程安排 // {{ formatDate(monday) }} - {{ formatDate(sunday) }}</h1>
        </div>
        <div class="header-divider">
          <div class="acid-segment" />
          <div class="header-barcode" />
        </div>
        <div class="view-switcher">
          <button :class="{ active: cal.viewMode === 'week' }" @click="switchView('week')">周</button>
          <button :class="{ active: cal.viewMode === 'day' }" @click="switchView('day')">日</button>
          <button :class="{ active: cal.viewMode === 'list' }" @click="switchView('list')">列表</button>
        </div>
      </header>

      <!-- 周视图 -->
      <div v-if="cal.viewMode === 'week'" id="weekly-scroll-container" class="glass">
        <div class="weekly-grid" id="weekly-grid">
          <div class="time-gutter">
            <div class="column-header">CST</div>
            <div v-for="h in 24" :key="h" class="time-slot-label">{{ h - 1 }}:00</div>
          </div>
          <div
            v-for="col in columns"
            :key="col.dateStr"
            class="day-column"
            :class="{ today: col.isToday }"
            :data-date="col.dateStr"
          >
            <div class="column-header">
              {{ col.weekLabel }} <span>{{ col.month }}/{{ col.day }}</span>
            </div>
            <div v-if="col.isCurrentDay" class="current-time-line" :style="{ top: currentTimeTop + 'px' }" />
            <TaskCard
              v-for="t in col.tasks"
              :key="t.id"
              :task="t"
              :is-today="col.isToday"
              @delete="handleDelete(t.id)"
              @edit="handleEdit({ task: t, dateStr: col.dateStr })"
            />
          </div>
        </div>
      </div>

      <!-- 日视图 -->
      <div v-if="cal.viewMode === 'day'" id="day-view-container" class="day-view-container glass">
        <div class="day-nav">
          <button @click="cal.prevDay()">&lt;</button>
          <span>{{ cal.currentFocusDate.getMonth()+1 }}月{{ cal.currentFocusDate.getDate() }}日 {{ weekDayName }}</span>
          <button @click="cal.nextDay()">&gt;</button>
        </div>
        <div class="day-grid" style="position:relative">
          <template v-for="h in 24" :key="h">
            <div style="display:flex;height:80px;border-bottom:1px solid var(--grid-line)">
              <div style="width:48px;font-size:0.6rem;opacity:0.35;text-align:right;padding:2px 6px">{{ h-1 }}:00</div>
              <div style="flex:1" />
            </div>
          </template>
          <div v-if="cal.focusDateStr === todayStr" class="current-time-line" :style="{ top: (new Date().getHours()+new Date().getMinutes()/60)*80+'px', left:'48px', right:0 }" />
          <div
            v-for="t in dayTasks"
            :key="t.id"
            class="day-task-card"
            :style="{
              top: dayTaskTop(t)+'px',
              height: Math.max((t.duration||0.5)*80,20)+'px',
              '--task-color': t.color || '#b5d528aa'
            }"
            @click="handleEdit({ task: t, dateStr: cal.focusDateStr })"
          >{{ t.time }} {{ t.name }}</div>
        </div>
      </div>

      <!-- 列表视图 -->
      <div v-if="cal.viewMode === 'list'" class="list-view glass">
        <div style="padding:12px 16px;font-size:0.8rem;opacity:0.5">本周任务 ({{ allTasks.length }})</div>
        <div v-if="allTasks.length===0" style="text-align:center;opacity:0.3;padding:40px">暂无任务</div>
        <div
          v-for="t in allTasks" :key="t.id+t._date"
          class="task-list-item"
          @click="ui.editingTask={task:t as any,dateStr:t._date};ui.showTaskModal=true"
        >
          <div style="width:4px;height:24px;border-radius:2px;margin-right:10px;flex-shrink:0" :style="{background:t.color||'#b5d528aa'}" />
          <div style="flex:1">
            <div style="font-weight:600;font-size:0.82rem">{{ t.name }}</div>
            <div style="font-size:0.65rem;opacity:0.5">{{ t._date }} {{ t.time }}</div>
          </div>
          <span style="font-size:0.72rem;opacity:0.6">{{ t.duration>0?t.duration+'h':'DDL' }}</span>
        </div>
      </div>

      <!-- ===== 表单区域 ===== -->
      <section id="add-task-section">
        <h2 class="form-title">丨 新建任务录入</h2>
        <div class="geometric-add-form glass">
          <input v-model="newTask.name" type="text" placeholder="任务内容 (例如: 高等数学作业)" class="task-input" />
          <div class="input-group">
            <input v-model="newTask.date" type="date" class="cyber-input" />
            <div class="time-picker-cyber">
              <select v-model="newTask.hour" class="cyber-select">
                <option v-for="h in 24" :key="h" :value="String(h-1).padStart(2,'0')">{{ String(h-1).padStart(2,'0') }}</option>
              </select>
              <span class="cyber-divider">:</span>
              <select v-model="newTask.minute" class="cyber-select">
                <option v-for="m in 12" :key="m" :value="String((m-1)*5).padStart(2,'0')">{{ String((m-1)*5).padStart(2,'0') }}</option>
              </select>
            </div>
            <div class="time-picker-cyber">
              <span class="deadline-label">截止（可选）</span>
              <select v-model="newTask.deadlineHour" class="cyber-select">
                <option value="">--</option>
                <option v-for="h in 24" :key="h" :value="String(h-1).padStart(2,'0')">{{ String(h-1).padStart(2,'0') }}</option>
              </select>
              <span class="cyber-divider">:</span>
              <select v-model="newTask.deadlineMin" class="cyber-select">
                <option value="">--</option>
                <option v-for="m in 12" :key="m" :value="String((m-1)*5).padStart(2,'0')">{{ String((m-1)*5).padStart(2,'0') }}</option>
              </select>
            </div>
            <select v-model="newTask.color" class="cyber-select">
              <option value="#b5d528aa">翠绿（默认）</option>
              <option value="#f89828aa">鲜橙</option>
              <option value="#5eb8e8">天蓝</option>
              <option value="#f07880">赤红</option>
              <option value="#b088e0aa">淡紫</option>
            </select>
            <button class="save-btn" @click="saveNewTask">立即保存 +</button>
          </div>
          <!-- OCR 拖拽区 -->
          <div class="ocr-drop-zone" @click="$refs.ocrInputRef?.click()">
            <span class="material-symbols-outlined">imagesmode</span>
            <span class="ocr-drop-text">拖拽图片到这里，自动识别文字填表</span>
            <span class="ocr-drop-hint">或点击选择文件</span>
            <input ref="ocrInputRef" type="file" accept="image/*" hidden @change="onOcrFile" />
            <span class="ocr-status">{{ ocrStatus }}</span>
          </div>
        </div>
      </section>
    </main>

    <!-- 移动端底部导航 -->
    <nav v-if="ui.isMobile" class="bottom-nav">
      <div class="bottom-nav-item" :class="{active:cal.viewMode==='week'}" @click="switchView('week')">
        <span class="material-symbols-outlined">calendar_view_week</span>
        <span class="bottom-nav-label">日程</span>
      </div>
      <div class="bottom-nav-item" :class="{active:cal.viewMode==='day'}" @click="switchView('day')">
        <span class="material-symbols-outlined">calendar_today</span>
        <span class="bottom-nav-label">今日</span>
      </div>
      <div class="bottom-nav-item" @click="ui.openSidebar()">
        <span class="material-symbols-outlined">group</span>
        <span class="bottom-nav-label">好友</span>
      </div>
      <div class="bottom-nav-item" @click="ui.openSidebar()">
        <span class="material-symbols-outlined">settings</span>
        <span class="bottom-nav-label">设置</span>
      </div>
    </nav>

    <!-- FAB -->
    <button v-if="ui.isMobile" class="fab" @click="scrollToForm">+</button>

    <!-- Modals -->
    <TaskModal :visible="ui.showTaskModal" :edit-task="ui.editingTask" @close="ui.showTaskModal=false;ui.editingTask=null" @saved="onSaved" />
    <ChatModal />
    <ToastNotification />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, reactive, ref } from 'vue'
import { useCalendarStore } from '@/stores/calendar'
import { useTaskStore } from '@/stores/tasks'
import { useAuthStore } from '@/stores/auth'
import { useFriendStore } from '@/stores/friends'
import { useUiStore } from '@/stores/ui'
import { ocrApi } from '@/services/api'
import MiniCalendar from '@/components/calendar/MiniCalendar.vue'
import CountdownList from '@/components/layout/CountdownList.vue'
import FriendPanel from '@/components/social/FriendPanel.vue'
import ChatModal from '@/components/social/ChatModal.vue'
import TaskCard from '@/components/calendar/TaskCard.vue'
import TaskModal from '@/components/tasks/TaskModal.vue'
import ToastNotification from '@/components/layout/ToastNotification.vue'
import type { TaskCache } from '@/types'

const cal = useCalendarStore()
const taskStore = useTaskStore()
const auth = useAuthStore()
const friend = useFriendStore()
const ui = useUiStore()

const weekNames = ['周一','周二','周三','周四','周五','周六','周日']
const weekDayName = computed(() => ['周日','周一','周二','周三','周四','周五','周六'][cal.currentFocusDate.getDay()])
const todayStr = computed(() => cal.getCSTDateStr(new Date()))

const monday = computed(() => cal.getWeekRange(cal.currentFocusDate).monday)
const sunday = computed(() => cal.getWeekRange(cal.currentFocusDate).sunday)

function formatDate(d: Date) { return `${d.getMonth()+1}月${d.getDate()}日` }

// ---- 周视图列 ----
interface Col { dateStr: string; weekLabel: string; month: number; day: number; isToday: boolean; isCurrentDay: boolean; tasks: TaskCache[] }
const columns = computed<Col[]>(() => {
  const { monday: mon } = cal.getWeekRange(cal.currentFocusDate)
  const today = new Date()
  const ts = cal.getCSTDateStr(today)
  const cols: Col[] = []
  for (let i = 0; i < 7; i++) {
    const cur = new Date(mon); cur.setDate(mon.getDate() + i)
    const ds = cal.getCSTDateStr(cur)
    cols.push({
      dateStr: ds, weekLabel: weekNames[i], month: cur.getMonth()+1, day: cur.getDate(),
      isToday: ds === ts,
      isCurrentDay: cur.getFullYear()===today.getFullYear() && cur.getMonth()===today.getMonth() && cur.getDate()===today.getDate(),
      tasks: taskStore.getTasksByDate(ds),
    })
  }
  return cols
})

const currentTimeTop = computed(() => { const n=new Date(); return 60 + (n.getHours()+n.getMinutes()/60)*80 })

// ---- 日视图 ----
const dayTasks = computed(() => (taskStore.storage[cal.focusDateStr]||[]).filter(t=>t.taskType!=='DDL'||t.duration===0))
function dayTaskTop(t:TaskCache){ const [h,m]=t.time.split(':').map(Number); return (h+m/60)*80 }

// ---- 列表视图 ----
const allTasks = computed(() => {
  const { monday: mon } = cal.getWeekRange(cal.currentFocusDate)
  const r: Array<TaskCache&{_date:string}> = []
  for (let i=0;i<7;i++){ const cur=new Date(mon);cur.setDate(mon.getDate()+i);const k=cal.getCSTDateStr(cur);(taskStore.storage[k]||[]).forEach(t=>r.push({...t,_date:k})) }
  r.sort((a,b)=>a._date.localeCompare(b._date)||a.time.localeCompare(b.time))
  return r
})

// ---- 新任务表单 ----
const newTask = reactive({ name:'', date:cal.focusDateStr, hour:'09', minute:'00', deadlineHour:'', deadlineMin:'', color:'#b5d528aa' })
const ocrStatus = ref('')
const ocrInputRef = ref<HTMLInputElement|null>(null)

async function saveNewTask() {
  if (!newTask.name || !newTask.date) { ui.showToast('请填写任务名称和日期'); return }
  const st = `${newTask.hour}:${newTask.minute}`
  let duration: number; let deadline: string|null=null; let taskType: string
  if (newTask.deadlineHour!=='' && newTask.deadlineMin!=='') {
    taskType='BLOCK'; const sm=parseInt(newTask.hour)*60+parseInt(newTask.minute); const em=parseInt(newTask.deadlineHour)*60+parseInt(newTask.deadlineMin)
    duration=(em-sm)/60; if(duration<=0){ui.showToast('截止时间必须晚于开始时间');return}; deadline=`${newTask.deadlineHour}:${newTask.deadlineMin}:00`
  } else { taskType='DDL'; duration=0; deadline=`${newTask.hour}:${newTask.minute}:00` }
  await taskStore.saveTask({ taskName:newTask.name, taskDate:newTask.date, startTime:st+':00', duration, deadline, taskType, color:newTask.color })
  newTask.name = ''; ui.showToast('任务已创建')
}

async function onOcrFile(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]; if(!file) return
  ocrStatus.value='识别中...'
  try {
    const r = await ocrApi.uploadImage(file, newTask.date)
    if(r.tasks?.length){ const t=r.tasks[0] as any; newTask.name=t.taskName||''; if(t.startTime?.length>=5){newTask.hour=t.startTime.substring(0,2);newTask.minute=t.startTime.substring(3,5)}; ocrStatus.value='识别成功！' }
    else ocrStatus.value='未识别到任务'
  } catch { ocrStatus.value='识别失败' }
}

function switchView(v:'week'|'day'|'list') { cal.viewMode=v }
function handleDelete(id:number){ if(confirm('确定删除？')) taskStore.deleteTask(id) }
function handleEdit(p:{task:TaskCache;dateStr:string}){ ui.editingTask={task:p.task as any, dateStr:p.dateStr}; ui.showTaskModal=true }
function onSaved(){}
function scrollToForm(){ document.getElementById('add-task-section')?.scrollIntoView({behavior:'smooth'}) }

onMounted(async ()=>{
  ui.initTheme()
  await taskStore.fetchTasks()
  await friend.refreshFriends()
  friend.startPolling()
  setTimeout(()=>{
    const c=document.getElementById('weekly-scroll-container'); if(!c||!cal.isViewingCurrentWeek) return
    const n=new Date(); const pos=60+(n.getHours()+n.getMinutes()/60)*80
    c.scrollTo({top:Math.max(0,pos-c.clientHeight*0.4),behavior:'smooth'})
  },300)
})
onUnmounted(()=>friend.stopPolling())
</script>

<style scoped>
/* ===== Layout ===== */
.app-shell { display: flex; height: 100vh; width: 100%; }

/* ===== 侧边栏 ===== */
.sidebar {
  width: 260px; flex-shrink: 0; overflow-y: auto; padding: 18px 14px;
  display: flex; flex-direction: column; gap: 14px;
  border-right: var(--border-subtle);
}
.logo-area { display: flex; align-items: center; gap: 8px; }
.logo-area .material-symbols-outlined { font-size: 28px; color: var(--accent); }
.logo-text { font-size: 1.2rem; font-weight: 900; letter-spacing: 0.06em; color: var(--accent); }
.logo-divider { height: 4px; background: var(--accent); border-radius: 2px; margin: 4px 0; }

/* ===== 主内容 ===== */
.main-content { flex: 1; display: flex; flex-direction: column; overflow: hidden; position: relative; min-width: 0; }

/* 顶栏 */
.top-right-nav {
  position: absolute; top: 12px; right: 16px; display: flex; align-items: center; gap: 10px; z-index: 20;
}
.user-meta-group { display: flex; align-items: center; gap: 10px; }
.user-text { text-align: right; line-height: 1.3; }
.u-name { font-weight: 900; font-size: 0.78rem; letter-spacing: 0.06em; display: block; }
.u-status { font-size: 0.6rem; opacity: 0.45; }
.avatar-pixel { width: 40px; height: 40px; border-radius: 50%; border: var(--border-subtle); }
.theme-btn {
  width: 36px; height: 36px; border-radius: 50%; border: var(--border-subtle);
  background: var(--glass-bg); backdrop-filter: blur(12px); cursor: pointer;
  display: flex; align-items: center; justify-content: center; color: var(--black);
}
.theme-btn:hover { background: var(--accent-bg); }
.logout-btn { font-size: 0.7rem; font-weight: 900; }

/* Header */
header { padding: 10px 16px 0; flex-shrink: 0; }
.mobile-top-bar { display: flex; align-items: center; gap: 10px; }
.sidebar-toggle-btn { background: none; border: none; color: var(--black); font-size: 1.4rem; cursor: pointer; }
#range-title { font-size: 0.9rem; font-weight: 700; opacity: 0.6; margin: 0; }
.header-divider { display: flex; align-items: center; gap: 10px; margin: 6px 0; }
.acid-segment { flex: 1; height: 2px; background: var(--accent); }
.header-barcode { width: 60px; height: 12px;
  background: repeating-linear-gradient(90deg, var(--accent) 0, var(--accent) 2px, transparent 2px, transparent 4px);
}
.view-switcher { display: flex; gap: 6px; margin-bottom: 8px; }
.view-switcher button {
  padding: 4px 14px; border-radius: 6px; border: var(--border-subtle);
  background: transparent; color: var(--black); cursor: pointer; font-size: 0.72rem;
}
.view-switcher button.active { background: var(--accent); color: #000; border-color: var(--accent); }

/* ===== 周视图 ===== */
#weekly-scroll-container { flex: 1; overflow: auto; border-radius: 12px; margin: 0 10px 10px; }
.weekly-grid { display: flex; min-width: 780px; min-height: 100%; }
.time-gutter { width: 52px; flex-shrink: 0; border-right: 1px solid var(--grid-line); }
.time-slot-label { height: var(--hour-height); font-size: 0.58rem; display: flex; align-items: flex-start; justify-content: flex-end; padding-right: 6px; opacity: 0.35; }
.column-header { height: var(--header-height); display: flex; flex-direction: column; align-items: center; justify-content: center; font-size: 0.7rem; font-weight: 600; border-bottom: 1px solid var(--grid-line); }
.column-header span { font-size: 0.58rem; opacity: 0.5; }
.day-column { flex: 1; min-width: 100px; position: relative; border-right: 1px solid var(--grid-line); }
.day-column.today { background: var(--today-highlight); }
.current-time-line { position: absolute; left: 0; right: 0; height: 2px; background: #f44336; z-index: 10; pointer-events: none; }
.current-time-line::before { content: ''; position: absolute; left: -4px; top: -3px; width: 8px; height: 8px; border-radius: 50%; background: #f44336; }

/* ===== 日视图 ===== */
.day-view-container { flex: 1; overflow-y: auto; border-radius: 12px; margin: 0 10px 10px; padding: 8px; }
.day-nav { display: flex; justify-content: space-between; align-items: center; padding: 6px 8px; font-weight: 600; font-size: 0.85rem; }
.day-nav button { background: none; border: 1px solid var(--grid-line); color: var(--black); border-radius: 6px; padding: 4px 10px; cursor: pointer; }
.day-task-card {
  position: absolute; left: 52px; right: 6px; background: var(--task-color); border-radius: 6px;
  padding: 4px 8px; font-size: 0.7rem; cursor: pointer; z-index: 2; color: #000; overflow: hidden;
}

/* ===== 列表视图 ===== */
.list-view { flex: 1; overflow-y: auto; border-radius: 12px; margin: 0 10px 10px; }
.task-list-item { display: flex; align-items: center; padding: 10px 16px; cursor: pointer; border-bottom: 1px solid var(--grid-line); }
.task-list-item:hover { background: var(--accent-bg); }

/* ===== 表单区 ===== */
#add-task-section { flex-shrink: 0; padding: 10px 16px 16px; }
.form-title { font-size: 0.78rem; font-weight: 700; letter-spacing: 0.08em; opacity: 0.5; margin-bottom: 8px; }
.geometric-add-form { border-radius: 14px; padding: 16px; }
.task-input { width: 100%; padding: 10px 14px; border-radius: 10px; border: var(--border-subtle); background: var(--white); color: var(--black); font-size: 0.85rem; margin-bottom: 10px; }
.input-group { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
.cyber-input { padding: 6px 10px; border-radius: 8px; border: var(--border-subtle); background: var(--white); color: var(--black); font-size: 0.8rem; }
.time-picker-cyber { display: flex; align-items: center; gap: 2px; }
.cyber-select { padding: 6px 8px; border-radius: 8px; border: var(--border-subtle); background: var(--white); color: var(--black); font-size: 0.78rem; }
.cyber-divider { font-weight: 700; margin: 0 1px; }
.deadline-label { font-size: 0.6rem; opacity: 0.5; margin-right: 2px; }
.save-btn { padding: 8px 18px; border-radius: 10px; border: none; background: var(--accent); color: #000; font-weight: 700; cursor: pointer; font-size: 0.82rem; }
.save-btn:hover { background: var(--accent-bright); }
.ocr-drop-zone {
  margin-top: 10px; border: 2px dashed var(--grid-line); border-radius: 10px; padding: 14px;
  text-align: center; cursor: pointer; font-size: 0.75rem; opacity: 0.7; transition: 0.2s;
  display: flex; flex-direction: column; align-items: center; gap: 4px;
}
.ocr-drop-zone:hover { opacity: 1; border-color: var(--accent); }
.ocr-drop-text { font-size: 0.78rem; }
.ocr-drop-hint { font-size: 0.65rem; opacity: 0.5; }
.ocr-status { font-size: 0.7rem; color: var(--accent); }

/* ===== 移动端抽屉 ===== */
.sidebar-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,0.5); z-index: 100; }
.sidebar-drawer { position: fixed; left: 0; top: 0; bottom: 0; width: 260px; z-index: 101; transform: translateX(-100%); transition: transform 0.3s ease; padding: 14px; overflow-y: auto; }
.sidebar-drawer.open { transform: translateX(0); }

/* ===== 移动端底部 ===== */
.bottom-nav { display: flex; justify-content: space-around; padding: 4px 0; border-top: var(--border-subtle); background: var(--bg); flex-shrink: 0; }
.bottom-nav-item { display: flex; flex-direction: column; align-items: center; padding: 4px 12px; cursor: pointer; opacity: 0.4; font-size: 0.6rem; gap: 2px; }
.bottom-nav-item.active { opacity: 1; color: var(--accent); }
.bottom-nav-item .material-symbols-outlined { font-size: 20px; }
.bottom-nav-label { font-size: 0.6rem; }
.fab { position: fixed; bottom: 70px; right: 20px; width: 48px; height: 48px; border-radius: 50%; background: var(--accent); color: #000; font-size: 1.5rem; border: none; cursor: pointer; z-index: 50; box-shadow: 0 4px 16px rgba(0,0,0,0.3); }
</style>
