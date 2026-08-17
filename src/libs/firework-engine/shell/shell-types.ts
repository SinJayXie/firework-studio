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
  gravity?: number
  fade?: number
  launchHeight?: number
  onDeath?: (star: StarData, fw: Firework) => void
}

export type ShellFactory = (size?: number, fw?: Firework) => ShellOptions

// 内置烟花已迁移到 shell/*.shell，运行时扫描自动加载注册。
// 这里仅保留 Random 占位，实际逻辑由 Firework 构造时覆盖为「随机选择已加载烟花」。
export const shellTypes: Record<string, ShellFactory> = {
  Random: () => ({}) as ShellOptions,
}

export const shellNames = Object.keys(shellTypes)

export const shellNameMap: Record<string, string> = {
  Random: "随机",
}
