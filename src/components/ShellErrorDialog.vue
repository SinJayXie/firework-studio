<template>
  <AppDialog :show="show" :title="t('firework.errorDialog.title')" :width="560" @close="$emit('close')">
    <div class="err-summary">
      <span class="err-ok">{{ t('firework.errorDialog.loaded', { count: shellCount }) }}</span>
      <span class="err-count">{{ t('firework.errorDialog.errors', { count: errors.length }) }}</span>
    </div>

    <div class="err-body">
      <div
        v-for="(err, idx) in errors"
        :key="idx"
        class="err-item"
      >
        <div class="err-msg">{{ err.message }}</div>
        <div class="err-loc">{{ t('firework.errorDialog.lineCol', { line: err.line, col: err.col }) }}</div>
        <div class="err-code">
          <div
            v-for="(ctxLine, i) in getContext(err)"
            :key="i"
            :class="['code-line', { 'code-line--error': ctxLine.isError }]"
          >
            <span class="code-line__num">{{ ctxLine.num }}</span>
            <span class="code-line__text">{{ ctxLine.text }}</span>
          </div>
        </div>
      </div>
    </div>

    <template #footer>
      <AppButton variant="ghost" @click="$emit('close')">{{ t('common.close') }}</AppButton>
    </template>
  </AppDialog>
</template>

<script setup lang="ts">
import { useI18n } from "vue-i18n"
import type { ShellParseError } from "../libs/firework-engine"
import AppDialog from "./AppDialog.vue"
import AppButton from "./AppButton.vue"

const { t } = useI18n()

const props = defineProps<{
  show: boolean
  shellCount: number
  errors: ShellParseError[]
  source: string
}>()

defineEmits<{ close: [] }>()

interface CodeLine { num: number; text: string; isError: boolean }

function getContext(err: ShellParseError): CodeLine[] {
  const lines = props.source.split("\n")
  const idx = err.line - 1
  const start = Math.max(0, idx - 2)
  const end = Math.min(lines.length, idx + 3)
  const result: CodeLine[] = []

  for (let i = start; i < end; i++) {
    let text = lines[i] || ""
    const isError = i === idx
    const lineNum = i + 1

    if (isError && err.col > 0) {
      const pad = " ".repeat(Math.max(0, err.col - 1))
      text = text + "\n" + pad + "^".repeat(4)
    }

    result.push({ num: lineNum, text, isError })
  }

  return result
}
</script>

<style scoped>
.err-summary {
  display: flex;
  gap: 12px;
  margin-bottom: 16px;
  font-size: 14px;
}

.err-ok {
  color: var(--ios-green);
}

.err-count {
  color: var(--ios-red);
}

.err-body {
  max-height: 400px;
  overflow-y: auto;
}

.err-item {
  margin-bottom: 16px;
  padding-bottom: 16px;
  border-bottom: 1px solid var(--ios-separator-opaque);
}

.err-item:last-child {
  border-bottom: none;
  margin-bottom: 0;
  padding-bottom: 0;
}

.err-msg {
  font-size: 14px;
  font-weight: 600;
  color: var(--ios-red);
  margin-bottom: 4px;
}

.err-loc {
  font-size: 12px;
  color: var(--ios-label-secondary);
  margin-bottom: 8px;
}

.err-code {
  background: rgba(0,0,0,0.3);
  border-radius: 6px;
  padding: 6px 0;
  overflow-x: auto;
  font-family: monospace;
}

.code-line {
  display: flex;
  font-size: 13px;
  line-height: 1.5;
  padding: 0 8px;
  white-space: pre;
}

.code-line--error {
  background: rgba(255, 69, 58, 0.15);
  color: var(--ios-red);
}

.code-line__num {
  flex-shrink: 0;
  width: 36px;
  color: var(--ios-label-tertiary);
  text-align: right;
  margin-right: 12px;
  user-select: none;
}

.code-line__text {
  color: var(--ios-label-primary);
}

.code-line--error .code-line__text {
  color: var(--ios-red);
}
</style>
