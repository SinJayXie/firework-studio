<template>
  <div class="app-root" :class="{ 'tauri': isTauri }">
    <!-- Loading -->
    <div v-if="loading" class="loading-screen">
      <div class="loading-screen__header">{{ t('firework.loading') }}</div>
      <div class="loading-screen__status">{{ t('firework.assembling') }}</div>
    </div>

    <!-- Stage -->
    <div class="stage-frame" :style="{ width: stageWidth + 'px', height: stageHeight + 'px' }">
      <div ref="canvasContainer" class="stage-canvas" />

      <ControlPanel :paused="paused" :hidden="menuOpen || config.hideControls" @toggle-pause="togglePause"
        @toggle-menu="toggleMenu" />
    </div>

    <!-- Settings Dialog -->
    <MenuPanel :open="menuOpen" :config="config" :fullscreen="fullscreen" :shell-refresh-key="shellRefreshKey"
      :custom-shells="customShellNames" @update:config="updateConfig" @toggle-fullscreen="toggleFullscreen"
      @load-shell-file="loadShellFile" @close="toggleMenu(false)" />

    <!-- Help Dialog -->
    <AppDialog :show="!!openHelpTopic" :title="openHelpTopic ? helpContent[openHelpTopic]?.header : ''"
      @close="openHelpTopic = null">
      <p v-if="openHelpTopic">{{ helpContent[openHelpTopic]?.body }}</p>
      <template #footer>
        <AppButton variant="ghost" @click="openHelpTopic = null">{{ t('common.close') }}</AppButton>
      </template>
    </AppDialog>

    <!-- Toast -->
    <transition name="toast-fade">
      <div v-if="toastVisible" class="toast">{{ toastMsg }}</div>
    </transition>

    <!-- Error Dialog -->
    <ShellErrorDialog :show="errorDialogOpen" :shell-count="errorDialogShellCount" :errors="errorDialogErrors"
      :source="errorDialogSource" @close="errorDialogOpen = false" />
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, onUnmounted, watch, nextTick } from "vue"
import { useI18n } from "vue-i18n"
import {
  Firework, shellNames, loadShellScript,
  MAX_WIDTH, MAX_HEIGHT,
} from "../libs/firework-engine"
import type { EngineConfig } from "../libs/firework-engine"
import ControlPanel from "./ControlPanel.vue"
import MenuPanel from "./MenuPanel.vue"
import AppDialog from "../components/AppDialog.vue"
import AppButton from "../components/AppButton.vue"
import ShellErrorDialog from "../components/ShellErrorDialog.vue"

const isTauri = ref(false)

onMounted(() => {
  isTauri.value = !!(window as any).__TAURI_INTERNALS__
})

const { t } = useI18n()
const engine = new Firework()
const canvasContainer = ref<HTMLElement>()
const stageWidth = ref(0)
const stageHeight = ref(0)
const canvasReady = ref(false)

const loading = ref(true)
const paused = ref(true)
const menuOpen = ref(false)
const fullscreen = ref(false)
const openHelpTopic = ref<string | null>(null)

const config = reactive<EngineConfig>({
  quality: String(engine.state.config.quality),
  shell: engine.state.config.shell,
  size: engine.state.config.size,
  autoLaunch: engine.state.config.autoLaunch,
  finale: engine.state.config.finale,
  skyLighting: engine.state.config.skyLighting,
  hideControls: engine.state.config.hideControls,
  longExposure: engine.state.config.longExposure,
  scaleFactor: engine.state.config.scaleFactor,
  renderer: engine.state.config.renderer,
  fps: engine.state.config.fps,
  speed: engine.state.config.speed,
  debug: engine.state.config.debug,
})

const shellRefreshKey = ref(0)
const customShellNames = ref<string[]>([])

// Error Dialog
const errorDialogOpen = ref(false)
const errorDialogShellCount = ref(0)
const errorDialogErrors = ref<import("../libs/firework-engine").ShellParseError[]>([])
const errorDialogSource = ref("")

