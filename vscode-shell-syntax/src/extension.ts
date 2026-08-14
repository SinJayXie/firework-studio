import * as vscode from "vscode"

// ═══════════════════════════════════════════════════════════════
// Data
// ═══════════════════════════════════════════════════════════════

const SELECTOR: vscode.DocumentSelector = { language: "firework-shell", scheme: "file" }

// ── Property metadata (used by completions, hover, diagnostics) ──

interface PropMeta {
  type: "string" | "number" | "boolean" | "color" | "color[]" | "glitter"
  required: boolean
  desc: string
  range?: [number, number] // [min, max]
  default?: string
}

const PROP_META: Record<string, PropMeta> = {
  name: { type: "string", required: true, desc: "Firework name (display label)" },
  size: { type: "number", required: false, desc: "Explosion spread radius", range: [50, 800], default: "300" },
  life: { type: "number", required: false, desc: "Particle lifespan (ms)", range: [300, 5000], default: "900" },
  lifeVariation: { type: "number", required: false, desc: "Lifespan random variation (0-5)", range: [0, 5], default: "0.125" },
  density: { type: "number", required: false, desc: "Particle density (0.05-2)", range: [0.05, 2], default: "1" },
  starCount: { type: "number", required: false, desc: "Exact particle count", range: [1, 5000], default: "200" },
  color: { type: "color", required: false, desc: "Primary color / color list [c1, c2, ...] or random" },
  secondColor: { type: "color", required: false, desc: "Fade to this color in the second half of lifespan" },
  glitter: { type: "glitter", required: false, desc: "Sparkle / trail effect type" },
  glitterColor: { type: "color", required: false, desc: "Sparkle color" },
  ring: { type: "boolean", required: false, desc: "Ring-shaped explosion", default: "false" },
  horsetail: { type: "boolean", required: false, desc: "Horsetail trail effect", default: "false" },
  strobe: { type: "boolean", required: false, desc: "Strobe flicker effect", default: "false" },
  strobeColor: { type: "color", required: false, desc: "Strobe color" },
  pistil: { type: "boolean", required: false, desc: "Inner pistil particles", default: "false" },
  pistilColor: { type: "color", required: false, desc: "Pistil color" },
  streamers: { type: "boolean", required: false, desc: "Additional white streamer layer", default: "false" },
  crossette: { type: "boolean", required: false, desc: "Crossette split on death", default: "false" },
  crackle: { type: "boolean", required: false, desc: "Crackle spark on death", default: "false" },
  floral: { type: "boolean", required: false, desc: "Floral burst on death", default: "false" },
  fallingLeaves: { type: "boolean", required: false, desc: "Falling leaves on death", default: "false" },
}

const BOOL_PROPS = new Set(["ring", "horsetail", "strobe", "pistil", "streamers", "crossette", "crackle", "floral", "fallingLeaves"])
const COLOR_PROPS = new Set(["color", "secondColor", "glitterColor", "strobeColor", "pistilColor"])
const NUMERIC_PROPS = new Set(["size", "life", "lifeVariation", "density", "starCount"])
const GLITTER_VALUES = new Set(["light", "medium", "heavy", "thick", "streamer", "willow"])
const GLITTER_DESCS: Record<string, string> = {
  light: "Sparse sparkle", medium: "Medium spark", heavy: "Dense trail", thick: "Thick trail", streamer: "Streamer line", willow: "Willow drop",
}

// ── Action option metadata (inside onDeath burst/flash/arc blocks) ──

interface ActionOptionMeta {
  type: "color|inherit" | "number"
  required?: boolean
  range?: [number, number]
}

const ACTION_OPTION_META: Record<string, ActionOptionMeta> = {
  color: { type: "color|inherit", required: true },
  life:   { type: "number", range: [100, 3000] },
  speed:  { type: "number", range: [0.1, 5] },
}

// Required props for a firework block
const REQUIRED_PROPS = new Set(Object.entries(PROP_META).filter(([, v]) => v.required).map(([k]) => k))

// ── Completion items ──

function makeCI(label: string, kind: vscode.CompletionItemKind, detail: string, doc?: string): vscode.CompletionItem {
  const item = new vscode.CompletionItem(label, kind)
  item.detail = detail
  if (doc) item.documentation = new vscode.MarkdownString(doc)
  return item
}

