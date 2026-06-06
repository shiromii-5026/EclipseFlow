<template>
  <div class="save-toast" :class="{show:ui.toastVisible}">&gt;&gt; {{ ui.toastMessage }}</div>
</template>

<script setup lang="ts">
import { useUiStore } from '@/stores/ui'
const ui = useUiStore()
</script>

<style scoped>
.save-toast {
  position:fixed; bottom:30px; left:50%; transform:translateX(-50%);
  background:rgba(20,20,20,0.92); color:var(--accent); padding:10px 28px;
  border-radius:28px; font-size:0.85rem; letter-spacing:0.08em; z-index:9999;
  opacity:0; pointer-events:none; transition:opacity 0.35s ease;
}
.save-toast.show { opacity:1; }
</style>
