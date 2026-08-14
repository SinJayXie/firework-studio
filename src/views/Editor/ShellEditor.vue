<template>
  <PanelCard class="shell-editor" :title="fileName || t('shellEditor.untitled')" icon="i-mdi-code-braces">
    <template #actions>
      <div class="shell-editor__toolbar">
        <ToolButton icon="i-mdi-folder-open-outline" :title="t('editor.openTitle')" @click="handleOpenFile">{{ t('editor.openFile') }}</ToolButton>
        <ToolButton icon="i-mdi-content-save" :title="t('editor.saveTitle')" @click="handleSaveFile">{{ t('editor.saveFile') }}</ToolButton>
        <ToolButton icon="i-mdi-format-align-left" :title="t('editor.formatTitle')" @click="formatDocument">{{ t('editor.format') }}</ToolButton>
        <ToolButton icon="i-mdi-play" :title="t('editor.runTitle')" variant="primary" @click="$emit('run-all')">{{ t('editor.runAll') }}</ToolButton>
        <ToolButton icon="i-mdi-code-tags" :title="t('editor.parseTitle')" @click="$emit('parse')">{{ t('editor.parse') }}</ToolButton>
      </div>
    </template>

    <div class="shell-editor__body">
      <!-- 行号 -->
      <div ref="lineNumbers" class="shell-editor__lines">
        <div v-for="n in lineCount" :key="n" class="shell-editor__line">
          <button
            v-if="fireworkBlockMap.has(n - 1)"
            class="shell-editor__play-btn"
            :title="fireworkBlockMap.has(n - 1) ? t('editor.runFirework', { name: fireworkBlockMap.get(n - 1) }) : undefined"
            @mousedown.stop.prevent
            @click.stop="playFirework(n - 1)"
          >&#9654;</button>
          <span class="shell-editor__line-num">{{ n }}</span>
        </div>
      </div>

      <!-- 代码区 -->
      <div class="shell-editor__code-area">
        <div
          ref="editorRef"
          class="shell-editor__input"
          contenteditable="true"
          spellcheck="false"
          v-html="highlightedCode"
          :style="{ '--active-line': activeLine }"
          @beforeinput="onBeforeInput"
          @keydown="onKeydown"
          @keyup="onKeyup"
          @click="onClick"
          @scroll="onScroll"
          @paste="onPaste"
          @mouseover="onEditorMouseOver"
          @mouseout="onEditorMouseOut"
        ></div>

        <!-- 错误 tooltip -->
        <div
          v-if="errorTooltip.visible"
          class="shell-editor__error-tip"
          :style="errorTooltip.style"
        >
          {{ errorTooltip.message }}
        </div>

        <!-- Suggestions -->
        <ul
          v-if="showSuggestions"
          ref="suggestionsRef"
          class="shell-editor__suggestions"
          :style="suggestStyle"
        >
          <li
            v-for="(item, i) in filteredSuggestions"
            :key="item.label"
            :class="['shell-editor__suggestion', { 'shell-editor__suggestion--active': i === selectedIndex }]"
            @mousedown.prevent="applySuggestion(i)"
          >
            <div class="shell-editor__suggestion-main">
              <span class="shell-editor__suggestion-label">{{ item.label }}</span>
              <span class="shell-editor__suggestion-type">{{ item.type }}</span>
            </div>
            <span class="shell-editor__suggestion-desc">{{ item.desc }}</span>
          </li>
        </ul>
      </div>
    </div>
  </PanelCard>
</template>

<script setup lang="ts">
import { ref, computed, nextTick } from "vue"
import { useI18n } from "vue-i18n"
import { highlightShell, posToOffset } from "./ShellHighlighter"
import { parseShellScript } from "../../libs/firework-engine"
import PanelCard from "../../components/PanelCard.vue"
import ToolButton from "../../components/ToolButton.vue"
import { useFileIO } from "../../composables/useFileIO"

const props = defineProps<{
  modelValue: string
  fileName?: string
  filePath?: string
}>()

const emit = defineEmits<{
  "update:modelValue": [value: string]
  "run-all": []
  "run-firework": [name: string]
  "parse": []
  "file-opened": [file: { name: string; path?: string }]
}>()

const editorRef = ref<HTMLElement>()
const lineNumbers = ref<HTMLElement>()
const suggestionsRef = ref<HTMLElement>()

const { t } = useI18n()

// ── 智能提示 ──
interface SuggestionItem {
  label: string
  type: string
  desc: string
}

