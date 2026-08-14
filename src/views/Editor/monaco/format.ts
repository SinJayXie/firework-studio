// format.ts — firework.shell 代码格式化
import * as monaco from "monaco-editor"
import { FIREWORK_SHELL_LANG } from "./language"

/** 对 firework.shell 代码做缩进与间距格式化。 */
export function formatFireworkShell(code: string): string {
  const lines = code.split("\n")
  const indentSize = 4

  // 合并被拆成多行的赋值与列表项。
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

  // 将无嵌套的单行块折叠到一行。
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

    const lineIndent = closeBraces > 0 && openBraces === 0
      ? Math.max(0, indentLevel - closeBraces)
      : indentLevel

    const result = " ".repeat(lineIndent * indentSize) + text
    indentLevel = Math.max(0, lineIndent + openBraces - closeBraces)
    return result
  })

  return formatted.join("\n")
}

/** 注册格式化 provider，使 Monaco 的「格式化文档」动作可用。 */
export function registerFireworkShellFormatting(): monaco.IDisposable {
  return monaco.languages.registerDocumentFormattingEditProvider(FIREWORK_SHELL_LANG, {
    provideDocumentFormattingEdits(model) {
      const formatted = formatFireworkShell(model.getValue())
      if (formatted === model.getValue()) return []
      return [{ range: model.getFullModelRange(), text: formatted }]
    },
  })
}
