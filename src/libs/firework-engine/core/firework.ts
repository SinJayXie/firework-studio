import type { Renderer } from "../renderers/renderer"
import type { DirtyRect } from "../renderers/renderer"
import { Canvas2DRenderer } from "../renderers/canvas2d-renderer"
import { WebGLRenderer } from "../renderers/webgl-renderer"
import Shell from "../shell/shell"
import { Star, type StarData } from "../particles/star"
import { Spark, type SparkData } from "../particles/spark"
import type { BurstFlashData } from "../particles/burst-flash"
import {
  GRAVITY, PI_2, PI_HALF, MAX_WIDTH, MAX_HEIGHT,
  QUALITY_LOW, QUALITY_NORMAL, QUALITY_HIGH,
  SKY_LIGHT_NONE,
  COLOR_CODES_W_INVIS, COLOR_TUPLES, INVISIBLE,
} from "../utils/constants"
import { shellTypes, shellNames, fastShellBlacklist, crysanthemumShell, ringShell } from "../shell/shell-types"
import type { ShellFactory } from "../shell/shell-types"

export interface EngineConfig {
  quality: string
  shell: string
  size: string
  autoLaunch: boolean
  finale: boolean
  skyLighting: string
  hideControls: boolean
  longExposure: boolean
  scaleFactor: number
  renderer: "webgl" | "canvas2d"
  fps: number
  speed: number
  debug: boolean
}

export interface EngineState {
  paused: boolean
  menuOpen: boolean
  openHelpTopic: string | null
  fullscreen: boolean
  config: EngineConfig
}

export default class Firework {
  renderer!: Renderer
  private _canvasContainer: HTMLElement | null = null

  private _debugLines: string[] = []

  private _fpsFrames = 0
  private _fpsTime = 0
  private _fpsLastTS = 0
  private _fps = 0
  private _renderMs = 0

  state: EngineState = {
    paused: true,
    menuOpen: false,
    openHelpTopic: null,
    fullscreen: false,
    config: {
      quality: "0",
      shell: "Random",
      size: "2",
      autoLaunch: true,
      finale: false,
      skyLighting: String(SKY_LIGHT_NONE),
      hideControls: false,
      longExposure: false,
      scaleFactor: 0,
      renderer: "webgl",
      fps: 60,
      speed: 1,
      debug: false,
    },
  }

  stars: Record<string, StarData[]> = {}
  starPool: StarData[] = []
  sparks: Record<string, SparkData[]> = {}
  sparkPool: SparkData[] = []
  burstFlashes: BurstFlashData[] = []
  burstFlashPool: BurstFlashData[] = []

  _starColors: string[] = []
  _sparkColors: string[] = []

  starDrawWidth = 3
  sparkDrawWidth = 0

  _listeners = new Set<(state: EngineState, prevState: EngineState) => void>()

  stageW = 0; stageH = 0
  private _containerW = 0; private _containerH = 0
  quality = 1
  isLowQuality = false; isNormalQuality = true; isHighQuality = false
  currentFrame = 0
  autoLaunchTime = 0
  isFirstSeq = true; currentFinaleCount = 0

  IS_MOBILE = false; IS_DESKTOP = false; IS_HEADER = false; IS_HIGH_END_DEVICE = false

  currentSkyColor = { r: 0, g: 0, b: 0 }
  targetSkyColor = { r: 0, g: 0, b: 0 }

  seqSmallBarrageLastCalled = 0
  seqSmallBarrageCooldown = 15000

  finaleCount = 32
  rafId: number | null = null
  prevFrameTime: number = 0


  constructor() {
    this.detectDevice()
    this.state.config.quality = String(this.IS_HIGH_END_DEVICE ? QUALITY_HIGH : QUALITY_NORMAL)
    if (this.IS_DESKTOP) { this.state.config.size = "3" }
    else if (this.IS_HEADER) { this.state.config.size = "1.2" }
    else { this.state.config.size = "2" }
    this.state.config.hideControls = this.IS_HEADER
    this.state.config.scaleFactor = this.getDefaultScaleFactor()
    shellTypes["Random"] = (size?: number) => this.randomShell(size || 1)

    COLOR_CODES_W_INVIS.forEach((color) => {
      this.stars[color] = []
      this.sparks[color] = []
    })
  }