function propCI(name: string): vscode.CompletionItem {
  const meta = PROP_META[name]
  const kind = BOOL_PROPS.has(name) ? vscode.CompletionItemKind.Enum : vscode.CompletionItemKind.Property
  let snippet: string
  if (meta.type === "boolean") snippet = `${name} = \${1|true,false|}`
  else if (meta.type === "glitter") snippet = `${name} = \${1|light,medium,heavy,thick,streamer,willow|}`
  else if (meta.type === "color") snippet = `${name} = "\${1:#ff0043}"`
  else if (meta.type === "number") snippet = `${name} = \${1:${meta.default || "0"}}`
  else snippet = `${name} = "\${1}"`

  const item = new vscode.CompletionItem(name, kind)
  item.insertText = new vscode.SnippetString(snippet)
  item.detail = `[${meta.type}] ${meta.required ? "(required) " : ""}${meta.desc}`
  if (meta.range) item.detail += ` (${meta.range[0]}-${meta.range[1]})`
  if (meta.default) item.detail += ` default: ${meta.default}`
  return item
}

const BLOCK_KW: vscode.CompletionItem[] = [
  (() => {
    const item = new vscode.CompletionItem("firework", vscode.CompletionItemKind.Keyword)
    item.insertText = new vscode.SnippetString("firework {\n\tname = \"${1:name}\"\n\t${0}\n}")
    item.detail = "Firework definition block"
    return item
  })(),
  (() => {
    const item = new vscode.CompletionItem("onDeath", vscode.CompletionItemKind.Keyword)
    item.insertText = new vscode.SnippetString("onDeath {\n\t${0}\n}")
    item.detail = "Particle death effect block"
    return item
  })(),
]

const ACTION_KW: vscode.CompletionItem[] = [
  (() => {
    const item = new vscode.CompletionItem("burst", vscode.CompletionItemKind.Function)
    item.insertText = new vscode.SnippetString("burst ${1:8} { color = inherit, life = ${2:600} }")
    item.detail = "Circular burst (burst count)"
    item.documentation = new vscode.MarkdownString("Circular burst effect. First argument is particle count, followed by `{ ... }` options block.\n\nOptions: `color`, `life`, `speed`")
    return item
  })(),
  (() => {
    const item = new vscode.CompletionItem("flash", vscode.CompletionItemKind.Function)
    item.insertText = new vscode.SnippetString("flash(${1:46})")
    item.detail = "Radial glow flash (flash radius)"
    item.documentation = new vscode.MarkdownString("Radial gradient glow. Parentheses contain the radius.")
    return item
  })(),
  (() => {
    const item = new vscode.CompletionItem("arc", vscode.CompletionItemKind.Function)
    item.insertText = new vscode.SnippetString("arc ${1:6} (${2:6.283}) { color = inherit, life = ${3:600} }")
    item.detail = "Arc distribution (arc count)(angle)"
    item.documentation = new vscode.MarkdownString("Arc distribution effect. Arguments: particle count, (angle in radians).\n\nAngle 6.283 = full circle (2π), 3.14 = half circle.\n\nOptions: `color`, `life`, `speed`")
    return item
  })(),
]

const ACTION_OPTION_CIS: vscode.CompletionItem[] = [
  (() => {
    const item = new vscode.CompletionItem("color", vscode.CompletionItemKind.Property)
    item.insertText = new vscode.SnippetString("color = ${1|inherit,#ff0043,#ffbf36,#1e7fff,#e60aff,#14fc56|}")
    item.detail = "Action particle color"
    return item
  })(),
  (() => {
    const item = new vscode.CompletionItem("life", vscode.CompletionItemKind.Property)
    item.insertText = new vscode.SnippetString("life = ${1:600}")
    item.detail = "Action particle lifespan ms (100-3000)"
    return item
  })(),
  (() => {
    const item = new vscode.CompletionItem("speed", vscode.CompletionItemKind.Property)
    item.insertText = new vscode.SnippetString("speed = ${1:1.0}")
    item.detail = "Action speed multiplier (0.1-5)"
    return item
  })(),
]

const ALL_PROPS_CIS = Object.keys(PROP_META).map(propCI)

// ═══════════════════════════════════════════════════════════════
// Completion Provider
// ═══════════════════════════════════════════════════════════════

