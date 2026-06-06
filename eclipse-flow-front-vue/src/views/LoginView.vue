<template>
  <div class="login-page">
    <div class="login-card glass">
      <div class="login-logo">
        <span class="material-symbols-outlined filled">tonality</span>
        <h1>EclipseFlow</h1>
      </div>
      <p class="login-sub">多平台日程助手</p>

      <input v-model="username" type="text" placeholder="用户名" class="login-input" @keyup.enter="submit" />
      <input v-model="password" type="password" placeholder="密码" class="login-input" @keyup.enter="submit" />
      <p v-if="error" class="login-error">{{ error }}</p>

      <button class="login-btn" @click="submit" :disabled="loading">
        {{ loading ? '处理中...' : (mode==='login' ? '登 录' : '注 册') }}
      </button>
      <button class="switch-btn" @click="mode=mode==='login'?'register':'login'">
        {{ mode==='login' ? '没有账号？点此注册' : '已有账号？点此登录' }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useAuthStore } from '@/stores/auth'
const auth = useAuthStore()
const username = ref('')
const password = ref('')
const mode = ref<'login'|'register'>('login')
const error = ref('')
const loading = ref(false)

async function submit() {
  error.value = ''
  if (!username.value.trim()||!password.value.trim()) { error.value='请填写用户名和密码'; return }
  loading.value = true
  try {
    if (mode.value==='login') await auth.login(username.value.trim(),password.value)
    else await auth.register(username.value.trim(),password.value)
  } catch(e) { error.value=(e as Error).message||'操作失败' } finally { loading.value=false }
}
</script>

<style scoped>
.login-page {
  min-height: 100vh; display: flex; align-items: center; justify-content: center;
  background-color: var(--bg);
  background-image:
    radial-gradient(circle at 25% 25%, var(--accent) 0.4px, transparent 0.4px),
    radial-gradient(circle at 75% 75%, var(--accent) 0.4px, transparent 0.4px);
  background-size: 60px 60px; background-position: 0 0, 30px 30px;
  font-family: 'Noto Sans SC', sans-serif;
  color: var(--black);
}
.login-card {
  background: var(--glass-bg); backdrop-filter: blur(30px); border: var(--glass-border);
  box-shadow: var(--glass-shadow); border-radius: 20px; padding: 40px 32px;
  width: 90%; max-width: 380px; text-align: center;
}
.login-logo { display: flex; align-items: center; justify-content: center; gap: 8px; margin-bottom: 4px; }
.login-logo .material-symbols-outlined { font-size: 32px; color: var(--accent); }
.login-logo h1 { font-size: 1.8rem; font-weight: 900; letter-spacing: 0.08em; color: var(--accent); margin: 0; }
.login-sub { font-size: 0.85rem; opacity: 0.5; margin: 0 0 24px; }
.login-input {
  width: 100%; padding: 12px 16px; border-radius: 10px; border: var(--border-subtle);
  background: var(--white); color: var(--black); font-size: 0.9rem; margin-bottom: 12px; box-sizing: border-box;
}
.login-error { color: var(--danger); font-size: 0.78rem; margin: 0 0 8px; }
.login-btn {
  width: 100%; padding: 12px; border-radius: 10px; border: none;
  background: var(--accent); color: #000; font-size: 0.95rem; font-weight: 700; cursor: pointer; transition: 0.2s;
}
.login-btn:hover { background: var(--accent-bright); }
.login-btn:disabled { opacity: 0.5; cursor: default; }
.switch-btn { background: none; border: none; color: var(--black); opacity: 0.4; font-size: 0.78rem; cursor: pointer; margin-top: 12px; }
.switch-btn:hover { opacity: 0.7; }
</style>
