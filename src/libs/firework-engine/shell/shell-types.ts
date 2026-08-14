import { PI_2, COLOR, INVISIBLE } from "../utils/constants"
import { randomColor, whiteOrGold, makePistilColor } from "../effects/color-utils"
import type Firework from "../core/firework"

import type { StarData } from "../particles/star"

export interface ShellOptions {
  shellSize?: number
  spreadSize?: number
  starLife?: number
  starLifeVariation?: number
  starDensity?: number
  starCount?: number
  color?: string | string[]
  secondColor?: string | null
  glitter?: string
  glitterColor?: string
  pistil?: boolean
  pistilColor?: string
  streamers?: boolean
  crossette?: boolean
  crackle?: boolean
  floral?: boolean
  fallingLeaves?: boolean
  strobe?: boolean
  strobeColor?: string | null
  ring?: boolean
  horsetail?: boolean
  onDeath?: (star: StarData, fw: Firework) => void
}

export type ShellFactory = (size?: number, fw?: Firework) => ShellOptions

export function crysanthemumShell(size: number = 1, fw?: Firework): ShellOptions {
  const isLowQuality = fw!.isLowQuality
  const isHighQuality = fw!.isHighQuality
  const glitter = Math.random() < 0.25
  const singleColor = Math.random() < 0.72
  const color = singleColor
    ? randomColor({ limitWhite: true })
    : [randomColor(), randomColor({ notSame: true })]
  const pistil = singleColor && Math.random() < 0.42
  const pistilColor = pistil
    ? makePistilColor(typeof color === "string" ? color : color[0])
    : undefined
  const secondColor =
    singleColor && (Math.random() < 0.2 || color === COLOR.White)
      ? pistilColor || randomColor({ notColor: typeof color === "string" ? color : "", limitWhite: true })
      : null
  const streamers = !pistil && color !== COLOR.White && Math.random() < 0.42
  let starDensity = glitter ? 1.1 : 1.25
  if (isLowQuality) starDensity *= 0.8
  if (isHighQuality) starDensity = 1.2
  return {
    shellSize: size, spreadSize: 300 + size * 100, starLife: 900 + size * 200,
    starDensity, color: color as string | string[], secondColor,
    glitter: glitter ? "light" : "", glitterColor: whiteOrGold(), pistil, pistilColor, streamers,
  }
}

export function ghostShell(size: number = 1, fw?: Firework): ShellOptions {
  const shell = crysanthemumShell(size, fw)
  shell.starLife = shell.starLife! * 1.5
  const ghostColor = randomColor({ notColor: COLOR.White })
  shell.streamers = true
  const pistil = Math.random() < 0.42
  shell.color = INVISIBLE
  shell.secondColor = ghostColor
  shell.glitter = ""
  shell.pistil = pistil
  shell.pistilColor = pistil ? makePistilColor(ghostColor) : undefined
  return shell
}

export function strobeShell(size: number = 1, _fw?: Firework): ShellOptions {
  const color = randomColor({ limitWhite: true })
  return {
    shellSize: size, spreadSize: 280 + size * 92, starLife: 1100 + size * 200,
    starLifeVariation: 0.4, starDensity: 1.1, color,
    glitter: "light", glitterColor: COLOR.White, strobe: true,
    strobeColor: Math.random() < 0.5 ? COLOR.White : null,
    pistil: Math.random() < 0.5, pistilColor: makePistilColor(color),
  }
}

export function palmShell(size: number = 1, _fw?: Firework): ShellOptions {
  const color = randomColor()
  const thick = Math.random() < 0.5
  return {
    shellSize: size, color, spreadSize: 250 + size * 75,
    starDensity: thick ? 0.15 : 0.4, starLife: 1800 + size * 200,
    glitter: thick ? "thick" : "heavy",
  }
}

