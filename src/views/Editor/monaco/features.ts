// features.ts — firework.shell 的智能提示（补全）与 CodeLens（运行单个烟花）
import * as monaco from "monaco-editor"
import i18n from "../../../i18n"
import { FIREWORK_SHELL_LANG } from "./language"
import { registerFireworkShellFormatting } from "./format"

const t = (key: string, params?: Record<string, unknown>): string => i18n.global.t(key, params ?? {}) as string

const RUN_FIREWORK_COMMAND = "firework-shell.run-firework"

const KW = monaco.languages.CompletionItemKind.Keyword
const FN = monaco.languages.CompletionItemKind.Function
const PROP = monaco.languages.CompletionItemKind.Property
const VAL = monaco.languages.CompletionItemKind.Value
const ENUM = monaco.languages.CompletionItemKind.EnumMember

type CtxKind = "top" | "firework" | "onDeath" | "burst" | "arc" | "spiral" | "ring" | "wave" | "heart" | "action"

interface CompletionDef {
  label: string
  i18nKey: string
  kind: monaco.languages.CompletionItemKind
  insertText?: string
  isSnippet?: boolean
}

// 顶层结构与 onDeath 块内的动作。
const STRUCTURE_COMPLETIONS: CompletionDef[] = [
  { label: "firework", i18nKey: "firework", kind: KW, insertText: 'firework {\n    name = "${1:firework}"\n    ${0}\n}', isSnippet: true },
  { label: "onDeath", i18nKey: "onDeath", kind: KW, insertText: "onDeath {\n    ${0}\n}", isSnippet: true },
]

const ACTION_COMPLETIONS: CompletionDef[] = [
  { label: "burst", i18nKey: "burst", kind: FN, insertText: "burst ${1:6} { color = ${2:inherit}, life = ${3:600}, speed = ${4:1.0} }", isSnippet: true },
  { label: "flash", i18nKey: "flash", kind: FN, insertText: "flash(${1:46})", isSnippet: true },
  { label: "arc", i18nKey: "arc", kind: FN, insertText: "arc ${1:6} (${2:6.283}) { color = ${3:inherit}, life = ${4:600} }", isSnippet: true },
  { label: "spiral", i18nKey: "spiral", kind: FN, insertText: "spiral ${1:12} (${2:2}) { color = ${3:inherit}, life = ${4:600}, speed = ${5:1.0} }", isSnippet: true },
  { label: "ring", i18nKey: "ring_action", kind: FN, insertText: "ring ${1:16} { color = ${2:inherit}, life = ${3:600}, speed = ${4:1.0} }", isSnippet: true },
  { label: "wave", i18nKey: "wave", kind: FN, insertText: "wave ${1:24} (${2:2}) { color = ${3:inherit}, life = ${4:600}, speed = ${5:1.0} }", isSnippet: true },
  { label: "heart", i18nKey: "heart", kind: FN, insertText: "heart ${1:60} { color = ${2:inherit}, life = ${3:600}, speed = ${4:1.0} }", isSnippet: true },
  { label: "star", i18nKey: "star", kind: FN, insertText: "star ${1:40} (${2:5}) { color = ${3:inherit}, life = ${4:600}, speed = ${5:1.0} }", isSnippet: true },
  { label: "cross", i18nKey: "cross", kind: FN, insertText: "cross ${1:40} { color = ${2:inherit}, life = ${3:600}, speed = ${4:1.0} }", isSnippet: true },
  { label: "snowflake", i18nKey: "snowflake", kind: FN, insertText: "snowflake ${1:48} (${2:6}) { color = ${3:inherit}, life = ${4:600}, speed = ${5:1.0} }", isSnippet: true },
  { label: "flower", i18nKey: "flower", kind: FN, insertText: "flower ${1:48} (${2:6}) { color = ${3:inherit}, life = ${4:600}, speed = ${5:1.0} }", isSnippet: true },
  { label: "square", i18nKey: "square", kind: FN, insertText: "square ${1:40} { color = ${2:inherit}, life = ${3:600}, speed = ${4:1.0} }", isSnippet: true },
  { label: "triangle", i18nKey: "triangle", kind: FN, insertText: "triangle ${1:36} { color = ${2:inherit}, life = ${3:600}, speed = ${4:1.0} }", isSnippet: true },
  { label: "arrow", i18nKey: "arrow", kind: FN, insertText: "arrow ${1:40} { color = ${2:inherit}, life = ${3:600}, speed = ${4:1.0} }", isSnippet: true },
  { label: "rain", i18nKey: "rain", kind: FN, insertText: "rain ${1:40} { color = ${2:inherit}, life = ${3:600}, speed = ${4:1.0} }", isSnippet: true },
  { label: "vortex", i18nKey: "vortex", kind: FN, insertText: "vortex ${1:48} (${2:2}) { color = ${3:inherit}, life = ${4:600}, speed = ${5:1.0} }", isSnippet: true },
  { label: "fountain", i18nKey: "fountain", kind: FN, insertText: "fountain ${1:40} { color = ${2:inherit}, life = ${3:600}, speed = ${4:1.0} }", isSnippet: true },
  { label: "galaxy", i18nKey: "galaxy", kind: FN, insertText: "galaxy ${1:60} (${2:2}) { color = ${3:inherit}, life = ${4:600}, speed = ${5:1.0} }", isSnippet: true },
  { label: "text", i18nKey: "text", kind: FN, insertText: 'text ${1:80} ("${2:LOVE}") { color = ${3:inherit}, life = ${4:600}, speed = ${5:1.0} }', isSnippet: true },
]

