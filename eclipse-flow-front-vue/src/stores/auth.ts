import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { authApi } from '@/services/api'
import router from '@/router'

export const useAuthStore = defineStore('auth', () => {
  const token = ref(localStorage.getItem('eclipse_token') || '')
  const username = ref(localStorage.getItem('eclipse_username') || '')

  const isLoggedIn = computed(() => !!token.value)

  async function login(user: string, pass: string) {
    const result = await authApi.login(user, pass)
    token.value = result.token
    username.value = result.username
    localStorage.setItem('eclipse_token', result.token)
    localStorage.setItem('eclipse_username', result.username)
    router.push('/')
  }

  async function register(user: string, pass: string) {
    const result = await authApi.register(user, pass)
    token.value = result.token
    username.value = result.username
    localStorage.setItem('eclipse_token', result.token)
    localStorage.setItem('eclipse_username', result.username)
    router.push('/')
  }

  function logout() {
    token.value = ''
    username.value = ''
    localStorage.removeItem('eclipse_token')
    localStorage.removeItem('eclipse_username')
    router.push('/login')
  }

  return { token, username, isLoggedIn, login, register, logout }
})
