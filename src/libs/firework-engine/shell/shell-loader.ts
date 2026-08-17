// shell-loader.ts — 加载解析后的 shell 并注册到系统

import { parseShellScript } from "./shell-parser"
import type { ParsedShell, OnDeathAction, ShellParseError, ShellValue, GradientExpr } from "./shell-parser"
import { shellTypes, shellNameMap, type ShellOptions, type ShellFactory } from "./shell-types"
import type { StarData } from "../particles/star"
import { createBurst, createParticleArc } from "../particles/particle-utils"
import { PI_2, INVISIBLE } from "../utils/constants"
import type Firework from "../core/firework"

export interface ShellLoadResult {
  success: boolean
  shells: string[]
  errors: ShellParseError[]
}

function isGradient(v: ShellValue | undefined): v is GradientExpr {
  return !!v && typeof v === "object" && "kind" in v && v.kind === "gradient"
}

function resolveNumber(v: ShellValue | undefined, fallback: number): number {
  if (typeof v === "number") return v
  if (v && typeof v === "object" && "kind" in v && v.kind === "random") return v.min + Math.random() * (v.max - v.min)
  return fallback
}

function resolveColor(v: ShellValue | undefined, fallback: string): string {
  if (typeof v === "string") {
    if (v === "inherit") return fallback
    return v
  }
  return fallback
}

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "")
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]
}

function lerpColor(a: string, b: string, t: number): string {
  const ca = hexToRgb(a)
  const cb = hexToRgb(b)
  const r = Math.round(ca[0] + (cb[0] - ca[0]) * t)
  const g = Math.round(ca[1] + (cb[1] - ca[1]) * t)
  const bl = Math.round(ca[2] + (cb[2] - ca[2]) * t)
  return `#${((1 << 24) + (r << 16) + (g << 8) + bl).toString(16).slice(1)}`
}

function gradientOrColor(v: ShellValue | undefined, t: number, fallback: string): string {
  if (isGradient(v)) return lerpColor(v.from, v.to, t)
  return resolveColor(v, fallback)
}

// 采样一个闭合多边形轮廓，均分成 count 个点。
function sampleOutline(count: number, pts: [number, number][]): [number, number][] {
  const n = pts.length
  if (count <= 1) return [pts[0]]
  const segs: number[] = []
  let total = 0
  for (let i = 0; i < n; i++) {
    const a = pts[i]
    const b = pts[(i + 1) % n]
    const d = Math.hypot(b[0] - a[0], b[1] - a[1])
    segs.push(d)
    total += d
  }
  const out: [number, number][] = []
  for (let k = 0; k < count; k++) {
    const target = (k / count) * total
    let acc = 0
    for (let i = 0; i < n; i++) {
      const d = segs[i]
      if (target <= acc + d || i === n - 1) {
        const t = d === 0 ? 0 : (target - acc) / d
        const a = pts[i]
        const b = pts[(i + 1) % n]
        out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t])
        break
      }
      acc += d
    }
  }
  return out
}

// 采样多条线段（用于雪花等分叉造型），均分成 count 个点。
function sampleSegments(count: number, segments: [number, number, number, number][]): [number, number][] {
  if (count <= 1) return [[segments[0][0], segments[0][1]]]
  const lens = segments.map((s) => Math.hypot(s[2] - s[0], s[3] - s[1]))
  const total = lens.reduce((a, b) => a + b, 0)
  const out: [number, number][] = []
  for (let k = 0; k < count; k++) {
    const target = (k / count) * total
    let acc = 0
    for (let i = 0; i < segments.length; i++) {
      const d = lens[i]
      if (target <= acc + d || i === segments.length - 1) {
        const t = d === 0 ? 0 : (target - acc) / d
        const s = segments[i]
        out.push([s[0] + (s[2] - s[0]) * t, s[1] + (s[3] - s[1]) * t])
        break
      }
      acc += d
    }
  }
  return out
}

