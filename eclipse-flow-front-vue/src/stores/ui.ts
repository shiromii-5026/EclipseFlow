import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useUiStore = defineStore('ui', () => {
  const isDark = ref(localStorage.getItem('eclipse_theme') === 'dark')
  const isMobile = ref(window.matchMedia('(max-width: 780px)').matches)
  const sidebarOpen = ref(false)
  const toastMessage = ref('')
  const toastVisible = ref(false)

  // modal states
  const showTaskModal = ref(false)
  const showOcrModal = ref(false)
  const showChatModal = ref(false)

  // edit task context
  const editingTask = ref<{ task: Record<string, unknown>; dateStr: string } | null>(null)

  function toggleTheme() {
    isDark.value = !isDark.value
    localStorage.setItem('eclipse_theme', isDark.value ? 'dark' : 'light')
    document.documentElement.classList.toggle('dark', isDark.value)
    const metaTheme = document.querySelector('meta[name="theme-color"]')
    if (metaTheme) {
      metaTheme.setAttribute('content', isDark.value ? '#070b1a' : '#b5d528')
    }
  }

  function initTheme() {
    if (isDark.value) {
      document.documentElement.classList.add('dark')
    }
  }

  function showToast(msg: string) {
    toastMessage.value = msg
    toastVisible.value = true
    setTimeout(() => { toastVisible.value = false }, 2500)
  }

  function openSidebar() { sidebarOpen.value = true }
  function closeSidebar() { sidebarOpen.value = false }

  // watch mobile changes
  window.matchMedia('(max-width: 780px)').addEventListener('change', (e) => {
    isMobile.value = e.matches
  })

  return {
    isDark, isMobile, sidebarOpen, toastMessage, toastVisible,
    showTaskModal, showOcrModal, showChatModal, editingTask,
    toggleTheme, initTheme, showToast, openSidebar, closeSidebar,
  }
})