export function ringShell(size: number = 1, _fw?: Firework): ShellOptions {
  const color = randomColor()
  const pistil = Math.random() < 0.75
  return {
    shellSize: size, ring: true, color, spreadSize: 300 + size * 100,
    starLife: 900 + size * 200, starCount: 2.2 * PI_2 * (size + 1), pistil,
    pistilColor: makePistilColor(color),
    glitter: !pistil ? "light" : "",
    glitterColor: color === COLOR.Gold ? COLOR.Gold : COLOR.White,
    streamers: Math.random() < 0.3,
  }
}

export function crossetteShell(size: number = 1, _fw?: Firework): ShellOptions {
  const color = randomColor({ limitWhite: true })
  return {
    shellSize: size, spreadSize: 300 + size * 100, starLife: 750 + size * 160,
    starLifeVariation: 0.4, starDensity: 0.85, color, crossette: true,
    pistil: Math.random() < 0.5, pistilColor: makePistilColor(color),
  }
}

export function floralShell(size: number = 1, _fw?: Firework): ShellOptions {
  return {
    shellSize: size, spreadSize: 300 + size * 120, starDensity: 0.12,
    starLife: 500 + size * 50, starLifeVariation: 0.5,
    color: Math.random() < 0.65 ? "random" : (Math.random() < 0.15 ? randomColor() : [randomColor(), randomColor({ notSame: true })]),
    floral: true,
  }
}

export function fallingLeavesShell(size: number = 1, _fw?: Firework): ShellOptions {
  return {
    shellSize: size, color: INVISIBLE, spreadSize: 300 + size * 120,
    starDensity: 0.12, starLife: 500 + size * 50, starLifeVariation: 0.5,
    glitter: "medium", glitterColor: COLOR.Gold, fallingLeaves: true,
  }
}

export function willowShell(size: number = 1, _fw?: Firework): ShellOptions {
  return {
    shellSize: size, spreadSize: 300 + size * 100, starDensity: 0.6,
    starLife: 3000 + size * 300, glitter: "willow",
    glitterColor: COLOR.Gold, color: INVISIBLE,
  }
}

export function crackleShell(size: number = 1, fw?: Firework): ShellOptions {
  const isLowQuality = fw!.isLowQuality
  const color = Math.random() < 0.75 ? COLOR.Gold : randomColor()
  return {
    shellSize: size, spreadSize: 380 + size * 75, starDensity: isLowQuality ? 0.65 : 1,
    starLife: 600 + size * 100, starLifeVariation: 0.32, glitter: "light",
    glitterColor: COLOR.Gold, color, crackle: true,
    pistil: Math.random() < 0.65, pistilColor: makePistilColor(color),
  }
}

export function horsetailShell(size: number = 1, _fw?: Firework): ShellOptions {
  const color = randomColor()
  return {
    shellSize: size, horsetail: true, color, spreadSize: 250 + size * 38,
    starDensity: 0.9, starLife: 2500 + size * 300, glitter: "medium",
    glitterColor: Math.random() < 0.5 ? whiteOrGold() : color,
    strobe: color === COLOR.White,
  }
}

export const shellTypes: Record<string, ShellFactory> = {
  Random: () => ({}) as ShellOptions,
  Crackle: crackleShell,
  Crossette: crossetteShell,
  Crysanthemum: crysanthemumShell,
  "Falling Leaves": fallingLeavesShell,
  Floral: floralShell,
  Ghost: ghostShell,
  "Horse Tail": horsetailShell,
  Palm: palmShell,
  Ring: ringShell,
  Strobe: strobeShell,
  Willow: willowShell,
}

export const shellNames = Object.keys(shellTypes)
export const fastShellBlacklist = ["Falling Leaves", "Floral", "Willow"]

export const shellNameMap: Record<string, string> = {
  Random: "随机", Crackle: "噼啪", Crossette: "十字星",
  Crysanthemum: "菊花", "Falling Leaves": "落叶", Floral: "花簇",
  Ghost: "幽灵", "Horse Tail": "马尾", Palm: "棕榈",
  Ring: "环形", Strobe: "频闪", Willow: "杨柳",
}
