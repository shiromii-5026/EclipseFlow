<template>
  <teleport to="body">
    <div v-if="friend.chatFriendId!==null" class="modal-overlay" @click.self="friend.closeChat()">
      <div class="chat-modal glass">
        <div class="chat-header">
          <span>{{ friend.chatFriendName }}</span>
          <button @click="friend.closeChat()">&times;</button>
        </div>
        <div class="chat-msgs" ref="mc">
          <div v-for="m in friend.messages" :key="m.id" class="chat-msg" :class="m.mine?'mine':'theirs'">{{ m.content }}</div>
          <div v-if="friend.messages.length===0" class="chat-empty">暂无消息</div>
        </div>
        <div class="chat-input-row">
          <input v-model="input" placeholder="输入消息..." @keyup.enter="send" />
          <button @click="send">发送</button>
        </div>
      </div>
    </div>
  </teleport>
</template>

<script setup lang="ts">
import { ref, watch, nextTick } from 'vue'
import { useFriendStore } from '@/stores/friends'
const friend = useFriendStore()
const input = ref('')
const mc = ref<HTMLElement|null>(null)
watch(()=>friend.messages.length,()=>{nextTick(()=>{if(mc.value)mc.value.scrollTop=mc.value.scrollHeight})})
async function send(){const c=input.value.trim();if(!c)return;await friend.sendMessage(c);input.value=''}
</script>

<style scoped>
.modal-overlay { position:fixed; inset:0; background:rgba(0,0,0,0.55); display:flex; align-items:center; justify-content:center; z-index:1000; }
.chat-modal { border-radius:16px; width:90%; max-width:360px; display:flex; flex-direction:column; max-height:70vh; background:var(--glass-bg); backdrop-filter:blur(30px); border:var(--glass-border); box-shadow:var(--glass-shadow); }
.chat-header { display:flex; justify-content:space-between; align-items:center; padding:12px 16px; border-bottom:var(--border-subtle); font-weight:600; font-size:0.85rem; }
.chat-header button { background:none; border:none; color:var(--black); font-size:1rem; cursor:pointer; opacity:0.5; }
.chat-msgs { flex:1; overflow-y:auto; padding:10px; max-height:320px; }
.chat-msg { max-width:75%; padding:7px 10px; border-radius:12px; margin-bottom:6px; font-size:0.78rem; word-break:break-word; }
.chat-msg.mine { margin-left:auto; background:var(--accent); color:#000; }
.chat-msg.theirs { background:var(--accent-bg); }
.chat-empty { text-align:center; opacity:0.25; padding:24px; font-size:0.75rem; }
.chat-input-row { display:flex; padding:8px; border-top:var(--border-subtle); }
.chat-input-row input { flex:1; padding:7px 10px; border-radius:8px; border:var(--border-subtle); background:var(--white); color:var(--black); font-size:0.78rem; }
.chat-input-row button { margin-left:6px; padding:7px 14px; border-radius:8px; border:none; background:var(--accent); color:#000; font-weight:600; cursor:pointer; font-size:0.78rem; }
</style>