// firework 块内的全部参数，带类型化示例值。
const PROP_COMPLETIONS: CompletionDef[] = [
  { label: "name", i18nKey: "name", kind: PROP, insertText: 'name = "${1:firework}"', isSnippet: true },
  { label: "size", i18nKey: "size", kind: PROP, insertText: "size = ${1:300}", isSnippet: true },
  { label: "life", i18nKey: "life", kind: PROP, insertText: "life = ${1:900}", isSnippet: true },
  { label: "lifeVariation", i18nKey: "lifeVariation", kind: PROP, insertText: "lifeVariation = ${1:0.125}", isSnippet: true },
  { label: "density", i18nKey: "density", kind: PROP, insertText: "density = ${1:1.0}", isSnippet: true },
  { label: "starCount", i18nKey: "starCount", kind: PROP, insertText: "starCount = ${1:100}", isSnippet: true },
  { label: "color", i18nKey: "color", kind: PROP, insertText: "color = ${1:random}", isSnippet: true },
  { label: "secondColor", i18nKey: "secondColor", kind: PROP, insertText: "secondColor = ${1:#ff0043}", isSnippet: true },
  { label: "glitter", i18nKey: "glitter", kind: PROP, insertText: "glitter = ${1:light}", isSnippet: true },
  { label: "glitterColor", i18nKey: "glitterColor", kind: PROP, insertText: "glitterColor = ${1:#ffbf36}", isSnippet: true },
  { label: "ring", i18nKey: "ring", kind: PROP, insertText: "ring = ${1:true}", isSnippet: true },
  { label: "horsetail", i18nKey: "horsetail", kind: PROP, insertText: "horsetail = ${1:true}", isSnippet: true },
  { label: "strobe", i18nKey: "strobe", kind: PROP, insertText: "strobe = ${1:true}", isSnippet: true },
  { label: "strobeColor", i18nKey: "strobeColor", kind: PROP, insertText: "strobeColor = ${1:#ffffff}", isSnippet: true },
  { label: "pistil", i18nKey: "pistil", kind: PROP, insertText: "pistil = ${1:true}", isSnippet: true },
  { label: "pistilColor", i18nKey: "pistilColor", kind: PROP, insertText: "pistilColor = ${1:#ffffff}", isSnippet: true },
  { label: "streamers", i18nKey: "streamers", kind: PROP, insertText: "streamers = ${1:true}", isSnippet: true },
  { label: "crossette", i18nKey: "crossette", kind: PROP, insertText: "crossette = ${1:true}", isSnippet: true },
  { label: "crackle", i18nKey: "crackle", kind: PROP, insertText: "crackle = ${1:true}", isSnippet: true },
  { label: "floral", i18nKey: "floral", kind: PROP, insertText: "floral = ${1:true}", isSnippet: true },
  { label: "fallingLeaves", i18nKey: "fallingLeaves", kind: PROP, insertText: "fallingLeaves = ${1:true}", isSnippet: true },
  { label: "gravity", i18nKey: "gravity", kind: PROP, insertText: "gravity = ${1:1.0}", isSnippet: true },
  { label: "fade", i18nKey: "fade", kind: PROP, insertText: "fade = ${1:1.0}", isSnippet: true },
  { label: "launchHeight", i18nKey: "launchHeight", kind: PROP, insertText: "launchHeight = ${1:0.5}", isSnippet: true },
]