// 5×7 点阵字体（大写字母 + 数字 + 常用符号），用于 text 动作。
const FONT_5X7: Record<string, string[]> = {
  A: ["01110", "10001", "10001", "11111", "10001", "10001", "10001"],
  B: ["11110", "10001", "10001", "11110", "10001", "10001", "11110"],
  C: ["01110", "10001", "10000", "10000", "10000", "10001", "01110"],
  D: ["11110", "10001", "10001", "10001", "10001", "10001", "11110"],
  E: ["11111", "10000", "10000", "11110", "10000", "10000", "11111"],
  F: ["11111", "10000", "10000", "11110", "10000", "10000", "10000"],
  G: ["01110", "10001", "10000", "10111", "10001", "10001", "01111"],
  H: ["10001", "10001", "10001", "11111", "10001", "10001", "10001"],
  I: ["11111", "00100", "00100", "00100", "00100", "00100", "11111"],
  J: ["00111", "00010", "00010", "00010", "00010", "10010", "01100"],
  K: ["10001", "10010", "10100", "11000", "10100", "10010", "10001"],
  L: ["10000", "10000", "10000", "10000", "10000", "10000", "11111"],
  M: ["10001", "11011", "10101", "10101", "10001", "10001", "10001"],
  N: ["10001", "11001", "10101", "10011", "10001", "10001", "10001"],
  O: ["01110", "10001", "10001", "10001", "10001", "10001", "01110"],
  P: ["11110", "10001", "10001", "11110", "10000", "10000", "10000"],
  Q: ["01110", "10001", "10001", "10001", "10101", "10010", "01101"],
  R: ["11110", "10001", "10001", "11110", "10100", "10010", "10001"],
  S: ["01111", "10000", "10000", "01110", "00001", "00001", "11110"],
  T: ["11111", "00100", "00100", "00100", "00100", "00100", "00100"],
  U: ["10001", "10001", "10001", "10001", "10001", "10001", "01110"],
  V: ["10001", "10001", "10001", "10001", "10001", "01010", "00100"],
  W: ["10001", "10001", "10001", "10101", "10101", "10101", "01010"],
  X: ["10001", "10001", "01010", "00100", "01010", "10001", "10001"],
  Y: ["10001", "10001", "01010", "00100", "00100", "00100", "00100"],
  Z: ["11111", "00001", "00010", "00100", "01000", "10000", "11111"],
  "0": ["01110", "10001", "10011", "10101", "11001", "10001", "01110"],
  "1": ["00100", "01100", "00100", "00100", "00100", "00100", "01110"],
  "2": ["01110", "10001", "00001", "00010", "00100", "01000", "11111"],
  "3": ["11110", "00001", "00001", "01110", "00001", "00001", "11110"],
  "4": ["00010", "00110", "01010", "10010", "11111", "00010", "00010"],
  "5": ["11111", "10000", "10000", "11110", "00001", "00001", "11110"],
  "6": ["00110", "01000", "10000", "11110", "10001", "10001", "01110"],
  "7": ["11111", "00001", "00010", "00100", "01000", "01000", "01000"],
  "8": ["01110", "10001", "10001", "01110", "10001", "10001", "01110"],
  "9": ["01110", "10001", "10001", "01111", "00001", "00010", "01100"],
  " ": ["00000", "00000", "00000", "00000", "00000", "00000", "00000"],
  "-": ["00000", "00000", "00000", "11111", "00000", "00000", "00000"],
  ".": ["00000", "00000", "00000", "00000", "00000", "00110", "00110"],
  "!": ["00100", "00100", "00100", "00100", "00100", "00000", "00100"],
  "?": ["01110", "10001", "00001", "00010", "00100", "00000", "00100"],
  "+": ["00000", "00100", "00100", "11111", "00100", "00100", "00000"],
  "&": ["01100", "10010", "10100", "01000", "10101", "10010", "01101"],
}

// 将字符串转为点阵网格坐标（列为 x，行为 y），字符间留 1 列间距。
function textDots(text: string): [number, number][] {
  const dots: [number, number][] = []
  let col = 0
  for (const ch of text) {
    const glyph = FONT_5X7[ch] ?? FONT_5X7[" "]
    for (let r = 0; r < 7; r++) {
      for (let c = 0; c < 5; c++) {
        if (glyph[r][c] === "1") dots.push([col + c, r])
      }
    }
    col += 6
  }
  return dots
}

