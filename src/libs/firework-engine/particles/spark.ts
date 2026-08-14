export interface SparkData {
  x: number; y: number
  prevX: number; prevY: number
  color: string
  speedX: number; speedY: number
  life: number
}

export const Spark = {
  drawWidth: 0,
  airDrag: 0.9,
}