  private detectDevice(): void {
    this.IS_MOBILE = window.innerWidth <= 640
    this.IS_DESKTOP = window.innerWidth > 800
    this.IS_HEADER = this.IS_DESKTOP && window.innerHeight < 300
    this.IS_HIGH_END_DEVICE = (() => {
      const hwConcurrency = (navigator as any).hardwareConcurrency
      if (!hwConcurrency) return false
      const minCount = window.innerWidth <= 1024 ? 4 : 8
      return hwConcurrency >= minCount
    })()
  }

  private getDefaultScaleFactor(): number {
    if (this.IS_MOBILE) return 0.9
    if (this.IS_HEADER) return 0.75
    return 1
  }

  setState(nextState: Partial<EngineState>): void {
    const prevState = { ...this.state }
    Object.assign(this.state, nextState)
    this._listeners.forEach((listener) => listener(this.state, prevState))
  }

  subscribe(listener: (state: EngineState, prevState: EngineState) => void): () => void {
    this._listeners.add(listener)
    return () => { this._listeners.delete(listener) }
  }

  isRunning(): boolean { return !this.state.paused }
  qualitySelector(): number { return +this.state.config.quality }
  shellNameSelector(): string { return this.state.config.shell }
  shellSizeSelector(): number { return +this.state.config.size }
  finaleSelector(): boolean { return this.state.config.finale }
  skyLightingSelector(): number { return +this.state.config.skyLighting }
  scaleFactorSelector(): number { return this.state.config.scaleFactor }

  togglePause(toggle?: boolean): void {
    const paused = this.state.paused
    const newValue = typeof toggle === "boolean" ? toggle : !paused
    if (paused !== newValue) { this.setState({ paused: newValue }) }
  }

  toggleMenu(toggle?: boolean): void {
    if (typeof toggle === "boolean") { this.setState({ menuOpen: toggle }) }
    else { this.setState({ menuOpen: !this.state.menuOpen }) }
  }

  configDidUpdate(): void {
    this.quality = this.qualitySelector()
    this.isLowQuality = this.quality === QUALITY_LOW
    this.isNormalQuality = this.quality === QUALITY_NORMAL
    this.isHighQuality = this.quality === QUALITY_HIGH
    this.starDrawWidth = this.quality === QUALITY_HIGH ? 0.75 : 1
    this.sparkDrawWidth = this.quality === QUALITY_HIGH ? 0.75 : 1
    if (this.renderer instanceof Canvas2DRenderer) {
      this.renderer.setQuality(this.quality)
    }
    const newScale = this.scaleFactorSelector()
    this.stageW = this._containerW / newScale
    this.stageH = this._containerH / newScale
    this.renderer.setScaleFactor(newScale)
  }

  // ─── Renderer management ───

  switchRenderer(type: "webgl" | "canvas2d"): void {
    this.state.config.renderer = type
    this.renderer = this._createRenderer(type)
  }

  private _createRenderer(type: "webgl" | "canvas2d"): Renderer {
    const oldRenderer = this.renderer
    if (oldRenderer) {
      oldRenderer.destroy()
    }

    const renderer = type === "webgl" ? new WebGLRenderer() : new Canvas2DRenderer()

    if (this._canvasContainer) {
      const ok = renderer.init(this._canvasContainer)
      if (type === "webgl" && !ok) {
        // WebGL not supported, fall back to canvas2d
        renderer.destroy()
        return new Canvas2DRenderer()
      }
      if (renderer instanceof Canvas2DRenderer) {
        renderer.setQuality(this.quality)
      }
      this._bindClickToLaunch(renderer)
    }

    return renderer
  }

  private _bindClickToLaunch(r: Renderer): void {
    r.canvas.addEventListener("pointerdown", (e: PointerEvent) => {
      if (!this.isRunning()) return
      const rect = r.canvas.getBoundingClientRect()
      this.launchShellFromConfig({ x: e.clientX - rect.left, y: e.clientY - rect.top })
    })
  }

  // ─── Particle methods ───

