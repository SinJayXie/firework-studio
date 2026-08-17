<template>
  <div class="editor-page">
    <!-- 顶栏 -->
    <header class="editor-titlebar">
      <router-link to="/" class="editor-titlebar__back">
        <MdiIcon icon="i-mdi-chevron-left" />
        <span>{{ t('editor.engine') }}</span>
      </router-link>

      <div class="editor-titlebar__tabs">
        <button
          :class="['editor-titlebar__tab', { 'editor-titlebar__tab--active': editorMode === 'code' }]"
          @click="switchMode('code')"
        >
          <MdiIcon icon="i-mdi-code-braces" />
          {{ t('editor.code') }}
        </button>
        <button
          :class="['editor-titlebar__tab', { 'editor-titlebar__tab--active': editorMode === 'design' }]"
          @click="switchMode('design')"
        >
          <MdiIcon icon="i-mdi-palette-swatch" />
          {{ t('editor.design') }}
        </button>
      </div>

      <div class="editor-titlebar__actions">
        <ToolButton icon="i-mdi-code-tags" :title="t('editor.parseTitle')" @click="parseScript">{{ t('editor.parse') }}</ToolButton>
        <ToolButton icon="i-mdi-play-circle" :title="t('editor.runTitle')" variant="primary" @click="runAll">{{ t('editor.runAll') }}</ToolButton>
      </div>
    </header>

    <!-- 主体 -->
    <div class="editor-body">
      <!-- 活动栏 -->
      <nav class="editor-activity-bar">
        <button
          :class="['editor-activity-bar__item', { 'editor-activity-bar__item--active': showPreview }]"
          :title="t('editor.preview')"
          @click="showPreview = !showPreview"
        >
          <MdiIcon icon="i-mdi-monitor-screenshot" />
        </button>
        <button
          :class="['editor-activity-bar__item', { 'editor-activity-bar__item--active': showLogs }]"
          :title="t('editor.logs')"
          @click="showLogs = !showLogs"
        >
          <MdiIcon icon="i-mdi-console" />
        </button>
      </nav>

      <!-- 工作区 -->
      <main class="editor-workbench">
        <ShellEditor
          v-if="editorMode === 'code'"
          ref="codeEditorRef"
          v-model="shellCode"
          :file-path="currentFilePath"
          @run-firework="runSingleFirework"
          @file-opened="onFileOpened"
          @cursor-block="onCursorBlock"
        />
        <VisualDesigner
          v-else
          ref="designerRef"
          v-model="shellCode"
          @run-firework="runSingleFirework"
          @active-change="onActiveChange"
        />
      </main>

      <!-- 右侧预览 -->
      <aside v-if="showPreview" class="editor-preview-panel">
        <PanelCard class="editor-preview" :title="t('editor.preview')" icon="i-mdi-monitor-screenshot">
          <template #actions>
            <ToolButton icon="i-mdi-broom" :title="t('editor.clearCanvas')" @click="clearCanvas" />
          </template>
          <div ref="previewContainer" class="editor-preview__canvas"></div>
        </PanelCard>
      </aside>
    </div>

    <!-- 底部日志 -->
    <footer v-if="showLogs" class="editor-log-panel">
      <PanelCard class="editor-logs" :title="t('editor.logs')" icon="i-mdi-console">
        <template #actions>
          <ToolButton icon="i-mdi-close" variant="danger" :title="t('editor.clearLogs')" @click="logs = []" />
        </template>
        <div class="editor-logs__list" ref="logListRef">
          <div
            v-for="(log, i) in logs"
            :key="i"
            :class="['editor-log', `editor-log--${log.type}`]"
          >
            <span class="editor-log__time">{{ log.time }}</span>
            <span class="editor-log__msg">{{ log.msg }}</span>
          </div>
          <div v-if="logs.length === 0" class="editor-logs__empty">{{ t('editor.noLogs') }}</div>
        </div>
      </PanelCard>
    </footer>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, nextTick, watch } from "vue"
