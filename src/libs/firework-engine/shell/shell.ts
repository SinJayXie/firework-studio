import MyMath from "../utils/my-math"
import { PI_2, COLOR, INVISIBLE } from "../utils/constants"
import type Firework from "../core/firework"
import type { StarData } from "../particles/star"
import { randomColor } from "../effects/color-utils"
import { createParticleArc, createBurst } from "../particles/particle-utils"
import { crossetteEffect, crackleEffect, floralEffect, fallingLeavesEffect } from "../effects/effects"
import type { ShellOptions } from "./shell-types"

export default class Shell {
  shellSize!: number
  spreadSize!: number
  starLife!: number
  starLifeVariation!: number
  starDensity!: number
  starCount!: number
  color!: string | string[]
  secondColor!: string | null
  glitter!: string
  glitterColor!: string
  pistil!: boolean
  pistilColor!: string
  streamers!: boolean
  crossette!: boolean
  crackle!: boolean
  floral!: boolean
  fallingLeaves!: boolean
  strobe!: boolean
  strobeColor!: string | null
  ring!: boolean
  horsetail!: boolean
  onDeath?: (star: StarData, fw: Firework) => void
  comet!: StarData

  constructor(options: ShellOptions) {
    Object.assign(this, options)
    this.starLifeVariation = options.starLifeVariation || 0.125
    this.color = options.color || randomColor()
    this.glitterColor = options.glitterColor || (typeof this.color === "string" ? this.color : this.color[0])
    if (!this.starCount) {
      const density = options.starDensity || 1
      const scaledSize = this.spreadSize / 54
      this.starCount = Math.max(6, scaledSize * scaledSize * density)
    }
  }

  launch(position: number, launchHeight: number, fw: Firework): void {
    const width = fw.stageW
    const height = fw.stageH
    const hpad = 60; const vpad = 50
    const minHeightPercent = 0.45
    const minHeight = height - height * minHeightPercent
    const launchX = position * (width - hpad * 2) + hpad
    const launchY = height
    const burstY = minHeight - launchHeight * (minHeight - vpad)
    const launchDistance = launchY - burstY
    const launchVelocity = Math.pow(launchDistance * 0.04, 0.64)

    const comet = (this.comet = fw.addStar(
      launchX, launchY,
      typeof this.color === "string" && this.color !== "random" ? this.color : COLOR.White,
      Math.PI,
      launchVelocity * (this.horsetail ? 1.2 : 1),
      launchVelocity * (this.horsetail ? 100 : 400),
    ))

    comet.heavy = true
    comet.spinRadius = MyMath.random(0.32, 0.85)
    comet.sparkFreq = 32 / fw.quality
    if (fw.isHighQuality) comet.sparkFreq = 8
    comet.sparkLife = 320
    comet.sparkLifeVariation = 3
    if (this.glitter === "willow" || this.fallingLeaves) {
      comet.sparkFreq = 20 / fw.quality
      comet.sparkSpeed = 0.5; comet.sparkLife = 500
    }
    if (this.color === INVISIBLE) { comet.sparkColor = COLOR.Gold }

    if (Math.random() > 0.4 && !this.horsetail) {
      comet.secondColor = INVISIBLE
      comet.transitionTime = Math.pow(Math.random(), 1.5) * 700 + 500
    }

    comet.onDeath = (_c: StarData) => this.burst(_c.x, _c.y, fw)
  }