const completions = computed<SuggestionItem[]>(() => [
  { label: "firework", type: t("shellEditor.completions.firework.type"), desc: t("shellEditor.completions.firework.desc") },
  { label: "onDeath", type: t("shellEditor.completions.onDeath.type"), desc: t("shellEditor.completions.onDeath.desc") },
  { label: "burst", type: t("shellEditor.completions.burst.type"), desc: t("shellEditor.completions.burst.desc") },
  { label: "flash", type: t("shellEditor.completions.flash.type"), desc: t("shellEditor.completions.flash.desc") },
  { label: "arc", type: t("shellEditor.completions.arc.type"), desc: t("shellEditor.completions.arc.desc") },
  { label: "name", type: t("shellEditor.completions.name.type"), desc: t("shellEditor.completions.name.desc") },
  { label: "size", type: t("shellEditor.completions.size.type"), desc: t("shellEditor.completions.size.desc") },
  { label: "life", type: t("shellEditor.completions.life.type"), desc: t("shellEditor.completions.life.desc") },
  { label: "lifeVariation", type: t("shellEditor.completions.lifeVariation.type"), desc: t("shellEditor.completions.lifeVariation.desc") },
  { label: "density", type: t("shellEditor.completions.density.type"), desc: t("shellEditor.completions.density.desc") },
  { label: "starCount", type: t("shellEditor.completions.starCount.type"), desc: t("shellEditor.completions.starCount.desc") },
  { label: "color", type: t("shellEditor.completions.color.type"), desc: t("shellEditor.completions.color.desc") },
  { label: "secondColor", type: t("shellEditor.completions.secondColor.type"), desc: t("shellEditor.completions.secondColor.desc") },
  { label: "glitter", type: t("shellEditor.completions.glitter.type"), desc: t("shellEditor.completions.glitter.desc") },
  { label: "glitterColor", type: t("shellEditor.completions.glitterColor.type"), desc: t("shellEditor.completions.glitterColor.desc") },
  { label: "ring", type: t("shellEditor.completions.ring.type"), desc: t("shellEditor.completions.ring.desc") },
  { label: "horsetail", type: t("shellEditor.completions.horsetail.type"), desc: t("shellEditor.completions.horsetail.desc") },
  { label: "strobe", type: t("shellEditor.completions.strobe.type"), desc: t("shellEditor.completions.strobe.desc") },
  { label: "strobeColor", type: t("shellEditor.completions.strobeColor.type"), desc: t("shellEditor.completions.strobeColor.desc") },
  { label: "pistil", type: t("shellEditor.completions.pistil.type"), desc: t("shellEditor.completions.pistil.desc") },
  { label: "pistilColor", type: t("shellEditor.completions.pistilColor.type"), desc: t("shellEditor.completions.pistilColor.desc") },
  { label: "streamers", type: t("shellEditor.completions.streamers.type"), desc: t("shellEditor.completions.streamers.desc") },
  { label: "crossette", type: t("shellEditor.completions.crossette.type"), desc: t("shellEditor.completions.crossette.desc") },
  { label: "crackle", type: t("shellEditor.completions.crackle.type"), desc: t("shellEditor.completions.crackle.desc") },
  { label: "floral", type: t("shellEditor.completions.floral.type"), desc: t("shellEditor.completions.floral.desc") },
  { label: "fallingLeaves", type: t("shellEditor.completions.fallingLeaves.type"), desc: t("shellEditor.completions.fallingLeaves.desc") },
  { label: "speed", type: t("shellEditor.completions.speed.type"), desc: t("shellEditor.completions.speed.desc") },
  { label: "true", type: t("shellEditor.completions.true.type"), desc: t("shellEditor.completions.true.desc") },
  { label: "false", type: t("shellEditor.completions.false.type"), desc: t("shellEditor.completions.false.desc") },
  { label: "random", type: t("shellEditor.completions.random.type"), desc: t("shellEditor.completions.random.desc") },
  { label: "inherit", type: t("shellEditor.completions.inherit.type"), desc: t("shellEditor.completions.inherit.desc") },
])

type CtxKind = "top" | "firework" | "onDeath" | "burst" | "arc"

function detectContext(pos: number): CtxKind {
  const text = props.modelValue
  const stack: CtxKind[] = ["top"]

  for (let i = 0; i < pos; i++) {
    if (text[i] === "#") {
      while (i < pos && text[i] !== "\n") i++
      continue
    }
    if (text[i] === '"') {
      i++
      while (i < pos && text[i] !== '"') {
        if (text[i] === "\\") i++
        i++
      }
      continue
    }
    if (text[i] === "{") {
      let j = i - 1
      while (j >= 0 && (text[j] === " " || text[j] === "\t" || text[j] === "\n" || text[j] === "\r")) j--
      let newCtx: CtxKind = stack[stack.length - 1]
      if (j >= 0) {
        let k = j
        while (k >= 0 && /[a-zA-Z]/.test(text[k])) k--
        const word = text.slice(k + 1, j + 1)
        if (word === "firework") newCtx = "firework"
        else if (word === "onDeath") newCtx = "onDeath"
        else if (word === "burst") newCtx = "burst"
        else if (word === "arc") newCtx = "arc"
      }
      stack.push(newCtx)
    } else if (text[i] === "}") {
      if (stack.length > 1) stack.pop()
    }
  }
  return stack[stack.length - 1]
}

