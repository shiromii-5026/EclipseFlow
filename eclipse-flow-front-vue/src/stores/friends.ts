import { defineStore } from 'pinia'
import { ref } from 'vue'
import { socialApi } from '@/services/api'
import type { ChatMessage } from '@/types'

export const useFriendStore = defineStore('friends', () => {
  const friends = ref<Array<{ id: number; username: string; calendarPublic: boolean }>>([])
  const requests = ref<Array<{ id: number; username: string }>>([])
  const messages = ref<ChatMessage[]>([])
  const chatFriendId = ref<number | null>(null)
  const chatFriendName = ref('')

  let pollTimer: ReturnType<typeof setInterval> | null = null

  async function refreshFriends() {
    try {
      friends.value = await socialApi.getFriends()
      requests.value = await socialApi.getRequests()
    } catch { /* ignore */ }
  }

  async function searchUsers(q: string) {
    return socialApi.searchUsers(q)
  }

  async function addFriend(friendId: number) {
    return socialApi.addFriend(friendId)
  }

  async function acceptFriend(requestId: number) {
    await socialApi.acceptFriend(requestId)
    await refreshFriends()
  }

  async function toggleCalendar() {
    return socialApi.toggleCalendar()
  }

  function openChat(friendId: number, name: string) {
    chatFriendId.value = friendId
    chatFriendName.value = name
    loadMessages()
  }

  function closeChat() {
    chatFriendId.value = null
    chatFriendName.value = ''
    messages.value = []
  }

  async function sendMessage(content: string) {
    if (!chatFriendId.value) return
    await socialApi.sendMessage(chatFriendId.value, content)
    await loadMessages()
  }

  async function loadMessages() {
    if (!chatFriendId.value) return
    try {
      messages.value = await socialApi.getMessages(chatFriendId.value)
    } catch { /* ignore */ }
  }

  async function viewFriendCalendar(friendId: number) {
    return socialApi.getFriendCalendar(friendId)
  }

  function startPolling() {
    if (pollTimer) return
    pollTimer = setInterval(() => {
      if (chatFriendId.value) loadMessages()
      refreshFriends()
    }, 5000)
  }

  function stopPolling() {
    if (pollTimer) {
      clearInterval(pollTimer)
      pollTimer = null
    }
  }

  return {
    friends, requests, messages, chatFriendId, chatFriendName,
    refreshFriends, searchUsers, addFriend, acceptFriend, toggleCalendar,
    openChat, closeChat, sendMessage, loadMessages, viewFriendCalendar,
    startPolling, stopPolling,
  }
})
