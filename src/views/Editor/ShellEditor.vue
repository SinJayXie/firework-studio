<template>
  <PanelCard class="shell-editor" :title="t('shellEditor.title')" icon="i-mdi-code-braces">
    <template #actions>
      <div class="shell-editor__toolbar">
        <ToolButton icon="i-mdi-folder-open-outline" :title="t('editor.openTitle')" @click="handleOpenFile">{{ t('editor.openFile') }}</ToolButton>
        <ToolButton icon="i-mdi-content-save" :title="t('editor.saveTitle')" @click="handleSaveFile">{{ t('editor.saveFile') }}</ToolButton>
        <ToolButton icon="i-mdi-format-align-left" :title="t('editor.formatTitle')" @click="formatDocument">{{ t('editor.format') }}</ToolButton>
      </div>
    </template>

    <div ref="editorContainer" class="shell-editor__container"></div>
  </PanelCard>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from "vue"
import { useI18n } from "vue-i18n"
import * as monaco from "monaco-editor"
import { parseShellScript } from "../../libs/firework-engine"
import PanelCard from "../../components/PanelCard.vue"
import ToolButton from "../../components/ToolButton.vue"
import { useFileIO } from "../../composables/useFileIO"
import { ensureFireworkShellLanguage, FIREWORK_SHELL_LANG, FIREWORK_SHELL_THEME } from "./monaco/language"
import { registerFireworkShellFeatures } from "./monaco/features"

const props = defineProps<{
  modelValue: string
  filePath?: string
}>()

const emit = defineEmits<{
  "update:modelValue": [value: string]
  "run-firework": [name: string]
  "file-opened": [file: { name: string; path?: string }]
  "cursor-block": [index: number]
}>()

const { t } = useI18n()
const editorContainer = ref<HTMLElement>()

let editor: monaco.editor.IStandaloneCodeEditor | null = null
let model: monaco.editor.ITextModel | null = null
let featuresDisposable: monaco.IDisposable | null = null
let applyingExternal = false

function updateMarkers(value: string) {
  const m = model
  if (!m) return
  const lineCount = m.getLineCount()
  const markers: monaco.editor.IMarkerData[] = parseShellScript(value).errors.map((err) => {
    const line = Math.max(1, Math.min(err.line, lineCount))
    return {
      severity: monaco.MarkerSeverity.Error,
      message: err.message,
      startLineNumber: line,
      startColumn: Math.max(1, err.col),
      endLineNumber: line,
      endColumn: m.getLineMaxColumn(line),
    }
  })
  monaco.editor.setModelMarkers(m, FIREWORK_SHELL_LANG, markers)
}

function formatDocument() {
  editor?.getAction("editor.action.formatDocument")?.run()
}

function fireworkBlockStartLines(code: string): number[] {
  const lines = code.split("\n")
  const starts: number[] = []
  for (let i = 0; i < lines.length; i++) {
    const t = lines[i].trim()
    if (t.startsWith("firework") && (t.endsWith("{") || t === "firework")) starts.push(i + 1)
  }
  return starts
}

function blockIndexAtLine(code: string, line: number): number {
  const starts = fireworkBlockStartLines(code)
  let count = 0
  for (const s of starts) if (s <= line) count++
  return Math.max(0, count - 1)
}

function revealBlock(index: number) {
  if (!editor || !model) return
  const starts = fireworkBlockStartLines(model.getValue())
  const line = starts[index] ?? 1
  editor.revealLineInCenter(line)
  editor.setPosition({ lineNumber: line, column: 1 })
  editor.focus()
}

const { openFile: openFileIO, saveFile: saveFileIO } = useFileIO()

async function handleOpenFile() {
  const result = await openFileIO()
  if (!result) return
  emit("update:modelValue", result.content)
  emit("file-opened", { name: result.name, path: result.path })
}

async function handleSaveFile() {
  const savedPath = await saveFileIO(props.modelValue, props.filePath || undefined)
  if (savedPath) {
    emit("file-opened", { name: savedPath.split(/[\\/]/).pop() || t("common.untitled"), path: savedPath })
  }
}

onMounted(() => {
  if (!editorContainer.value) return
  ensureFireworkShellLanguage()

  const editorModel = monaco.editor.createModel(props.modelValue, FIREWORK_SHELL_LANG)
  const editorInstance = monaco.editor.create(editorContainer.value, {
    model: editorModel,
    theme: FIREWORK_SHELL_THEME,
    automaticLayout: true,
    fontFamily: '"Consolas", "Courier New", monospace',
    fontSize: 14,
    lineHeight: 21,
    tabSize: 4,
    insertSpaces: true,
    minimap: { enabled: false },
    scrollBeyondLastLine: false,
    wordWrap: "off",
    folding: true,
    wordBasedSuggestions: "off",
    padding: { top: 12, bottom: 12 },
  })

  model = editorModel
  editor = editorInstance

  editorModel.onDidChangeContent(() => {
    const value = editorModel.getValue()
    if (!applyingExternal) {
      emit("update:modelValue", value)
    }
    updateMarkers(value)
  })

  editorInstance.onDidChangeCursorPosition((e) => {
    emit("cursor-block", blockIndexAtLine(editorModel.getValue(), e.position.lineNumber))
  })

  featuresDisposable = registerFireworkShellFeatures((name) => emit("run-firework", name))
  updateMarkers(props.modelValue)
})

watch(
  () => props.modelValue,
  (value) => {
    if (!model || value === model.getValue()) return
    applyingExternal = true
    model.setValue(value)
    applyingExternal = false
  },
)

onBeforeUnmount(() => {
  featuresDisposable?.dispose()
  featuresDisposable = null
  editor?.dispose()
  editor = null
  model?.dispose()
  model = null
})

defineExpose({ revealBlock })
</script>

<style scoped lang="scss">
.shell-editor {
  flex: 1;
  min-height: 0;

  &__toolbar {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  &__container {
    flex: 1;
    min-height: 0;
  }
}
</style>
