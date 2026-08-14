import { PI_2, PI_HALF } from "../utils/constants"

export function createParticleArc(
  start: number, arcLength: number, count: number,
  randomness: number, particleFactory: (angle: number) => void,
): void {
  const angleDelta = arcLength / count
  const end = start + arcLength - angleDelta * 0.5
  if (end > start) {
    for (let angle = start; angle < end; angle = angle + angleDelta) {
      particleFactory(angle + Math.random() * angleDelta * randomness)
    }
  } else {
    for (let angle = start; angle > end; angle = angle + angleDelta) {
      particleFactory(angle + Math.random() * angleDelta * randomness)
    }
  }
}

export function createBurst(
  count: number,
  particleFactory: (angle: number, speedMult: number) => void,
  startAngle: number = 0,
  arcLength: number = PI_2,
): void {
  const R = 0.5 * Math.sqrt(count / Math.PI)
  const C = 2 * R * Math.PI
  const C_HALF = C / 2

  for (let i = 0; i <= C_HALF; i++) {
    const ringAngle = (i / C_HALF) * PI_HALF
    const ringSize = Math.cos(ringAngle)
    const partsPerFullRing = C * ringSize
    const partsPerArc = partsPerFullRing * (arcLength / PI_2)
    const angleInc = PI_2 / partsPerFullRing
    const angleOffset = Math.random() * angleInc + startAngle
    const maxRandomAngleOffset = angleInc * 0.33

    for (let j = 0; j < partsPerArc; j++) {
      const randomAngleOffset = Math.random() * maxRandomAngleOffset
      const angle = angleInc * j + angleOffset + randomAngleOffset
      particleFactory(angle, ringSize)
    }
  }
}