// burst / arc / spiral / ring / wave / heart 块内的选项。
const ACTION_OPTION_COMPLETIONS: CompletionDef[] = [
  { label: "color", i18nKey: "color", kind: PROP, insertText: "color = ${1:inherit}", isSnippet: true },
  { label: "life", i18nKey: "life", kind: PROP, insertText: "life = ${1:600}", isSnippet: true },
  { label: "speed", i18nKey: "speed", kind: PROP, insertText: "speed = ${1:1.0}", isSnippet: true },
  { label: "gravity", i18nKey: "gravity", kind: PROP, insertText: "gravity = ${1:1.0}", isSnippet: true },
  { label: "fade", i18nKey: "fade", kind: PROP, insertText: "fade = ${1:1.0}", isSnippet: true },
  { label: "delay", i18nKey: "delay", kind: PROP, insertText: "delay = ${1:200}", isSnippet: true },
  { label: "duration", i18nKey: "duration", kind: PROP, insertText: "duration = ${1:500}", isSnippet: true },
]

// 表达式：区间随机 / 颜色渐变。
const EXPR_COMPLETIONS: CompletionDef[] = [
  { label: "random()", i18nKey: "random_range", kind: FN, insertText: "random(${1:0.5}, ${2:1.5})", isSnippet: true },
  { label: "gradient()", i18nKey: "gradient", kind: FN, insertText: "gradient(${1:#ff0043}, ${2:#1e7fff})", isSnippet: true },
]

const BOOL_VALUES: CompletionDef[] = [
  { label: "true", i18nKey: "true", kind: VAL },
  { label: "false", i18nKey: "false", kind: VAL },
]

const VALUE_COMPLETIONS: CompletionDef[] = [
  { label: "true", i18nKey: "true", kind: VAL },
  { label: "false", i18nKey: "false", kind: VAL },
  { label: "random", i18nKey: "random", kind: VAL },
  { label: "inherit", i18nKey: "inherit", kind: VAL },
]

const GLITTER_VALUES: CompletionDef[] = ["light", "medium", "heavy", "thick", "streamer", "willow"].map(
  (g): CompletionDef => ({ label: g, i18nKey: `glitter_${g}`, kind: ENUM }),
)

const HEX_VALUES: CompletionDef[] = ["#ff0043", "#1e7fff", "#14fc56", "#ffbf36", "#ffffff"].map(
  (hex): CompletionDef => ({ label: hex, i18nKey: "color_hex", kind: VAL }),
)

const COLOR_VALUES: CompletionDef[] = [
  { label: "random", i18nKey: "random", kind: VAL },
  ...HEX_VALUES,
]

const ARC_ANGLE_VALUES: CompletionDef[] = [
  { label: "Math.PI", i18nKey: "math_pi", kind: VAL },
  { label: "6.283", i18nKey: "arc_angle_full", kind: VAL },
]

