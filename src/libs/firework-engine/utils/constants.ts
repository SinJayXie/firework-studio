export const GRAVITY = 0.9
export const PI_2 = Math.PI * 2
export const PI_HALF = Math.PI * 0.5
export const MAX_WIDTH = 7680
export const MAX_HEIGHT = 4320

export const QUALITY_LOW = 1
export const QUALITY_NORMAL = 2
export const QUALITY_HIGH = 3

export const SKY_LIGHT_NONE = 0
export const SKY_LIGHT_DIM = 1
export const SKY_LIGHT_NORMAL = 2

export const COLOR: Record<string, string> = {
  Red: "#ff0043",
  Green: "#14fc56",
  Blue: "#1e7fff",
  Purple: "#e60aff",
  Gold: "#ffbf36",
  White: "#ffffff",
}

export const INVISIBLE = "_INVISIBLE_"

export const COLOR_NAMES = Object.keys(COLOR)
export const COLOR_CODES = COLOR_NAMES.map((name) => COLOR[name])
export const COLOR_CODES_W_INVIS = [...COLOR_CODES, INVISIBLE]

export const COLOR_CODE_INDEXES: Record<string, number> = {}
COLOR_CODES_W_INVIS.forEach((code, i) => {
  COLOR_CODE_INDEXES[code] = i
})

export const COLOR_TUPLES: Record<string, { r: number; g: number; b: number }> = {}
COLOR_CODES.forEach((hex) => {
  COLOR_TUPLES[hex] = {
    r: parseInt(hex.substring(1, 3), 16),
    g: parseInt(hex.substring(3, 5), 16),
    b: parseInt(hex.substring(5, 7), 16),
  }
})
