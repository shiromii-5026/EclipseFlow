<template>
  <div class="countdown-panel">
    <div class="countdown-header">
      <span class="material-symbols-outlined">group</span>
      <span class="countdown-title">好友</span>
    </div>
    <div class="friend-search">
      <input v-model="q" placeholder="搜索用户" @keyup.enter="doSearch" />
      <button @click="doSearch">添加</button>
    </div>
    <div class="countdown-list">
      <div v-if="friend.friends.length===0" class="countdown-empty">暂无好友</div>
      <div v-for="f in friend.friends" :key="f.id" class="countdown-item">
        <span class="ci-name">{{ f.username }} <span v-if="f.calendarPublic" class="pub-badge">公开</span></span>
        <div class="friend-acts">
          <button class="mini-btn" @click="friend.openChat(f.id,f.username)">聊天</button>
          <button class="mini-btn" @click="viewCal(f.id)">日历</button>
        </div>
      </div>
    </div>
    <div v-if="friend.requests.length" class="countdown-list" style="margin-top:6px">
      <div style="font-size:0.62rem;opacity:0.4;margin-bottom:2px">好友申请</div>
      <div v-for="r in friend.requests" :key="r.id" class="countdown-item" style="font-size:0.68rem">
        <span>{{ r.username }}</span>
        <button class="mini-btn accept" @click="friend.acceptFriend(r.id)">接受</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useFriendStore } from '@/stores/friends'
import { useTaskStore } from '@/stores/tasks'
import { useCalendarStore } from '@/stores/calendar'
import { useUiStore } from '@/stores/ui'
import type { Task } from '@/types'

const friend = useFriendStore()
const taskStore = useTaskStore()
const cal = useCalendarStore()
const ui = useUiStore()
const q = ref('')

async function doSearch() {
  const kw = q.value.trim(); if(!kw) return
  const users = await friend.searchUsers(kw)
  if(!users.length){ui.showToast('未找到用户');return}
  const r = await friend.addFriend(users[0].id)
  ui.showToast(r.status==='pending'?'已发送申请':'已是好友')
  friend.refreshFriends(); q.value=''
}

async function viewCal(fid:number){
  const tasks = await friend.viewFriendCalendar(fid)
  if(!tasks?.length){ui.showToast('好友未公开日历或无任务');return}
  const dk = (tasks[0] as Task).taskDate||cal.focusDateStr
  taskStore.storage[dk] = tasks.map((bt:Task)=>({
    id:bt.id,name:bt.taskName,taskName:bt.taskName,taskDate:bt.taskDate,
    time:bt.startTime?.substring(0,5)||'00:00',startTime:bt.startTime||'00:00:00',
    duration:bt.duration??1,color:bt.color||'#b5d528aa',notes:bt.notes||'',
    deadline:bt.deadline||null,taskType:(bt.taskType as any)||(bt.duration===0?'DDL':'BLOCK'),
  }))
  ui.showToast('已切换到好友日历')
}
</script>

<style scoped>
.countdown-panel { padding: 6px 4px; }
.countdown-header { display: flex; align-items: center; gap: 6px; margin-bottom: 4px; }
.countdown-header .material-symbols-outlined { font-size: 18px; color: var(--accent); }
.countdown-title { font-size: 0.7rem; font-weight: 700; opacity: 0.6; }
.countdown-list { margin-left: 4px; }
.countdown-item { display: flex; align-items: center; justify-content: space-between; padding: 5px 6px; font-size: 0.72rem; border-radius: 6px; }
.ci-name { font-weight: 600; flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.pub-badge { font-size: 0.58rem; opacity: 0.4; }
.countdown-empty { font-size: 0.68rem; opacity: 0.25; }
.friend-search { display: flex; gap: 4px; margin-bottom: 6px; }
.friend-search input { flex:1; padding:5px 8px; border-radius:6px; border:var(--border-subtle); background:var(--white); color:var(--black); font-size:0.7rem; }
.friend-search button { padding:4px 8px; border-radius:6px; border:1px solid var(--accent); background:transparent; color:var(--accent); font-weight:700; font-size:0.65rem; cursor:pointer; }
.friend-acts { display: flex; gap: 3px; }
.mini-btn { padding:2px 6px; border-radius: 4px; border: var(--border-subtle); background: transparent; color: var(--black); cursor: pointer; font-size: 0.6rem; }
.mini-btn:hover { background: var(--accent-bg); }
.mini-btn.accept { border-color: var(--accent); color: var(--accent); }
</style>
