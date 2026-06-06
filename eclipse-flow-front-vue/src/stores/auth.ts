import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { authApi } from '@/services/api'
import router from '@/router'

// Determine avatar URL: if it's a relative path, prepend the API base origin
function avatarUrl(path: string): string {
  if (!path) return ''
  if (path.startsWith('http')) return path
  // path like "/uploads/avatars/avatar_1.png"
  const origin = window.location.protocol === 'file:' ? 'http://localhost:8080' : window.location.origin
  return origin + path
}

export const useAuthStore = defineStore('auth', () => {
  const token = ref(localStorage.getItem('eclipse_token') || '')
  const username = ref(localStorage.getItem('eclipse_username') || '')
  const avatarPath = ref(localStorage.getItem('eclipse_avatar') || '')

  const isLoggedIn = computed(() => !!token.value)
  const avatarUrlComputed = computed(() => avatarUrl(avatarPath.value))

  async function fetchProfile() {
    if (!token.value) return
    try {
      const p = await authApi.getProfile()
      username.value = p.username
      avatarPath.value = p.avatarPath || ''
      localStorage.setItem('eclipse_username', p.username)
      localStorage.setItem('eclipse_avatar', avatarPath.value)
    } catch { /* ignore */ }
  }

  async function login(user: string, pass: string) {
    const result = await authApi.login(user, pass)
    token.value = result.token
    username.value = result.username
    localStorage.setItem('eclipse_token', result.token)
    localStorage.setItem('eclipse_username', result.username)
    await fetchProfile()
    router.push('/')
  }

  async function register(user: string, pass: string) {
    const result = await authApi.register(user, pass)
    token.value = result.token
    username.value = result.username
    localStorage.setItem('eclipse_token', result.token)
    localStorage.setItem('eclipse_username', result.username)
    await fetchProfile()
    router.push('/')
  }

  async function updateProfile(newName: string) {
    const result = await authApi.updateProfile({ username: newName || undefined })
    username.value = result.username
    avatarPath.value = result.avatarPath || ''
    localStorage.setItem('eclipse_username', result.username)
    localStorage.setItem('eclipse_avatar', avatarPath.value)
  }

  async function uploadAvatar(base64: string) {
    const result = await authApi.uploadAvatar(base64)
    avatarPath.value = result.avatarPath
    localStorage.setItem('eclipse_avatar', result.avatarPath)
  }

  function logout() {
    token.value = ''
    username.value = ''
    avatarPath.value = ''
    localStorage.removeItem('eclipse_token')
    localStorage.removeItem('eclipse_username')
    localStorage.removeItem('eclipse_avatar')
    router.push('/login')
  }

  return { token, username, avatarPath, avatarUrl: avatarUrlComputed, isLoggedIn, fetchProfile, login, register, updateProfile, uploadAvatar, logout }
})
