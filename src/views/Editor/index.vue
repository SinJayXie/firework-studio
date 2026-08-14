<template>
  <div class="editor-page">
    <!-- 左侧编辑器 -->
    <div class="editor-left">
      <!-- 返回主页 + 模式切换 -->
      <div class="editor-top-bar">
        <router-link to="/" class="editor-back">
          <MdiIcon icon="i-mdi-chevron-left" />
          {{ t('editor.engine') }}
        </router-link>

        <div class="editor-tabs">
          <button
            :class="['editor-tab', { 'editor-tab--active': editorMode === 'code' }]"
            @click="editorMode = 'code'"
          >
            <MdiIcon icon="i-mdi-code-braces" />
            {{ t('editor.code') }}
          </button>
          <button
            :class="['editor-tab', { 'editor-tab--active': editorMode === 'design' }]"
            @click="editorMode = 'design'"
          >
            <MdiIcon icon="i-mdi-palette-swatch" />
            {{ t('editor.design') }}
          </button>
        </div>
      </div>

      <ShellEditor
        v-if="editorMode === 'code'"
        v-model="shellCode"
        :file-name="currentFileName"
        :file-path="currentFilePath"
        class="editor-panel"
        @run-all="runAll"
        @run-firework="runSingleFirework"
        @parse="parseScript"
        @file-opened="onFileOpened"
      />
      <VisualDesigner
        v-else
        v-model="shellCode"
        class="editor-panel"
        @run-firework="runSingleFirework"
      />
    </div>

    <!-- 右侧面板 -->
    <div class="editor-right">
      <!-- 调试预览 -->
      <PanelCard class="editor-preview" :title="t('editor.preview')" icon="i-mdi-monitor-screenshot">
        <template #actions>
          <div class="editor-right__actions">
            <ToolButton icon="i-mdi-broom" :title="t('editor.clearCanvas')" @click="clearCanvas">{{ t('editor.clearCanvas') }}</ToolButton>
            <ToolButton icon="i-mdi-play-circle" :title="t('editor.runAll')" variant="primary" @click="runAll">{{ t('editor.runAll') }}</ToolButton>
          </div>
        </template>
        <div ref="previewContainer" class="editor-preview__canvas"></div>
      </PanelCard>

      <!-- 日志 -->
      <PanelCard class="editor-logs" :title="t('editor.logs')" icon="i-mdi-console">
        <template #actions>
          <ToolButton icon="i-mdi-close" variant="danger" :title="t('editor.clearLogs')" @click="logs = []">{{ t('editor.clearLogs') }}</ToolButton>
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
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, nextTick } from "vue"
import { useI18n } from "vue-i18n"
import ShellEditor from "./ShellEditor.vue"
import VisualDesigner from "./VisualDesigner.vue"
import PanelCard from "../../components/PanelCard.vue"
import ToolButton from "../../components/ToolButton.vue"
import MdiIcon from "../../components/MdiIcon.vue"
import { Firework, parseShellScript, loadShellScript, shellNames } from "../../libs/firework-engine"
import type { ParsedShell, ShellParseError } from "../../libs/firework-engine"

const editorMode = ref<"code" | "design">("code")

const { t } = useI18n()

const shellCode = ref(`// ─── Example ───

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
        flash(25)
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

onMounted(() => {
  initEngine()
  window.addEventListener("resize", handleResize)
})

onUnmounted(() => {
  window.removeEventListener("resize", handleResize)
  if (engine) engine.destroy()
})
</script>

<style scoped lang="scss">
.editor-page {
  display: flex;
  height: 100%;
  background: #1e1e1e;
  color: #d4d4d4;
  overflow: hidden;
}

// ── 左侧 ──
.editor-left {
  flex: 1;
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  padding: 8px;
  gap: 8px;
  overflow: hidden;
}

.editor-panel {
  flex: 1;
  min-height: 0;
}

// ── 模式 tabs ──
.editor-top-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.editor-tabs {
  display: flex;
  background: #252526;
  border-radius: 10px;
  overflow: hidden;
  flex-shrink: 0;
}

.editor-tab {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 7px 16px;
  font-size: 13px;
  font-family: inherit;
  color: #888;
  background: transparent;
  border: none;
  cursor: pointer;
  transition: all 0.15s;

  &:hover {
    color: #ccc;
    background: rgba(255, 255, 255, 0.04);
  }

  &--active {
    color: #fff;
    background: rgba(14, 99, 156, 0.3);
  }
}

// ── 右侧 ──
.editor-right {
  width: 50%;
  min-width: 400px;
  display: flex;
  flex-direction: column;
  padding: 8px;
  padding-left: 0;
  gap: 8px;
  overflow: hidden;

  &__actions {
    display: flex;
    gap: 6px;
  }
}

// ── 预览 ──
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

// ── 日志 ──
.editor-logs {
  flex-shrink: 0;
  height: 160px;

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

// ── 返回链接 ──
.editor-back {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  font-size: 14px;
  color: var(--ios-tint);
  text-decoration: none;
  border-radius: 6px;
  flex-shrink: 0;
  transition: background 0.15s;

  &:hover {
    background: rgba(10, 132, 255, 0.1);
  }
}
</style>