const NUMBER_EXAMPLES: Record<string, CompletionDef> = {
  size: { label: "300", i18nKey: "size_val", kind: VAL },
  life: { label: "900", i18nKey: "life_val", kind: VAL },
  lifeVariation: { label: "0.125", i18nKey: "lifeVariation_val", kind: VAL },
  density: { label: "1.0", i18nKey: "density_val", kind: VAL },
  starCount: { label: "100", i18nKey: "starCount_val", kind: VAL },
  speed: { label: "1.0", i18nKey: "speed_val", kind: VAL },
  gravity: { label: "1.0", i18nKey: "gravity_val", kind: VAL },
  fade: { label: "1.0", i18nKey: "fade_val", kind: VAL },
  launchHeight: { label: "0.5", i18nKey: "launchHeight_val", kind: VAL },
  delay: { label: "200", i18nKey: "delay_val", kind: VAL },
  duration: { label: "500", i18nKey: "duration_val", kind: VAL },
}

function buildItem(def: CompletionDef, range: monaco.IRange): monaco.languages.CompletionItem {
  return {
    label: def.label,
    kind: def.kind,
    detail: t(`shellEditor.completions.${def.i18nKey}.type`),
    documentation: t(`shellEditor.completions.${def.i18nKey}.desc`),
    insertText: def.insertText ?? def.label,
    insertTextRules: def.isSnippet
      ? monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet
      : undefined,
    range,
  }
}

function isInStringOrComment(text: string, offset: number): boolean {
  let i = 0
  while (i < offset) {
    const ch = text[i]
    if (ch === "/" && text[i + 1] === "/") {
      const end = text.indexOf("\n", i)
      if (end === -1 || end >= offset) return true
      i = end + 1
    } else if (ch === "/" && text[i + 1] === "*") {
      const end = text.indexOf("*/", i + 2)
      if (end === -1 || end + 2 >= offset) return true
      i = end + 2
    } else if (ch === '"') {
      i++
      while (i < offset && text[i] !== '"') {
        if (text[i] === "\\") i++
        i++
      }
      if (i >= offset) return true
      i++
    } else {
      i++
    }
  }
  return false
}

function detectPropBeforeEqual(text: string, offset: number): string | null {
  const before2 = text.slice(Math.max(0, offset - 2), offset)
  const isAfterEqual = before2 === "= " || before2 === "=\t" || (offset > 0 && text[offset - 1] === "=")
  if (!isAfterEqual) return null

  const eqPos = text.lastIndexOf("=", offset - 1)
  if (eqPos < 0) return null

  let nameEnd = eqPos - 1
  while (nameEnd >= 0 && (text[nameEnd] === " " || text[nameEnd] === "\t")) nameEnd--
  if (nameEnd < 0) return null

  let nameStart = nameEnd
  while (nameStart >= 0 && /[a-zA-Z0-9_]/.test(text[nameStart])) nameStart--
  nameStart++
  return text.slice(nameStart, nameEnd + 1) || null
}

function detectArcAngle(text: string, offset: number): boolean {
  let i = offset - 1
  while (i >= 0 && text[i] !== "(" && text[i] !== ")" && text[i] !== "{" && text[i] !== "}") i--
  if (i < 0 || text[i] !== "(") return false
  return /arc\s+\d+\s*$/.test(text.slice(0, i))
}