const fireworkCompletions = computed(() => completions.value.filter(c => c.type === t("shellEditor.completions.name.type") || c.label === "onDeath"))
const onDeathCompletions = computed(() => completions.value.filter(c => c.type === t("shellEditor.completions.name.type") || c.type === t("shellEditor.completions.burst.type")))
const burstCompletions = computed(() => completions.value.filter(c => c.type === t("shellEditor.completions.name.type")))
const arcCompletions = computed(() => completions.value.filter(c => c.type === t("shellEditor.completions.name.type")))
const topCompletions = computed(() => completions.value.filter(c => c.label === "firework"))

const valueCompletions = computed<SuggestionItem[]>(() => [
  { label: "true", type: t("shellEditor.completions.val_true.type"), desc: t("shellEditor.completions.val_true.desc") },
  { label: "false", type: t("shellEditor.completions.val_false.type"), desc: t("shellEditor.completions.val_false.desc") },
  { label: "random", type: t("shellEditor.completions.val_random.type"), desc: t("shellEditor.completions.val_random.desc") },
  { label: "inherit", type: t("shellEditor.completions.val_inherit.type"), desc: t("shellEditor.completions.val_inherit.desc") },
])

const PROP_VALUE_MAP = computed(() => {
  const vc = valueCompletions.value
  const gv = (k: string) => ({ label: k, type: t("shellEditor.completions.glitter_light.type"), desc: t(`shellEditor.completions.glitter_${k}.desc`) })
  return {
    glitter: [
      gv("light"), gv("medium"), gv("heavy"), gv("thick"), gv("streamer"), gv("willow"),
    ],
    ring: vc,
    horsetail: vc,
    strobe: vc,
    pistil: vc,
    streamers: vc,
    crossette: vc,
    crackle: vc,
    floral: vc,
    fallingLeaves: vc,
    size: [{ label: "260", type: t("shellEditor.completions.size_val.type"), desc: t("shellEditor.completions.size_val.desc") }],
    life: [{ label: "400", type: t("shellEditor.completions.life_val.type"), desc: t("shellEditor.completions.life_val.desc") }],
    lifeVariation: [{ label: "0.1", type: t("shellEditor.completions.lifeVariation_val.type"), desc: t("shellEditor.completions.lifeVariation_val.desc") }],
    density: [{ label: "0.5", type: t("shellEditor.completions.density_val.type"), desc: t("shellEditor.completions.density_val.desc") }],
    starCount: [{ label: "1", type: t("shellEditor.completions.starCount_val.type"), desc: t("shellEditor.completions.starCount_val.desc") }],
  } as Record<string, SuggestionItem[]>
})

function detectPropBeforeEqual(): string | null {
  const text = props.modelValue
  const sel = saveCaret()
  const pos = sel?.start ?? text.length

  const before2 = text.slice(Math.max(0, pos - 2), pos)
  if (before2 !== "= " && before2 !== "=\t" && (pos === 0 || text[pos - 1] !== "=")) {
    return null
  }

  let eqPos = text.lastIndexOf("=", pos - 1)
  if (eqPos < 0) return null
  let nameEnd = eqPos - 1
  while (nameEnd >= 0 && (text[nameEnd] === " " || text[nameEnd] === "\t")) nameEnd--
  if (nameEnd < 0) return null
  let nameStart = nameEnd
  while (nameStart >= 0 && /[a-zA-Z0-9_]/.test(text[nameStart])) nameStart--
  nameStart++
  const propName = text.slice(nameStart, nameEnd + 1)
  return propName || null
}

const showSuggestions = ref(false)
const filteredSuggestions = ref<SuggestionItem[]>([])
const selectedIndex = ref(0)
const suggestStyle = ref({ top: "0px", left: "0px" })
const suggestionJustApplied = ref(false)
const suggestionNavUsed = ref(false)
const afterPropValue = ref(false)

// ── 错误 tooltip ──
const errorTooltip = ref({
  visible: false,
  message: "",
  style: { top: "0px", left: "0px" },
})

function onEditorMouseOver(e: MouseEvent) {
  const target = e.target as HTMLElement
  const errorEl = target.closest?.(".sh-error") as HTMLElement | null
  if (!errorEl) {
    errorTooltip.value.visible = false
    return
  }
  const msg = errorEl.dataset.error || "syntax error"
  const rect = errorEl.getBoundingClientRect()
  const edRect = editorRef.value?.getBoundingClientRect()
  if (!edRect) return
  errorTooltip.value = {
    visible: true,
    message: msg,
    style: {
      top: `${rect.bottom - edRect.top + 4}px`,
      left: `${rect.left - edRect.left}px`,
    },
  }
}

