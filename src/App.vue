<template>
  <div class="app-shell" :class="{ 'app-shell--tauri': isTauri }">
    <WindowTitleBar v-if="isTauri && !isFullscreen" />
    <div class="app-content">
      <router-view />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from "vue"
import WindowTitleBar from "./components/WindowTitleBar.vue"
import { getCurrentWindow } from "@tauri-apps/api/window"
import type { UnlistenFn } from "@tauri-apps/api/event"

const isTauri = ref(false)
const isFullscreen = ref(false)
let unlistenFullscreen: UnlistenFn | undefined

async function syncFullscreen() {
  try { isFullscreen.value = await getCurrentWindow().isFullscreen() } catch { /* ignore */ }
}

onMounted(async () => {
  isTauri.value = !!(window as any).__TAURI_INTERNALS__
  if (isTauri.value) {
    await syncFullscreen()
    unlistenFullscreen = await getCurrentWindow().onResized(() => syncFullscreen())
  }
})

onUnmounted(() => {
  unlistenFullscreen?.()
})
</script>

<style>
.app-shell {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.app-content {
  flex: 1;
  position: relative;
}



.app-shell--tauri> :not(.win-title) {
  flex: 1;
  min-height: 0;
}
</style>