function detectContext(text: string, pos: number): CtxKind {
  const stack: CtxKind[] = ["top"]
  const blockRe = /\b(firework|onDeath|burst|arc|spiral|ring|wave|heart|star|cross|snowflake|flower|square|triangle|arrow|rain|vortex|fountain|galaxy|text)\b/g
  const actionRe = /\b(star|cross|snowflake|flower|square|triangle|arrow|rain|vortex|fountain|galaxy|text)\b/

  let i = 0
  while (i < pos) {
    const ch = text[i]
    if (ch === "/" && text[i + 1] === "/") {
      const end = text.indexOf("\n", i)
      i = end === -1 ? pos : end + 1
    } else if (ch === "/" && text[i + 1] === "*") {
      const end = text.indexOf("*/", i + 2)
      i = end === -1 ? pos : end + 2
    } else if (ch === '"') {
      i++
      while (i < pos && text[i] !== '"') {
        if (text[i] === "\\") i++
        i++
      }
      if (i < pos) i++
    } else if (ch === "{") {
      // 取「上一个 } 或行首」到当前 { 之间的片段，识别最近的块关键词。
      let start = i - 1
      while (start >= 0 && text[start] !== "}" && text[start] !== "\n") start--
      const seg = text.slice(start + 1, i)
      let last = ""
      let m: RegExpExecArray | null
      blockRe.lastIndex = 0
      while ((m = blockRe.exec(seg)) !== null) last = m[1]

      let next = stack[stack.length - 1]
      if (last === "firework") next = "firework"
      else if (last === "onDeath") next = "onDeath"
      else if (last === "burst") next = "burst"
      else if (last === "arc") next = "arc"
      else if (last === "spiral") next = "spiral"
      else if (last === "ring") next = "ring"
      else if (last === "wave") next = "wave"
      else if (last === "heart") next = "heart"
      else if (actionRe.test(last)) next = "action"
      stack.push(next)
      i++
    } else if (ch === "}") {
      if (stack.length > 1) stack.pop()
      i++
    } else {
      i++
    }
  }
  return stack[stack.length - 1]
}

function getWordBefore(model: monaco.editor.ITextModel, position: monaco.Position): string {
  const lineBefore = model.getValueInRange(
    new monaco.Range(position.lineNumber, 1, position.lineNumber, position.column),
  )
  const m = lineBefore.match(/[a-zA-Z0-9_]*$/)
  return m ? m[0] : ""
}

function computeRange(position: monaco.Position, word = ""): monaco.Range {
  const startColumn = Math.max(1, position.column - word.length)
  return new monaco.Range(position.lineNumber, startColumn, position.lineNumber, position.column)
}

function valueSuggestionsFor(prop: string): CompletionDef[] {
  switch (prop) {
    case "glitter":
      return GLITTER_VALUES
    case "ring":
    case "horsetail":
    case "strobe":
    case "pistil":
    case "streamers":
    case "crossette":
    case "crackle":
    case "floral":
    case "fallingLeaves":
      return BOOL_VALUES
    case "color":
      return [...COLOR_VALUES, EXPR_COMPLETIONS[1]]
    case "secondColor":
    case "glitterColor":
    case "strobeColor":
    case "pistilColor":
      return HEX_VALUES
    case "size":
    case "life":
    case "lifeVariation":
    case "density":
    case "starCount":
    case "speed":
    case "gravity":
    case "fade":
    case "launchHeight":
    case "delay":
    case "duration":
      return [NUMBER_EXAMPLES[prop], EXPR_COMPLETIONS[0]]
    default:
      return VALUE_COMPLETIONS
  }
}

function suggestionsForContext(ctx: CtxKind): CompletionDef[] {
  switch (ctx) {
    case "top":
      return [STRUCTURE_COMPLETIONS[0]]
    case "firework":
      return [...PROP_COMPLETIONS, STRUCTURE_COMPLETIONS[1]]
    case "onDeath":
      return ACTION_COMPLETIONS
    case "burst":
      return ACTION_OPTION_COMPLETIONS
    case "arc":
      return ACTION_OPTION_COMPLETIONS.slice(0, 2)
    case "spiral":
      return ACTION_OPTION_COMPLETIONS
    case "ring":
    case "wave":
    case "heart":
      return ACTION_OPTION_COMPLETIONS
    case "action":
      return ACTION_OPTION_COMPLETIONS
  }
}