function onEditorMouseOut(e: MouseEvent) {
  const target = e.target as HTMLElement
  if (target.closest?.(".sh-error")) {
    errorTooltip.value.visible = false
  }
}

function getCurrentWord(): { word: string; start: number; end: number } {
  const text = props.modelValue
  const sel = saveCaret()
  const pos = sel?.start ?? text.length
  let start = pos
  while (start > 0 && /[a-zA-Z0-9_]/.test(text[start - 1])) {
    start--
  }
  return { word: text.slice(start, pos), start, end: pos }
}

function updateSuggestions() {
  updateActiveLine()
  const { word, start } = getCurrentWord()

  if (afterPropValue.value) {
    afterPropValue.value = false
    const propName = detectPropBeforeEqual()
    if (propName) {
      const items = PROP_VALUE_MAP.value[propName] || valueCompletions.value
      filteredSuggestions.value = [...items]
      selectedIndex.value = 0
      showSuggestions.value = true
      const text = props.modelValue
      const sel = saveCaret()
      const pos = sel?.start ?? text.length
      positionSuggestions(pos)
      return
    }
  }

  {
    const propName = detectPropBeforeEqual()
    if (propName) {
      const items = PROP_VALUE_MAP.value[propName] || valueCompletions.value
      filteredSuggestions.value = [...items]
      selectedIndex.value = 0
      showSuggestions.value = true
      const text = props.modelValue
      const sel = saveCaret()
      const pos = sel?.start ?? text.length
      positionSuggestions(pos)
      return
    }
  }

  filter: {
    const text = props.modelValue
    const sel = saveCaret()
    const pos = sel?.start ?? text.length
    const ctx = detectContext(pos)
    const ctxCompletions = ctx === "onDeath" ? onDeathCompletions.value
      : ctx === "firework" ? fireworkCompletions.value
      : ctx === "burst" ? burstCompletions.value
      : ctx === "arc" ? arcCompletions.value
      : topCompletions.value

    const items = ctxCompletions.filter(c =>
      c.label.toLowerCase().startsWith(word.toLowerCase())
    )
    if (items.length === 1 && items[0].label === word) {
      break filter
    }
    if (word.length < 1 || items.length === 0) {
      break filter
    }
    filteredSuggestions.value = items
    if (showSuggestions.value) {
      selectedIndex.value = Math.min(selectedIndex.value, items.length - 1)
    } else {
      selectedIndex.value = 0
    }
    showSuggestions.value = true
    positionSuggestions(start)
    return
  }
  hideSuggestions()
}

function positionSuggestions(offset: number) {
  const ed = editorRef.value
  if (!ed) return
  const range = document.createRange()
  let cur = 0

  const walk = (node: Node): boolean => {
    if (node.nodeType === Node.TEXT_NODE) {
      const len = (node.textContent || "").length
      if (cur + len >= offset) {
        range.setStart(node, offset - cur)
        range.collapse(true)
        return true
      }
      cur += len
      return false
    }
    if (node.nodeType === Node.ELEMENT_NODE) {
      if ((node as HTMLElement).tagName === "BR") {
        if (cur >= offset) {
          range.setStartBefore(node)
          range.collapse(true)
          return true
        }
        cur += 1
        return false
      }
      for (const child of node.childNodes) {
        if (walk(child)) return true
      }
    }
    return false
  }

  for (const child of ed.childNodes) {
    if (walk(child)) break
  }

  const rect = range.getBoundingClientRect()
  const edRect = ed.getBoundingClientRect()
  suggestStyle.value = {
    top: `${rect.bottom - edRect.top + 2}px`,
    left: `${rect.left - edRect.left}px`,
  }
}

function hideSuggestions() {
  showSuggestions.value = false
  filteredSuggestions.value = []
  selectedIndex.value = 0
  afterPropValue.value = false
}

function applySuggestion(index: number) {
  const item = filteredSuggestions.value[index]
  if (!item) return
  const { start, end } = getCurrentWord()
  const isProperty = item.type === "属性"

  let insertText: string
  let caretOffset: number

  if (item.label === "firework" || item.label === "onDeath") {
    const text = props.modelValue
    const lineStart = text.lastIndexOf("\n", start - 1) + 1
    const lineBefore = text.slice(lineStart, start)
    const baseIndent = lineBefore.match(/^(\s*)/)?.[1] ?? ""
    insertText = item.label + " {\n" + baseIndent + "    \n" + baseIndent + "}"
    caretOffset = item.label.length + " {\n".length + 4
  } else if (item.label === "burst") {
    insertText = "burst 6 { }"
    caretOffset = "burst 6 { ".length
  } else if (item.label === "flash") {
    insertText = "flash(25)"
    caretOffset = "flash(".length
  } else if (item.label === "arc") {
    insertText = "arc 20"
    caretOffset = "arc ".length
  } else if (isProperty) {
    insertText = item.label + " = "
    caretOffset = insertText.length
  } else {
    insertText = item.label
    caretOffset = insertText.length
  }

  const newText = props.modelValue.slice(0, start) + insertText + props.modelValue.slice(end)
  emit("update:modelValue", newText)
  pushHistory(newText)
  suggestionJustApplied.value = true
  if (isProperty) afterPropValue.value = true
  hideSuggestions()
  nextTick(() => {
    restoreCaretAt(start + caretOffset)
    if (isProperty) updateSuggestions()
    setTimeout(() => { suggestionJustApplied.value = false }, 0)
  })
}

