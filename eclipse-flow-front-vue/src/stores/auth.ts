import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { authApi } from '@/services/api'
import router from '@/router'

export const useAuthStore = defineStore('auth', () => {
  const token = ref(localStorage.getItem('eclipse_token') || '')
  const username = ref(localStorage.getItem('eclipse_username') || '')
  const avatarSeed = ref(localStorage.getItem('eclipse_avatar') || '')

  const isLoggedIn = computed(() => !!token.value)

  async function fetchProfile() {
    if (!token.value) return
    try {
      const p = await authApi.getProfile()
      username.value = p.username
      avatarSeed.value = p.avatarSeed || p.username || ''
      localStorage.setItem('eclipse_username', p.username)
      localStorage.setItem('eclipse_avatar', avatarSeed.value)
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

  async function updateProfile(newName: string, newSeed: string) {
    const result = await authApi.updateProfile({
      username: newName || undefined,
      avatarSeed: newSeed || undefined,
    })
    username.value = result.username
    avatarSeed.value = result.avatarSeed || ''
    localStorage.setItem('eclipse_username', result.username)
    localStorage.setItem('eclipse_avatar', avatarSeed.value)
  }

  function logout() {
    token.value = ''
    username.value = ''
    avatarSeed.value = ''
    localStorage.removeItem('eclipse_token')
    localStorage.removeItem('eclipse_username')
    localStorage.removeItem('eclipse_avatar')
    router.push('/login')
  }

  return { token, username, avatarSeed, isLoggedIn, fetchProfile, login, register, updateProfile, logout }
})