class ShellCompletionProvider implements vscode.CompletionItemProvider {
  provideCompletionItems(document: vscode.TextDocument, position: vscode.Position): vscode.CompletionItem[] {
    const lineText = document.lineAt(position.line).text
    const textBefore = lineText.substring(0, position.character).trim()
    const col = position.character

    // ── After "=" → suggest value ──
    const afterEq = textBefore.match(/(\w+)\s*=\s*$/)
    if (afterEq) {
      const key = afterEq[1]
      if (COLOR_PROPS.has(key)) return [
        makeCI("random", vscode.CompletionItemKind.Constant, "Random color"),
        makeCI("inherit", vscode.CompletionItemKind.Constant, "Inherit parent particle color"),
      ]
      if (key === "glitter") return [
        ...Array.from(GLITTER_VALUES).map(v => makeCI(v, vscode.CompletionItemKind.Enum, GLITTER_DESCS[v] || "")),
      ]
      if (BOOL_PROPS.has(key)) return [
        makeCI("true", vscode.CompletionItemKind.Constant, "Enable"),
        makeCI("false", vscode.CompletionItemKind.Constant, "Disable"),
      ]
      return []
    }

    // ── Inside onDeath action options block ──
    if (this.scopeDepth(document, position).inActionOptions) return ACTION_OPTION_CIS

    // ── Inside onDeath body ──
    const scope = this.scopeDepth(document, position)
    if (scope.inOnDeath) return ACTION_KW

    // ── Top-level (inside firework block) ──
    // Deduplicate already-written props
    const existing = this.existingProps(document, position)
    const remaining = ALL_PROPS_CIS.filter(c => !existing.has(String(c.label)))

    if (textBefore === "" || textBefore.endsWith("{") || /^\s*$/.test(textBefore)) {
      return [...remaining, ...BLOCK_KW]
    }

    return remaining
  }

  /** Return the set of props already assigned in the current firework block above position. */
  private existingProps(document: vscode.TextDocument, position: vscode.Position): Set<string> {
    const text = document.getText()
    const before = text.substring(0, document.offsetAt(position))
    // Find the nearest preceding "firework {"
    const fwIdx = before.lastIndexOf("firework")
    if (fwIdx === -1) return new Set()
    const section = before.substring(fwIdx)
    const set = new Set<string>()
    const re = /^\s*(\w+)\s*=/gm
    let m: RegExpExecArray | null
    while ((m = re.exec(section)) !== null) set.add(m[1])
    return set
  }

  /** Determine scope context at position. */
  private scopeDepth(document: vscode.TextDocument, position: vscode.Position): {
    depth: number
    inOnDeath: boolean
    inActionOptions: boolean
  } {
    let depth = 0
    let onDeathActive = false
    let actionOptionsDepth = -1
    let recentActionLine = -1

    for (let i = 0; i <= position.line; i++) {
      const line = document.lineAt(i).text
      const endCol = i === position.line ? position.character : line.length
      const part = i === position.line ? line.substring(0, endCol) : line

      if (/\bonDeath\b/.test(part)) onDeathActive = true
      if (/\b(burst|flash|arc)\b/.test(part)) recentActionLine = i

      const opens = (part.match(/\{/g) || []).length
      const closes = (part.match(/\}/g) || []).length
      const prevDepth = depth
      depth += opens - closes

      if (recentActionLine >= i - 1 && part.includes("{") && actionOptionsDepth < 0) {
        actionOptionsDepth = prevDepth + 1
      }
      if (actionOptionsDepth >= 0 && depth < actionOptionsDepth) {
        actionOptionsDepth = -1; recentActionLine = -1
      }

      if (onDeathActive && depth <= 0) onDeathActive = false
    }

    return { depth, inOnDeath: onDeathActive, inActionOptions: actionOptionsDepth >= 0 }
  }
}

// ═══════════════════════════════════════════════════════════════
// Diagnostic Provider (Strict Validation)
// ═══════════════════════════════════════════════════════════════

class ShellDiagnosticProvider {
  private collection = vscode.languages.createDiagnosticCollection("firework-shell")