  addStar(
    x: number, y: number, color: string, angle: number, speed: number, life: number,
    speedOffX = 0, speedOffY = 0,
  ): StarData {
    const instance = this.starPool.pop() || ({} as StarData)
    instance.visible = true; instance.heavy = false
    instance.gravity = 1; instance.fade = 1
    instance.x = x; instance.y = y
    instance.prevX = x; instance.prevY = y
    instance.color = color
    instance.speedX = Math.sin(angle) * speed + speedOffX
    instance.speedY = Math.cos(angle) * speed + speedOffY
    instance.life = life; instance.fullLife = life
    instance.spinAngle = Math.random() * PI_2
    instance.spinSpeed = 0.8; instance.spinRadius = 0
    instance.sparkFreq = 0; instance.sparkSpeed = 1; instance.sparkTimer = 0
    instance.sparkColor = color
    instance.sparkLife = 750; instance.sparkLifeVariation = 0.25
    instance.strobe = false
    instance.secondColor = null; instance.transitionTime = 0
    instance.colorChanged = false; instance.updateFrame = 0
    instance.onDeath = null
    if (!this.stars[color]) this.stars[color] = []
    this.stars[color].push(instance)
    return instance
  }

  addSpark(x: number, y: number, color: string, angle: number, speed: number, life: number): SparkData {
    const instance = this.sparkPool.pop() || ({} as SparkData)
    instance.x = x; instance.y = y
    instance.prevX = x; instance.prevY = y
    instance.color = color
    instance.speedX = Math.sin(angle) * speed
    instance.speedY = Math.cos(angle) * speed
    instance.life = life
    if (!this.sparks[color]) this.sparks[color] = []
    this.sparks[color].push(instance)
    return instance
  }

  addBurstFlash(x: number, y: number, radius: number): BurstFlashData {
    const instance = this.burstFlashPool.pop() || { x: 0, y: 0, radius: 0 }
    instance.x = x; instance.y = y; instance.radius = radius
    this.burstFlashes.push(instance)
    return instance
  }

  returnStar(instance: StarData): void {
    instance.onDeath && instance.onDeath(instance)
    instance.onDeath = null
    instance.secondColor = null
    instance.transitionTime = 0
    instance.colorChanged = false
    this.starPool.push(instance)
  }

  returnSpark(instance: SparkData): void { this.sparkPool.push(instance) }
  returnBurstFlash(instance: BurstFlashData): void { this.burstFlashPool.push(instance) }

  // ─── Shell sequences ───

  randomShellName(): string {
    return Math.random() < 0.5 ? "Crysanthemum" : shellNames[(Math.random() * (shellNames.length - 1) + 1) | 0]
  }

  randomShell(size: number): ReturnType<ShellFactory> {
    if (this.IS_HEADER) return this.randomFastShell()(size, this)
    return shellTypes[this.randomShellName()](size, this)
  }

  shellFromConfig(size: number): ReturnType<ShellFactory> {
    return shellTypes[this.shellNameSelector()](size, this)
  }

  randomFastShell(): ShellFactory {
    const isRandom = this.shellNameSelector() === "Random"
    let shellName = isRandom ? this.randomShellName() : this.shellNameSelector()
    if (isRandom) { while (fastShellBlacklist.includes(shellName)) { shellName = this.randomShellName() } }
    return shellTypes[shellName]
  }

  fitShellPositionInBoundsH(position: number): number { const edge = 0.18; return (1 - edge * 2) * position + edge }
  fitShellPositionInBoundsV(position: number): number { return position * 0.75 }
  getRandomShellPositionH(): number { return this.fitShellPositionInBoundsH(Math.random()) }
  getRandomShellPositionV(): number { return this.fitShellPositionInBoundsV(Math.random()) }

  getRandomShellSize(): { size: number; x: number; height: number } {
    const baseSize = this.shellSizeSelector()
    const maxVariance = Math.min(2.5, baseSize)
    const variance = Math.random() * maxVariance
    const size = baseSize - variance
    const height = maxVariance === 0 ? Math.random() : 1 - variance / maxVariance
    const centerOffset = Math.random() * (1 - height * 0.65) * 0.5
    const x = Math.random() < 0.5 ? 0.5 - centerOffset : 0.5 + centerOffset
    return { size, x: this.fitShellPositionInBoundsH(x), height: this.fitShellPositionInBoundsV(height) }
  }

