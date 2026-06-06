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
        <div class="drawer-section">
          <div class="view-switcher drawer-switcher">
            <button :class="{ active: cal.viewMode === 'week' }" @click="switchView('week')">周</button>
            <button :class="{ active: cal.viewMode === 'day' }" @click="switchView('day')">日</button>
            <button :class="{ active: cal.viewMode === 'list' }" @click="switchView('list')">列表</button>
          </div>
        </div>
        <MiniCalendar />
        <FriendPanel />
        <CountdownList />
        <div class="drawer-section drawer-bottom-actions">
          <div class="drawer-user-row" @click="showSettings = true; ui.closeSidebar()">
            <img :src="auth.avatarUrl || defaultAvatar" class="drawer-avatar" />
            <span class="drawer-username">{{ auth.username || 'OPERATOR_01' }}</span>
          </div>
          <button class="drawer-action-btn" @click="showSettings = true; ui.closeSidebar()">
            <span class="material-symbols-outlined">settings</span> 设置
          </button>
          <button class="drawer-action-btn danger" @click="auth.logout()">
            <span class="material-symbols-outlined">logout</span> 退出
          </button>
        </div>
      </aside>
    </teleport>

    <!-- ===== 主内容 ===== -->
    <main class="main-content">
      <!-- 顶栏 -->
      <div v-if="!ui.isMobile" class="top-right-nav">
        <div class="user-meta-group">
          <div class="user-text">
            <span class="u-name">{{ auth.username || 'OPERATOR_01' }}</span>
            <span class="u-status">在线 // 实时同步</span>
          </div>
          <img :src="auth.avatarUrl || defaultAvatar" alt="Avatar" class="avatar-pixel" />
        </div>
        <button class="icon-btn" @click="showSettings = !showSettings" title="设置">
          <span class="material-symbols-outlined">settings</span>
        </button>
      </div>

      <!-- ===== 设置面板 ===== -->
      <div class="add-panel" :class="{ open: showSettings }" style="width:320px">
        <div class="add-panel-inner glass">
          <div class="add-panel-head">
            <span class="add-panel-title">丨 设置</span>
            <button class="add-panel-close" @click="showSettings = false">&times;</button>
          </div>
          <div class="add-panel-body">
            <div class="avatar-crop-box" @click="$refs.avatarInput?.click()" title="点击更换头像">
              <img :src="settingsPreview || defaultAvatar" class="settings-avatar" />
              <span class="crop-icon">&#9998;</span>
            </div>
            <input ref="avatarInput" type="file" accept="image/*" hidden @change="onAvatarFile" />
            <label>头像</label>
            <div class="settings-row">
              <button class="f-btn" @click="$refs.avatarInput?.click()">选择图片</button>
              <button v-if="avatarFileData" class="save-btn" @click="doUploadAvatar">确认上传</button>
            </div>
            <label>用户名</label>
            <div class="settings-row">
              <input v-model="settingsName" type="text" class="f-input" style="flex:1" placeholder="输入新用户名" />
              <button class="save-btn" @click="saveProfile">更新</button>
            </div>
            <span class="settings-hint">修改后 #0000 后缀将保留不变</span>
            <label>主题</label>
            <div class="settings-row">
              <button class="f-btn" @click="ui.toggleTheme(); showSettings=false">{{ ui.isDark ? '切换日间' : '切换夜间' }}</button>
            </div>
            <label>账号</label>
            <div class="settings-row">
              <span class="settings-user">{{ auth.username || 'OPERATOR_01' }}</span>
              <button class="f-btn danger" @click="auth.logout()">退出登录</button>
            </div>
          </div>
        </div>
      </div>

      <!-- ===== 新建任务滑出面板 ===== -->
      <div class="add-panel" :class="{ open: showAddPanel }">
        <div class="add-panel-inner glass">
          <div class="add-panel-head">
            <span class="add-panel-title">丨 新建任务录入</span>
            <button class="add-panel-close" @click="showAddPanel = false">&times;</button>
          </div>
          <div class="add-panel-body">
            <input v-model="newTask.name" type="text" placeholder="任务内容 (例如: 高等数学作业)" class="task-input" @keyup.enter="saveNewTask" />
            <div class="input-group">
              <input v-model="newTask.date" type="date" class="f-input" />
              <div class="time-picker">
                <select v-model="newTask.hour" class="f-select">
                  <option v-for="h in 24" :key="h" :value="String(h-1).padStart(2,'0')">{{ String(h-1).padStart(2,'0') }}</option>
                </select>
                <span class="time-colon">:</span>
                <select v-model="newTask.minute" class="f-select">
                  <option v-for="m in 12" :key="m" :value="String((m-1)*5).padStart(2,'0')">{{ String((m-1)*5).padStart(2,'0') }}</option>
                </select>
              </div>
              <div class="time-picker">
                <span class="deadline-label">截止（可选）</span>
                <select v-model="newTask.deadlineHour" class="f-select">
                  <option value="">--</option>
                  <option v-for="h in 24" :key="h" :value="String(h-1).padStart(2,'0')">{{ String(h-1).padStart(2,'0') }}</option>
                </select>
                <span class="time-colon">:</span>
                <select v-model="newTask.deadlineMin" class="f-select">
                  <option value="">--</option>
                  <option v-for="m in 12" :key="m" :value="String((m-1)*5).padStart(2,'0')">{{ String((m-1)*5).padStart(2,'0') }}</option>
                </select>
              </div>
              <select v-model="newTask.color" class="f-select">
                <option value="#b5d528aa">翠绿（默认）</option>
                <option value="#f89828aa">鲜橙</option>
                <option value="#5eb8e8">天蓝</option>
                <option value="#f07880">赤红</option>
                <option value="#b088e0aa">淡紫</option>
              </select>
              <button class="save-btn" @click="saveNewTask">立即保存 +</button>
            </div>
            <div class="ocr-drop-zone" @click="$refs.ocrInputRef?.click()">
              <span class="material-symbols-outlined ocr-icon">imagesmode</span>
              <span class="ocr-text">拖拽图片到这里，自动识别文字填表</span>
              <span class="ocr-hint">或点击选择文件</span>
              <input ref="ocrInputRef" type="file" accept="image/*" hidden @change="onOcrFile" />
              <span class="ocr-status">{{ ocrStatus }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- ===== Header ===== -->
      <header>
        <div class="header-main-row">
          <button v-if="ui.isMobile" class="sidebar-toggle-btn" @click="ui.openSidebar()">&#9776;</button>
          <h1 id="range-title">日程安排 // {{ formatDate(monday) }} - {{ formatDate(sunday) }}</h1>
          <button class="add-task-btn" @click="showAddPanel = !showAddPanel" title="新建任务">
            <span class="material-symbols-outlined">add</span>
          </button>
        </div>
        <div class="header-controls-row">
          <div class="view-switcher">
            <button :class="{ active: cal.viewMode === 'week' }" @click="switchView('week')">周</button>
            <button :class="{ active: cal.viewMode === 'day' }" @click="switchView('day')">日</button>
            <button :class="{ active: cal.viewMode === 'list' }" @click="switchView('list')">列表</button>
          </div>
        </div>
      </header>

      <!-- ===== 周视图 ===== -->
      <div v-if="cal.viewMode === 'week'" id="weekly-scroll-container" class="glass">
        <div class="weekly-grid" id="weekly-grid">
          <div class="time-gutter">
            <div class="column-header">CST</div>
            <div v-for="h in 24" :key="h" class="time-slot-label">{{ h - 1 }}:00</div>
          </div>
          <!-- 全宽当前时间线 -->
          <div v-if="isCurrentWeek" class="current-time-line-full" :style="{ top: currentTimeTop + 'px' }">
            <span class="time-line-label">{{ currentTimeLabel }}</span>
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
            <TaskCard
              v-for="t in col.tasks"
              :key="t.id"
              :task="t"
              :is-today="col.isToday"
              :data-date="col.dateStr"
              @delete="handleDelete(t.id)"
              @edit="handleEdit({ task: t, dateStr: col.dateStr })"
              @dragend="handleDragEnd"
              @resizeend="handleResizeEnd"
            />
          </div>
        </div>
      </div>

      <!-- ===== 日视图 ===== -->
      <div v-if="cal.viewMode === 'day'" id="day-view-container" class="day-view-container glass">
        <div class="day-nav">
          <button @click="cal.prevDay()">&lt;</button>
          <span class="day-date">{{ cal.currentFocusDate.getMonth()+1 }}月{{ cal.currentFocusDate.getDate() }}日 {{ weekDayName }}</span>
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

      <!-- ===== 列表视图 ===== -->
      <div v-if="cal.viewMode === 'list'" class="list-view glass">
        <div class="list-header">本周任务 ({{ allTasks.length }})</div>
        <div v-if="allTasks.length===0" class="list-empty">暂无任务</div>
        <div
          v-for="t in allTasks" :key="t.id+t._date"
          class="task-list-item"
          @click="ui.editingTask={task:t as any,dateStr:t._date};ui.showTaskModal=true"
        >
          <div class="tl-color" :style="{background:t.color||'#b5d528aa'}" />
          <div class="tl-info">
            <div class="tl-name">{{ t.name }}</div>
            <div class="tl-meta">{{ t._date }} {{ t.time }}</div>
          </div>
          <span class="tl-dur">{{ t.duration>0?t.duration+'h':'DDL' }}</span>
        </div>
      </div>
    </main>

    <!-- FAB -->
    <button v-if="ui.isMobile" class="fab" @click="showAddPanel = true">+</button>

    <!-- Modals -->
    <TaskModal :visible="ui.showTaskModal" :edit-task="ui.editingTask" @close="ui.showTaskModal=false;ui.editingTask=null" @saved="onSaved" />
    <ChatModal />
    <ToastNotification />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, reactive, ref, watch } from 'vue'
