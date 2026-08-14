// shell-parser.ts — firework.shell script parser

export interface ShellParseError {
  message: string
  line: number
  col: number
}

export interface BurstAction {
  type: "burst"
  count: number
  options: Record<string, string | number>
}

export interface FlashAction {
  type: "flash"
  radius: number
}

export interface ArcAction {
  type: "arc"
  count: number
  arcAngle: number
  options: Record<string, string | number>
}

export interface SpiralAction {
  type: "spiral"
  count: number
  turns: number
  options: Record<string, string | number>
}

export type OnDeathAction = BurstAction | FlashAction | ArcAction | SpiralAction

export interface ParsedShell {
  name: string
  props: Record<string, string | number | boolean | string[]>
  onDeath: OnDeathAction[]
}

type TokenType = "keyword" | "string" | "number" | "bool" | "builtin" | "symbol"

interface Token {
  type: TokenType
  value: string
  line: number
  col: number
}

const KEYWORDS = new Set(["firework", "onDeath", "burst", "flash", "arc", "spiral", "true", "false", "random", "inherit"])

const KNOWN_PROPS = new Set([
  "name", "size", "life", "lifeVariation", "density", "starCount",
  "color", "secondColor", "glitter", "glitterColor",
  "ring", "horsetail", "strobe", "strobeColor",
  "pistil", "pistilColor", "streamers",
  "crossette", "crackle", "floral", "fallingLeaves",
  "gravity", "fade", "launchHeight",
  "speed", // burst/arc action option
])

const GLITTER_VALUES = new Set(["light", "medium", "heavy", "thick", "streamer", "willow"])

// color supports random | single hex | [hex, ...]
// secondColor / glitterColor / strobeColor / pistilColor only support single hex
const COLOR_MAIN = "color"
const COLOR_HEX_ONLY = new Set(["secondColor", "glitterColor", "strobeColor", "pistilColor"])

const HEX_RE = /^#[0-9a-fA-F]{6}$/

function isHexColor(val: unknown): val is string {
  return typeof val === "string" && HEX_RE.test(val)
}

// Numeric range constraints (per SYNTAX.md)
const PROP_RANGES: Record<string, [number, number]> = {
  size: [50, 800],
  life: [300, 5000],
  lifeVariation: [0, 5],
  density: [0.05, 2],
  starCount: [1, 5000],
  gravity: [0, 5],
  fade: [0, 2],
  launchHeight: [0, 1],
}

const NUMERIC_PROPS = new Set(Object.keys(PROP_RANGES))

const ACTION_OPTION_RANGES: Record<string, [number, number]> = {
  life: [100, 3000],
  speed: [0.1, 5],
}

function validateRange(label: string, value: number, [min, max]: [number, number], line: number, col: number): ShellParseError | null {
  if (value < min) return { message: `${label}=${value} is below minimum ${min}`, line, col }
  if (value > max) return { message: `${label}=${value} exceeds maximum ${max}`, line, col }
  return null
}