// Toast
const toastMsg = ref("")
const toastVisible = ref(false)
let toastTimer = 0
function showToast(msg: string) {
  toastMsg.value = msg
  toastVisible.value = true
  clearTimeout(toastTimer)
  toastTimer = window.setTimeout(() => { toastVisible.value = false }, 2500)
}

const helpContent = computed(() => {
  const help = (key: string) => ({
    header: t(`firework.help.${key}.header`),
    body: t(`firework.help.${key}.body`),
  })
  return {
    shellType: help("shellType"),
    shellSize: help("shellSize"),
    quality: help("quality"),
    skyLighting: help("skyLighting"),
    scaleFactor: help("scaleFactor"),
    autoLaunch: help("autoLaunch"),
    finaleMode: help("finaleMode"),
    hideControls: help("hideControls"),
    fullscreen: help("fullscreen"),
    longExposure: help("longExposure"),
  } as Record<string, { header: string; body: string }>
})

engine.subscribe((state, _prevState) => {
  paused.value = state.paused
  menuOpen.value = state.menuOpen
  fullscreen.value = state.fullscreen
  openHelpTopic.value = state.openHelpTopic
  const c = state.config
  Object.assign(config, { quality: c.quality, shell: c.shell, size: c.size, autoLaunch: c.autoLaunch, finale: c.finale, skyLighting: c.skyLighting, hideControls: c.hideControls, longExposure: c.longExposure, scaleFactor: c.scaleFactor, renderer: c.renderer, fps: c.fps, speed: c.speed, debug: c.debug })
})

watch(() => config.renderer, (newVal) => {
  engine.switchRenderer(newVal)
  handleResize()
})

function updateConfig(partial: Partial<EngineConfig>) {
  engine.setState({ config: { ...engine.state.config, ...partial } })
  engine.configDidUpdate()
}

// ─── Settings Persistence ───
const SETTINGS_KEY = "firework-settings"
const persistKeys = ["quality", "shell", "size", "autoLaunch", "finale", "skyLighting", "hideControls", "longExposure", "scaleFactor", "renderer", "fps", "speed", "debug"] as const

// Load saved settings on mount
try {
  const saved = localStorage.getItem(SETTINGS_KEY)
  if (saved) {
    const parsed = JSON.parse(saved)
    const partial: Record<string, unknown> = {}
    for (const k of persistKeys) {
      if (k in parsed) partial[k] = parsed[k]
    }
    if (Object.keys(partial).length) {
      engine.setState({ config: { ...engine.state.config, ...partial } })
      engine.configDidUpdate()
    }
  }
} catch { /* ignore corrupted data */ }

// Persist on change
watch(config, () => {
  const data: Record<string, unknown> = {}
  for (const k of persistKeys) { data[k] = config[k] }
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(data))
}, { deep: true })

function togglePause() { engine.togglePause() }
function toggleMenu(open?: boolean) { engine.toggleMenu(open) }
function toggleFullscreen() {
  try {
    if (!document.fullscreenElement) document.documentElement.requestFullscreen()
    else document.exitFullscreen()
  } catch { /* */ }
}

function syncFullscreenState() {
  fullscreen.value = !!document.fullscreenElement
  engine.setState({ fullscreen: fullscreen.value })
}

function loadShellFile(file?: File) {
  if (!file) return
  const reader = new FileReader()
  reader.onload = () => {
    const source = reader.result as string
    const result = loadShellScript(source)
    for (const name of result.shells) {
      if (!shellNames.includes(name)) shellNames.push(name)
      if (!customShellNames.value.includes(name)) customShellNames.value.push(name)
    }
    shellRefreshKey.value++

    if (result.errors.length > 0) {
      errorDialogShellCount.value = result.shells.length
      errorDialogErrors.value = result.errors
      errorDialogSource.value = source
      errorDialogOpen.value = true
      showToast(t('firework.toast.loadedWithErrors', { shellCount: result.shells.length, errorCount: result.errors.length }))
    } else {
      showToast(t('firework.toast.loaded', { count: result.shells.length }))
    }
  }
  reader.readAsText(file)
}

