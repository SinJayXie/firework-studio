import { PI_2, PI_HALF, COLOR, INVISIBLE } from "../utils/constants"
import type { StarData } from "../particles/star"
import { createParticleArc, createBurst } from "../particles/particle-utils"
import type Firework from "../core/firework"

export function crossetteEffect(star: StarData, fw: Firework): void {
  const startAngle = Math.random() * PI_HALF
  createParticleArc(startAngle, PI_2, 4, 0.5, (angle) => {
    fw.addStar(star.x, star.y, star.color, angle, Math.random() * 0.6 + 0.75, 600)
  })
}

export function floralEffect(star: StarData, fw: Firework): void {
  const quality = fw.quality
  const count = 12 + 6 * quality
  createBurst(count, (angle, speedMult) => {
    fw.addStar(star.x, star.y, star.color, angle, speedMult * 2.4, 1000 + Math.random() * 300, star.speedX, star.speedY)
  })
  fw.addBurstFlash(star.x, star.y, 46)
}

export function fallingLeavesEffect(star: StarData, fw: Firework): void {
  createBurst(7, (angle, speedMult) => {
    const newStar = fw.addStar(star.x, star.y, INVISIBLE, angle, speedMult * 2.4, 2400 + Math.random() * 600, star.speedX, star.speedY)
    newStar.sparkColor = COLOR.Gold
    newStar.sparkFreq = 144 / fw.quality
    newStar.sparkSpeed = 0.28
    newStar.sparkLife = 750
    newStar.sparkLifeVariation = 3.2
  })
  fw.addBurstFlash(star.x, star.y, 46)
}

export function crackleEffect(star: StarData, fw: Firework): void {
  const isHighQuality = fw.isHighQuality
  const count = isHighQuality ? 32 : 16
  createParticleArc(0, PI_2, count, 1.8, (angle) => {
    fw.addSpark(star.x, star.y, COLOR.Gold, angle, Math.pow(Math.random(), 0.45) * 2.4, 300 + Math.random() * 200)
  })
}