function tokenize(input: string): { tokens: Token[]; errors: ShellParseError[] } {
  const tokens: Token[] = []
  const errors: ShellParseError[] = []
  let i = 0
  let line = 1
  let col = 1

  function advance(n: number = 1): void {
    for (let j = 0; j < n; j++) {
      if (input[i] === "\n") { line++; col = 1 }
      else { col++ }
      i++
    }
  }

  while (i < input.length) {
    const ch = input[i]

    // Whitespace
    if (ch === " " || ch === "\t" || ch === "\r" || ch === "\n") {
      advance()
      continue
    }

    // Line comment
    if (ch === "/" && input[i + 1] === "/") {
      while (i < input.length && input[i] !== "\n") advance()
      continue
    }

    // Block comment
    if (ch === "/" && input[i + 1] === "*") {
      advance(2)
      while (i < input.length && !(input[i] === "*" && input[i + 1] === "/")) advance()
      advance(2)
      continue
    }

    const startLine = line; const startCol = col

    // String
    if (ch === '"') {
      advance(); let str = ""
      while (i < input.length && input[i] !== '"') {
        if (input[i] === "\\") {
          advance(); str += input[i]; advance()
        } else {
          str += input[i]; advance()
        }
      }
      if (i >= input.length) {
        errors.push({ message: "Unterminated string literal", line: startLine, col: startCol })
      } else {
        advance() // closing quote
      }
      tokens.push({ type: "string", value: str, line: startLine, col: startCol })
      continue
    }

    // Number
    if (/[0-9]/.test(ch) || (ch === "-" && /[0-9]/.test(input[i + 1]))) {
      let num = ch
      advance()
      while (i < input.length && /[0-9.eE+\-]/.test(input[i])) { num += input[i]; advance() }
      // Validate the numeric literal is well-formed (int, float, or scientific)
      if (!/^-?\d+(\.\d+)?([eE][+-]?\d+)?$/.test(num)) {
        errors.push({ message: `Invalid numeric literal "${num}"`, line: startLine, col: startCol })
      }
      tokens.push({ type: "number", value: num, line: startLine, col: startCol })
      continue
    }

    // Symbols
    if ("{}()[],=".includes(ch)) {
      tokens.push({ type: "symbol", value: ch, line: startLine, col: startCol })
      advance()
      continue
    }

    // Identifier or keyword
    if (/[a-zA-Z_\u4e00-\u9fff]/.test(ch)) {
      let word = ""
      while (i < input.length && /[a-zA-Z0-9_\u4e00-\u9fff]/.test(input[i])) {
        word += input[i]; advance()
      }
      // Math.PI 作为数字常量（用于 arc 弧线角度，如半圆）
      if (word === "Math" && input.slice(i, i + 3) === ".PI") {
        const after = input[i + 3]
        if (after === undefined || !/[a-zA-Z0-9_\u4e00-\u9fff]/.test(after)) {
          advance(3)
          tokens.push({ type: "number", value: String(Math.PI), line: startLine, col: startCol })
          continue
        }
      }
      if (KEYWORDS.has(word)) {
        if (word === "true") tokens.push({ type: "bool", value: "true", line: startLine, col: startCol })
        else if (word === "false") tokens.push({ type: "bool", value: "false", line: startLine, col: startCol })
        else if (word === "random" || word === "inherit") tokens.push({ type: "builtin", value: word, line: startLine, col: startCol })
        else tokens.push({ type: "keyword", value: word, line: startLine, col: startCol })
      } else {
        tokens.push({ type: "keyword", value: word, line: startLine, col: startCol })
      }
      continue
    }

    // Color hex value
    if (ch === "#") {
      let hex = ch; advance()
      while (i < input.length && /[0-9a-fA-F]/.test(input[i])) { hex += input[i]; advance() }
      tokens.push({ type: "string", value: hex, line: startLine, col: startCol })
      continue
    }

    // Unknown char
    errors.push({ message: `Unexpected character "${ch}"`, line: startLine, col: startCol })
    advance()
  }

  return { tokens, errors }
}

class Parser {
  private tokens: Token[]
  private pos: number
  errors: ShellParseError[]
  shells: ParsedShell[]

  constructor(tokens: Token[], errors: ShellParseError[]) {
    this.tokens = tokens
    this.pos = 0
    this.errors = errors
    this.shells = []
  }

  private peek(): Token | null { return this.pos < this.tokens.length ? this.tokens[this.pos] : null }
  private advance(): Token | null { return this.pos < this.tokens.length ? this.tokens[this.pos++] : null }
  private expect(type: TokenType, value?: string): Token | null {
    const t = this.peek()
    if (t && t.type === type && (value === undefined || t.value === value)) return this.advance()
    return null
  }
  private require(type: TokenType, value?: string): Token {
    const t = this.expect(type, value)
    if (!t) {
      const cur = this.peek()
      this.errors.push({
        message: value ? `Expected "${value}", but got "${cur?.value ?? "EOF"}"` : `Expected ${type}, but got "${cur?.value ?? "EOF"}"`,
        line: cur?.line ?? 1, col: cur?.col ?? 1,
      })
      throw new Error("parse error")
    }
    return t
  }

  parse(): ParsedShell[] {
    while (this.peek()) {
      try {
        this.parseFirework()
      } catch {
        // Try to recover: skip to next "firework"
        while (this.pos < this.tokens.length && !(this.tokens[this.pos].value === "firework" && this.tokens[this.pos].type === "keyword")) {
          this.pos++
        }
      }
    }
    return this.shells
  }

  private parseFirework(): void {
    this.require("keyword", "firework")
    this.require("symbol", "{")
    const errCountBefore = this.errors.length
    const shell = this.parseFireworkBody()
    this.require("symbol", "}")
    // Only register the shell if no errors were found in this block
    if (this.errors.length === errCountBefore) {
      this.shells.push(shell)
    }
  }

  private parseFireworkBody(): ParsedShell {
    const props: Record<string, string | number | boolean | string[]> = {}
    const onDeath: OnDeathAction[] = []

    while (this.peek() && this.peek()!.value !== "}") {
      if (this.peek()!.type === "keyword" && this.peek()!.value === "onDeath") {
        this.advance()
        onDeath.push(...this.parseOnDeathBlock())
        continue
      }
      this.parseProperty(props)
    }
    return { name: String(props.name || ""), props, onDeath }
  }