  launchShellFromConfig(event?: { x: number; y: number }): void {
    const shell = new Shell(this.shellFromConfig(this.shellSizeSelector()))
    const w = this.renderer.canvas.clientWidth; const h = this.renderer.canvas.clientHeight
    shell.launch(
      event ? event.x / w : this.getRandomShellPositionH(),
      event ? 1 - event.y / h : this.getRandomShellPositionV(),
      this,
    )
  }

  seqRandomShell(): number {
    const size = this.getRandomShellSize()
    const shell = new Shell(this.shellFromConfig(size.size))
    shell.launch(size.x, size.height, this)
    let extraDelay = shell.starLife
    if (shell.fallingLeaves) extraDelay = 4600
    return 900 + Math.random() * 600 + extraDelay
  }

  seqRandomFastShell(): number {
    const shellType = this.randomFastShell()
    const size = this.getRandomShellSize()
    const shell = new Shell(shellType(size.size, this))
    shell.launch(size.x, size.height, this)
    return 900 + Math.random() * 600 + shell.starLife
  }

  seqTwoRandom(): number {
    const size1 = this.getRandomShellSize(); const size2 = this.getRandomShellSize()
    const shell1 = new Shell(this.shellFromConfig(size1.size))
    const shell2 = new Shell(this.shellFromConfig(size2.size))
    shell1.launch(0.3 + Math.random() * 0.2 - 0.1, size1.height, this)
    setTimeout(() => { shell2.launch(0.7 + Math.random() * 0.2 - 0.1, size2.height, this) }, 100)
    let extraDelay = Math.max(shell1.starLife, shell2.starLife)
    if (shell1.fallingLeaves || shell2.fallingLeaves) extraDelay = 4600
    return 900 + Math.random() * 600 + extraDelay
  }

  seqTriple(): number {
    const shellType = this.randomFastShell()
    const baseSize = this.shellSizeSelector(); const smallSize = Math.max(0, baseSize - 1.25)
    new Shell(shellType(baseSize, this)).launch(0.5 + Math.random() * 0.08 - 0.04, 0.7, this)
    setTimeout(() => { new Shell(shellType(smallSize, this)).launch(0.2 + Math.random() * 0.08 - 0.04, 0.1, this) }, 1000 + Math.random() * 400)
    setTimeout(() => { new Shell(shellType(smallSize, this)).launch(0.8 + Math.random() * 0.08 - 0.04, 0.1, this) }, 1000 + Math.random() * 400)
    return 4000
  }

  seqPyramid(): number {
    const barrageCountHalf = this.IS_DESKTOP ? 7 : 4
    const largeSize = this.shellSizeSelector(); const smallSize = Math.max(0, largeSize - 3)
    const randomMainShell = Math.random() < 0.78 ? crysanthemumShell : ringShell
    const randomSpecialShell: ShellFactory = (size: number = 1) => this.randomShell(size)

    const launchShell = (x: number, useSpecial: boolean) => {
      const isRandom = this.shellNameSelector() === "Random"
      const st = isRandom ? (useSpecial ? randomSpecialShell : randomMainShell) : shellTypes[this.shellNameSelector()]
      const shell = new Shell(st(useSpecial ? largeSize : smallSize, this))
      shell.launch(x, useSpecial ? 0.75 : (x <= 0.5 ? x / 0.5 : (1 - x) / 0.5) * 0.42, this)
    }

    let count = 0; let delay = 0
    while (count <= barrageCountHalf) {
      if (count === barrageCountHalf) { setTimeout(() => launchShell(0.5, true), delay) }
      else {
        const offset = (count / barrageCountHalf) * 0.5; const delayOffset = Math.random() * 30 + 30
        setTimeout(() => launchShell(offset, false), delay)
        setTimeout(() => launchShell(1 - offset, false), delay + delayOffset)
      }
      count++; delay += 200
    }
    return 3400 + barrageCountHalf * 250
  }

