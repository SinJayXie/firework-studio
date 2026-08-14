import { COLOR_CODES_W_INVIS } from "../utils/constants"

export function createParticleCollection(): Record<string, any[]> {
  const collection: Record<string, any[]> = {}
  COLOR_CODES_W_INVIS.forEach((color) => {
    collection[color] = []
  })
  return collection
}
