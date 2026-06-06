<template>
  <teleport to="body">
    <div v-if="visible" class="modal-overlay" @click.self="$emit('close')">
      <div class="modal-content glass">
        <h3>{{ isEdit ? '编辑任务' : '新建任务' }}</h3>

        <label>任务名称</label>
        <input v-model="form.name" type="text" placeholder="任务内容" class="m-input" />

        <label>日期</label>
        <input v-model="form.date" type="date" class="m-input" />

        <div class="time-row">
          <div>
            <label>开始</label>
            <div class="time-sels">
              <select v-model="form.hour" class="m-sel"><option v-for="h in 24" :key="h" :value="s2(h-1)">{{ s2(h-1) }}</option></select>
              <span>:</span>
              <select v-model="form.minute" class="m-sel"><option v-for="m in 12" :key="m" :value="s2((m-1)*5)">{{ s2((m-1)*5) }}</option></select>
            </div>
          </div>
          <div>
            <label>截止（可选）</label>
            <div class="time-sels">
              <select v-model="form.deadlineHour" class="m-sel"><option value="">--</option><option v-for="h in 24" :key="h" :value="s2(h-1)">{{ s2(h-1) }}</option></select>
              <span>:</span>
              <select v-model="form.deadlineMin" class="m-sel"><option value="">--</option><option v-for="m in 12" :key="m" :value="s2((m-1)*5)">{{ s2((m-1)*5) }}</option></select>
            </div>
          </div>
        </div>

        <label>颜色</label>
        <div class="color-row">
          <button v-for="c in colors" :key="c" class="c-dot" :class="{active:form.color===c}" :style="{background:c}" @click="form.color=c" />
        </div>

        <label>备注</label>
        <input v-model="form.notes" type="text" placeholder="备注（可选）" class="m-input" />

        <div class="modal-acts">
          <button class="btn-cancel" @click="$emit('close')">取消</button>
          <button class="btn-save" @click="save">保存</button>
        </div>
      </div>
    </div>
  </teleport>
</template>

<script setup lang="ts">
import { reactive, ref, watch } from 'vue'
import { useTaskStore } from '@/stores/tasks'
import { useCalendarStore } from '@/stores/calendar'
import { useUiStore } from '@/stores/ui'

const props = defineProps<{ visible: boolean; editTask?: {task:Record<string,unknown>;dateStr:string}|null }>()
const emit = defineEmits<{ close: []; saved: [] }>()
const taskStore = useTaskStore()
const cal = useCalendarStore()
const ui = useUiStore()
const s2 = (n:number)=>String(n).padStart(2,'0')

const isEdit = ref(false)
const colors = ['#b5d528aa','#f89828aa','#5eb8e8','#f07880','#b088e0aa']

const form = reactive({ name:'', date:cal.focusDateStr, hour:'09', minute:'00', deadlineHour:'', deadlineMin:'', color:colors[0], notes:'' })

watch(()=>props.visible, v=>{
  if(!v) return
  if(props.editTask?.task.id!==undefined && props.editTask.task.id!==0){
    isEdit.value=true; const t=props.editTask.task
    form.name=(t.name as string)||''; form.date=props.editTask.dateStr
    if(t.time&&typeof t.time==='string'&&t.time.length>=5){form.hour=t.time.substring(0,2);form.minute=t.time.substring(3,5)}
    if(t.deadline&&typeof t.deadline==='string'&&t.deadline.length>=5){form.deadlineHour=t.deadline.substring(0,2);form.deadlineMin=t.deadline.substring(3,5)}
    form.color=(t.color as string)||colors[0]; form.notes=(t.notes as string)||''
  } else {
    isEdit.value=false; form.name=''; form.date=cal.focusDateStr; form.hour='09'; form.minute='00'
    form.deadlineHour=''; form.deadlineMin=''; form.color=colors[0]; form.notes=''
  }
})

async function save(){
  if(!form.name||!form.date){ui.showToast('请填写任务名称和日期');return}
  const st=`${form.hour}:${form.minute}`
  let dur:number,dl:string|null=null,tt:string
  if(form.deadlineHour!==''&&form.deadlineMin!==''){
    tt='BLOCK'; const sm=parseInt(form.hour)*60+parseInt(form.minute), em=parseInt(form.deadlineHour)*60+parseInt(form.deadlineMin)
    dur=(em-sm)/60; if(dur<=0){ui.showToast('截止时间必须晚于开始时间');return}
    dl=`${form.deadlineHour}:${form.deadlineMin}:00`
  } else { tt='DDL'; dur=0; dl=`${form.hour}:${form.minute}:00` }
  await taskStore.saveTask({taskName:form.name,taskDate:form.date,startTime:st+':00',duration:dur,deadline:dl,taskType:tt,color:form.color,notes:form.notes})
  ui.showToast(isEdit.value?'任务已更新':'任务已创建')
  emit('saved'); emit('close')
}
</script>

<style scoped>
.modal-overlay { position:fixed; inset:0; background:rgba(0,0,0,0.55); display:flex; align-items:center; justify-content:center; z-index:1000; }
.modal-content { border-radius:16px; padding:24px; max-width:400px; width:90%; max-height:90vh; overflow-y:auto; background:var(--glass-bg); backdrop-filter:blur(30px); border:var(--glass-border); box-shadow:var(--glass-shadow); }
h3 { margin:0 0 14px; font-size:0.95rem; }
label { font-size:0.65rem; opacity:0.5; display:block; margin-bottom:4px; margin-top:8px; }
.m-input { width:100%; padding:8px 10px; border-radius:8px; border:var(--border-subtle); background:var(--white); color:var(--black); font-size:0.82rem; box-sizing:border-box; }
.time-row { display:flex; gap:10px; }
.time-row>div { flex:1; }
.time-sels { display:flex; align-items:center; gap:2px; }
.m-sel { flex:1; padding:6px 4px; border-radius:6px; border:var(--border-subtle); background:var(--white); color:var(--black); font-size:0.78rem; }
.color-row { display:flex; gap:8px; flex-wrap:wrap; }
.c-dot { width:24px; height:24px; border-radius:50%; border:2px solid transparent; cursor:pointer; }
.c-dot.active { border-color:var(--black); }
.modal-acts { display:flex; gap:8px; justify-content:flex-end; margin-top:16px; }
.btn-cancel { padding:7px 16px; border-radius:8px; border:var(--border-subtle); background:transparent; color:var(--black); cursor:pointer; }
.btn-save { padding:7px 18px; border-radius:8px; border:none; background:var(--accent); color:#000; font-weight:700; cursor:pointer; }
</style>