  seqSmallBarrage(): number {
    this.seqSmallBarrageLastCalled = Date.now()
    const barrageCount = this.IS_DESKTOP ? 11 : 5; const specialIndex = this.IS_DESKTOP ? 3 : 1
    const shellSize = Math.max(0, this.shellSizeSelector() - 2)
    const randomMainShell = Math.random() < 0.78 ? crysanthemumShell : ringShell
    const randomSpecialShell = this.randomFastShell()

    const launchShell = (x: number, useSpecial: boolean) => {
      const isRandom = this.shellNameSelector() === "Random"
      const st = isRandom ? (useSpecial ? randomSpecialShell : randomMainShell) : shellTypes[this.shellNameSelector()]
      const height = (Math.cos(x * 5 * Math.PI + PI_HALF) + 1) / 2
      new Shell(st(shellSize, this)).launch(x, height * 0.75, this)
    }

    let count = 0; let delay = 0
    while (count < barrageCount) {
      if (count === 0) { launchShell(0.5, false); count += 1 }
      else {
        const offset = (count + 1) / barrageCount / 2; const delayOffset = Math.random() * 30 + 30
        setTimeout(() => launchShell(0.5 + offset, count === specialIndex), delay)
        setTimeout(() => launchShell(0.5 - offset, count === specialIndex), delay + delayOffset)
        count += 2
      }
      delay += 200
    }
    return 3400 + barrageCount * 120
  }

  startSequence(): number {
    if (this.isFirstSeq) {
      this.isFirstSeq = false
      if (this.IS_HEADER) { return this.seqTwoRandom() }
      else { new Shell(crysanthemumShell(this.shellSizeSelector(), this)).launch(0.5, 0.5, this); return 2400 }
    }
    if (this.finaleSelector()) {
      this.seqRandomFastShell()
      if (this.currentFinaleCount < this.finaleCount) { this.currentFinaleCount++; return 170 }
      else { this.currentFinaleCount = 0; return 6000 }
    }
    const rand = Math.random()
    if (rand < 0.08 && Date.now() - this.seqSmallBarrageLastCalled > this.seqSmallBarrageCooldown) return this.seqSmallBarrage()
    if (rand < 0.1) return this.seqPyramid()
    if (rand < 0.6 && !this.IS_HEADER) return this.seqRandomShell()
    else if (rand < 0.8) return this.seqTwoRandom()
    else return this.seqTriple()
  }

  // ─── Lifecycle ───

  handleResize(containerW: number, containerH: number): void {
    const w = Math.min(containerW, MAX_WIDTH)
    const h = containerW <= 420 ? containerH : Math.min(containerH, MAX_HEIGHT)
    const scaleFactor = this.scaleFactorSelector()
    this._containerW = w; this._containerH = h
    this.stageW = w / scaleFactor; this.stageH = h / scaleFactor
    const dpr = window.devicePixelRatio || 1

    this.renderer.resize(
      Math.ceil(w * dpr),
      Math.ceil(h * dpr),
      this.stageW,
      this.stageH,
      dpr,
    )
    this.renderer.setScaleFactor(scaleFactor)
  }

  updateGlobals(timeStep: number, _lag: number): void {
    this.currentFrame++
    if (this.state.config.autoLaunch) {
      this.autoLaunchTime -= timeStep
      if (this.autoLaunchTime <= 0) { this.autoLaunchTime = this.startSequence() * 1.25 }
    }
  }