function registerCompletion(): monaco.IDisposable {
  return monaco.languages.registerCompletionItemProvider(FIREWORK_SHELL_LANG, {
    triggerCharacters: ["=", "{", "(", ",", " ", "\n"],
    provideCompletionItems(model, position) {
      const text = model.getValue()
      const offset = model.getOffsetAt(position)

      if (isInStringOrComment(text, offset)) return { suggestions: [] }

      const prop = detectPropBeforeEqual(text, offset)
      const defs = detectArcAngle(text, offset)
        ? ARC_ANGLE_VALUES
        : prop
          ? valueSuggestionsFor(prop)
          : suggestionsForContext(detectContext(text, offset))

      const word = getWordBefore(model, position)
      const filtered = word
        ? defs.filter((d) => d.label.toLowerCase().startsWith(word.toLowerCase()))
        : defs

      return {
        suggestions: filtered.map((d) => buildItem(d, computeRange(position, word))),
      }
    },
  })
}

function resolveHoverTarget(model: monaco.editor.ITextModel, position: monaco.Position): { label: string; range: monaco.Range } | null {
  const word = model.getWordAtPosition(position)
  if (word) {
    // 十六进制颜色：#rrggbb（getWordAtPosition 默认不包含 #）
    if (/^[0-9a-fA-F]{6}$/.test(word.word)) {
      const before = word.startColumn > 1 ? model.getLineContent(position.lineNumber)[word.startColumn - 2] : ""
      if (before === "#") {
        return {
          label: `#${word.word}`,
          range: new monaco.Range(position.lineNumber, word.startColumn - 1, position.lineNumber, word.endColumn),
        }
      }
    }
    return {
      label: word.word,
      range: new monaco.Range(position.lineNumber, word.startColumn, position.lineNumber, word.endColumn),
    }
  }
  // 悬停在 # 上（十六进制颜色开头）
  const line = model.getLineContent(position.lineNumber)
  if (line[position.column - 1] === "#") {
    const m = line.slice(position.column).match(/^[0-9a-fA-F]{6}/)
    if (m) {
      return {
        label: `#${m[0]}`,
        range: new monaco.Range(position.lineNumber, position.column, position.lineNumber, position.column + 6),
      }
    }
  }
  return null
}

function registerHover(): monaco.IDisposable {
  const hoverMap = new Map<string, CompletionDef>()
  for (const def of [
    ...STRUCTURE_COMPLETIONS,
    ...ACTION_COMPLETIONS,
    ...PROP_COMPLETIONS,
    ...ACTION_OPTION_COMPLETIONS,
    ...VALUE_COMPLETIONS,
    ...GLITTER_VALUES,
    ...HEX_VALUES,
    ...EXPR_COMPLETIONS,
  ]) {
    if (!hoverMap.has(def.label)) hoverMap.set(def.label, def)
    // 函数类 label（如 gradient()）额外注册去括号的标识符，便于悬停匹配
    if (def.label.endsWith("()")) {
      const bare = def.label.slice(0, -2)
      if (!hoverMap.has(bare)) hoverMap.set(bare, def)
    }
  }

  return monaco.languages.registerHoverProvider(FIREWORK_SHELL_LANG, {
    provideHover(model, position) {
      const target = resolveHoverTarget(model, position)
      if (!target) return null
      const def = hoverMap.get(target.label)
      if (!def) return null

      const type = t(`shellEditor.completions.${def.i18nKey}.type`)
      const desc = t(`shellEditor.completions.${def.i18nKey}.desc`)
      return {
        range: target.range,
        contents: [
          { value: `**${def.label}** · ${type}` },
          { value: desc },
        ],
      }
    },
  })
}

// ── Quick Fix（Code Action）──

function tokenRange(model: monaco.editor.ITextModel, line: number, col: number): monaco.Range {
  const text = model.getLineContent(line)
  let start = col - 1
  let end = col - 1

  if (text[start] === "#") {
    end = start + 1
    while (end < text.length && /[0-9a-fA-F]/.test(text[end])) end++
    return new monaco.Range(line, start + 1, line, end)
  }
  if (text.slice(start, start + 7) === "Math.PI") {
    return new monaco.Range(line, start + 1, line, start + 7)
  }
  while (start > 0 && /[0-9a-zA-Z_.]/.test(text[start - 1])) start--
  while (end < text.length && /[0-9a-zA-Z_.]/.test(text[end])) end++
  return new monaco.Range(line, start + 1, line, end)
}