function compileOnDeath(actions: OnDeathAction[]): (star: StarData, fw: Firework) => void {
  return (star: StarData, fw: Firework) => {
    const sx = star.x, sy = star.y
    const sc = star.color
    const svx = star.speedX, svy = star.speedY

    for (const action of actions) {
      if (action.type === "flash") {
        fw.addBurstFlash(sx, sy, action.radius)
        continue
      }

      const opts = action.options
      const gravity = typeof opts.gravity === "number" ? opts.gravity : undefined
      const fade = typeof opts.fade === "number" ? opts.fade : undefined
      const life = resolveNumber(opts.life, 600)
      const speed = resolveNumber(opts.speed, 1)
      const delay = resolveNumber(opts.delay, 0)
      const duration = resolveNumber(opts.duration, 0)
      const colorOpt = opts.color

      const spawn = (x: number, y: number, color: string, angle: number, spd: number, ox = 0, oy = 0): StarData => {
        const s = fw.addStar(x, y, color, angle, spd, life, ox, oy)
        if (gravity !== undefined) s.gravity = gravity
        if (fade !== undefined) s.fade = fade
        return s
      }

      const schedule = (i: number, count: number, fn: () => void): void => {
        const t = count <= 1 ? 0 : i / (count - 1)
        const when = delay + (duration > 0 ? t * duration : 0)
        if (when <= 0) fn()
        else setTimeout(fn, when)
      }

      switch (action.type) {
        case "burst": {
          let i = 0
          createBurst(action.count, (angle, speedMult) => {
            const idx = i++
            const t = action.count <= 1 ? 0 : idx / (action.count - 1)
            const color = gradientOrColor(colorOpt, t, sc)
            schedule(idx, action.count, () => {
              spawn(sx, sy, color, angle, speedMult * speed * 2.2, svx, svy)
            })
          })
          break
        }
        case "arc": {
          let i = 0
          createParticleArc(0, action.arcAngle, action.count, 0.5, (angle) => {
            const idx = i++
            const t = action.count <= 1 ? 0 : idx / (action.count - 1)
            const color = gradientOrColor(colorOpt, t, sc)
            schedule(idx, action.count, () => {
              spawn(sx, sy, color, angle, Math.random() * 0.6 + 0.75, 0, 0)
            })
          })
          break
        }
        case "spiral": {
          const startAngle = Math.random() * PI_2
          for (let i = 0; i < action.count; i++) {
            const t = action.count === 1 ? 0 : i / (action.count - 1)
            const angle = startAngle + t * action.turns * PI_2
            const color = gradientOrColor(colorOpt, t, sc)
            const speedMult = (0.3 + t * 0.7) * speed * 2.2
            schedule(i, action.count, () => {
              spawn(sx, sy, color, angle, speedMult, svx, svy)
            })
          }
          break
        }
        case "ring": {
          const startAngle = Math.random() * PI_2
          const R = 45
          for (let i = 0; i < action.count; i++) {
            const t = action.count <= 1 ? 0 : i / action.count
            const theta = startAngle + t * PI_2
            const color = gradientOrColor(colorOpt, t, sc)
            const px = Math.cos(theta) * R
            const py = Math.sin(theta) * R
            const speedAngle = Math.atan2(px, py)
            schedule(i, action.count, () => {
              spawn(sx + px, sy + py, color, speedAngle, speed * 2, svx, svy)
            })
          }
          break
        }
        case "wave": {
          const W = 120, A = 30
          for (let i = 0; i < action.count; i++) {
            const t = action.count <= 1 ? 0 : i / (action.count - 1)
            const color = gradientOrColor(colorOpt, t, sc)
            const px = (t - 0.5) * W
            const py = Math.sin(t * action.waves * PI_2) * A
            const speedAngle = Math.atan2(px, py)
            schedule(i, action.count, () => {
              spawn(sx + px, sy + py, color, speedAngle, speed * 2, svx, svy)
            })
          }
          break
        }
        case "heart": {
          const S = 2.8
          for (let i = 0; i < action.count; i++) {
            const pt = action.count <= 1 ? 0 : i / (action.count - 1)
            const color = gradientOrColor(colorOpt, pt, sc)
            const th = (i / action.count) * PI_2
            const px = S * 16 * Math.pow(Math.sin(th), 3)
            const py = -S * (13 * Math.cos(th) - 5 * Math.cos(2 * th) - 2 * Math.cos(3 * th) - Math.cos(4 * th))
            const speedAngle = Math.atan2(px, py)
            schedule(i, action.count, () => {
              spawn(sx + px, sy + py, color, speedAngle, speed * 2, svx, svy)
            })
          }
          break
        }
        case "star": {
          const R = 52
          const points = Math.max(3, Math.round(action.param || 5))
          const inner = R * 0.4
          const verts: [number, number][] = []
          for (let i = 0; i < points * 2; i++) {
            const rad = i % 2 === 0 ? R : inner
            const a = -Math.PI / 2 + (i * Math.PI) / points
            verts.push([Math.cos(a) * rad, Math.sin(a) * rad])
          }
          const pts = sampleOutline(action.count, verts)
          pts.forEach(([px, py], i) => {
            const t = action.count <= 1 ? 0 : i / (action.count - 1)
            const color = gradientOrColor(colorOpt, t, sc)
            const speedAngle = Math.atan2(px, py)
            schedule(i, action.count, () => spawn(sx + px, sy + py, color, speedAngle, speed * 2, svx, svy))
          })
          break
        }
        case "cross": {
          const L = 52, w = 14
          const verts: [number, number][] = [
            [-w, -L], [w, -L], [w, -w], [L, -w], [L, w], [w, w], [w, L], [-w, L], [-w, w], [-L, w], [-L, -w], [-w, -w],
          ]
          const pts = sampleOutline(action.count, verts)
          pts.forEach(([px, py], i) => {
            const t = action.count <= 1 ? 0 : i / (action.count - 1)
            const color = gradientOrColor(colorOpt, t, sc)
            const speedAngle = Math.atan2(px, py)
            schedule(i, action.count, () => spawn(sx + px, sy + py, color, speedAngle, speed * 2, svx, svy))
          })
          break
        }
        case "snowflake": {
          const R = 50
          const spokes = Math.max(3, Math.round(action.param || 6))
          const segs: [number, number, number, number][] = []
          for (let k = 0; k < spokes; k++) {
            const a = (k / spokes) * PI_2
            const ex = Math.cos(a) * R
            const ey = Math.sin(a) * R
            segs.push([0, 0, ex, ey])
            const branch = R * 0.45
            const mx = Math.cos(a) * branch
            const my = Math.sin(a) * branch
            segs.push([mx, my, mx + Math.cos(a + Math.PI / 3) * R * 0.32, my + Math.sin(a + Math.PI / 3) * R * 0.32])
            segs.push([mx, my, mx + Math.cos(a - Math.PI / 3) * R * 0.32, my + Math.sin(a - Math.PI / 3) * R * 0.32])
          }
          const pts = sampleSegments(action.count, segs)
          pts.forEach(([px, py], i) => {
            const t = action.count <= 1 ? 0 : i / (action.count - 1)
            const color = gradientOrColor(colorOpt, t, sc)
            const speedAngle = Math.atan2(px, py)
            schedule(i, action.count, () => spawn(sx + px, sy + py, color, speedAngle, speed * 2, svx, svy))
          })
          break
        }
        case "flower": {
          const petals = Math.max(3, Math.round(action.param || 6))
          const R = 40, pr = 20
          for (let i = 0; i < action.count; i++) {
            const t = action.count <= 1 ? 0 : i / (action.count - 1)
            const petal = i % petals
            const petalAngle = (petal / petals) * PI_2
            const cx = Math.cos(petalAngle) * R
            const cy = Math.sin(petalAngle) * R
            const a = (i / action.count) * PI_2 * petals
            const px = cx + Math.cos(a) * pr
            const py = cy + Math.sin(a) * pr
            const color = gradientOrColor(colorOpt, t, sc)
            const speedAngle = Math.atan2(px, py)
            schedule(i, action.count, () => spawn(sx + px, sy + py, color, speedAngle, speed * 2, svx, svy))
          }
          break
        }
        case "square": {
          const R = 46
          const verts: [number, number][] = [[-R, -R], [R, -R], [R, R], [-R, R]]
          const pts = sampleOutline(action.count, verts)
          pts.forEach(([px, py], i) => {
            const t = action.count <= 1 ? 0 : i / (action.count - 1)
            const color = gradientOrColor(colorOpt, t, sc)
            const speedAngle = Math.atan2(px, py)
            schedule(i, action.count, () => spawn(sx + px, sy + py, color, speedAngle, speed * 2, svx, svy))
          })
          break
        }
        case "triangle": {
          const R = 52
          const verts: [number, number][] = [[0, -R], [R, R], [-R, R]]
          const pts = sampleOutline(action.count, verts)
          pts.forEach(([px, py], i) => {
            const t = action.count <= 1 ? 0 : i / (action.count - 1)
            const color = gradientOrColor(colorOpt, t, sc)
            const speedAngle = Math.atan2(px, py)
            schedule(i, action.count, () => spawn(sx + px, sy + py, color, speedAngle, speed * 2, svx, svy))
          })
          break
        }
        case "arrow": {
          const L = 54, w = 8, hw = 24
          const verts: [number, number][] = [
            [-w, L], [w, L], [w, 6], [hw, 6], [0, -L], [-hw, 6], [-w, 6],
          ]
          const pts = sampleOutline(action.count, verts)
          pts.forEach(([px, py], i) => {
            const t = action.count <= 1 ? 0 : i / (action.count - 1)
            const color = gradientOrColor(colorOpt, t, sc)
            const speedAngle = Math.atan2(px, py)
            schedule(i, action.count, () => spawn(sx + px, sy + py, color, speedAngle, speed * 2, svx, svy))
          })
          break
        }
        case "rain": {
          const spread = 1.2
          for (let i = 0; i < action.count; i++) {
            const t = action.count <= 1 ? 0 : i / (action.count - 1)
            const color = gradientOrColor(colorOpt, t, sc)
            const px = (t - 0.5) * 90
            const angle = (t - 0.5) * spread
            schedule(i, action.count, () => {
              const s = spawn(sx + px, sy, color, angle, speed * 1.6, svx, svy)
              if (gravity === undefined) s.gravity = 1.6
            })
          }
          break
        }
        case "vortex": {
          const startAngle = Math.random() * PI_2
          const R = 60
          for (let i = 0; i < action.count; i++) {
            const t = action.count <= 1 ? 0 : i / (action.count - 1)
            const angle = startAngle + t * action.turns * PI_2
            const radius = R * Math.sqrt(t)
            const px = Math.cos(angle) * radius
            const py = Math.sin(angle) * radius
            const color = gradientOrColor(colorOpt, t, sc)
            const speedAngle = Math.atan2(px, py)
            schedule(i, action.count, () => spawn(sx + px, sy + py, color, speedAngle, speed * 1.8, svx, svy))
          }
          break
        }
        case "fountain": {
          const spread = 0.9
          for (let i = 0; i < action.count; i++) {
            const t = action.count <= 1 ? 0 : i / (action.count - 1)
            const color = gradientOrColor(colorOpt, t, sc)
            const angle = Math.PI + (t - 0.5) * spread
            schedule(i, action.count, () => {
              const s = spawn(sx, sy, color, angle, speed * 2.4, svx, svy)
              if (gravity === undefined) s.gravity = 1.8
            })
          }
          break
        }
        case "galaxy": {
          const arms = Math.max(1, Math.round(action.arms || 2))
          const R = 60
          for (let i = 0; i < action.count; i++) {
            const t = action.count <= 1 ? 0 : i / (action.count - 1)
            const arm = i % arms
            const angle = (arm / arms) * PI_2 + t * PI_2 * 2
            const radius = R * (0.15 + 0.85 * t)
            const jitter = (Math.random() - 0.5) * 8
            const px = Math.cos(angle) * radius + jitter
            const py = Math.sin(angle) * radius + jitter
            const color = gradientOrColor(colorOpt, t, sc)
            const speedAngle = Math.atan2(px, py)
            schedule(i, action.count, () => spawn(sx + px, sy + py, color, speedAngle, speed * 1.6, svx, svy))
          }
          break
        }
        case "text": {
          const dots = textDots((action.text || "LOVE").toUpperCase())
          if (dots.length === 0) break
          const scale = 6
          const cols = dots.map((d) => d[0])
          const rows = dots.map((d) => d[1])
          const cx = (Math.min(...cols) + Math.max(...cols)) / 2
          const cy = (Math.min(...rows) + Math.max(...rows)) / 2
          for (let i = 0; i < action.count; i++) {
            const d = dots[i % dots.length]
            const px = (d[0] - cx) * scale
            const py = (d[1] - cy) * scale
            const t = action.count <= 1 ? 0 : i / (action.count - 1)
            const color = gradientOrColor(colorOpt, t, sc)
            const speedAngle = Math.atan2(px, py)
            schedule(i, action.count, () => spawn(sx + px, sy + py, color, speedAngle, speed * 1.4, svx, svy))
          }
          break
        }
      }
    }
  }
}