function onKeyup() {
  if (suggestionNavUsed.value) {
    suggestionNavUsed.value = false
    return
  }
  updateSuggestions()
}

function onClick() {
  updateActiveLine()
  hideSuggestions()
}

// ── 当前行高亮 ──
const activeLine = ref(0)

function updateActiveLine() {
  const sel = saveCaret()
  if (sel === null) return
  const textBefore = props.modelValue.slice(0, sel.start)
  activeLine.value = textBefore.split("\n").length - 1
}

// ── 撤回历史 ──
const MAX_HISTORY = 200
const history = ref<string[]>([props.modelValue])
const historyIndex = ref(0)

function pushHistory(text: string) {
  if (historyIndex.value < history.value.length - 1) {
    history.value = history.value.slice(0, historyIndex.value + 1)
  }
  history.value.push(text)
  if (history.value.length > MAX_HISTORY) {
    history.value.shift()
  } else {
    historyIndex.value++
  }
}

function undo() {
  if (historyIndex.value > 0) {
    historyIndex.value--
    emit("update:modelValue", history.value[historyIndex.value])
  }
}

function redo() {
  if (historyIndex.value < history.value.length - 1) {
    historyIndex.value++
    emit("update:modelValue", history.value[historyIndex.value])
  }
}

const lineCount = computed(() => {
  const lines = props.modelValue.split("\n").length
  return Math.max(lines, 1)
})

const fireworkBlockMap = computed(() => {
  const map = new Map<number, string>()
  const lines = props.modelValue.split("\n")
  for (let i = 0; i < lines.length; i++) {
    if (/^\s*firework\b/.test(lines[i])) {
      let name = ""
      let depth = 0
      for (let j = i; j < lines.length; j++) {
        depth += (lines[j].match(/\{/g) || []).length
        depth -= (lines[j].match(/\}/g) || []).length
        const m = lines[j].match(/name\s*=\s*"([^"]*)"/)
        if (m) { name = m[1]; break }
        if (j > i && depth <= 0) break
      }
      map.set(i, name || t("common.unnamed"))
    }
  }
  return map
})

function playFirework(lineIndex: number) {
  const name = fireworkBlockMap.value.get(lineIndex)
  if (name) emit("run-firework", name)
}

const highlightedCode = computed(() => {
  const code = props.modelValue || ""
  const { errors } = parseShellScript(code)
  const errorRanges = errors.map(err => {
    const start = posToOffset(code, err.line, err.col)
    return { start, end: start + Math.max(1, err.message.length), message: err.message }
  })
  return highlightShell(code, errorRanges)
})

// ── 光标/选区 保存 / 恢复 ──
interface CaretPos {
  start: number
  end: number
}

function nodeOffsetInEditor(targetNode: Node, nodeOffset: number): number {
  const el = editorRef.value
  if (!el) return 0
  let offset = 0
  const walk = (node: Node): boolean => {
    if (node.nodeType === Node.TEXT_NODE) {
      if (node === targetNode) {
        offset += nodeOffset
        return true
      }
      offset += (node.textContent || "").length
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as HTMLElement
      if (el.tagName === "BR") offset += 1
      for (const child of el.childNodes) {
        if (walk(child)) return true
      }
    }
    return false
  }
  for (const child of el.childNodes) {
    if (walk(child)) break
  }
  return offset
}

function saveCaret(): CaretPos | null {
  const sel = window.getSelection()
  if (!sel || !sel.rangeCount) return null
  const range = sel.getRangeAt(0)
  const el = editorRef.value
  if (!el || !el.contains(range.startContainer)) return null

  const start = nodeOffsetInEditor(range.startContainer, range.startOffset)
  const end = nodeOffsetInEditor(range.endContainer, range.endOffset)
  return {
    start: Math.min(start, end),
    end: Math.max(start, end),
  }
}

