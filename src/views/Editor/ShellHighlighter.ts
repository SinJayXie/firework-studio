// ShellHighlighter.ts — firework.shell 脚本语法高亮

const KEYWORDS = new Set([
  "firework", "onDeath", "burst", "flash", "arc", "true", "false", "random", "inherit",
])

const PROPS = new Set([
  "name", "size", "life", "lifeVariation", "density", "starCount",
  "color", "secondColor", "glitter", "glitterColor",
  "ring", "horsetail", "strobe", "strobeColor",
  "pistil", "pistilColor", "streamers",
  "crossette", "crackle", "floral", "fallingLeaves",
])

interface Token {
  type: "keyword" | "prop" | "string" | "color" | "number" | "comment" | "symbol" | "builtin" | "text"
  value: string
  offset: number
}

function tokenize(input: string): Token[] {
  const tokens: Token[] = []
  let i = 0

  while (i < input.length) {
    const ch = input[i]
    const start = i

    // Newline
    if (ch === "\n") {
      tokens.push({ type: "text", value: "\n", offset: start })
      i++
      continue
    }

    // Whitespace
    if (ch === " " || ch === "\t" || ch === "\r") {
      let ws = ""
      while (i < input.length && (input[i] === " " || input[i] === "\t" || input[i] === "\r")) {
        ws += input[i]; i++
      }
      tokens.push({ type: "text", value: ws, offset: start })
      continue
    }

    // Line comment
    if (ch === "/" && input[i + 1] === "/") {
      let comment = "//"
      i += 2
      while (i < input.length && input[i] !== "\n") {
        comment += input[i]; i++
      }
      tokens.push({ type: "comment", value: comment, offset: start })
      continue
    }

    // Block comment
    if (ch === "/" && input[i + 1] === "*") {
      let comment = "/*"
      i += 2
      while (i < input.length && !(input[i] === "*" && input[i + 1] === "/")) {
        comment += input[i]; i++
      }
      if (i < input.length) { comment += "*/"; i += 2 }
      tokens.push({ type: "comment", value: comment, offset: start })
      continue
    }

    // String
    if (ch === '"') {
      let str = '"'; i++
      while (i < input.length && input[i] !== '"') {
        if (input[i] === "\\") { str += input[i]; i++; str += input[i]; i++ }
        else { str += input[i]; i++ }
      }
      if (i < input.length) { str += '"'; i++ }
      tokens.push({ type: "string", value: str, offset: start })
      continue
    }

    // Color hex
    if (ch === "#" && /[0-9a-fA-F]/.test(input[i + 1] || "")) {
      let hex = "#"; i++
      while (i < input.length && /[0-9a-fA-F]/.test(input[i])) { hex += input[i]; i++ }
      tokens.push({ type: "color", value: hex, offset: start })
      continue
    }

    // Number (including negative)
    if (/[0-9]/.test(ch) || (ch === "-" && /[0-9]/.test(input[i + 1] || ""))) {
      let num = ch; i++
      while (i < input.length && /[0-9.eE+\-]/.test(input[i])) { num += input[i]; i++ }
      tokens.push({ type: "number", value: num, offset: start })
      continue
    }

    // Symbols
    if ("{}()[],=".includes(ch)) {
      tokens.push({ type: "symbol", value: ch, offset: start })
      i++
      continue
    }

    // Identifier / keyword / prop
    if (/[a-zA-Z_\u4e00-\u9fff]/.test(ch)) {
      let word = ""
      while (i < input.length && /[a-zA-Z0-9_\u4e00-\u9fff]/.test(input[i])) {
        word += input[i]; i++
      }
      if (KEYWORDS.has(word)) {
        if (word === "true" || word === "false") tokens.push({ type: "builtin", value: word, offset: start })
        else if (word === "random" || word === "inherit") tokens.push({ type: "builtin", value: word, offset: start })
        else tokens.push({ type: "keyword", value: word, offset: start })
      } else if (PROPS.has(word)) {
        tokens.push({ type: "prop", value: word, offset: start })
      } else {
        tokens.push({ type: "text", value: word, offset: start })
      }
      continue
    }

    // Any other character
    tokens.push({ type: "text", value: ch, offset: start })
    i++
  }

  return tokens
}

const CSS_CLASS: Record<Token["type"], string> = {
  keyword: "sh-keyword",
  prop: "sh-prop",
  string: "sh-string",
  color: "sh-color",
  number: "sh-number",
  comment: "sh-comment",
  symbol: "sh-symbol",
  builtin: "sh-builtin",
  text: "sh-text",
}

function escapeHTML(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

export interface ErrorRange {
  start: number
  end: number
  message?: string
}

// (line, col) 1-indexed → 字符偏移
export function posToOffset(code: string, line: number, col: number): number {
  const lines = code.split("\n")
  let offset = 0
  for (let i = 0; i < Math.min(line - 1, lines.length); i++) {
    offset += lines[i].length + 1 // +1 for \n
  }
  return offset + Math.max(0, col - 1)
}

export function highlightShell(code: string, errorRanges: ErrorRange[] = []): string {
  const tokens = tokenize(code)
  const errorMap = new Map<number, string>()

  // 标记错误范围内的所有 token，记录错误信息
  if (errorRanges.length > 0) {
    for (const token of tokens) {
      const tStart = token.offset
      const tEnd = tStart + token.value.length
      for (const range of errorRanges) {
        if (tStart < range.end && tEnd > range.start) {
          errorMap.set(token.offset, range.message || "")
          break
        }
      }
    }
  }

  let html = ""
  let inError = false
  for (const token of tokens) {
    const cls = CSS_CLASS[token.type]
    const isError = errorMap.has(token.offset)
    const errMsg = errorMap.get(token.offset) || ""

    if (isError && !inError) {
      html += `<span class="sh-error" data-error="${escapeHTML(errMsg)}">`
      inError = true
    } else if (!isError && inError) {
      html += `</span>`
      inError = false
    }

    html += `<span class="${cls}">${escapeHTML(token.value)}</span>`
  }
  if (inError) {
    html += `</span>`
  }

  return html
}