import { useCalendarStore } from '@/stores/calendar'
import { useTaskStore } from '@/stores/tasks'
import { useAuthStore } from '@/stores/auth'
import { useFriendStore } from '@/stores/friends'
import { useUiStore } from '@/stores/ui'
import { taskApi, ocrApi } from '@/services/api'
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

const showAddPanel = ref(false)
const showSettings = ref(false)
const settingsName = ref('')
const settingsPreview = ref('')
const defaultAvatar = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect width="64" height="64" fill="#2c2416"/><text x="32" y="40" text-anchor="middle" fill="#b5d528" font-size="28" font-weight="bold">?</text></svg>')

// 打开设置时同步当前值
watch(showSettings, v => {
  if (v) {
    settingsPreview.value = auth.avatarUrl || defaultAvatar
    const name = auth.username || ''
    const hashIdx = name.lastIndexOf('#')
    settingsName.value = hashIdx >= 0 ? name.substring(0, hashIdx) : name
  }
})

const avatarFileData = ref<string | null>(null)

function onAvatarFile(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = () => {
    // 用 canvas 裁剪成 1:1
    const img = new Image()
    img.onload = () => {
      const size = Math.min(img.width, img.height)
      const sx = (img.width - size) / 2
      const sy = (img.height - size) / 2
      const canvas = document.createElement('canvas')
      canvas.width = 256
      canvas.height = 256
      const ctx = canvas.getContext('2d')!
      ctx.drawImage(img, sx, sy, size, size, 0, 0, 256, 256)
      const croppedBase64 = canvas.toDataURL('image/png')
      settingsPreview.value = croppedBase64
      avatarFileData.value = croppedBase64
    }
    img.src = reader.result as string
  }
  reader.readAsDataURL(file)
}