  update(frameTime: number, shouldRender: boolean = true): void {
    if (!this.isRunning()) return
    const frameRatio = frameTime / (1000 / 60)
    const timeStep = frameTime * this.state.config.speed
    const speed = this.state.config.speed * frameRatio
    this.updateGlobals(timeStep, frameRatio)

    const starDrag = 1 - (1 - Star.airDrag) * speed
    const starDragHeavy = 1 - (1 - Star.airDragHeavy) * speed
    const sparkDrag = 1 - (1 - Spark.airDrag) * speed
    const gAcc = (timeStep / 1000) * GRAVITY

    this._starColors = Object.keys(this.stars)
    this._sparkColors = Object.keys(this.sparks)

    // Update stars
    for (let ci = 0; ci < this._starColors.length; ci++) {
      const color = this._starColors[ci]
      const stars = this.stars[color]
      for (let i = 0; i < stars.length; ) {
        const star = stars[i]
        if (star.updateFrame === this.currentFrame) { i++; continue }
        star.updateFrame = this.currentFrame
        star.life -= timeStep
        if (star.life <= 0) {
          this.returnStar(star)
          if (i < stars.length - 1) { stars[i] = stars.pop()! }
          else { stars.pop() }
        } else {
          const burnRate = Math.pow(star.life / star.fullLife, 0.5)
          const burnRateInverse = 1 - burnRate
          star.prevX = star.x; star.prevY = star.y
          star.x += star.speedX * speed; star.y += star.speedY * speed
          const drag = star.heavy ? starDragHeavy : starDrag
          const dragFactor = 1 - (1 - drag) * star.fade
          star.speedX *= dragFactor
          star.speedY *= dragFactor
          star.speedY += gAcc * star.gravity
          if (star.spinRadius) {
            star.spinAngle += star.spinSpeed * speed
            star.x += Math.sin(star.spinAngle) * star.spinRadius * speed
            star.y += Math.cos(star.spinAngle) * star.spinRadius * speed
          }
          if (star.sparkFreq) {
            star.sparkTimer -= timeStep
            while (star.sparkTimer < 0) {
              star.sparkTimer += star.sparkFreq * 0.75 + star.sparkFreq * burnRateInverse * 4
              this.addSpark(star.x, star.y, star.sparkColor, Math.random() * PI_2,
                Math.random() * star.sparkSpeed * burnRate,
                star.sparkLife * 0.8 + Math.random() * star.sparkLifeVariation * star.sparkLife)
            }
          }
          if (star.life < star.transitionTime) {
            if (star.secondColor && !star.colorChanged) {
              star.colorChanged = true; star.color = star.secondColor
              if (!this.stars[star.secondColor]) this.stars[star.secondColor] = []
              this.stars[star.secondColor].push(star)
              if (i < stars.length - 1) { stars[i] = stars.pop()! }
              else { stars.pop() }
              if (star.secondColor === "_INVISIBLE_") { star.sparkFreq = 0 }
              continue
            }
            if (star.strobe) { star.visible = Math.floor(star.life / star.strobeFreq!) % 3 === 0 }
          }
          i++
        }
      }
    }

    // Update sparks
    for (let ci = 0; ci < this._sparkColors.length; ci++) {
      const color = this._sparkColors[ci]
      const sparks = this.sparks[color]
      for (let i = 0; i < sparks.length; ) {
        const spark = sparks[i]
        spark.life -= timeStep
        if (spark.life <= 0) {
          this.returnSpark(spark)
          if (i < sparks.length - 1) { sparks[i] = sparks.pop()! }
          else { sparks.pop() }
        } else {
          spark.prevX = spark.x; spark.prevY = spark.y
          spark.x += spark.speedX * speed; spark.y += spark.speedY * speed
          spark.speedX *= sparkDrag; spark.speedY *= sparkDrag
          spark.speedY += gAcc
          i++
        }
      }
    }

    // Debug stats
    if (this.state.config.debug) {
      let stars = 0, sparks = 0
      for (const c of this._starColors) { if (c !== INVISIBLE) stars += (this.stars[c]?.length || 0) }
      for (const c of this._sparkColors) { if (c !== INVISIBLE) sparks += (this.sparks[c]?.length || 0) }
      const q = { "0": "Low", "1": "Normal", "2": "High" } as Record<string, string>
      const dpr = window.devicePixelRatio || 1
      const qVal = q[this.state.config.quality] || this.state.config.quality
      const renW = Math.ceil((this.stageW * this.state.config.scaleFactor || 1) * dpr)
      const renH = Math.ceil((this.stageH * this.state.config.scaleFactor || 1) * dpr)

      const poolStars = this.starPool.length
      const poolSparks = this.sparkPool.length
      const poolBursts = this.burstFlashPool.length
      const colorGroupCount = this._starColors.filter(c => c !== INVISIBLE && this.stars[c]?.length).length
      const sparkGroupCount = this._sparkColors.filter(c => c !== INVISIBLE && this.sparks[c]?.length).length

      const device = this.IS_HEADER ? 'Header' : this.IS_MOBILE ? 'Mobile' : 'Desktop'
      const le = this.state.config.longExposure ? 'on' : 'off'
      const finale = this.state.config.finale ? 'on' : 'off'
      const skyLight = this.skyLightingSelector()

      this._debugLines = [
        `FPS ${this._fps > 0 ? this._fps.toFixed(1) : '-'}/${this.state.config.fps}  Render ${this._renderMs.toFixed(1)}ms  Frame ${this.currentFrame}`,
        `Stars ${stars}/${colorGroupCount}grp  Sparks ${sparks}/${sparkGroupCount}grp`,
        `Pool star ${poolStars}  spark ${poolSparks}  burst ${poolBursts}`,
        `Renderer ${this.state.config.renderer}  ${device}  LongExp ${le}`,
        `Shell ${this.state.config.shell} sz=${this.state.config.size}  Bursts ${this.burstFlashes.length}  Finale ${finale}`,
        `Speed x${this.state.config.speed}  Quality ${qVal}  SkyLight ${skyLight}`,
        `Stage ${this.stageW.toFixed(0)}x${this.stageH.toFixed(0)}  Scale x${this.state.config.scaleFactor}  DPR ${dpr}  ${renW}x${renH}`,
      ]
    } else {
      this._debugLines = []
    }

    // Sky color interpolates every physics step to stay smooth
    if (this.skyLightingSelector() !== SKY_LIGHT_NONE) {
      this.colorSky(speed)
    } else {
      this.currentSkyColor.r = 0; this.currentSkyColor.g = 0; this.currentSkyColor.b = 0
    }

    if (!shouldRender) return

    const renderStart = this.state.config.debug ? performance.now() : 0

    // FPS counter — counts actual render frames using real elapsed time
    if (this.state.config.debug) {
      this._fpsFrames++
      const now = performance.now()
      const renderDelta = now - (this._fpsLastTS || now)
      this._fpsLastTS = now
      this._fpsTime += renderDelta
      if (this._fpsTime >= 500) {
        this._fps = Math.round((this._fpsFrames / (this._fpsTime / 1000)) * 10) / 10
        this._fpsFrames = 0; this._fpsTime = 0
      }
    }

    // Collect burst flash data
    const burstData: { x: number; y: number; radius: number }[] = []
    while (this.burstFlashes.length) {
      const bf = this.burstFlashes.pop()!
      burstData.push({ x: bf.x, y: bf.y, radius: bf.radius })
      this.returnBurstFlash(bf)
    }

    // Calculate dirty rect
    const dirtyRect = this._calcDirtyRect(burstData)
    if (dirtyRect && this.state.config.debug) {
      const area = dirtyRect.w * dirtyRect.h
      const total = this.stageW * this.stageH
      const pct = Math.round((area / total) * 100)
      this._debugLines.push(`Dirty ${pct}%  ${dirtyRect.w.toFixed(0)}x${dirtyRect.h.toFixed(0)}`)
    }

    this.renderer.render({
      stars: this.stars,
      sparks: this.sparks,
      burstFlashes: burstData,
      starColors: this._starColors,
      sparkColors: this._sparkColors,
      invisibleKey: INVISIBLE,
      speed,
      longExposure: this.state.config.longExposure,
      debugLines: this._debugLines,
      skyColor: this.currentSkyColor,
      dirtyRect,
    })

    if (this.state.config.debug) { this._renderMs = performance.now() - renderStart }
  }