import { useI18n } from "vue-i18n"
import ShellEditor from "./ShellEditor.vue"
import VisualDesigner from "./VisualDesigner.vue"
import PanelCard from "../../components/PanelCard.vue"
import ToolButton from "../../components/ToolButton.vue"
import MdiIcon from "../../components/MdiIcon.vue"
import { Firework, parseShellScript, loadShellScript, shellNames } from "../../libs/firework-engine"
import type { ParsedShell, ShellParseError } from "../../libs/firework-engine"
import { useWindowTitle } from "../../composables/useWindowTitle"

const { t } = useI18n()
const { setFileName } = useWindowTitle()

const editorMode = ref<"code" | "design">("code")

const codeEditorRef = ref<{ revealBlock: (index: number) => void } | null>(null)
const designerRef = ref<{ setActiveBlock: (index: number) => void } | null>(null)
const syncBlockIdx = ref(0)

function switchMode(mode: "code" | "design") {
  editorMode.value = mode
  nextTick(() => {
    if (mode === "design") {
      designerRef.value?.setActiveBlock(syncBlockIdx.value)
    } else {
      codeEditorRef.value?.revealBlock(syncBlockIdx.value)
    }
  })
}

function onCursorBlock(index: number) {
  syncBlockIdx.value = index
}

function onActiveChange(index: number) {
  syncBlockIdx.value = index
}

// ── 面板显示状态 ──
const showPreview = ref(true)
const showLogs = ref(true)

const shellCode = ref(`// ─── Example ───
// 经典动作：爆发 / 圆弧 / 螺旋 / 圆环 / 波浪 / 心形

firework {
    name = "nebula-spiral"
    size = 300
    life = 1200
    color = #1e7fff
    secondColor = #14fc56
    glitter = light
    glitterColor = #ffffff

    // 物理参数
    gravity = 1.2
    fade = 0.8
    launchHeight = 0.6

    ring = true
    strobe = true
    strobeColor = #ffffff

    onDeath {
        burst 6 { color = inherit, life = 400, speed = 0.6 }
        arc 8 (Math.PI) { color = inherit, life = 500 }
        spiral 16 (2) { color = inherit, life = 600, speed = 1.0 }
        ring 24 { color = inherit, life = 500, speed = 1.0, gravity = 0.4 }
        wave 32 (3) { color = inherit, life = 600, speed = 0.9, fade = 0.2 }
        heart 60 { color = inherit, life = 700, speed = 0.8, delay = 300, duration = 500 }
        flash(25)
    }
}

// 造型动作：星形 / 雪花 / 花朵 / 十字 / 方形 / 三角 / 箭头
firework {
    name = "shape-parade"
    size = 320
    life = 1300
    color = #ffbf36

    onDeath {
        star 48 (5) { color = gradient(#ffbf36, #ffffff), life = 600 }
        snowflake 60 (6) { color = #1e7fff, life = 700, delay = 200 }
        flower 60 (8) { color = gradient(#ff6699, #ffbf36), life = 700, delay = 400 }
        cross 44 { color = #ffffff, life = 550, delay = 600 }
        square 48 { color = #14fc56, life = 550, delay = 800 }
        triangle 44 { color = #ffbf36, life = 550, delay = 1000 }
        arrow 48 { color = #ff0043, life = 550, delay = 1200 }
    }
}

// 运动 / 文字动作：漩涡 / 星系 / 喷泉 / 雨滴 / 点阵文字
firework {
    name = "galaxy-text"
    size = 340
    life = 1500
    color = #1e7fff

    onDeath {
        vortex 60 (3) { color = gradient(#1e7fff, #00ff88), life = 700 }
        galaxy 80 (2) { color = gradient(#9933ff, #1e7fff), life = 800, delay = 300 }
        fountain 50 { color = gradient(#ffbf36, #ffffff), life = 600, delay = 500 }
        rain 60 { color = #00ffcc, life = 700, delay = 700 }
        text 90 ("LOVE") { color = gradient(#ff0043, #ff6699), life = 800, delay = 900 }
    }
}
`)