function restoreCaretAt(offset: number) {
  const el = editorRef.value
  if (!el) return

  let cur = 0
  let targetNode: Node | null = null
  let targetOffset = 0

  const walk = (node: Node): boolean => {
    if (node.nodeType === Node.TEXT_NODE) {
      const len = (node.textContent || "").length
      if (cur + len >= offset) {
        targetNode = node
        targetOffset = offset - cur
        return true
      }
      cur += len
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as HTMLElement
      if (el.tagName === "BR") {
        if (cur >= offset) {
          targetNode = node.parentNode
          targetOffset = Array.from(node.parentNode!.childNodes).indexOf(node as ChildNode)
          return true
        }
        cur += 1
      }
      for (const child of el.childNodes) {
        if (walk(child)) return true
      }
    }
    return false
  }
  for (const child of el.childNodes) {
    if (walk(child)) break
  }

  el.focus()
  if (targetNode) {
    const sel = window.getSelection()
    const range = document.createRange()
    range.setStart(targetNode, Math.min(targetOffset, (targetNode as Text).textContent?.length ?? 0))
    range.collapse(true)
    sel?.removeAllRanges()
    sel?.addRange(range)
  }
  updateActiveLine()
}

function onBeforeInput(e: InputEvent) {
  if (suggestionJustApplied.value) {
    suggestionJustApplied.value = false
    e.preventDefault()
    return
  }

  e.preventDefault()

  const sel = saveCaret()
  const currentText = props.modelValue
  const start = sel?.start ?? currentText.length
  const end = sel?.end ?? currentText.length
  let newText = currentText

  if (e.inputType === "insertText" && e.data) {
    newText = currentText.slice(0, start) + e.data + currentText.slice(end)
    emit("update:modelValue", newText)
    pushHistory(newText)
    nextTick(() => restoreCaretAt(start + e.data!.length))
  } else if (e.inputType === "deleteContentBackward") {
    if (start !== end) {
      newText = currentText.slice(0, start) + currentText.slice(end)
    } else if (start > 0) {
      newText = currentText.slice(0, start - 1) + currentText.slice(end)
    }
    emit("update:modelValue", newText)
    pushHistory(newText)
    nextTick(() => restoreCaretAt(start !== end ? start : Math.max(0, start - 1)))
  } else if (e.inputType === "deleteContentForward") {
    if (start !== end) {
      newText = currentText.slice(0, start) + currentText.slice(end)
    } else if (end < currentText.length) {
      newText = currentText.slice(0, start) + currentText.slice(end + 1)
    }
    emit("update:modelValue", newText)
    pushHistory(newText)
    nextTick(() => restoreCaretAt(start))
  }
}