function computeStageSize(): { w: number; h: number } {
  const w = Math.min(window.innerWidth, MAX_WIDTH)
  const h = window.innerWidth <= 420 ? window.innerHeight : Math.min(window.innerHeight, MAX_HEIGHT)
  return { w, h }
}

function handleResize() {
  const { w, h } = computeStageSize()
  stageWidth.value = w
  stageHeight.value = h
  engine.handleResize(w, h)
}

function loadPersistedConfig() {
  const raw = localStorage.getItem("cm_fireworks_data")
  if (!raw) return
  try {
    const { schemaVersion, data } = JSON.parse(raw)
    const c = engine.state.config
    const patch: Partial<EngineConfig> = {}
    if (schemaVersion === "1.1" || schemaVersion === "1.2") {
      patch.quality = data.quality
      patch.size = data.size
      patch.skyLighting = data.skyLighting
    }
    if (schemaVersion === "1.2") { patch.scaleFactor = data.scaleFactor }
    engine.setState({ config: { ...c, ...patch } })
  } catch { /* */ }
}

watch(() => engine.state.config, () => {
  const c = engine.state.config
  localStorage.setItem("cm_fireworks_data", JSON.stringify({
    schemaVersion: "1.2",
    data: { quality: c.quality, size: c.size, skyLighting: c.skyLighting, scaleFactor: c.scaleFactor },
  }))
}, { deep: true })

function handleKeydown(e: KeyboardEvent) {
  if (e.code === "KeyP") engine.togglePause()
  else if (e.code === "KeyO") engine.toggleMenu()
  else if (e.code === "Escape") engine.toggleMenu(false)
}

onMounted(async () => {
  engine.init()

  const { w, h } = computeStageSize()
  stageWidth.value = w
  stageHeight.value = h

  const container = canvasContainer.value
  if (container) {
    engine.mount(container)
  }

  loadPersistedConfig()
  handleResize()
  window.addEventListener("resize", handleResize)
  document.addEventListener("keydown", handleKeydown)
  document.addEventListener("fullscreenchange", syncFullscreenState)

  engine.togglePause(false)
  engine.configDidUpdate()

  await nextTick()
  loading.value = false
  canvasReady.value = true
})

onUnmounted(() => {
  window.removeEventListener("resize", handleResize)
  document.removeEventListener("keydown", handleKeydown)
  document.removeEventListener("fullscreenchange", syncFullscreenState)
  engine.destroy()
})
</script>

<style lang="scss" scoped>
.app-root {
  flex: 1;
  height: 100%;
  justify-content: center;
  align-items: center;
  background: #000;
  overflow: hidden;

  &.tauri {
    height: 100vh;
    display: flex;
    margin-top: -36px;

    &:deep(.control-bar) {
      top: 36px;
    }
  }

  .loading-screen {
    position: absolute;
    z-index: 50;
  }

  .stage-frame {
    position: relative;
    overflow: hidden;
    flex-shrink: 0;
  }

  .stage-canvas {
    width: 100%;
    height: 100%;
  }

  .stage-canvas :deep(canvas) {
    position: absolute;
    top: 0;
    left: 0;
    transform: translateZ(0);
    pointer-events: auto;
  }

  .toast {
    position: fixed;
    bottom: 60px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 200;
    padding: 10px 24px;
    background: var(--ios-bg-tertiary);
    color: var(--ios-label-primary);
    font-size: 15px;
    letter-spacing: var(--letter-spacing);
    border-radius: var(--ios-radius);
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
    pointer-events: none;
  }
}



.toast-fade-enter-active,
.toast-fade-leave-active {
  transition: opacity 0.3s ease, transform 0.3s ease;
}

.toast-fade-enter-from,
.toast-fade-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(12px);
}
</style>
