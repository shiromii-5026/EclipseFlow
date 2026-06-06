<template>
  <div class="countdown-panel">
    <!-- 进行中 -->
    <div class="countdown-header">
      <span class="material-symbols-outlined">timer</span>
      <span class="countdown-title">进行中</span>
    </div>
    <div class="countdown-list">
      <template v-if="running.length">
        <div v-for="t in running" :key="t.id" class="countdown-item running">
          <span class="ci-name">{{ t.name }}</span>
          <span class="ci-time">{{ t.remaining }}</span>
        </div>
      </template>
      <span v-else class="countdown-empty">-</span>
    </div>

    <!-- 即将开始 -->
    <div class="countdown-header upc">
      <span class="material-symbols-outlined">schedule</span>
      <span class="countdown-title">即将开始</span>
    </div>
    <div class="countdown-list">
      <template v-if="upcoming.length">
        <div v-for="t in upcoming" :key="t.id" class="countdown-item">
          <span class="ci-name">{{ t.name }}</span>
          <span class="ci-time">{{ t.remaining }}</span>
        </div>
      </template>
      <span v-else class="countdown-empty">-</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useCountdown } from '@/composables/useCountdown'
const { items } = useCountdown()
import { computed } from 'vue'
const running = computed(() => items.value.filter(i=>i.isRunning))
const upcoming = computed(() => items.value.filter(i=>!i.isRunning))
</script>

<style scoped>
.countdown-panel { padding: 6px 4px; }
.countdown-header { display: flex; align-items: center; gap: 6px; margin-bottom: 4px; }
.countdown-header .material-symbols-outlined { font-size: 18px; color: var(--accent); }
.countdown-header.upc { margin-top: 10px; }
.countdown-title { font-size: 0.7rem; font-weight: 700; opacity: 0.6; }
.countdown-list { margin-left: 4px; }
.countdown-item { display: flex; justify-content: space-between; align-items: center; padding: 5px 6px; font-size: 0.7rem; border-radius: 6px; }
.countdown-item.running { background: var(--accent-bg); }
.ci-name { font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1; }
.ci-time { font-size: 0.6rem; opacity: 0.5; white-space: nowrap; margin-left: 8px; }
.countdown-empty { font-size: 0.68rem; opacity: 0.25; }
</style>