  burst(x: number, y: number, fw: Firework): void {
    const speed = this.spreadSize / 96
    let color: string | null = null
    let onDeath: ((star: StarData) => void) | undefined
    let sparkFreq: number = 0
    let sparkSpeed: number = 0
    let sparkLife: number = 0
    let sparkLifeVariation = 0.25

    // 内置死亡特效（crossette / crackle / floral / fallingLeaves）— 全部可叠加
    const builtinOnDeathFns: ((star: StarData) => void)[] = []
    if (this.crossette) builtinOnDeathFns.push((star: StarData) => { crossetteEffect(star, fw) })
    if (this.crackle) builtinOnDeathFns.push((star: StarData) => { crackleEffect(star, fw) })
    if (this.floral) builtinOnDeathFns.push((star: StarData) => { floralEffect(star, fw) })
    if (this.fallingLeaves) builtinOnDeathFns.push((star: StarData) => { fallingLeavesEffect(star, fw) })
    const builtinOnDeath: ((star: StarData) => void) | undefined =
      builtinOnDeathFns.length > 0
        ? (star: StarData) => builtinOnDeathFns.forEach(fn => fn(star))
        : undefined

    // 组合：内置特效先执行，shell onDeath 后执行
    const shellOnDeath = this.onDeath
    if (builtinOnDeath && shellOnDeath) {
      onDeath = (star: StarData) => { builtinOnDeath!(star); shellOnDeath(star, fw) }
    } else if (builtinOnDeath) {
      onDeath = builtinOnDeath
    } else if (shellOnDeath) {
      onDeath = (star: StarData) => shellOnDeath(star, fw)
    }

    if (this.glitter === "light") {
      sparkFreq = 400; sparkSpeed = 0.3; sparkLife = 300; sparkLifeVariation = 2
    } else if (this.glitter === "medium") {
      sparkFreq = 200; sparkSpeed = 0.44; sparkLife = 700; sparkLifeVariation = 2
    } else if (this.glitter === "heavy") {
      sparkFreq = 80; sparkSpeed = 0.8; sparkLife = 1400; sparkLifeVariation = 2
    } else if (this.glitter === "thick") {
      sparkFreq = 16; sparkSpeed = fw.isHighQuality ? 1.65 : 1.5; sparkLife = 1400; sparkLifeVariation = 3
    } else if (this.glitter === "streamer") {
      sparkFreq = 32; sparkSpeed = 1.05; sparkLife = 620; sparkLifeVariation = 2
    } else if (this.glitter === "willow") {
      sparkFreq = 120; sparkSpeed = 0.34; sparkLife = 1400; sparkLifeVariation = 3.8
    }

    sparkFreq = sparkFreq / fw.quality
    const standardInitialSpeed = this.spreadSize / 1800

    const starFactory = (angle: number, speedMult: number) => {
      const star = fw.addStar(
        x, y, color || randomColor(), angle, speedMult * speed,
        this.starLife + Math.random() * this.starLife * this.starLifeVariation,
        this.horsetail ? this.comet && this.comet.speedX : 0,
        this.horsetail ? this.comet && this.comet.speedY : -standardInitialSpeed,
      )
      if (this.secondColor) {
        star.transitionTime = this.starLife * (Math.random() * 0.05 + 0.32)
        star.secondColor = this.secondColor
      }
      if (this.strobe) {
        star.transitionTime = this.starLife * (Math.random() * 0.08 + 0.46)
        star.strobe = true; star.strobeFreq = Math.random() * 20 + 40
        if (this.strobeColor) { star.secondColor = this.strobeColor }
      }
      star.onDeath = onDeath || null
      if (this.glitter) {
        star.sparkFreq = sparkFreq; star.sparkSpeed = sparkSpeed
        star.sparkLife = sparkLife; star.sparkLifeVariation = sparkLifeVariation
        star.sparkColor = this.glitterColor; star.sparkTimer = Math.random() * star.sparkFreq
      }
    }

    // 提取通用效果应用，供 ring 分支复用以确保全特效兼容
    const applyStarProps = (star: StarData) => {
      if (this.secondColor) {
        star.transitionTime = this.starLife * (Math.random() * 0.05 + 0.32)
        star.secondColor = this.secondColor
      }
      if (this.strobe) {
        star.transitionTime = this.starLife * (Math.random() * 0.08 + 0.46)
        star.strobe = true; star.strobeFreq = Math.random() * 20 + 40
        if (this.strobeColor) { star.secondColor = this.strobeColor }
      }
      star.onDeath = onDeath || null
      if (this.glitter) {
        star.sparkFreq = sparkFreq; star.sparkSpeed = sparkSpeed
        star.sparkLife = sparkLife; star.sparkLifeVariation = sparkLifeVariation
        star.sparkColor = this.glitterColor; star.sparkTimer = Math.random() * star.sparkFreq
      }
    }

    if (typeof this.color === "string") {
      if (this.color === "random") { color = null } else { color = this.color }
      if (this.ring) {
        const ringStartAngle = Math.random() * Math.PI
        const ringSquash = Math.pow(Math.random(), 2) * 0.85 + 0.15
        createParticleArc(0, PI_2, this.starCount, 0, (angle) => {
          const initSpeedX = Math.sin(angle) * speed * ringSquash
          const initSpeedY = Math.cos(angle) * speed
          const newSpeed = MyMath.pointDist(0, 0, initSpeedX, initSpeedY)
          const newAngle = MyMath.pointAngle(0, 0, initSpeedX, initSpeedY) + ringStartAngle
          const star = fw.addStar(x, y, color!, newAngle, newSpeed,
            this.starLife + Math.random() * this.starLife * this.starLifeVariation,
            this.horsetail ? this.comet && this.comet.speedX : 0,
            this.horsetail ? this.comet && this.comet.speedY : 0)
          applyStarProps(star)
        })
      } else {
        createBurst(this.starCount, starFactory)
      }
    } else if (Array.isArray(this.color)) {
      if (this.ring) {
        const ringStartAngle = Math.random() * Math.PI
        const ringSquash = Math.pow(Math.random(), 2) * 0.85 + 0.15
        const colors = this.color as string[]
        createParticleArc(0, PI_2, this.starCount, 0, (angle) => {
          const initSpeedX = Math.sin(angle) * speed * ringSquash
          const initSpeedY = Math.cos(angle) * speed
          const newSpeed = MyMath.pointDist(0, 0, initSpeedX, initSpeedY)
          const newAngle = MyMath.pointAngle(0, 0, initSpeedX, initSpeedY) + ringStartAngle
          const star = fw.addStar(x, y, colors[Math.floor(Math.random() * colors.length)], newAngle, newSpeed,
            this.starLife + Math.random() * this.starLife * this.starLifeVariation,
            this.horsetail ? this.comet && this.comet.speedX : 0,
            this.horsetail ? this.comet && this.comet.speedY : 0)
          applyStarProps(star)
        })
      } else if (Math.random() < 0.5) {
        // 扇形分区：每个颜色占据一段弧
        const colors = this.color as string[]
        const numColors = colors.length
        const arcPerColor = PI_2 / numColors
        const startOffset = Math.random() * Math.PI
        for (let i = 0; i < numColors; i++) {
          color = colors[i]
          const startAngle = startOffset + i * arcPerColor
          createBurst(this.starCount / numColors, starFactory, startAngle, arcPerColor)
        }
      } else {
        // 交错混合：每个颜色生成一轮
        const colors = this.color as string[]
        const numColors = colors.length
        for (let i = 0; i < numColors; i++) {
          color = colors[i]
          createBurst(this.starCount / numColors, starFactory)
        }
      }
    }

    if (this.pistil) {
      const innerShell = new Shell({
        spreadSize: this.spreadSize * 0.5, starLife: this.starLife * 0.6,
        starLifeVariation: this.starLifeVariation, starDensity: 1.4,
        color: this.pistilColor, glitter: "light",
        glitterColor: this.pistilColor === COLOR.Gold ? COLOR.Gold : COLOR.White,
      })
      innerShell.burst(x, y, fw)
    }

    if (this.streamers) {
      const innerShell = new Shell({
        spreadSize: this.spreadSize * 0.9, starLife: this.starLife * 0.8,
        starLifeVariation: this.starLifeVariation,
        starCount: Math.floor(Math.max(6, this.spreadSize / 45)),
        color: COLOR.White, glitter: "streamer",
      })
      innerShell.burst(x, y, fw)
    }

    fw.addBurstFlash(x, y, this.spreadSize / 4)
  }
}