function propValueRange(model: monaco.editor.ITextModel, line: number, prop: string): monaco.Range | null {
  const text = model.getLineContent(line)
  const re = new RegExp(`${prop}\\s*=\\s*(#?[0-9a-zA-Z_.]+)`)
  const m = text.match(re)
  if (!m) return null
  const start = text.indexOf(m[1], m.index!)
  return new monaco.Range(line, start + 1, line, start + m[1].length)
}

interface QuickFix {
  title: string
  range: monaco.Range
  text: string
}

function quickFixForMarker(model: monaco.editor.ITextModel, marker: monaco.editor.IMarkerData): QuickFix | null {
  const msg = marker.message
  const line = marker.startLineNumber
  const col = marker.startColumn

  // 未知动作 → 替换为 burst
  if (/^Unknown action "(\w+)"/.test(msg)) {
    return { title: t("shellEditor.quickfix.replace", { value: "burst" }), range: tokenRange(model, line, col), text: "burst" }
  }

  // 空 onDeath 块 → 插入 burst 动作
  if (msg.includes("onDeath block is empty")) {
    const lineText = model.getLineContent(line)
    const indent = (lineText.match(/^\s*/)?.[0] ?? "") + "    "
    const colAfterBrace = col + 1
    const range = new monaco.Range(line, colAfterBrace, line, colAfterBrace)
    return { title: t("shellEditor.quickfix.emptyOnDeath"), range, text: `\n${indent}burst 6 { color = inherit }` }
  }

  // 非法 glitter → light
  if (/Invalid glitter value "(\w+)"/.test(msg)) {
    const r = propValueRange(model, line, "glitter")
    if (r) return { title: t("shellEditor.quickfix.replace", { value: "light" }), range: r, text: "light" }
    return null
  }

  // 非法 color → random
  if (msg.includes('"color" expects')) {
    const r = propValueRange(model, line, "color")
    if (r) return { title: t("shellEditor.quickfix.replace", { value: "random" }), range: r, text: "random" }
    return null
  }

  // 属性数值越界：`<prop>=<v> is below minimum <min>` / `exceeds maximum <max>`
  let m = msg.match(/^(\w+)=[\d.]+ is below minimum ([\d.]+)/)
  if (m) {
    const r = propValueRange(model, line, m[1])
    if (r) return { title: t("shellEditor.quickfix.replace", { value: m[2] }), range: r, text: m[2] }
    return null
  }
  m = msg.match(/^(\w+)=[\d.]+ exceeds maximum ([\d.]+)/)
  if (m) {
    const r = propValueRange(model, line, m[1])
    if (r) return { title: t("shellEditor.quickfix.replace", { value: m[2] }), range: r, text: m[2] }
    return null
  }

  // 动作数量/半径过高：`too high (X), recommended A-B` → 上限 B
  m = msg.match(/recommended \d+-(\d+)/)
  if (m) {
    return { title: t("shellEditor.quickfix.replace", { value: m[1] }), range: tokenRange(model, line, col), text: m[1] }
  }

  // 必须为正数 → 1
  if (msg.includes("must be positive")) {
    return { title: t("shellEditor.quickfix.replace", { value: "1" }), range: tokenRange(model, line, col), text: "1" }
  }

  // arc 角度越界 → Math.PI
  if (msg.includes("arc angle must be in range")) {
    return { title: t("shellEditor.quickfix.replace", { value: "Math.PI" }), range: tokenRange(model, line, col), text: "Math.PI" }
  }

  // spiral 圈数 / wave 波数越界 `(0, 10]` → 2
  if (msg.includes("must be in range (0, 10]")) {
    return { title: t("shellEditor.quickfix.replace", { value: "2" }), range: tokenRange(model, line, col), text: "2" }
  }

  // 造型动作参数 / galaxy 臂数越界 `[min, max]` → max
  m = msg.match(/must be in range \[[\d.]+, ([\d.]+)\]/)
  if (m) {
    return { title: t("shellEditor.quickfix.replace", { value: m[1] }), range: tokenRange(model, line, col), text: m[1] }
  }

  // 仅支持 hex 的颜色属性（secondColor / glitterColor / strobeColor / pistilColor）→ #ff0043
  m = msg.match(/^"(\w+)" requires a hex color/)
  if (m) {
    const r = propValueRange(model, line, m[1])
    if (r) return { title: t("shellEditor.quickfix.replace", { value: "#ff0043" }), range: r, text: "#ff0043" }
    return null
  }

  // color 数组元素非法 → #ff0043
  if (msg.includes('"color" array element must be hex')) {
    return { title: t("shellEditor.quickfix.replace", { value: "#ff0043" }), range: tokenRange(model, line, col), text: "#ff0043" }
  }

  // gradient() 颜色必须是 hex
  if (msg.includes("gradient() first color must be hex")) {
    return { title: t("shellEditor.quickfix.replace", { value: "#ff0043" }), range: tokenRange(model, line, col), text: "#ff0043" }
  }
  if (msg.includes("gradient() second color must be hex")) {
    return { title: t("shellEditor.quickfix.replace", { value: "#1e7fff" }), range: tokenRange(model, line, col), text: "#1e7fff" }
  }

  return null
}