function onKeydown(e: KeyboardEvent) {
  if (showSuggestions.value) {
    if (e.key === "ArrowDown") {
      e.preventDefault()
      suggestionNavUsed.value = true
      selectedIndex.value = (selectedIndex.value + 1) % filteredSuggestions.value.length
      nextTick(() => {
        const list = suggestionsRef.value
        const active = list?.querySelector(".shell-editor__suggestion--active")
        active?.scrollIntoView({ block: "nearest" })
      })
      return
    }
    if (e.key === "ArrowUp") {
      e.preventDefault()
      suggestionNavUsed.value = true
      selectedIndex.value = (selectedIndex.value - 1 + filteredSuggestions.value.length) % filteredSuggestions.value.length
      nextTick(() => {
        const list = suggestionsRef.value
        const active = list?.querySelector(".shell-editor__suggestion--active")
        active?.scrollIntoView({ block: "nearest" })
      })
      return
    }
    if (e.key === "Enter" || e.key === "Tab") {
      e.preventDefault()
      suggestionNavUsed.value = true
      applySuggestion(selectedIndex.value)
      return
    }
    if (e.key === "Escape") {
      e.preventDefault()
      suggestionNavUsed.value = true
      hideSuggestions()
      return
    }
  }

  if (e.key === "Enter") {
    e.preventDefault()
    const text = props.modelValue
    const sel = saveCaret()
    const start = sel?.start ?? text.length
    const end = sel?.end ?? text.length

    const lineStart = text.lastIndexOf("\n", start - 1) + 1
    const lineBeforeCursor = text.slice(lineStart, start)
    let indent = lineBeforeCursor.match(/^(\s*)/)?.[1] ?? ""

    const lineEnd = text.indexOf("\n", start)
    const restOfLine = text.slice(start, lineEnd === -1 ? text.length : lineEnd)

    let inserted = "\n" + indent
    let caretDelta = 1 + indent.length

    if (/{\s*$/.test(lineBeforeCursor + restOfLine)) {
      indent += "    "
      inserted = "\n" + indent
      caretDelta = 1 + indent.length
    }

    const newText = text.slice(0, start) + inserted + text.slice(end)
    emit("update:modelValue", newText)
    pushHistory(newText)
    nextTick(() => restoreCaretAt(start + caretDelta))
    return
  }

  if (e.shiftKey && e.altKey && (e.key === "f" || e.key === "F")) {
    e.preventDefault()
    formatDocument()
    return
  }

  if (e.ctrlKey || e.metaKey) {
    if (e.key === "z" || e.key === "Z") {
      e.preventDefault()
      if (e.shiftKey) {
        redo()
      } else {
        undo()
      }
      nextTick(() => {
        restoreCaretAt(props.modelValue.length)
        updateActiveLine()
      })
      return
    }
    if (e.key === "y" || e.key === "Y") {
      e.preventDefault()
      redo()
      return
    }
    if (e.key === "s" || e.key === "S") {
      e.preventDefault()
      handleSaveFile()
      return
    }
    return
  }

  if (e.key === "Tab") {
    e.preventDefault()
    const sel = saveCaret()
    const start = sel?.start ?? props.modelValue.length
    const end = sel?.end ?? props.modelValue.length
    const newText = props.modelValue.slice(0, start) + "    " + props.modelValue.slice(end)
    emit("update:modelValue", newText)
    pushHistory(newText)
    nextTick(() => restoreCaretAt(start + 4))
  }
}

function onPaste(e: ClipboardEvent) {
  e.preventDefault()
  const text = (e.clipboardData?.getData("text/plain") || "").replace(/\r\n/g, "\n").replace(/\r/g, "\n")
  if (!text) return
  const sel = saveCaret()
  const start = sel?.start ?? props.modelValue.length
  const end = sel?.end ?? props.modelValue.length
  const newText = props.modelValue.slice(0, start) + text + props.modelValue.slice(end)
  emit("update:modelValue", newText)
  pushHistory(newText)
  nextTick(() => restoreCaretAt(start + text.length))
}

function onScroll() {
  const ed = editorRef.value
  const lines = lineNumbers.value
  if (lines && ed) {
    lines.scrollTop = ed.scrollTop
  }
}

// ── 代码格式化 ──
function formatCode(code: string): string {
  const lines = code.split("\n")
  const indentSize = 4

  const merged: string[] = []
  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim()
    if (trimmed === "") { merged.push(""); continue }

    if (merged.length > 0 && merged[merged.length - 1] !== "") {
      const prev = merged[merged.length - 1]
      if (/=\s*$/.test(prev) && !/^[{}()#/]/.test(trimmed) && !/^(firework|onDeath|burst|flash|arc)\b/.test(trimmed)) {
        merged[merged.length - 1] += " " + trimmed
        continue
      }
      if (/^,/.test(trimmed)) {
        merged[merged.length - 1] += " " + trimmed
        continue
      }
    }
    merged.push(trimmed)
  }

  const collapsed: string[] = []
  for (let i = 0; i < merged.length; i++) {
    if (merged[i] === "") { collapsed.push(""); continue }

    const openCount = (merged[i].match(/\{/g) || []).length
    const closeCount = (merged[i].match(/\}/g) || []).length
    if (openCount > closeCount) {
      let j = i + 1
      let depth = openCount - closeCount
      let hasNested = false
      const innerParts: string[] = []
      while (j < merged.length && depth > 0) {
        const l = merged[j]
        if (l === "") { j++; continue }
        const opens = (l.match(/\{/g) || []).length
        const closes = (l.match(/\}/g) || []).length
        if (opens > 0) hasNested = true
        depth += opens - closes
        if (depth > 0) innerParts.push(l)
        j++
      }
      if (!hasNested && innerParts.length > 0) {
        const inner = innerParts.map(s => s.trim()).join(" ")
        const closeLine = merged[j - 1] || ""
        collapsed.push(merged[i].trimEnd() + " " + inner + " " + closeLine.trim())
        i = j - 1
        continue
      }
    }
    collapsed.push(merged[i])
  }

  let indentLevel = 0

  const formatted = collapsed.map((line) => {
    if (line === "") return ""

    let text = line.replace(/[ \t]+/g, " ")
    text = text.replace(/\s*\(\s*/g, "(").replace(/\s*\)\s*/g, ")")
    text = text.replace(/\s*,\s*/g, ", ")
    text = text.replace(/\s*=\s*/g, " = ")
    text = text.replace(/\s*\{/g, " {")
    text = text.replace(/\}\s*/g, "}")
    text = text.trimEnd()

    const openBraces = (text.match(/\{/g) || []).length
    const closeBraces = (text.match(/\}/g) || []).length

    let lineIndent: number
    if (closeBraces > 0 && openBraces === 0) {
      lineIndent = Math.max(0, indentLevel - closeBraces)
    } else {
      lineIndent = indentLevel
    }

    const result = " ".repeat(lineIndent * indentSize) + text

    indentLevel = Math.max(0, lineIndent + openBraces - closeBraces)

    return result
  })

  return formatted.join("\n")
}

function formatDocument() {
  const formatted = formatCode(props.modelValue)
  if (formatted !== props.modelValue) {
    emit("update:modelValue", formatted)
    pushHistory(formatted)
    nextTick(() => restoreCaretAt(0))
  }
}

// function openFile() {
//   const input = document.createElement("input")
//   input.type = "file"
//   input.accept = ".shell"
//   input.onchange = () => {
//     const file = input.files?.[0]
//     if (!file) { input.remove(); return }
//     const reader = new FileReader()
//     reader.onload = () => {
//       emit("update:modelValue", reader.result as string)
//     }
//     reader.readAsText(file)
//     input.remove()
//   }
//   input.click()
// }

const { openFile: openFileIO, saveFile: saveFileIO } = useFileIO()

async function handleOpenFile() {
  const result = await openFileIO()
  if (!result) return
  history.value = [result.content]
  historyIndex.value = 0
  emit("update:modelValue", result.content)
  emit("file-opened", { name: result.name, path: result.path })
}

async function handleSaveFile() {
  const savedPath = await saveFileIO(props.modelValue, props.filePath || props.fileName || undefined)
  if (savedPath) {
    emit("file-opened", { name: savedPath.split(/[\\/]/).pop() || t("common.untitled"), path: savedPath })
  }
}

defineExpose({ editorRef })
</script>

<style scoped lang="scss">
.shell-editor {
  flex: 1;
  min-height: 0;

  &__toolbar {
    display: flex;
    gap: 6px;
  }

  &__body {
    display: flex;
    flex: 1;
    overflow: hidden;
  }

  // ── 行号 ──
  &__lines {
    flex-shrink: 0;
    width: 64px;
    padding: 12px 0;
    overflow: hidden;
    background: #1e1e1e;
    border-right: 1px solid #2d2d2d;
    user-select: none;
  }

  &__line {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    height: 21px;
    line-height: 21px;
    padding-right: 4px;
  }

  &__line-num {
    font-size: 14px;
    line-height: 21px;
    font-family: "Consolas", "Courier New", monospace;
    color: #858585;
  }

  &__play-btn {
    width: 16px;
    height: 16px;
    padding: 0;
    margin-right: 4px;
    border: none;
    border-radius: 2px;
    font-size: 10px;
    line-height: 16px;
    text-align: center;
    cursor: pointer;
    color: #4ec9b0;
    background: transparent;
    flex-shrink: 0;

    &:hover {
      background: #3c3c3c;
      color: #6fe0c9;
    }
  }

  // ── 代码区 ──
  &__code-area {
    flex: 1;
    position: relative;
    overflow: hidden;
  }

  &__input {
    position: absolute;
    inset: 0;
    padding: 12px 16px;
    font-size: 14px;
    line-height: 21px;
    font-family: "Consolas", "Courier New", monospace;
    tab-size: 4;
    white-space: pre;
    overflow: auto;
    border: none;
    outline: none;
    background: transparent;
    color: #d4d4d4;
    caret-color: white;

    -moz-tab-size: 4;
  }

  // ── 错误 tooltip ──
  &__error-tip {
    position: absolute;
    z-index: 200;
    padding: 5px 10px;
    max-width: 20rem;
    font-size: 12px;
    color: #fff;
    background: #f44747;
    border-radius: 4px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
    white-space: nowrap;
    pointer-events: none;
  }

  // ── 智能提示 ──
  &__suggestions {
    position: absolute;
    z-index: 100;
    min-width: 180px;
    max-height: 200px;
    overflow-y: auto;
    margin: 0;
    padding: 4px 0;
    list-style: none;
    background: #252526;
    border: 1px solid #454545;
    border-radius: 6px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
    font-family: "Consolas", "Courier New", monospace;
    font-size: 13px;
  }

  &__suggestion {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 6px 12px;
    cursor: pointer;
    color: #d4d4d4;

    &--active {
      background: #094771;
    }
  }

  &__suggestion-main {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-shrink: 0;
  }

  &__suggestion-label {
    color: #d4d4d4;
  }

  &__suggestion-type {
    font-size: 11px;
    color: #858585;
  }

  &__suggestion-desc {
    font-size: 12px;
    color: #6a6a6a;
    margin-left: auto;
    white-space: nowrap;
  }
}

// ── 代码高亮颜色 ──
:deep(.sh-keyword) { color: #569cd6; }
:deep(.sh-prop) { color: #9cdcfe; }
:deep(.sh-string) { color: #ce9178; }
:deep(.sh-color) { color: #ce9178; }
:deep(.sh-number) { color: #b5cea8; }
:deep(.sh-comment) { color: #6a9955; font-style: italic; }
:deep(.sh-symbol) { color: #d4d4d4; }
:deep(.sh-builtin) { color: #4fc1ff; }
:deep(.sh-text) { color: #d4d4d4; }
:deep(.sh-error) {
  text-decoration: underline wavy #f44747;
  text-underline-offset: 3px;
  text-decoration-skip-ink: none;
}
</style>