  private parseProperty(props: Record<string, string | number | boolean | string[]>): void {
    const keyTok = this.require("keyword")
    const key = keyTok.value

    if (!KNOWN_PROPS.has(key)) {
      this.errors.push({ message: `Unknown property "${key}"`, line: keyTok.line, col: keyTok.col })
    }

    this.require("symbol", "=")
    const value = this.parseValue()

    if (key === "glitter" && typeof value === "string" && !GLITTER_VALUES.has(value)) {
      this.errors.push({ message: `Invalid glitter value "${value}", allowed: light, medium, heavy, thick, streamer, willow`, line: keyTok.line, col: keyTok.col })
    }

    // Validate color values per SYNTAX.md
    if (key === COLOR_MAIN) {
      // color supports: random | single hex | [hex, hex, ...]
      if (Array.isArray(value)) {
        for (const c of value) {
          if (!isHexColor(c)) {
            this.errors.push({ message: `"color" array element must be hex (e.g. #ff0043), got "${c}"`, line: keyTok.line, col: keyTok.col })
          }
        }
      } else if (value !== "random" && !isHexColor(value)) {
        this.errors.push({ message: `"color" expects random, a hex color, or an array of hex colors, got "${value}"`, line: keyTok.line, col: keyTok.col })
      }
    } else if (COLOR_HEX_ONLY.has(key)) {
      // secondColor / glitterColor / strobeColor / pistilColor only support hex
      if (Array.isArray(value)) {
        this.errors.push({ message: `"${key}" does not support array values, use a single hex color`, line: keyTok.line, col: keyTok.col })
      } else if (!isHexColor(value)) {
        this.errors.push({ message: `"${key}" requires a hex color (e.g. #ff0043), got "${value}"`, line: keyTok.line, col: keyTok.col })
      }
    }

    // Numeric properties must be numbers, not strings
    if (NUMERIC_PROPS.has(key) && typeof value !== "number") {
      this.errors.push({ message: `"${key}" requires a number, got "${value}"`, line: keyTok.line, col: keyTok.col })
    }

    // Duplicate property
    if (key in props) {
      this.errors.push({ message: `Duplicate property "${key}"`, line: keyTok.line, col: keyTok.col })
    }

    // Validate numeric range
    const range = PROP_RANGES[key]
    if (range && typeof value === "number") {
      const err = validateRange(key, value, range, keyTok.line, keyTok.col)
      if (err) this.errors.push(err)
    }

    props[key] = value
  }

  private parseValue(): string | number | boolean | string[] {
    const t = this.peek()
    if (!t) { throw new Error("unexpected EOF") }

    // Color list
    if (t.type === "symbol" && t.value === "[") {
      this.advance()
      const colors: string[] = []
      const first = this.require("string")
      colors.push(first.value)
      while (this.expect("symbol", ",")) {
        colors.push(this.require("string").value)
      }
      this.require("symbol", "]")
      return colors
    }

    if (t.type === "number") { this.advance(); return parseFloat(t.value) }
    if (t.type === "string") { this.advance(); return t.value }
    if (t.type === "bool") { this.advance(); return t.value === "true" }
    if (t.type === "builtin") {
      this.advance()
      if (t.value === "random") return "random"
      if (t.value === "inherit") return "inherit"
      return t.value
    }
    // Keyword as string value
    if (t.type === "keyword") { this.advance(); return t.value }
    this.errors.push({ message: `Unexpected token "${t.value}"`, line: t.line, col: t.col })
    throw new Error("parse error")
  }

  private parseOnDeathBlock(): OnDeathAction[] {
    const braceTok = this.peek()
    this.require("symbol", "{")
    const actions: OnDeathAction[] = []
    while (this.peek() && this.peek()!.value !== "}") {
      const action = this.parseAction()
      if (action) actions.push(action)
    }
    this.require("symbol", "}")
    // 完整性校验：onDeath 块至少需要一个动作
    if (actions.length === 0 && braceTok) {
      this.errors.push({ message: `onDeath block is empty, add at least one action (burst, flash, arc)`, line: braceTok.line, col: braceTok.col })
    }
    return actions
  }

  private parseAction(): OnDeathAction | null {
    const t = this.peek()
    if (!t || t.type !== "keyword") return null

    switch (t.value) {
      case "burst": return this.parseBurst()
      case "flash": return this.parseFlash()
      case "arc": return this.parseArc()
      case "spiral": return this.parseSpiral()
      default: {
        this.errors.push({ message: `Unknown action "${t.value}", allowed: burst, flash, arc, spiral`, line: t.line, col: t.col })
        this.advance()
        return null
      }
    }
  }