function registerCodeActions(): monaco.IDisposable {
  return monaco.languages.registerCodeActionProvider(FIREWORK_SHELL_LANG, {
    provideCodeActions(model, _range, context) {
      const actions: monaco.languages.CodeAction[] = []
      for (const marker of context.markers) {
        const fix = quickFixForMarker(model, marker)
        if (!fix) continue
        actions.push({
          title: fix.title,
          kind: "quickfix",
          edit: {
            edits: [{ resource: model.uri, versionId: undefined, textEdit: { range: fix.range, text: fix.text } }],
          },
          isPreferred: actions.length === 0,
        })
      }
      return { actions, dispose() {} }
    },
  })
}

function parseFireworkBlocks(code: string): { line: number; name: string }[] {
  const blocks: { line: number; name: string }[] = []
  const lines = code.split("\n")

  for (let i = 0; i < lines.length; i++) {
    if (!/^\s*firework\b/.test(lines[i])) continue

    let name = ""
    let depth = 0
    for (let j = i; j < lines.length; j++) {
      depth += (lines[j].match(/\{/g) || []).length
      depth -= (lines[j].match(/\}/g) || []).length
      const m = lines[j].match(/name\s*=\s*"([^"]*)"/)
      if (m) { name = m[1]; break }
      if (j > i && depth <= 0) break
    }
    blocks.push({ line: i + 1, name })
  }
  return blocks
}

function registerCodeLens(onRun: (name: string) => void): monaco.IDisposable {
  const command = monaco.editor.registerCommand(RUN_FIREWORK_COMMAND, (_accessor, name: string) => onRun(name))
  const provider = monaco.languages.registerCodeLensProvider(FIREWORK_SHELL_LANG, {
    provideCodeLenses(model) {
      const blocks = parseFireworkBlocks(model.getValue())
      return {
        lenses: blocks.map((b) => {
          const name = b.name || t("common.unnamed")
          return {
            range: new monaco.Range(b.line, 1, b.line, 1),
            command: {
              id: RUN_FIREWORK_COMMAND,
              title: `▶ ${name}`,
              arguments: [name],
            },
          }
        }),
        dispose() {},
      }
    },
  })

  return {
    dispose() {
      command.dispose()
      provider.dispose()
    },
  }
}

/** 注册补全、格式化与 CodeLens，返回统一的销毁句柄。 */
export function registerFireworkShellFeatures(onRun: (name: string) => void): monaco.IDisposable {
  const disposables = [
    registerCompletion(),
    registerHover(),
    registerFireworkShellFormatting(),
    registerCodeLens(onRun),
    registerCodeActions(),
  ]
  return {
    dispose() {
      for (const d of disposables) d.dispose()
    },
  }
}
