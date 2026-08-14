export interface StarData {
  visible: boolean
  heavy: boolean
  gravity: number
  fade: number
  x: number; y: number
  prevX: number; prevY: number
  color: string
  speedX: number; speedY: number
  life: number; fullLife: number
  spinAngle: number; spinSpeed: number; spinRadius: number
  sparkFreq: number; sparkSpeed: number; sparkTimer: number
  sparkColor: string
  sparkLife: number; sparkLifeVariation: number
  strobe: boolean; strobeFreq?: number
  secondColor: string | null
  transitionTime: number
  colorChanged: boolean
  updateFrame: number
  onDeath: ((star: StarData) => void) | null
}

export const Star = {
  drawWidth: 3,
  airDrag: 0.98,
  airDragHeavy: 0.992,
}