const currentFileName = ref("")
const currentFilePath = ref("")
const parsedShells = ref<ParsedShell[]>([])
const parseErrors = ref<ShellParseError[]>([])

// ── Log ──
interface LogEntry {
  time: string
  type: "info" | "error" | "success" | "run"
  msg: string
}

const logs = ref<LogEntry[]>([])
const logListRef = ref<HTMLElement>()

function formatTime(): string {
  const d = new Date()
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}:${String(d.getSeconds()).padStart(2, "0")}`
}

function addLog(type: LogEntry["type"], msg: string) {
  logs.value.push({ time: formatTime(), type, msg })
  nextTick(() => {
    const el = logListRef.value
    if (el) el.scrollTop = el.scrollHeight
  })
}

// Preview engine
const previewContainer = ref<HTMLElement>()
let engine: Firework | null = null

function initEngine() {
  if (!previewContainer.value) return
  if (engine) engine.destroy()
  engine = new Firework()
  engine.init()
  engine.mount(previewContainer.value)
  engine.togglePause(false)
  engine.setState({ config: { ...engine.state.config, autoLaunch: false, debug: true } })
  engine.configDidUpdate()
  const rect = previewContainer.value.getBoundingClientRect()
  engine.handleResize(rect.width, rect.height)
}

function onFileOpened(file: { name: string; path?: string }) {
  currentFileName.value = file.name
  currentFilePath.value = file.path || ""
}

watch(currentFileName, (name) => setFileName(name))

function parseScript() {
  const result = parseShellScript(shellCode.value)
  parsedShells.value = result.shells
  parseErrors.value = result.errors

  if (result.errors.length > 0) {
    for (const err of result.errors) {
      addLog("error", `${t('log.lineCol', { line: err.line, col: err.col })} ${err.message}`)
    }
  }
  if (result.shells.length > 0) {
    addLog("info", t('editor.parseComplete', { count: result.shells.length }))
  }
}

function runAll() {
  parseScript()
  if (!engine) return

  const result = loadShellScript(shellCode.value)
  for (const name of result.shells) {
    if (!shellNames.includes(name)) {
      shellNames.push(name)
    }
  }

  const names = result.shells
  addLog("run", t('editor.runningAll', { count: names.length }))
  for (let i = 0; i < names.length; i++) {
    setTimeout(() => {
      if (!engine) return
      engine.setState({ config: { ...engine.state.config, shell: names[i] } })
      engine.configDidUpdate()
      engine.launchShellFromConfig()
      addLog("success", t('editor.launched', { name: names[i] }))
    }, i * 400)
  }
}

function runShell(name: string) {
  if (!engine) return
  engine.setState({ config: { ...engine.state.config, shell: name } })
  engine.configDidUpdate()
  engine.launchShellFromConfig()
  addLog("success", t('editor.launched', { name }))
}

function runSingleFirework(name: string) {
  parseScript()
  if (!engine) return
  void loadShellScript(shellCode.value)
  if (!shellNames.includes(name)) {
    shellNames.push(name)
  }
  runShell(name)
}

function clearCanvas() {
  if (engine) engine.destroy()
  engine = null
  setTimeout(() => initEngine(), 50)
  addLog("info", t('editor.canvasCleared'))
}

function handleResize() {
  if (!previewContainer.value || !engine) return
  const rect = previewContainer.value.getBoundingClientRect()
  engine.handleResize(rect.width, rect.height)
}

watch(showPreview, (visible) => {
  if (visible) {
    nextTick(() => initEngine())
  } else if (engine) {
    engine.destroy()
    engine = null
  }
})

onMounted(() => {
  initEngine()
  window.addEventListener("resize", handleResize)
})

onUnmounted(() => {
  setFileName("")
  window.removeEventListener("resize", handleResize)
  if (engine) engine.destroy()
})
</script>

<style scoped lang="scss">
.editor-page {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: #1e1e1e;
  color: #d4d4d4;
  overflow: hidden;
}

// ── 顶栏 ──
.editor-titlebar {
  display: flex;
  align-items: center;
  gap: 12px;
  height: 40px;
  padding: 0 10px;
  background: #2d2d30;
  border-bottom: 1px solid #3c3c3c;
  flex-shrink: 0;

  &__back {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 5px 10px;
    font-size: 13px;
    color: #ccc;
    text-decoration: none;
    border-radius: 6px;
    flex-shrink: 0;
    transition: background 0.15s;

    &:hover {
      background: rgba(255, 255, 255, 0.08);
    }
  }

  &__tabs {
    display: flex;
    background: #1e1e1e;
    border-radius: 8px;
    overflow: hidden;
    margin: 0 auto;
    flex-shrink: 0;
  }

  &__tab {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 6px 16px;
    font-size: 13px;
    font-family: inherit;
    color: #888;
    background: transparent;
    border: none;
    cursor: pointer;
    transition: all 0.15s;

    &:hover {
      color: #ccc;
    }

    &--active {
      color: #fff;
      background: rgba(14, 99, 156, 0.35);
    }
  }

  &__actions {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-shrink: 0;
  }

  &__file {
    max-width: 180px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 12px;
    color: #888;
    margin-right: 4px;
  }
}

// ── 主体 ──
.editor-body {
  display: flex;
  flex: 1;
  min-height: 0;
}

// ── 活动栏 ──
.editor-activity-bar {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  width: 48px;
  padding: 8px 0;
  background: #333333;
  flex-shrink: 0;

  &__item {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    font-size: 20px;
    color: #858585;
    background: transparent;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    transition: all 0.15s;

    &:hover {
      color: #ccc;
      background: rgba(255, 255, 255, 0.06);
    }

    &--active {
      color: #fff;
      background: rgba(14, 99, 156, 0.3);
      box-shadow: inset 2px 0 0 #4fc1ff;
    }
  }
}

// ── 工作区 ──
.editor-workbench {
  flex: 1;
  min-width: 0;
  min-height: 0;
  display: flex;
  padding: 8px;
  overflow: hidden;

  > * {
    flex: 1;
    min-height: 0;
  }
}

// ── 右侧预览 ──
.editor-preview-panel {
  display: flex;
  flex-direction: column;
  width: 42%;
  min-width: 320px;
  max-width: 640px;
  padding: 8px;
  padding-left: 0;
  flex-shrink: 0;
}

.editor-preview {
  flex: 1;
  min-height: 0;

  &__canvas {
    flex: 1;
    min-height: 0;
    position: relative;
    background: #000;
    overflow: hidden;
  }
}

// ── 底部日志 ──
.editor-log-panel {
  display: flex;
  flex-direction: column;
  height: 180px;
  padding: 0 8px 8px;
  flex-shrink: 0;
}

.editor-logs {
  flex: 1;
  min-height: 0;

  &__list {
    flex: 1;
    overflow-y: auto;
    padding: 4px 0;
  }

  &__empty {
    padding: 20px;
    text-align: center;
    font-size: 13px;
    color: #555;
  }
}

.editor-log {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 2px 12px;
  font-size: 12px;
  font-family: "Consolas", "Courier New", monospace;
  line-height: 1.6;

  &__time {
    flex-shrink: 0;
    color: #555;
  }

  &__msg {
    word-break: break-all;
  }

  &--info {
    color: #888;
  }

  &--error {
    color: #f44747;
    background: rgba(244, 71, 71, 0.06);
  }

  &--success {
    color: #4ec9b0;
  }

  &--run {
    color: #569cd6;
  }
}
</style>