  private _calcDirtyRect(bursts: { x: number; y: number; radius: number }[]): DirtyRect | null {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
    const pad = 6

    for (const c of this._starColors) {
      if (c === INVISIBLE) continue
      const items = this.stars[c]
      if (!items) continue
      for (let i = 0; i < items.length; i++) {
        const s = items[i]
        if (!s.visible) continue
        if (s.x < minX) minX = s.x; if (s.x > maxX) maxX = s.x
        if (s.y < minY) minY = s.y; if (s.y > maxY) maxY = s.y
        if (s.prevX < minX) minX = s.prevX; if (s.prevX > maxX) maxX = s.prevX
        if (s.prevY < minY) minY = s.prevY; if (s.prevY > maxY) maxY = s.prevY
      }
    }
    for (const c of this._sparkColors) {
      if (c === INVISIBLE) continue
      const items = this.sparks[c]
      if (!items) continue
      for (let i = 0; i < items.length; i++) {
        const s = items[i]
        if (s.x < minX) minX = s.x; if (s.x > maxX) maxX = s.x
        if (s.y < minY) minY = s.y; if (s.y > maxY) maxY = s.y
        if (s.prevX < minX) minX = s.prevX; if (s.prevX > maxX) maxX = s.prevX
        if (s.prevY < minY) minY = s.prevY; if (s.prevY > maxY) maxY = s.prevY
      }
    }
    for (let i = 0; i < bursts.length; i++) {
      const b = bursts[i]
      if (b.x - b.radius < minX) minX = b.x - b.radius
      if (b.x + b.radius > maxX) maxX = b.x + b.radius
      if (b.y - b.radius < minY) minY = b.y - b.radius
      if (b.y + b.radius > maxY) maxY = b.y + b.radius
    }

    if (!isFinite(minX)) return null // no particles

    minX = Math.max(0, minX - pad)
    minY = Math.max(0, minY - pad)
    maxX = Math.min(this.stageW, maxX + pad)
    maxY = Math.min(this.stageH, maxY + pad)

    const w = maxX - minX; const h = maxY - minY
    // If covering >95% of screen, skip optimization
    if (w * h > this.stageW * this.stageH * 0.95) return null

    return { x: minX, y: minY, w, h }
  }