  update(document: vscode.TextDocument): void {
    const diagnostics: vscode.Diagnostic[] = []
    const text = document.getText()
    const lines = text.split("\n")

    // Phase 1: Parse blocks
    const blocks = this.parseBlocks(document)

    // Phase 2: Validate each block
    for (const block of blocks) {
      this.validateBlock(document, block, diagnostics)
    }

    // Phase 3: Brace balance (global)
    let depth = 0
    for (let i = 0; i < lines.length; i++) {
      const opens = (lines[i].match(/\{/g) || []).length
      const closes = (lines[i].match(/\}/g) || []).length
      depth += opens - closes
      if (depth < 0) {
        diagnostics.push(this.error(i, 0, `Unexpected "}"`))
        depth = 0
      }
    }
    if (depth > 0) {
      diagnostics.push(this.error(lines.length - 1, 0, `Missing ${depth} closing "}"`))
    }

    this.collection.set(document.uri, diagnostics)
  }

  // ── Block parser ──

  private parseBlocks(document: vscode.TextDocument): FireworkBlock[] {
    const blocks: FireworkBlock[] = []
    const text = document.getText()
    const re = /\b(firework)\b/g
    let match: RegExpExecArray | null
    while ((match = re.exec(text)) !== null) {
      const block = this.extractBlock(document, match.index, text)
      if (block) blocks.push(block)
    }
    return blocks
  }