async function doUploadAvatar() {
  if (!avatarFileData.value) return
  console.log('[doUploadAvatar] 准备上传, 数据长度:', avatarFileData.value.length)
  try {
    const result = await auth.uploadAvatar(avatarFileData.value)
    console.log('[doUploadAvatar] 成功, 返回:', result)
    avatarFileData.value = null
    ui.showToast('头像已更新')
  } catch (e: any) {
    console.error('[doUploadAvatar] 失败:', e, e.message)
    ui.showToast(e.message || '头像上传失败')
  }
}

async function saveProfile() {
  console.log('[saveProfile] 准备更新, settingsName:', settingsName.value)
  try {
    const result = await auth.updateProfile(settingsName.value)
    console.log('[saveProfile] 成功, 返回:', result)
    ui.showToast('用户名已更新')
    showSettings.value = false
  } catch (e: any) {
    console.error('[saveProfile] 失败:', e, e.message)
    ui.showToast(e.message || '更新失败')
  }
}
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

const currentTimeLabel = ref('')
const isCurrentWeek = computed(() => {
  const { monday: mon, sunday: sun } = cal.getWeekRange(cal.currentFocusDate)
  const today = new Date()
  const ts = today.getTime()
  return mon.getTime() <= ts && sun.getTime() >= ts
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

async function saveNewTask() {
  if (!newTask.name || !newTask.date) { ui.showToast('请填写任务名称和日期'); return }
  const st = `${newTask.hour}:${newTask.minute}`
  let duration: number; let deadline: string|null=null; let taskType: string
  if (newTask.deadlineHour!=='' && newTask.deadlineMin!=='') {
    taskType='BLOCK'; const sm=parseInt(newTask.hour)*60+parseInt(newTask.minute); const em=parseInt(newTask.deadlineHour)*60+parseInt(newTask.deadlineMin)
    duration=(em-sm)/60; if(duration<=0){ui.showToast('截止时间必须晚于开始时间');return}; deadline=`${newTask.deadlineHour}:${newTask.deadlineMin}:00`
  } else { taskType='DDL'; duration=0; deadline=`${newTask.hour}:${newTask.minute}:00` }
  const taskData = { taskName:newTask.name, taskDate:newTask.date, startTime:st+':00', duration, deadline, taskType, color:newTask.color }
  console.log('[saveNewTask] 准备保存:', taskData)
  try {
    const ok = await taskStore.saveTask(taskData)
    console.log('[saveNewTask] 保存结果:', ok)
    if (ok) { newTask.name = ''; showAddPanel.value = false; ui.showToast('任务已创建') }
    else { ui.showToast('保存失败，请检查控制台') }
  } catch (e: any) {
    console.error('[saveNewTask] 异常:', e, e.message)
    ui.showToast(e.message || '保存异常')
  }
}

async function onOcrFile(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]; if(!file) return
  ocrStatus.value='识别中...'
  try {
    const r = await ocrApi.uploadImage(file, newTask.date)
    if(r.tasks?.length){ const t=r.tasks[0] as any; newTask.name=t.taskName||''; if(t.startTime?.length>=5){newTask.hour=t.startTime.substring(0,2);newTask.minute=t.startTime.substring(3,5)}; ocrStatus.value='识别成功' }
    else ocrStatus.value='未识别到任务'
  } catch { ocrStatus.value='识别失败' }
}

function switchView(v:'week'|'day'|'list') { cal.viewMode=v }
function handleDelete(id:number){ if(confirm('确定删除？')) taskStore.deleteTask(id) }
function handleEdit(p:{task:TaskCache;dateStr:string}){ ui.editingTask={task:p.task as any, dateStr:p.dateStr}; ui.showTaskModal=true }
function onSaved(){}

// ---- 拖拽/拉伸处理 ----
function handleDragEnd(payload: { taskId: number; newDate: string; newStartTime: string; newDuration: number; newDeadline: string }) {
  const { taskId, newDate, newStartTime, newDuration, newDeadline } = payload
  const shortTime = newStartTime.substring(0, 5)
  // 找到旧位置
  let fromDate = ''
  for (const [d, tasks] of Object.entries(taskStore.storage)) {
    if (tasks.find(t => t.id === taskId)) { fromDate = d; break }
  }
  if (!fromDate) return
  const updates: Record<string, unknown> = { time: shortTime, startTime: newStartTime, duration: newDuration, deadline: newDeadline }
  // 乐观更新：跨日期移动
  if (fromDate !== newDate) {
    taskStore.moveTaskLocal(taskId, fromDate, newDate, updates as any)
  } else {
    taskStore.updateTaskLocal(taskId, fromDate, updates as any)
  }
  // 持久化
  taskApi.updateTask({ id: taskId, date: newDate, startTime: newStartTime, duration: newDuration, deadline: newDeadline }).catch(() => {})
}

function handleResizeEnd(payload: { taskId: number; date: string; newStartTime: string; newDuration: number; newTaskType: string; newDeadline: string | null }) {
  const { taskId, date, newStartTime, newDuration, newTaskType, newDeadline } = payload
  const shortTime = newStartTime.substring(0, 5)
  taskStore.updateTaskLocal(taskId, date, {
    time: shortTime, startTime: newStartTime, duration: newDuration,
    taskType: newTaskType as 'DDL' | 'BLOCK',
    deadline: newDeadline || undefined,
  })
  // 持久化：一次性发送所有变更字段
  const body: Record<string, unknown> = { id: taskId, date, startTime: newStartTime, duration: newDuration, taskType: newTaskType }
  if (newDeadline) body.deadline = newDeadline
  taskApi.updateTask(body).catch(() => {})
}

let timeTimer: ReturnType<typeof setInterval> | null = null
function updateTimeLabel() { const n=new Date(); currentTimeLabel.value = `${String(n.getHours()).padStart(2,'0')}:${String(n.getMinutes()).padStart(2,'0')}` }

onMounted(async ()=>{
  ui.initTheme()
  updateTimeLabel()
  timeTimer = setInterval(updateTimeLabel, 10000)
  await auth.fetchProfile()
  await taskStore.fetchTasks()
  await friend.refreshFriends()
  friend.startPolling()
  setTimeout(()=>{
    const c=document.getElementById('weekly-scroll-container'); if(!c) return
    // 纵向：滚动到当前时间附近
    const n=new Date()
    const scrollOpts: { top?: number; left?: number; behavior: ScrollBehavior } = { behavior:'smooth' }
    if(cal.isViewingCurrentWeek){
      const pos=60+(n.getHours()+n.getMinutes()/60)*80
      scrollOpts.top = Math.max(0, pos-c.clientHeight*0.4)
    }
    // 横向：滚动到今天所在列
    const todayCol = c.querySelector('.day-column.today') as HTMLElement|null
    if(todayCol){
      scrollOpts.left = Math.max(0, todayCol.offsetLeft - 52) // 52px = time-gutter width
    }
    c.scrollTo(scrollOpts)
  },500)
})
onUnmounted(()=>{ friend.stopPolling(); if(timeTimer) clearInterval(timeTimer) })
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
.logo-divider { height: 3px; background: linear-gradient(90deg,var(--accent) 0,var(--accent) 30%,transparent 30%,transparent 35%,var(--accent) 35%,var(--accent) 50%,transparent 50%,transparent 55%,var(--accent) 55%,var(--accent) 75%,transparent 75%); opacity: 0.3; border-radius: 1px; margin: 4px 0; }

/* ===== 主内容 ===== */
.main-content { flex: 1; display: flex; flex-direction: column; overflow: hidden; position: relative; min-width: 0; }

/* ===== 顶栏 ===== */
.top-right-nav {
  position: absolute; top: 12px; right: 16px; display: flex; align-items: center; gap: 8px; z-index: 30;
}
.icon-btn {
  width: 36px; height: 36px; border-radius: 50%; border: var(--border-subtle);
  background: var(--glass-bg); backdrop-filter: blur(12px); cursor: pointer;
  display: flex; align-items: center; justify-content: center; color: var(--black);
}
.icon-btn:hover { background: var(--accent-bg); }
.icon-btn .material-symbols-outlined { font-size: 20px; }
.user-meta-group { display: flex; align-items: center; gap: 10px; }
.user-text { text-align: right; line-height: 1.3; }
.u-name { font-weight: 900; font-size: 0.78rem; letter-spacing: 0.06em; display: block; }
.u-status { font-size: 0.6rem; opacity: 0.45; }
.avatar-pixel { width: 40px; height: 40px; border-radius: 50%; border: var(--border-subtle); }

/* 设置面板 */
.avatar-crop-box {
  width: 80px; height: 80px; border-radius: 50%; border: 2px dashed var(--accent);
  margin: 0 auto 12px; cursor: pointer; overflow: hidden; position: relative;
}
.avatar-crop-box:hover { border-style: solid; }
.settings-avatar { width: 100%; height: 100%; object-fit: cover; display: block; }
.crop-icon {
  position: absolute; bottom: 2px; right: 2px; background: var(--accent); color: #000;
  border-radius: 50%; font-size: 11px; width: 18px; height: 18px;
  display: flex; align-items: center; justify-content: center; font-weight: 700;
}
.settings-row { display: flex; gap: 8px; align-items: center; }
.settings-user { font-weight: 700; font-size: 0.85rem; flex: 1; }
.f-btn {
  padding: 6px 14px; border-radius: 8px; border: var(--border-subtle);
  background: rgba(128,128,128,0.15); color: var(--black); cursor: pointer; font-size: 0.75rem;
}
.f-btn:hover { background: var(--accent-bg); }
.f-btn.danger { color: var(--danger); border-color: var(--danger); }
.settings-hint { font-size: 0.6rem; opacity: 0.35; margin: -4px 0 4px; }

/* ===== 滑出添加面板 ===== */
.add-panel {
  position: absolute; top: 60px; right: 16px; z-index: 25;
  width: 460px; max-width: calc(100vw - 32px);
  opacity: 0; visibility: hidden; transform: translateY(-12px);
  transition: all 0.25s var(--ease-fluid);
}
.add-panel.open { opacity: 1; visibility: visible; transform: translateY(0); }
.add-panel-inner { border-radius: 18px; padding: 16px 20px; background: var(--glass-bg); backdrop-filter: blur(30px); border: var(--glass-border); box-shadow: var(--glass-shadow); }
.add-panel-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
.add-panel-title { font-size: 0.78rem; font-weight: 700; letter-spacing: 0.08em; opacity: 0.5; }
.add-panel-close { background: none; border: none; color: var(--black); font-size: 1.3rem; cursor: pointer; opacity: 0.4; line-height: 1; }
.add-panel-close:hover { opacity: 0.8; }
.add-panel-body { display: flex; flex-direction: column; gap: 8px; }
.task-input {
  width: 100%; height: 48px; padding: 0 14px; border-radius: 14px;
  border: var(--border-subtle); background: var(--white); color: var(--black);
  font-size: 0.88rem; font-weight: 700; box-sizing: border-box;
}
.task-input::placeholder { font-weight: 400; opacity: 0.45; }
.input-group { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
.f-input { height: 48px; padding: 0 10px; border-radius: 12px; border: var(--border-subtle); background: var(--white); color: var(--black); font-size: 0.8rem; min-width: 130px; }
.time-picker { display: flex; align-items: center; gap: 2px; }
.f-select { height: 48px; padding: 0 8px; border-radius: 12px; border: var(--border-subtle); background: var(--white); color: var(--black); font-size: 0.78rem; min-width: 60px; }
.time-colon { font-weight: 900; margin: 0 2px; }
.deadline-label { font-size: 0.6rem; opacity: 0.45; margin-right: 2px; white-space: nowrap; }
.save-btn {
  height: 48px; padding: 0 22px; border-radius: 14px; border: none;
  background: var(--accent); color: #000; font-weight: 900; cursor: pointer; font-size: 0.85rem; letter-spacing: 0.04em;
}
.save-btn:hover { background: var(--accent-bright); }
.ocr-drop-zone {
  width: 100%; min-height: 44px; padding: 8px 16px;
  display: flex; flex-wrap: wrap; align-items: center; justify-content: center; gap: 10px;
  border: 1.5px dashed var(--grid-line); border-radius: 14px; cursor: pointer;
  transition: border-color 0.25s ease, background 0.25s ease; user-select: none;
  margin-top: 4px; box-sizing: border-box;
}
.ocr-drop-zone:hover { border-color: var(--accent); background: var(--accent-bg-hover); }
.ocr-icon { font-size: 20px; opacity: 0.5; }
.ocr-text { font-size: 0.8rem; font-weight: 700; opacity: 0.55; }
.ocr-hint { font-size: 0.7rem; opacity: 0.35; }
.ocr-status { font-size: 0.75rem; font-weight: 700; color: var(--accent); }

/* ===== Header ===== */
header { padding: 14px 16px 0; padding-top: calc(14px + env(safe-area-inset-top, 0px)); flex-shrink: 0; }

/* 第一行: 标题 + 添加按钮 */
.header-main-row { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; }
.sidebar-toggle-btn { background: none; border: none; color: var(--black); font-size: 1.3rem; cursor: pointer; flex-shrink: 0; }
#range-title {
  flex: 1; margin: 0; font-size: 1.2rem; font-weight: 900;
  letter-spacing: 0.5px; opacity: 0.85; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}

/* 第二行: 视图切换 */
.header-controls-row { display: flex; align-items: center; margin-bottom: 4px; }
.view-switcher { display: flex; gap: 4px; }
.view-switcher button {
  padding: 4px 14px; border-radius: 7px; border: var(--border-subtle);
  background: rgba(128,128,128,0.1); color: var(--black); cursor: pointer; font-size: 0.7rem; font-weight: 600;
}
.view-switcher button.active { background: var(--accent); color: #000; border-color: var(--accent); }

.add-task-btn {
  padding: 4px 10px; border-radius: 7px; border: none;
  background: var(--accent); cursor: pointer; display: flex; align-items: center; flex-shrink: 0;
}
.add-task-btn .material-symbols-outlined { font-size: 16px; color: #000; font-weight: 900; font-variation-settings: 'FILL' 1, 'wght' 900; }
.add-task-btn:hover { background: var(--accent-bright); }

/* ===== 周视图 ===== */
#weekly-scroll-container { flex: 1; overflow-y: auto; overflow-x: auto; margin: 0 12px 12px; border-radius: 20px; scroll-behavior: smooth; }
@media (max-width: 780px) {
  #weekly-scroll-container { margin: 0 4px 4px; border-radius: 14px; -webkit-overflow-scrolling: touch; }
}
#weekly-scroll-container::-webkit-scrollbar { width: 6px; }
#weekly-scroll-container::-webkit-scrollbar-thumb { background: var(--accent); border-radius: 3px; }
.weekly-grid { display: flex; min-width: 780px; min-height: 100%; position: relative; }
.time-gutter { width: 52px; flex-shrink: 0; border-right: 1px solid var(--grid-line); position: sticky; left: 0; z-index: 6; background: var(--bg); }
.time-gutter .column-header { background: var(--bg); }
.time-slot-label { height: var(--hour-height); font-size: 0.58rem; display: flex; align-items: flex-start; justify-content: flex-end; padding-right: 6px; opacity: 0.35; }
.column-header { height: var(--header-height); display: flex; flex-direction: column; align-items: center; justify-content: center; font-size: 0.7rem; font-weight: 600; border-bottom: 1px solid var(--grid-line); position: sticky; top: 0; z-index: 5; background: var(--bg); }
.column-header span { font-size: 0.58rem; opacity: 0.5; }
.day-column { flex: 1; min-width: 100px; position: relative; border-right: 1px solid var(--grid-line); }
.day-column.today { background: var(--today-highlight); }
.current-time-line { position: absolute; left: 0; right: 0; height: 2px; background: #f44336; z-index: 3; pointer-events: none; }
.current-time-line::before { content: ''; position: absolute; left: -4px; top: -3px; width: 8px; height: 8px; border-radius: 50%; background: #f44336; }

/* 全宽当前时间线 - 覆盖整行 7 列，从时间轴右侧到网格右边缘 */
.current-time-line-full {
  position: absolute;
  left: 52px; right: 0;
  height: 2px;
  background: #f44336;
  z-index: 7;
  pointer-events: none;
  display: flex;
  align-items: center;
}
.current-time-line-full::before {
  content: ''; position: absolute;
  left: -5px; top: -4px;
  width: 10px; height: 10px;
  border-radius: 50%; background: #f44336;
  border: 2px solid rgba(244,67,54,0.3);
}
.time-line-label {
  position: absolute;
  left: 8px;
  top: -10px;
  font-size: 0.6rem;
  font-weight: 700;
  color: #f44336;
  background: var(--bg);
  padding: 1px 4px;
  border-radius: 3px;
  white-space: nowrap;
}

/* ===== 日视图 ===== */
.day-view-container { flex: 1; overflow-y: auto; border-radius: 20px; margin: 0 12px 12px; padding: 12px; }
.day-nav { display: flex; justify-content: space-between; align-items: center; padding: 4px 8px; margin-bottom: 8px; }
.day-nav button { background: var(--black); color: var(--white); border: none; border-radius: 6px; padding: 5px 12px; cursor: pointer; font-weight: 700; font-size: 0.75rem; }
.day-date { font-weight: 700; font-size: 0.9rem; }
.day-task-card {
  position: absolute; left: 52px; right: 6px; background: var(--task-color); border-radius: 6px;
  padding: 4px 8px; font-size: 0.7rem; cursor: pointer; z-index: 2; color: #000; overflow: hidden;
}

/* ===== 列表视图 ===== */
.list-view { flex: 1; overflow-y: auto; border-radius: 20px; margin: 0 12px 12px; }
.list-header { padding: 10px 16px; font-size: 0.8rem; opacity: 0.5; border-bottom: 1px solid var(--grid-line); }
.list-empty { text-align: center; opacity: 0.3; padding: 40px; font-size: 0.85rem; }
.task-list-item { display: flex; align-items: center; padding: 10px 16px; cursor: pointer; border-bottom: 1px solid var(--grid-line); }
.task-list-item:hover { background: var(--accent-bg); }
.tl-color { width: 5px; height: 28px; border-radius: 3px; margin-right: 12px; flex-shrink: 0; }
.tl-info { flex: 1; }
.tl-name { font-weight: 600; font-size: 0.85rem; }
.tl-meta { font-size: 0.65rem; opacity: 0.45; }
.tl-dur { font-size: 0.72rem; opacity: 0.5; }

/* ===== 移动端 ===== */
.sidebar-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,0.5); z-index: 100; }
.sidebar-drawer { position: fixed; left: 0; top: 0; bottom: 0; width: 260px; z-index: 101; transform: translateX(-100%); transition: transform 0.3s ease; padding: 14px; padding-top: calc(14px + env(safe-area-inset-top, 0px)); overflow-y: auto; display: flex; flex-direction: column; gap: 10px; }
.sidebar-drawer.open { transform: translateX(0); }

/* 抽屉内视图切换 */
.drawer-section { padding: 0; }
.drawer-switcher { display: flex; gap: 4px; justify-content: center; }
.drawer-switcher button {
  padding: 6px 14px; border-radius: 8px; border: var(--border-subtle);
  background: rgba(128,128,128,0.1); color: var(--black); cursor: pointer; font-size: 0.72rem; font-weight: 600;
}
.drawer-switcher button.active { background: var(--accent); color: #000; border-color: var(--accent); }

/* 抽屉底部用户/操作区 */
.drawer-bottom-actions { margin-top: auto; border-top: var(--border-subtle); padding-top: 10px; display: flex; flex-direction: column; gap: 6px; }
.drawer-user-row { display: flex; align-items: center; gap: 10px; padding: 6px 8px; border-radius: 10px; cursor: pointer; }
.drawer-user-row:hover { background: var(--accent-bg); }
.drawer-avatar { width: 32px; height: 32px; border-radius: 50%; border: var(--border-subtle); }
.drawer-username { font-weight: 700; font-size: 0.78rem; }
.drawer-action-btn {
  display: flex; align-items: center; gap: 8px; padding: 8px 10px; border-radius: 10px; border: var(--border-subtle);
  background: none; color: var(--black); cursor: pointer; font-size: 0.72rem; font-weight: 600;
}
.drawer-action-btn:hover { background: var(--accent-bg); }
.drawer-action-btn.danger { color: #e74c3c; }
.drawer-action-btn .material-symbols-outlined { font-size: 18px; }

/* FAB */
.fab { position: fixed; bottom: 32px; right: 32px; width: 48px; height: 48px; border-radius: 50%; background: var(--accent); color: #000; font-size: 1.5rem; border: none; cursor: pointer; z-index: 50; box-shadow: 0 4px 16px rgba(0,0,0,0.3); }


/* ===== 响应式 ===== */
@media (max-width: 780px) {
  header { padding: 12px 8px 0; padding-top: calc(12px + env(safe-area-inset-top, 0px)); }
  .header-main-row { gap: 4px; margin-bottom: 4px; }
  .add-task-btn { display: none; }
  .header-controls-row { margin-bottom: 4px; }
  #range-title { font-size: 1rem; letter-spacing: 0; }
  .view-switcher button { padding: 5px 12px; font-size: 0.78rem; }
  .add-task-btn { padding: 3px 8px; }
  .add-task-btn .material-symbols-outlined { font-size: 14px; }

  /* 顶部右侧用户区隐藏 */
  .top-right-nav { display: none; }

  /* 周视图 */
  .weekly-grid { min-width: 600px; }
  .time-gutter { width: 40px; }
  .time-slot-label { font-size: 0.6rem; padding-right: 4px; }
  .column-header { font-size: 0.72rem; }

  /* 滑出面板全宽 */
  .add-panel { top: 50px; right: 4px; width: calc(100vw - 8px); }

  /* 事件卡片 */
  .event-item { left: 2px; right: 2px; padding: 3px 5px; font-size: 0.7rem; }
  .event-time-tag { font-size: 0.62rem; }
  .event-name-text { font-size: 0.7rem; }

  /* 日视图 */
  .day-view-container { margin: 0 4px 4px; padding: 8px; border-radius: 14px; }
  .day-nav button { padding: 5px 10px; font-size: 0.78rem; }
  .day-date { font-size: 0.85rem; }

  /* FAB */
  .fab { bottom: 28px; right: 24px; width: 48px; height: 48px; font-size: 1.5rem; }
}

@media (max-width: 540px) {
  header { padding: 10px 6px 0; padding-top: calc(10px + env(safe-area-inset-top, 0px)); }
  #range-title { font-size: 0.88rem; }
  .view-switcher button { padding: 5px 10px; font-size: 0.72rem; }
  .weekly-grid { min-width: 520px; }
  .time-gutter { width: 34px; }
  .time-slot-label { font-size: 0.56rem; }
  .column-header { font-size: 0.65rem; }
  .day-column { min-width: 64px; }
  .event-item { left: 1px; right: 1px; padding: 2px 4px; font-size: 0.66rem; }
  .event-time-tag { font-size: 0.58rem; }
  .event-name-text { font-size: 0.65rem; }
  .sidebar-drawer { width: 240px; }
  .fab { bottom: 28px; right: 24px; }
}
</style>
