import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export type ViewMode = 'week' | 'day' | 'list'

export const useCalendarStore = defineStore('calendar', () => {
  const currentFocusDate = ref(new Date())
  const miniMonthDate = ref(new Date())
  const viewMode = ref<ViewMode>('week')
  const isViewingCurrentWeek = ref(true)

  const focusDateStr = computed(() => getCSTDateStr(currentFocusDate.value))

  function getCSTDateStr(date: Date): string {
    const y = date.getFullYear()
    const m = (date.getMonth() + 1).toString().padStart(2, '0')
    const d = date.getDate().toString().padStart(2, '0')
    return `${y}-${m}-${d}`
  }

  function getWeekRange(date: Date): { monday: Date; sunday: Date } {
    const temp = new Date(date)
    const dayIdx = temp.getDay()
    const diff = temp.getDate() - (dayIdx === 0 ? 6 : dayIdx - 1)
    const monday = new Date(temp.getFullYear(), temp.getMonth(), diff)
    const sunday = new Date(monday)
    sunday.setDate(monday.getDate() + 6)
    return { monday, sunday }
  }

  function setFocusDate(date: Date) {
    currentFocusDate.value = new Date(date)
    const { monday, sunday } = getWeekRange(date)
    const today = new Date()
    isViewingCurrentWeek.value = today >= monday && today <= sunday
  }

  function goToToday() {
    const today = new Date()
    currentFocusDate.value = today
    miniMonthDate.value = today
    isViewingCurrentWeek.value = true
  }

  function prevMonth() {
    const d = new Date(miniMonthDate.value)
    d.setMonth(d.getMonth() - 1)
    miniMonthDate.value = d
  }

  function nextMonth() {
    const d = new Date(miniMonthDate.value)
    d.setMonth(d.getMonth() + 1)
    miniMonthDate.value = d
  }

  function prevDay() {
    const d = new Date(currentFocusDate.value)
    d.setDate(d.getDate() - 1)
    setFocusDate(d)
  }

  function nextDay() {
    const d = new Date(currentFocusDate.value)
    d.setDate(d.getDate() + 1)
    setFocusDate(d)
  }

  return {
    currentFocusDate, miniMonthDate, viewMode, isViewingCurrentWeek, focusDateStr,
    getCSTDateStr, getWeekRange,
    setFocusDate, goToToday, prevMonth, nextMonth, prevDay, nextDay,
  }
})
