// shell-loader.ts — 加载解析后的 shell 并注册到系统

import { parseShellScript } from "./shell-parser"
import type { ParsedShell, OnDeathAction, ShellParseError } from "./shell-parser"
import { shellTypes, shellNameMap, type ShellOptions, type ShellFactory } from "./shell-types"
import type { StarData } from "../particles/star"
import { createBurst, createParticleArc } from "../particles/particle-utils"
import { PI_2 } from "../utils/constants"
import type Firework from "../core/firework"

export interface ShellLoadResult {
  success: boolean
  shells: string[]
  errors: ShellParseError[]
}

function compileOnDeath(actions: OnDeathAction[]): (star: StarData, fw: Firework) => void {
  return (star: StarData, fw: Firework) => {
    for (const action of actions) {
      switch (action.type) {
        case "burst": {
          const color = resolveColor(action.options.color, star.color)
          const life = typeof action.options.life === "number" ? action.options.life : 600
          const speed = typeof action.options.speed === "number" ? action.options.speed : 1
          createBurst(action.count, (angle, speedMult) => {
            fw.addStar(star.x, star.y, color, angle, speedMult * speed * 2.2, life, star.speedX, star.speedY)
          })
          break
        }
        case "flash": {
          fw.addBurstFlash(star.x, star.y, action.radius)
          break
        }
        case "arc": {
          const color = resolveColor(action.options.color, star.color)
          const life = typeof action.options.life === "number" ? action.options.life : 600
          createParticleArc(0, action.arcAngle, action.count, 0.5, (angle) => {
            fw.addStar(star.x, star.y, color, angle, Math.random() * 0.6 + 0.75, life)
          })
          break
        }
        case "spiral": {
          const color = resolveColor(action.options.color, star.color)
          const life = typeof action.options.life === "number" ? action.options.life : 600
          const speed = typeof action.options.speed === "number" ? action.options.speed : 1
          const startAngle = Math.random() * PI_2
          for (let i = 0; i < action.count; i++) {
            const t = action.count === 1 ? 0 : i / (action.count - 1)
            const angle = startAngle + t * action.turns * PI_2
            const speedMult = (0.3 + t * 0.7) * speed * 2.2
            fw.addStar(star.x, star.y, color, angle, speedMult, life, star.speedX, star.speedY)
          }
          break
        }
      }
    }
  }
}

function resolveColor(colorValue: string | number | boolean | string[] | undefined, fallback: string): string {
  if (typeof colorValue === "string") {
    if (colorValue === "inherit") return fallback
    return colorValue
  }
  return fallback
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