  private parseBurst(): BurstAction {
    this.advance() // "burst"
    const countTok = this.require("number")
    const count = parseFloat(countTok.value)
    if (count <= 0) {
      this.errors.push({ message: `burst count must be positive, got ${count}`, line: countTok.line, col: countTok.col })
    } else if (count > 50) {
      this.errors.push({ message: `burst count too high (${count}), recommended 1-50`, line: countTok.line, col: countTok.col })
    }
    const options: Record<string, string | number> = {}
    if (this.peek()?.value === "{") {
      this.advance()
      this.parseOptionsBlock(options)
      this.require("symbol", "}")
    }
    return { type: "burst", count, options }
  }

  private parseFlash(): FlashAction {
    this.advance() // "flash"
    let radius = 46
    if (this.peek()?.value === "(") {
      this.advance()
      const radiusTok = this.require("number")
      radius = parseFloat(radiusTok.value)
      if (radius <= 0) {
        this.errors.push({ message: `flash radius must be positive, got ${radius}`, line: radiusTok.line, col: radiusTok.col })
      } else if (radius > 200) {
        this.errors.push({ message: `flash radius too high (${radius}), recommended 10-200`, line: radiusTok.line, col: radiusTok.col })
      }
      this.require("symbol", ")")
    }
    return { type: "flash", radius }
  }

  private parseArc(): ArcAction {
    this.advance() // "arc"
    const countTok = this.require("number")
    const count = parseFloat(countTok.value)
    if (count <= 0) {
      this.errors.push({ message: `arc count must be positive, got ${count}`, line: countTok.line, col: countTok.col })
    } else if (count > 100) {
      this.errors.push({ message: `arc count too high (${count}), recommended 1-100`, line: countTok.line, col: countTok.col })
    }
    let arcAngle = Math.PI * 2
    let angleLine = countTok.line; let angleCol = countTok.col
    if (this.peek()?.value === "(") {
      this.advance()
      const angleTok = this.require("number")
      angleLine = angleTok.line; angleCol = angleTok.col
      arcAngle = parseFloat(angleTok.value)
      if (arcAngle <= 0 || arcAngle > Math.PI * 2) {
        this.errors.push({ message: `arc angle must be in range (0, 2π], got ${arcAngle}`, line: angleLine, col: angleCol })
      }
      this.require("symbol", ")")
    }
    const options: Record<string, string | number> = {}
    if (this.peek()?.value === "{") {
      this.advance()
      this.parseOptionsBlock(options)
      this.require("symbol", "}")
    }
    return { type: "arc", count, arcAngle, options }
  }

  private parseSpiral(): SpiralAction {
    this.advance() // "spiral"
    const countTok = this.require("number")
    const count = parseFloat(countTok.value)
    if (count <= 0) {
      this.errors.push({ message: `spiral count must be positive, got ${count}`, line: countTok.line, col: countTok.col })
    } else if (count > 100) {
      this.errors.push({ message: `spiral count too high (${count}), recommended 1-100`, line: countTok.line, col: countTok.col })
    }
    let turns = 1
    if (this.peek()?.value === "(") {
      this.advance()
      const turnsTok = this.require("number")
      turns = parseFloat(turnsTok.value)
      if (turns <= 0 || turns > 10) {
        this.errors.push({ message: `spiral turns must be in range (0, 10], got ${turns}`, line: turnsTok.line, col: turnsTok.col })
      }
      this.require("symbol", ")")
    }
    const options: Record<string, string | number> = {}
    if (this.peek()?.value === "{") {
      this.advance()
      this.parseOptionsBlock(options)
      this.require("symbol", "}")
    }
    return { type: "spiral", count, turns, options }
  }

  private parseOptionsBlock(options: Record<string, string | number | boolean | string[]>): void {
    while (this.peek() && this.peek()!.value !== "}") {
      const keyTok = this.require("keyword")
      this.require("symbol", "=")
      const v = this.parseValue()

      // Unknown option name
      if (!KNOWN_PROPS.has(keyTok.value)) {
        this.errors.push({ message: `Unknown option "${keyTok.value}" in action block`, line: keyTok.line, col: keyTok.col })
      }

      // Duplicate option
      if (keyTok.value in options) {
        this.errors.push({ message: `Duplicate option "${keyTok.value}"`, line: keyTok.line, col: keyTok.col })
      }

      options[keyTok.value] = v
      if (this.peek()?.value === ",") this.advance()

      // Validate numeric range for action options
      const range = ACTION_OPTION_RANGES[keyTok.value]
      if (range && typeof v === "number") {
        const err = validateRange(keyTok.value, v, range, keyTok.line, keyTok.col)
        if (err) this.errors.push(err)
      }
    }
  }
}

export function parseShellScript(input: string): { shells: ParsedShell[]; errors: ShellParseError[] } {
  const { tokens, errors } = tokenize(input)
  const parser = new Parser(tokens, errors)
  const shells = parser.parse()
  return { shells, errors: parser.errors }
}
