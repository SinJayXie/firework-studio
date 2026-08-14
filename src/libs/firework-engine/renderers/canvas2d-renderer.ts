import type { Renderer, RendererData } from "./renderer"
import { INVISIBLE } from "../utils/constants"

export class Canvas2DRenderer implements Renderer {
  canvas: HTMLCanvasElement
  private _ctx: CanvasRenderingContext2D
  private _offscreen: OffscreenCanvas
  private _offscreenCtx: OffscreenCanvasRenderingContext2D

  private _burstGradientCache: OffscreenCanvas | null = null
  private _starDrawWidth = 1
  private _sparkDrawWidth = 1
  private _isLowQuality = false
  private _dpr = 1
  private _scaleFactor = 1
  private _stageW = 0
  private _stageH = 0

  constructor() {
    this.canvas = document.createElement("canvas")
    this.canvas.id = "main-canvas"
    this._ctx = this.canvas.getContext("2d")!

    this._offscreen = new OffscreenCanvas(0, 0)
    this._offscreenCtx = this._offscreen.getContext("2d")!

    this._initBurstGradient()
  }

  private _initBurstGradient(): void {
    const size = 128
    const canvas = new OffscreenCanvas(size, size)
    const ctx = canvas.getContext("2d")!
    const half = size / 2
    const gradient = ctx.createRadialGradient(half, half, 0, half, half, half)
    gradient.addColorStop(0.024, "rgba(255, 255, 255, 1)")
    gradient.addColorStop(0.125, "rgba(255, 160, 20, 0.2)")
    gradient.addColorStop(0.32, "rgba(255, 140, 20, 0.11)")
    gradient.addColorStop(1, "rgba(255, 120, 20, 0)")
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, size, size)
    this._burstGradientCache = canvas
  }

  init(container: HTMLElement): boolean {
    container.appendChild(this.canvas)
    return true
  }

  resize(width: number, height: number, stageW: number, stageH: number, dpr: number): void {
    this._dpr = dpr
    this._stageW = stageW
    this._stageH = stageH
    this.canvas.width = width
    this.canvas.height = height
    this.canvas.style.width = (width / dpr) + "px"
    this.canvas.style.height = (height / dpr) + "px"
    this._offscreen.width = width
    this._offscreen.height = height
  }

  setQuality(quality: number): void {
    this._isLowQuality = quality === 1
    this._starDrawWidth = quality === 3 ? 0.75 : 1
    this._sparkDrawWidth = quality === 3 ? 0.75 : 1
  }

  setScaleFactor(scale: number): void { this._scaleFactor = scale }

  render(data: RendererData): void {
    const offCtx = this._offscreenCtx
    const ctx = this._ctx
    const width = this._stageW
    const height = this._stageH
    const scale = this._dpr * this._scaleFactor

    // ── Pass 1: offscreen — decay + particles ──
    offCtx.save()
    offCtx.scale(scale, scale)

    // Decay fill — always full screen
    offCtx.globalCompositeOperation = "source-over"
    offCtx.fillStyle = `rgba(0, 0, 0, ${data.longExposure ? 0.0025 : 0.175 * data.speed})`
    offCtx.fillRect(0, 0, width, height)

    // Particles — clip to dirty rect
    if (data.dirtyRect) {
      offCtx.save()
      const dr = data.dirtyRect; offCtx.beginPath(); offCtx.rect(dr.x, dr.y, dr.w, dr.h); offCtx.clip()
    }

    while (data.burstFlashes.length) {
      const bf = data.burstFlashes.pop()!
      const r = bf.radius
      offCtx.drawImage(this._burstGradientCache!, bf.x - r, bf.y - r, r * 2, r * 2)
    }

    offCtx.globalCompositeOperation = "lighten"
    offCtx.lineWidth = this._starDrawWidth
    offCtx.lineCap = this._isLowQuality ? "square" : "round"

    for (let ci = 0; ci < data.starColors.length; ci++) {
      const color = data.starColors[ci]
      if (color === INVISIBLE) continue
      const stars = data.stars[color]
      offCtx.strokeStyle = color; offCtx.beginPath()
      for (let i = 0; i < stars.length; i++) {
        const star = stars[i]
        if (star.visible) {
          offCtx.moveTo(star.x, star.y); offCtx.lineTo(star.prevX, star.prevY)
        }
      }
      offCtx.stroke()
    }

    offCtx.lineWidth = this._sparkDrawWidth; offCtx.lineCap = "butt"
    for (let ci = 0; ci < data.sparkColors.length; ci++) {
      const color = data.sparkColors[ci]
      if (color === INVISIBLE) continue
      const sparks = data.sparks[color]
      offCtx.strokeStyle = color; offCtx.beginPath()
      for (let i = 0; i < sparks.length; i++) {
        const spark = sparks[i]; offCtx.moveTo(spark.x, spark.y); offCtx.lineTo(spark.prevX, spark.prevY)
      }
      offCtx.stroke()
    }

    if (data.dirtyRect) offCtx.restore()
    offCtx.restore()

    // ── Pass 2: main canvas — composite offscreen + overlays ──
    ctx.save()
    ctx.scale(scale, scale)

    // Sky background — always full screen
    const sc = data.skyColor
    ctx.fillStyle = `rgb(${sc.r}, ${sc.g}, ${sc.b})`
    ctx.fillRect(0, 0, width, height)

    // Blit offscreen trail buffer with lighten blend — always full screen
    ctx.globalCompositeOperation = "lighten"
    ctx.drawImage(this._offscreen, 0, 0, this.canvas.width, this.canvas.height, 0, 0, width, height)

    // Direction lines (source-over, on top of trails)
    ctx.globalCompositeOperation = "source-over"
    ctx.strokeStyle = "#fff"; ctx.lineWidth = 1
    ctx.beginPath()
    for (let ci = 0; ci < data.starColors.length; ci++) {
      const color = data.starColors[ci]
      if (color === INVISIBLE) continue
      const stars = data.stars[color]
      for (let i = 0; i < stars.length; i++) {
        const star = stars[i]
        if (star.visible) {
          ctx.moveTo(star.x, star.y); ctx.lineTo(star.x - star.speedX * 1.6, star.y - star.speedY * 1.6)
        }
      }
    }
    ctx.stroke()

    // Debug overlay — bottom-left
    if (data.debugLines.length) {
      const lineH = 13; const padX = 8; const padY = 5; const radius = 4; const margin = 4
      const lines = ["Renderer Canvas2D", ...data.debugLines]
      ctx.font = '10px monospace'; let maxW = 0
      for (const l of lines) { const w = ctx.measureText(l).width; if (w > maxW) maxW = w }
      const bgW = maxW + padX * 2
      const bgH = lineH * lines.length + padY * 2
      const bx = margin
      const by = height - bgH - margin

      ctx.globalAlpha = 1
      ctx.beginPath()
      ctx.moveTo(bx + radius, by)
      ctx.lineTo(bx + bgW - radius, by)
      ctx.arcTo(bx + bgW, by, bx + bgW, by + radius, radius)
      ctx.lineTo(bx + bgW, by + bgH - radius)
      ctx.arcTo(bx + bgW, by + bgH, bx + bgW - radius, by + bgH, radius)
      ctx.lineTo(bx + radius, by + bgH)
      ctx.arcTo(bx, by + bgH, bx, by + bgH - radius, radius)
      ctx.lineTo(bx, by + radius)
      ctx.arcTo(bx, by, bx + radius, by, radius)
      ctx.closePath()
      ctx.fillStyle = 'rgba(0,0,0,0.72)'; ctx.fill()
      ctx.strokeStyle = 'rgba(255,255,255,0.18)'; ctx.lineWidth = 1; ctx.stroke()

      ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 2; ctx.shadowOffsetX = 0; ctx.shadowOffsetY = 1
      ctx.textBaseline = 'top'
      for (let i = 0; i < lines.length; i++) {
        const l = lines[i]
        if (/^(Renderer|FPS)/.test(l)) ctx.fillStyle = '#4fc3f7'
        else if (/^(Stars|Sparks)/.test(l)) ctx.fillStyle = '#aed581'
        else if (/^Bursts/.test(l)) ctx.fillStyle = '#ffb74d'
        else if (/^(Shell)/.test(l)) ctx.fillStyle = '#ce93d8'
        else if (/^Pool/.test(l)) ctx.fillStyle = '#80cbc4'
        else if (/^Speed/.test(l)) ctx.fillStyle = '#90caf9'
        else if (/^Stage/.test(l)) ctx.fillStyle = '#80deea'
        else if (/^Dirty/.test(l)) ctx.fillStyle = '#ffcc80'
        else ctx.fillStyle = '#bdbdbd'
        ctx.fillText(l, bx + padX, by + padY + i * lineH)
      }
      ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0
    }

    // Dirty rect visual — debug only
    if (data.dirtyRect && data.debugLines.length) {
      const dr = data.dirtyRect
      const sc = data.skyColor
      const skyLum = sc.r * 0.299 + sc.g * 0.587 + sc.b * 0.114
      ctx.globalAlpha = 1
      ctx.strokeStyle = skyLum > 128 ? 'rgba(50,200,50,0.8)' : 'rgba(255,255,80,0.8)'
      ctx.lineWidth = 1
      ctx.strokeRect(dr.x, dr.y, dr.w, dr.h)
    }

    ctx.restore()
  }

  destroy(): void {
    this.canvas.remove()
  }
}
