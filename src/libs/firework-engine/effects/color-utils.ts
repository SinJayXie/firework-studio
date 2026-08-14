import { COLOR, COLOR_CODES } from "../utils/constants"

let lastColor: string | null = null

export function randomColorSimple(): string {
  return COLOR_CODES[(Math.random() * COLOR_CODES.length) | 0]
}

export function randomColor(options?: {
  notSame?: boolean
  notColor?: string
  limitWhite?: boolean
}): string {
  let color = randomColorSimple()
  if (options?.limitWhite && color === COLOR.White && Math.random() < 0.6) {
    color = randomColorSimple()
  }
  if (options?.notSame) {
    while (color === lastColor) {
      color = randomColorSimple()
    }
  } else if (options?.notColor) {
    while (color === options.notColor) {
      color = randomColorSimple()
    }
  }
  lastColor = color
  return color
}

export function whiteOrGold(): string {
  return Math.random() < 0.5 ? COLOR.Gold : COLOR.White
}

export function makePistilColor(shellColor: string): string {
  return shellColor === COLOR.White || shellColor === COLOR.Gold
    ? randomColor({ notColor: shellColor })
    : whiteOrGold()
}