  private extractBlock(document: vscode.TextDocument, start: number, fullText: string): FireworkBlock | null {
    let depth = 0
    let i = start
    const text = fullText
    // Find opening brace
    i = text.indexOf("{", i)
    if (i === -1) return null

    const startPos = document.positionAt(start)
    const blockLines: number[] = []

    for (; i < text.length; i++) {
      const ch = text[i]
      const pos = document.positionAt(i)
      if (ch === "{") depth++
      else if (ch === "}") {
        depth--
        if (depth === 0) {
          blockLines.push(pos.line)
          break
        }
      }
      if (pos.line !== (blockLines[blockLines.length - 1] ?? -1)) {
        blockLines.push(pos.line)
      }
    }

    // Parse props inside the block
    const props = new Map<string, PropValue>()
    const onDeathActions: OnDeathEntry[] = []
    const errors: FireworkError[] = []
    let inOnDeath = false
    let braceLevel = 0
    let onDeathBraceBase = 0
    let actionOptionBase = -1
    let actionHasOpenBrace = false
    let currentAction: OnDeathEntry | null = null

    for (let li = startPos.line; li <= (blockLines[blockLines.length - 1] ?? startPos.line); li++) {
      const line = document.lineAt(li).text.trim()
      if (!line || line.startsWith("//") || line.startsWith("/*")) continue

      const opens = (line.match(/\{/g) || []).length
      const closes = (line.match(/\}/g) || []).length
      const prevLevel = braceLevel
      braceLevel += opens - closes

      if (/\bonDeath\b/.test(line) && line.includes("{")) {
        inOnDeath = true
        onDeathBraceBase = prevLevel
        actionOptionBase = -1
        actionHasOpenBrace = false
        currentAction = null
        continue
      }
      if (inOnDeath && braceLevel <= onDeathBraceBase) {
        inOnDeath = false
        actionOptionBase = -1
        actionHasOpenBrace = false
        currentAction = null
      }

      // Detect action keyword (must be BEFORE prop parsing so single-line options work)
      if (inOnDeath && actionOptionBase < 0 && /^(\s*)(burst|flash|arc)\b/.test(line)) {
        const actionMatch = line.match(/^(\s*)(burst|flash|arc)\b/)
        if (actionMatch) {
          currentAction = {
            type: actionMatch[2] as ActionType,
            line: li,
            col: actionMatch.index! + actionMatch[1].length,
            options: [],
            errors: [],
          }
          onDeathActions.push(currentAction)
          if (line.includes("{")) {
            actionOptionBase = prevLevel
            actionHasOpenBrace = true
          }
        }
      }

      const propMatch = line.match(/^(\w+)\s*=\s*(.+)$/)
      if (propMatch && !inOnDeath) {
        const key = propMatch[1]
        const rawVal = propMatch[2].replace(/["']/g, "").trim()

        // Detect multiple assignments on same line
        const nestedAssign = rawVal.match(/\b(\w+)\s*=\s*\S/)
        if (nestedAssign) {
          const nestedKey = nestedAssign[1]
          const nestedIdx = rawVal.indexOf(nestedKey)
          const absCol = line.indexOf("=") + 1 + nestedIdx
          errors.push({ line: li, col: absCol, msg: `Assignments must be on separate lines, found "${nestedKey}" on the same line` })
        }

        if (props.has(key)) {
          errors.push({ line: li, col: line.indexOf(key), msg: `Duplicate property "${key}"` })
        }
        props.set(key, { raw: rawVal, line: li, col: line.indexOf("=") + 1 })
      }

      // Parse props inside action options (onDeath > burst/flash/arc > { ... })
      if (propMatch && inOnDeath && currentAction && (braceLevel > actionOptionBase || actionHasOpenBrace)) {
        const key = propMatch[1]
        const rawVal = propMatch[2].replace(/["']/g, "").trim()
        currentAction.options.push({ key, raw: rawVal, line: li, col: line.indexOf("=") + 1 })
      }

      // Reset single-line flag and check action option block exit
      if (actionHasOpenBrace) {
        actionHasOpenBrace = false
      }
      if (actionOptionBase >= 0 && braceLevel <= actionOptionBase) {
        actionOptionBase = -1
        currentAction = null
      }
    }

    return { name: props.get("name")?.raw, props, onDeathActions, errors, startLine: startPos.line }
  }

  // ── Block validation ──

  private validateBlock(document: vscode.TextDocument, block: FireworkBlock, diagnostics: vscode.Diagnostic[]): void {
    // Missing required
    for (const req of REQUIRED_PROPS) {
      if (!block.props.has(req)) {
        diagnostics.push(this.warn(block.startLine, 0, `Missing required property "${req}"`))
      }
    }

    for (const [key, pv] of block.props) {
      const meta = PROP_META[key]
      if (!meta) {
        diagnostics.push(this.error(pv.line, pv.col, `Unknown property "${key}"`))
        continue
      }
      const val = pv.raw

      // Type checks
      switch (meta.type) {
        case "string": {
          const line = document.lineAt(pv.line).text.trim()
          const eqIdx = line.indexOf("=")
          const valPart = line.substring(eqIdx + 1).trim()
          if (!valPart.startsWith('"')) {
            diagnostics.push(this.error(pv.line, pv.col, `"${key}" requires a string (double-quoted), got "${val}"`))
          } else {
            const closeIdx = valPart.indexOf('"', 1)
            if (closeIdx !== -1) {
              const after = valPart.substring(closeIdx + 1).trim()
              if (after && !after.startsWith("//")) {
                diagnostics.push(this.error(pv.line, pv.col + closeIdx + 1, `Unexpected content "${after}" after "${key}" value`))
              }
            }
          }
          break
        }
        case "number": {
          const line = document.lineAt(pv.line).text.trim()
          const eqIdx = line.indexOf("=")
          const valPart = line.substring(eqIdx + 1).trim()
          if (valPart.startsWith('"')) {
            diagnostics.push(this.error(pv.line, pv.col, `"${key}" requires a number (no quotes), got "${val}"`))
          } else {
            if (!this.isValidNumber(val)) {
              diagnostics.push(this.error(pv.line, pv.col, `"${key}" requires a number, got "${val}"`))
            } else if (meta.range) {
              const num = parseFloat(val)
              const [min, max] = meta.range
              if (num < min) diagnostics.push(this.error(pv.line, pv.col, `"${key}"=${num} is below minimum ${min}`))
              if (num > max) diagnostics.push(this.error(pv.line, pv.col, `"${key}"=${num} exceeds maximum ${max}`))
            }
          }
          break
        }
        case "boolean": {
          if (!["true", "false"].includes(val)) {
            diagnostics.push(this.error(pv.line, pv.col, `"${key}" requires true or false, got "${val}"`))
          }
          break
        }
        case "color": {
          if (val !== "random" && !/^#[0-9a-fA-F]{3,8}$/.test(val) && !/^\[.*\]$/.test(val)) {
            diagnostics.push(this.error(pv.line, pv.col, `Invalid color "${val}" for "${key}", expected hex or random`))
          }
          // For single hex color values, check trailing garbage
          if (/^#[0-9a-fA-F]{3,8}$/.test(val)) {
            const line = document.lineAt(pv.line).text.trim()
            const eqIdx = line.indexOf("=")
            const valPart = line.substring(eqIdx + 1).trim()
            const hexEnd = valPart.search(/#[0-9a-fA-F]{3,8}\b/)
            if (hexEnd >= 0) {
              const hexStr = valPart.substring(hexEnd).match(/^#[0-9a-fA-F]{3,8}/)![0]
              const after = valPart.substring(hexEnd + hexStr.length)
                .replace(/^"/, "")  // strip closing quote if present
                .trim()
              if (after && !after.startsWith("//")) {
                diagnostics.push(this.error(pv.line, pv.col + hexEnd + hexStr.length, `Unexpected content "${after}" after "${key}" value`))
              }
            }
          }
          break
        }
        case "glitter": {
          if (!GLITTER_VALUES.has(val)) {
            diagnostics.push(this.error(pv.line, pv.col, `Invalid glitter "${val}", valid: ${Array.from(GLITTER_VALUES).join(", ")}`))
          }
          break
        }
      }
    }

    // Block errors from parsing
    for (const err of block.errors) {
      diagnostics.push(this.error(err.line, err.col, err.msg))
    }

    // ── Validate onDeath actions ──
    for (const action of block.onDeathActions) {
      const actionLine = document.lineAt(action.line).text.trim()
      const cleanLine = actionLine.replace(/\s*\/\/.*$/, "").trim()

      // Action syntax + trailing garbage validation
      if (action.type === "burst") {
        if (!/^burst\s+\d+/.test(cleanLine)) {
          diagnostics.push(this.error(action.line, action.col, `burst requires a particle count, e.g. "burst 8 { ... }"`))
        } else if (!/^burst\s+\d+\s*(\{[^}]*\}?)?\s*$/.test(cleanLine)) {
          const garbage = cleanLine.replace(/^burst\s+\d+\s*(\{[^}]*\}?)?/, "").trim()
          diagnostics.push(this.error(action.line, action.col, `Unexpected content "${garbage}" on burst line`))
        }
      } else if (action.type === "flash") {
        if (!/^flash\s*\(\s*\d+/.test(cleanLine)) {
          diagnostics.push(this.error(action.line, action.col, `flash requires a radius, e.g. "flash(46)"`))
        } else if (!/^flash\s*\(\s*\d+(?:\.\d+)?\s*\)\s*$/.test(cleanLine)) {
          const garbage = cleanLine.replace(/^flash\s*\(\s*\d+(?:\.\d+)?\s*\)/, "").trim()
          diagnostics.push(this.error(action.line, action.col, `Unexpected content "${garbage}" on flash line`))
        }
      } else if (action.type === "arc") {
        if (!/^arc\s+\d+\s*\([\d.]+\)/.test(cleanLine)) {
          diagnostics.push(this.error(action.line, action.col, `arc requires count and angle, e.g. "arc 6 (6.283) { ... }"`))
        } else if (!/^arc\s+\d+\s*\([\d.]+\)\s*(\{[^}]*\}?)?\s*$/.test(cleanLine)) {
          const garbage = cleanLine.replace(/^arc\s+\d+\s*\([\d.]+\)\s*(\{[^}]*\}?)?/, "").trim()
          diagnostics.push(this.error(action.line, action.col, `Unexpected content "${garbage}" on arc line`))
        }
      }

      // Action option validation
      for (const opt of action.options) {
        const optMeta = ACTION_OPTION_META[opt.key]
        if (!optMeta) {
          diagnostics.push(this.error(opt.line, opt.col, `Unknown action option "${opt.key}"`))
          continue
        }

        const optVal = opt.raw

        if (optMeta.type === "color|inherit") {
          if (optVal !== "inherit" && !/^#[0-9a-fA-F]{3,8}$/.test(optVal) && !/^\[.*\]$/.test(optVal)) {
            diagnostics.push(this.error(opt.line, opt.col, `Invalid color "${optVal}" for "${opt.key}", expected hex or inherit`))
          }
        } else if (optMeta.type === "number") {
          const optLine = document.lineAt(opt.line).text.trim()
          const eqIdx = optLine.indexOf("=")
          const valPart = optLine.substring(eqIdx + 1).trim()
          if (valPart.startsWith('"')) {
            diagnostics.push(this.error(opt.line, opt.col, `"${opt.key}" requires a number (no quotes), got "${optVal}"`))
          } else {
            if (!this.isValidNumber(optVal)) {
              diagnostics.push(this.error(opt.line, opt.col, `"${opt.key}" requires a number, got "${optVal}"`))
            } else if (optMeta.range) {
              const num = parseFloat(optVal)
              const [min, max] = optMeta.range
              if (num < min) diagnostics.push(this.error(opt.line, opt.col, `"${opt.key}"=${num} is below minimum ${min}`))
              if (num > max) diagnostics.push(this.error(opt.line, opt.col, `"${opt.key}"=${num} exceeds maximum ${max}`))
            }
          }
        }
      }

      // Action-level errors from parsing
      for (const err of action.errors) {
        diagnostics.push(this.error(err.line, err.col, err.msg))
      }
    }
  }

  // ── Helpers ──

  /** Check whether the whole string is a valid number (int, float, or scientific). */
  private isValidNumber(s: string): boolean {
    return /^-?\d+(\.\d+)?([eE][+-]?\d+)?$/.test(s)
  }

  private error(line: number, col: number, msg: string): vscode.Diagnostic {
    const range = new vscode.Range(line, col, line, Math.max(col + 10, 200))
    const d = new vscode.Diagnostic(range, msg, vscode.DiagnosticSeverity.Error)
    d.source = "firework-shell"
    return d
  }

  private warn(line: number, col: number, msg: string): vscode.Diagnostic {
    const range = new vscode.Range(line, col, line, Math.max(col + 10, 200))
    const d = new vscode.Diagnostic(range, msg, vscode.DiagnosticSeverity.Warning)
    d.source = "firework-shell"
    return d
  }

  dispose(): void { this.collection.dispose() }
}

// ── Block types ──

interface PropValue { raw: string; line: number; col: number }
type ActionType = "burst" | "flash" | "arc"
interface OnDeathActionOption { key: string; raw: string; line: number; col: number }
interface OnDeathEntry {
  type: ActionType
  line: number
  col: number
  options: OnDeathActionOption[]
  errors: FireworkError[]
}
interface FireworkError { line: number; col: number; msg: string }
interface FireworkBlock {
  name?: string
  props: Map<string, PropValue>
  onDeathActions: OnDeathEntry[]
  errors: FireworkError[]
  startLine: number
}

// ═══════════════════════════════════════════════════════════════
// Hover Provider
// ═══════════════════════════════════════════════════════════════

class ShellHoverProvider implements vscode.HoverProvider {
  provideHover(document: vscode.TextDocument, position: vscode.Position): vscode.Hover | null {
    const wordRange = document.getWordRangeAtPosition(position, /\b(\w+)\b/)
    if (!wordRange) return null
    const word = document.getText(wordRange)

    // Known properties
    const meta = PROP_META[word]
    if (meta) {
      const parts: string[] = [`**\`${word}\`** — ${meta.desc}`]
      parts.push(`Type: \`${meta.type}\``)
      if (meta.required) parts.push("**(required)**")
      if (meta.range) parts.push(`Range: ${meta.range[0]} – ${meta.range[1]}`)
      if (meta.default) parts.push(`Default: \`${meta.default}\``)
      return new vscode.Hover(new vscode.MarkdownString(parts.join("\n\n")), wordRange)
    }

    // Keywords
    if (word === "firework") return new vscode.Hover(new vscode.MarkdownString("**`firework`** — Defines a firework effect block"), wordRange)
    if (word === "onDeath") return new vscode.Hover(new vscode.MarkdownString("**`onDeath`** — Effect block triggered on particle death"), wordRange)
    if (word === "burst") return new vscode.Hover(new vscode.MarkdownString("**`burst count { options }`** — Circular burst effect"), wordRange)
    if (word === "flash") return new vscode.Hover(new vscode.MarkdownString("**`flash(radius)`** — Radial gradient glow"), wordRange)
    if (word === "arc") return new vscode.Hover(new vscode.MarkdownString("**`arc count (angle) { options }`** — Arc distribution effect"), wordRange)

    // Glitter values
    if (GLITTER_DESCS[word]) {
      return new vscode.Hover(new vscode.MarkdownString(`**\`${word}\`** — ${GLITTER_DESCS[word]}`), wordRange)
    }

    // Builtin constants
    if (word === "random") return new vscode.Hover(new vscode.MarkdownString("**`random`** — Random color"), wordRange)
    if (word === "inherit") return new vscode.Hover(new vscode.MarkdownString("**`inherit`** — Inherit parent particle color"), wordRange)
    if (word === "true") return new vscode.Hover(new vscode.MarkdownString("**`true`** — Boolean true"), wordRange)
    if (word === "false") return new vscode.Hover(new vscode.MarkdownString("**`false`** — Boolean false"), wordRange)

    return null
  }
}

// ═══════════════════════════════════════════════════════════════
// Formatting Provider
// ═══════════════════════════════════════════════════════════════

class ShellFormatter implements vscode.DocumentFormattingEditProvider {
  provideDocumentFormattingEdits(
    document: vscode.TextDocument,
    options: vscode.FormattingOptions,
    _token: vscode.CancellationToken
  ): vscode.TextEdit[] {
    const indentSize = options.tabSize
    const insertSpaces = options.insertSpaces
    const indentChar = insertSpaces ? " ".repeat(indentSize) : "\t"

    const text = document.getText()
    const lines = text.split("\n")
    const formatted: string[] = []

    let depth = 0

    for (let i = 0; i < lines.length; i++) {
      const raw = lines[i]
      // Trim trailing whitespace, preserve leading
      const trimmed = raw.trimEnd()

      // Empty / whitespace-only lines → collapse to ""
      if (trimmed.trim() === "") {
        formatted.push("")
        continue
      }

      // Normalize internal whitespace (collapse multiple spaces/tabs → single space)
      // but preserve spaces inside double-quoted strings
      let content = trimmed.trim()
      content = this.collapseSpaces(content)

      const opens = (content.match(/\{/g) || []).length
      const closes = (content.match(/\}/g) || []).length

      // Determine indent for this line
      let indent = depth
      if (content.startsWith("}")) {
        indent = Math.max(0, depth - 1)
      }

      formatted.push(indentChar.repeat(indent) + content)

      // Update depth for next line
      depth += opens - closes
    }

    // ── Post-process: normalize blank lines ──
    const result: string[] = []
    for (let i = 0; i < formatted.length; i++) {
      const line = formatted[i]

      // Collapse consecutive blank lines → max 1
      if (line === "" && i > 0 && formatted[i - 1] === "") {
        continue
      }

      // Ensure blank line before firework blocks (skip first block)
      const trimmedLine = line.trim()
      if (trimmedLine.startsWith("firework") && result.length > 0) {
        // If last non-empty line is not already blank, insert blank line
        const last = result[result.length - 1]
        if (last !== "") {
          // Check if second-to-last is already blank to avoid triple blanks
          if (result.length < 2 || result[result.length - 2] !== "") {
            result.push("")
          }
        }
      }

      result.push(line)
    }

    // Strip trailing blank lines
    while (result.length > 0 && result[result.length - 1] === "") {
      result.pop()
    }

    const newText = result.join("\n")
    const fullRange = new vscode.Range(
      document.positionAt(0),
      document.positionAt(text.length)
    )
    return [vscode.TextEdit.replace(fullRange, newText)]
  }

  /** Collapse multiple whitespace chars → single space, preserving content inside "...". */
  private collapseSpaces(line: string): string {
    const parts = line.split('"')
    for (let i = 0; i < parts.length; i += 2) {
      // Even indices: outside strings — collapse whitespace
      parts[i] = parts[i]
        .replace(/[\t ]{2,}/g, " ")
        .replace(/\(\s+/g, "(")
        .replace(/\s+\)/g, ")")
    }
    // Odd indices: inside strings — preserve as-is
    return parts.join('"')
  }
}

// ═══════════════════════════════════════════════════════════════
// Activation
// ═══════════════════════════════════════════════════════════════

export function activate(context: vscode.ExtensionContext): void {
  // Completions (trigger on space, dot, letter)
  context.subscriptions.push(
    vscode.languages.registerCompletionItemProvider(SELECTOR, new ShellCompletionProvider(), " ", ".")
  )

  // Diagnostics
  const dp = new ShellDiagnosticProvider()
  context.subscriptions.push(dp)

  const onDoc = (doc: vscode.TextDocument) => { if (doc.languageId === "firework-shell") dp.update(doc) }
  context.subscriptions.push(vscode.workspace.onDidChangeTextDocument((e: vscode.TextDocumentChangeEvent) => onDoc(e.document)))
  context.subscriptions.push(vscode.workspace.onDidOpenTextDocument(onDoc))
  vscode.workspace.textDocuments.forEach(onDoc)

  // Hover
  context.subscriptions.push(vscode.languages.registerHoverProvider(SELECTOR, new ShellHoverProvider()))

  // Formatting
  context.subscriptions.push(vscode.languages.registerDocumentFormattingEditProvider(SELECTOR, new ShellFormatter()))
}

export function deactivate(): void {}