  colorSky(speed: number): void {
    const maxSkySaturation = this.skyLightingSelector() * 15
    const maxStarCount = 500; let totalStarCount = 0
    this.targetSkyColor.r = 0; this.targetSkyColor.g = 0; this.targetSkyColor.b = 0
    for (let ci = 0; ci < this._starColors.length; ci++) {
      const color = this._starColors[ci]
      if (color === INVISIBLE) continue
      let tuple = COLOR_TUPLES[color]
      if (!tuple) {
        tuple = { r: parseInt(color.substring(1,3),16), g: parseInt(color.substring(3,5),16), b: parseInt(color.substring(5,7),16) }
        COLOR_TUPLES[color] = tuple
      }
      const count = this.stars[color].length
      totalStarCount += count
      this.targetSkyColor.r += tuple.r * count; this.targetSkyColor.g += tuple.g * count; this.targetSkyColor.b += tuple.b * count
    }
    const intensity = Math.pow(Math.min(1, totalStarCount / maxStarCount), 0.3)
    const maxColorComponent = Math.max(1, this.targetSkyColor.r, this.targetSkyColor.g, this.targetSkyColor.b)
    this.targetSkyColor.r = (this.targetSkyColor.r / maxColorComponent) * maxSkySaturation * intensity
    this.targetSkyColor.g = (this.targetSkyColor.g / maxColorComponent) * maxSkySaturation * intensity
    this.targetSkyColor.b = (this.targetSkyColor.b / maxColorComponent) * maxSkySaturation * intensity
    const colorChange = 10
    this.currentSkyColor.r += ((this.targetSkyColor.r - this.currentSkyColor.r) / colorChange) * speed
    this.currentSkyColor.g += ((this.targetSkyColor.g - this.currentSkyColor.g) / colorChange) * speed
    this.currentSkyColor.b += ((this.targetSkyColor.b - this.currentSkyColor.b) / colorChange) * speed
  }

  private _renderTimer = 0

  private animationLoop(currentTime: number): void {
    this.rafId = requestAnimationFrame((t) => this.animationLoop(t))
    if (this.prevFrameTime === 0) { this.prevFrameTime = currentTime; return }
    const elapsed = Math.min(currentTime - this.prevFrameTime, 100)
    this.prevFrameTime = currentTime

    this._renderTimer += elapsed
    const renderInterval = 1000 / this.state.config.fps
    const shouldRender = this._renderTimer >= renderInterval

    if (this.isRunning()) {
      this.update(elapsed, shouldRender)
    }
    if (shouldRender) this._renderTimer -= renderInterval
  }

  init(): void {
    // Deferred — container provided via mount()
  }

  mount(container: HTMLElement): void {
    this._canvasContainer = container
    const rendererType = this.state.config.renderer
    this.renderer = this._createRenderer(rendererType)
    this.configDidUpdate()
    this.animationLoop(0)
  }

  destroy(): void {
    if (this.rafId) cancelAnimationFrame(this.rafId)
    if (this.renderer) this.renderer.destroy()
  }
}