function buildShellOptions(shell: ParsedShell): ShellOptions {
  const p = shell.props
  const hasOnDeath = shell.onDeath.length > 0

  return {
    shellSize: 1,
    spreadSize: typeof p.size === "number" ? p.size : 300,
    starLife: typeof p.life === "number" ? p.life : 900,
    starLifeVariation: typeof p.lifeVariation === "number" ? p.lifeVariation : 0.125,
    starDensity: typeof p.density === "number" ? p.density : 1,
    starCount: typeof p.starCount === "number" ? p.starCount : undefined,
    color: resolveShellColor(p.color),
    secondColor: typeof p.secondColor === "string" ? p.secondColor : null,
    glitter: typeof p.glitter === "string" ? p.glitter : "",
    glitterColor: typeof p.glitterColor === "string" ? p.glitterColor : undefined,
    ring: p.ring === true,
    horsetail: p.horsetail === true,
    strobe: p.strobe === true,
    strobeColor: typeof p.strobeColor === "string" ? p.strobeColor : null,
    pistil: p.pistil === true,
    pistilColor: typeof p.pistilColor === "string" ? p.pistilColor : undefined,
    streamers: p.streamers === true,
    crossette: p.crossette === true,
    crackle: p.crackle === true,
    floral: p.floral === true,
    fallingLeaves: p.fallingLeaves === true,
    gravity: typeof p.gravity === "number" ? p.gravity : 1,
    fade: typeof p.fade === "number" ? p.fade : 1,
    launchHeight: typeof p.launchHeight === "number" ? p.launchHeight : undefined,
    onDeath: hasOnDeath ? compileOnDeath(shell.onDeath) : undefined,
  }
}

function resolveShellColor(v: unknown): string | string[] | undefined {
  if (Array.isArray(v)) return v as string[]
  if (typeof v === "string") {
    if (v === "random") return "random"
    if (v === "none") return INVISIBLE
    return v
  }
  return undefined
}

export function loadShellScript(text: string): ShellLoadResult {
  const { shells, errors } = parseShellScript(text)
  const registered: string[] = []

  for (const shell of shells) {
    if (!shell.name) {
      errors.push({ message: "缺少 name 属性", line: 0, col: 0 })
      continue
    }

    const opts = buildShellOptions(shell)

    const factory: ShellFactory = (size: number = 1): ShellOptions => ({
      ...opts,
      shellSize: size,
      spreadSize: (typeof opts.spreadSize === "number" ? opts.spreadSize : 300) + (size - 1) * 50,
      starLife: (typeof opts.starLife === "number" ? opts.starLife : 900) + (size - 1) * 100,
    })

    shellTypes[shell.name] = factory
    shellNameMap[shell.name] = shell.name
    registered.push(shell.name)
  }

  return { success: errors.length === 0, shells: registered, errors }
}
