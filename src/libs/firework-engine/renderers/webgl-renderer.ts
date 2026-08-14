import type { Renderer, RendererData, DirtyRect } from "./renderer"

const QUAD_VS = `#version 100
attribute vec2 a_position;
attribute vec2 a_texcoord;
varying vec2 v_texcoord;
void main() {
  gl_Position = vec4(a_position, 0.0, 1.0);
  v_texcoord = a_texcoord;
}`

const DECAY_FS = `#version 100
precision mediump float;
varying vec2 v_texcoord;
uniform sampler2D u_texture;
uniform float u_decay;
void main() {
  gl_FragColor = texture2D(u_texture, v_texcoord) * u_decay;
}`

const COPY_FS = `#version 100
precision mediump float;
varying vec2 v_texcoord;
uniform sampler2D u_texture;
void main() {
  gl_FragColor = texture2D(u_texture, v_texcoord);
}`

const LINE_VS = `#version 100
attribute vec2 a_position;
attribute vec3 a_color;
varying vec3 v_color;
uniform vec2 u_stageSize;
uniform float u_pointSize;
void main() {
  vec2 normalized = a_position / u_stageSize;
  vec2 clip = normalized * 2.0 - 1.0;
  gl_Position = vec4(clip.x, -clip.y, 0.0, 1.0);
  gl_PointSize = u_pointSize;
  v_color = a_color;
}`

const LINE_FS = `#version 100
precision mediump float;
varying vec3 v_color;
void main() {
  gl_FragColor = vec4(v_color, 1.0);
}`

const POINT_FS = `#version 100
precision mediump float;
varying vec3 v_color;
void main() {
  float d = length(gl_PointCoord - 0.5) * 2.0;
  float alpha = 1.0 - smoothstep(0.7, 1.0, d);
  gl_FragColor = vec4(v_color, alpha);
}`

const HEX: Record<string, number> = { "0":0,"1":1,"2":2,"3":3,"4":4,"5":5,"6":6,"7":7,"8":8,"9":9,
  "a":10,"b":11,"c":12,"d":13,"e":14,"f":15,"A":10,"B":11,"C":12,"D":13,"E":14,"F":15 }

function hexToRgb(color: string): [number, number, number] {
  const r = HEX[color[1]] * 16 + HEX[color[2]]
  const g = HEX[color[3]] * 16 + HEX[color[4]]
  const b = HEX[color[5]] * 16 + HEX[color[6]]
  return [r / 255, g / 255, b / 255]
}

export class WebGLRenderer implements Renderer {
  canvas: HTMLCanvasElement
  gl!: WebGLRenderingContext

  private lineProgram!: WebGLProgram
  private decayProgram!: WebGLProgram
  private copyProgram!: WebGLProgram
  private pointProgram!: WebGLProgram

  private lineULoc!: { stageSize: WebGLUniformLocation; pointSize: WebGLUniformLocation }
  private pointULoc!: { stageSize: WebGLUniformLocation; pointSize: WebGLUniformLocation }
  private decayULoc!: { texture: WebGLUniformLocation; decay: WebGLUniformLocation }
  private copyULoc!: { texture: WebGLUniformLocation }

  private lineAttribLoc!: { pos: number; col: number }
  private pointAttribLoc!: { pos: number; col: number }
  private copyAttribLoc!: { pos: number; uv: number }
  private quadAttribLoc!: { pos: number; uv: number }

  private fbos: WebGLFramebuffer[] = []
  private fboTextures: WebGLTexture[] = []
  private writeIdx = 0

  private quadBuf: WebGLBuffer | null = null
  private starBuf: WebGLBuffer | null = null
  private sparkBuf: WebGLBuffer | null = null
  private mainBuf: WebGLBuffer | null = null
  private starPtBuf: WebGLBuffer | null = null
  private burstTex: WebGLTexture | null = null
  private debugTex: WebGLTexture | null = null
  private _debugCanvas: OffscreenCanvas | null = null
  private _debugCtx: OffscreenCanvasRenderingContext2D | null = null

  private w = 0; private h = 0
  private stageW = 0; private stageH = 0
  private dpr = 1

  private _blendMax: number = WebGLRenderingContext.prototype.FUNC_ADD

  constructor() {
    this.canvas = document.createElement("canvas")
    this.canvas.id = "webgl-canvas"
  }

  init(container: HTMLElement): boolean {
    container.appendChild(this.canvas)
    const gl = this.canvas.getContext("webgl", { alpha: false, premultipliedAlpha: false, antialias: true })
    if (!gl) return false
    this.gl = gl

    const maxExt = gl.getExtension("EXT_blend_minmax")
    if (maxExt) { this._blendMax = maxExt.MAX_EXT }

    this.lineProgram = this._compile(LINE_VS, LINE_FS)
    this.decayProgram = this._compile(QUAD_VS, DECAY_FS)
    this.copyProgram = this._compile(QUAD_VS, COPY_FS)
    this.pointProgram = this._compile(LINE_VS, POINT_FS)

    this.lineULoc = { stageSize: gl.getUniformLocation(this.lineProgram, "u_stageSize")!, pointSize: gl.getUniformLocation(this.lineProgram, "u_pointSize")! }
    this.pointULoc = { stageSize: gl.getUniformLocation(this.pointProgram, "u_stageSize")!, pointSize: gl.getUniformLocation(this.pointProgram, "u_pointSize")! }
    this.decayULoc = {
      texture: gl.getUniformLocation(this.decayProgram, "u_texture")!,
      decay: gl.getUniformLocation(this.decayProgram, "u_decay")!,
    }
    this.copyULoc = { texture: gl.getUniformLocation(this.copyProgram, "u_texture")! }

    this.lineAttribLoc = { pos: gl.getAttribLocation(this.lineProgram, "a_position"), col: gl.getAttribLocation(this.lineProgram, "a_color") }
    this.pointAttribLoc = { pos: gl.getAttribLocation(this.pointProgram, "a_position"), col: gl.getAttribLocation(this.pointProgram, "a_color") }
    this.copyAttribLoc = { pos: gl.getAttribLocation(this.copyProgram, "a_position"), uv: gl.getAttribLocation(this.copyProgram, "a_texcoord") }
    this.quadAttribLoc = { pos: gl.getAttribLocation(this.decayProgram, "a_position"), uv: gl.getAttribLocation(this.decayProgram, "a_texcoord") }

    this.quadBuf = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuf)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
      -1,-1, 0,0,  -1,1, 0,1,  1,-1, 1,0,  1,1, 1,1,
    ]), gl.STATIC_DRAW)

    this.starBuf = gl.createBuffer()
    this.sparkBuf = gl.createBuffer()
    this.mainBuf = gl.createBuffer()
    this.starPtBuf = gl.createBuffer()

    this._initBurstTex()
    this._initDebugResources()
    this._initFBOs()
    return true
  }

  resize(width: number, height: number, stageW: number, stageH: number, dpr: number): void {
    this.w = width; this.h = height
    this.stageW = stageW; this.stageH = stageH
    this.dpr = dpr
    this.canvas.width = width
    this.canvas.height = height
    this.canvas.style.width = (width / dpr) + "px"
    this.canvas.style.height = (height / dpr) + "px"

    const gl = this.gl
    for (let i = 0; i < 2; i++) {
      gl.bindTexture(gl.TEXTURE_2D, this.fboTextures[i])
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null)
    }
  }

  setScaleFactor(scale: number): void {
    this.stageW = Math.round(this.w / (this.dpr * scale))
    this.stageH = Math.round(this.h / (this.dpr * scale))
  }

  render(data: RendererData): void {
    const gl = this.gl
    const decay = data.longExposure ? 0.9975 : Math.max(0, 1 - 0.175 * data.speed)

    const readIdx = 1 - this.writeIdx
    const readTex = this.fboTextures[readIdx]
    const writeFBO = this.fbos[this.writeIdx]
    const dirty = data.dirtyRect

    gl.viewport(0, 0, this.w, this.h)

    // Pass 1: write trail FBO
    gl.bindFramebuffer(gl.FRAMEBUFFER, writeFBO)
    gl.clearColor(0, 0, 0, 0)
    gl.clear(gl.COLOR_BUFFER_BIT)

    // [a] Decay previous frame — always full screen
    gl.useProgram(this.decayProgram)
    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, readTex)
    gl.uniform1i(this.decayULoc.texture, 0)
    gl.uniform1f(this.decayULoc.decay, decay)
    this._drawDirtyQuad(gl, this.decayProgram, null)

    // [b] BurstFlash — scissor to dirty rect
    gl.enable(gl.BLEND)
    gl.blendEquation(gl.FUNC_ADD)
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA)
    if (dirty) { gl.enable(gl.SCISSOR_TEST); this._setScissor(gl, dirty) }
    this._drawBursts(gl, data.burstFlashes)

    // [c] Star/spark trails — lighten blend
    gl.blendEquation(this._blendMax)
    gl.blendFunc(gl.ONE, gl.ONE)

    gl.useProgram(this.lineProgram)
    gl.uniform2f(this.lineULoc.stageSize, this.stageW, this.stageH)

    this._drawLines(gl, data.stars, data.starColors, data.invisibleKey, this.starBuf!)

    gl.useProgram(this.pointProgram)
    gl.uniform2f(this.pointULoc.stageSize, this.stageW, this.stageH)
    gl.uniform1f(this.pointULoc.pointSize, this.dpr)
    this._drawStarPoints(gl, data.stars, data.starColors, data.invisibleKey, this.starPtBuf!)
    gl.useProgram(this.lineProgram)
    this._drawLines(gl, data.sparks, data.sparkColors, data.invisibleKey, this.sparkBuf!)

    if (dirty) gl.disable(gl.SCISSOR_TEST)
    gl.disable(gl.BLEND)
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)

    // Pass 2: blit trail FBO to screen — always full screen
    const sc = data.skyColor
    gl.clearColor(sc.r / 255, sc.g / 255, sc.b / 255, 1)
    gl.clear(gl.COLOR_BUFFER_BIT)

    gl.enable(gl.BLEND)
    gl.blendEquation(this._blendMax)
    gl.blendFunc(gl.ONE, gl.ONE)

    gl.useProgram(this.copyProgram)
    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, this.fboTextures[this.writeIdx])
    gl.uniform1i(this.copyULoc.texture, 0)
    this._drawDirtyQuad(gl, this.copyProgram, null)

    gl.disable(gl.BLEND)

    // Pass 3: main direction lines
    gl.enable(gl.BLEND)
    gl.blendEquation(this._blendMax)
    gl.blendFunc(gl.ONE, gl.ONE)

    gl.useProgram(this.lineProgram)
    gl.uniform2f(this.lineULoc.stageSize, this.stageW, this.stageH)
    this._drawMainLines(gl, data)

    gl.disable(gl.BLEND)

    // Debug overlay
    if (data.debugLines.length) {
      this._renderDebugOverlay(gl, data.debugLines)
    }

    // Dirty rect visual — debug only
    if (dirty && data.debugLines.length) {
      this._drawDirtyRectVisual(gl, dirty, data.skyColor)
    }

    this.writeIdx = readIdx
  }

  destroy(): void {
    const gl = this.gl
    gl.deleteProgram(this.lineProgram)
    gl.deleteProgram(this.decayProgram)
    gl.deleteProgram(this.copyProgram)
    gl.deleteProgram(this.pointProgram)
    for (const fbo of this.fbos) gl.deleteFramebuffer(fbo)
    for (const tex of this.fboTextures) gl.deleteTexture(tex)
    gl.deleteBuffer(this.quadBuf)
    gl.deleteBuffer(this.starBuf)
    gl.deleteBuffer(this.sparkBuf)
    gl.deleteBuffer(this.mainBuf)
    gl.deleteBuffer(this.starPtBuf)
    gl.deleteTexture(this.burstTex)
    gl.deleteTexture(this.debugTex)
    this.canvas.remove()
  }

  // ── private helpers ──

  private _compile(vsSrc: string, fsSrc: string): WebGLProgram {
    const gl = this.gl
    const vs = gl.createShader(gl.VERTEX_SHADER)!
    gl.shaderSource(vs, vsSrc); gl.compileShader(vs)
    if (!gl.getShaderParameter(vs, gl.COMPILE_STATUS)) throw new Error(`VS: ${gl.getShaderInfoLog(vs)}`)
    const fs = gl.createShader(gl.FRAGMENT_SHADER)!
    gl.shaderSource(fs, fsSrc); gl.compileShader(fs)
    if (!gl.getShaderParameter(fs, gl.COMPILE_STATUS)) throw new Error(`FS: ${gl.getShaderInfoLog(fs)}`)
    const prog = gl.createProgram()!
    gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog)
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(`Link: ${gl.getProgramInfoLog(prog)}`)
    return prog
  }

  private _initBurstTex(): void {
    const size = 128
    const canvas = new OffscreenCanvas(size, size)
    const ctx = canvas.getContext("2d")!
    const half = size / 2
    const g = ctx.createRadialGradient(half, half, 0, half, half, half)
    g.addColorStop(0.024, "rgba(255, 255, 255, 1)")
    g.addColorStop(0.125, "rgba(255, 160, 20, 0.2)")
    g.addColorStop(0.32, "rgba(255, 140, 20, 0.11)")
    g.addColorStop(1, "rgba(255, 120, 20, 0)")
    ctx.fillStyle = g; ctx.fillRect(0, 0, size, size)

    const gl = this.gl
    this.burstTex = gl.createTexture()
    gl.bindTexture(gl.TEXTURE_2D, this.burstTex)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, canvas)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
  }

  private _initDebugResources(): void {
    this._debugCanvas = new OffscreenCanvas(512, 256)
    this._debugCtx = this._debugCanvas.getContext("2d")!
    const gl = this.gl
    this.debugTex = gl.createTexture()
    gl.bindTexture(gl.TEXTURE_2D, this.debugTex)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 512, 256, 0, gl.RGBA, gl.UNSIGNED_BYTE, null)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
  }

  private _initFBOs(): void {
    const gl = this.gl
    for (let i = 0; i < 2; i++) {
      const fbo = gl.createFramebuffer()!
      const tex = gl.createTexture()!
      gl.bindTexture(gl.TEXTURE_2D, tex)
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 2, 2, 0, gl.RGBA, gl.UNSIGNED_BYTE, null)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo)
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0)
      this.fbos.push(fbo); this.fboTextures.push(tex)
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
  }

  private _setScissor(gl: WebGLRenderingContext, rect: DirtyRect): void {
    const s = this.w / this.stageW
    const sx = Math.floor(rect.x * s)
    const sy = Math.floor(this.h - (rect.y + rect.h) * s)
    const sw = Math.ceil(rect.w * s)
    const sh = Math.ceil(rect.h * s)
    gl.scissor(sx, sy, sw, sh)
  }

  private _drawDirtyQuad(gl: WebGLRenderingContext, _prog: WebGLProgram, dirty: DirtyRect | null): void {
    const { pos, uv } = this.quadAttribLoc
    gl.enableVertexAttribArray(pos); gl.enableVertexAttribArray(uv)
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuf)

    if (!dirty) {
      // Full screen quad
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
        -1,-1, 0,0,  -1,1, 0,1,  1,-1, 1,0,  1,1, 1,1,
      ]), gl.DYNAMIC_DRAW)
    } else {
      const sw = this.stageW; const sh = this.stageH
      const cl = (dirty.x / sw) * 2 - 1
      const cr = ((dirty.x + dirty.w) / sw) * 2 - 1
      const ct = 1 - (dirty.y / sh) * 2
      const cb = 1 - ((dirty.y + dirty.h) / sh) * 2
      const u0 = dirty.x / sw; const u1 = (dirty.x + dirty.w) / sw
      const v0 = 1 - (dirty.y + dirty.h) / sh; const v1 = 1 - dirty.y / sh
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
        cl, cb, u0, v0,   cl, ct, u0, v1,   cr, cb, u1, v0,   cr, ct, u1, v1,
      ]), gl.DYNAMIC_DRAW)
    }
    gl.vertexAttribPointer(pos, 2, gl.FLOAT, false, 16, 0)
    gl.vertexAttribPointer(uv, 2, gl.FLOAT, false, 16, 8)
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
  }

  private _drawLines(
    gl: WebGLRenderingContext,
    groups: Record<string, { x: number; y: number; prevX: number; prevY: number; visible?: boolean }[]>,
    colors: string[],
    invisibleKey: string,
    buf: WebGLBuffer,
  ): void {
    const { pos: posLoc, col: colLoc } = this.lineAttribLoc
    gl.enableVertexAttribArray(posLoc); gl.enableVertexAttribArray(colLoc)
    gl.bindBuffer(gl.ARRAY_BUFFER, buf)

    for (let ci = 0; ci < colors.length; ci++) {
      const color = colors[ci]
      if (color === invisibleKey) continue
      const items = groups[color]
      if (!items || items.length === 0) continue

      const [r, g, b] = hexToRgb(color)
      const verts = new Float32Array(items.length * 10)
      let j = 0
      for (let i = 0; i < items.length; i++) {
        const p = items[i]
        if (p.visible === false) continue
        verts[j++] = p.x; verts[j++] = p.y
        verts[j++] = r; verts[j++] = g; verts[j++] = b
        verts[j++] = p.prevX; verts[j++] = p.prevY
        verts[j++] = r; verts[j++] = g; verts[j++] = b
      }
      if (j === 0) continue

      gl.bufferData(gl.ARRAY_BUFFER, verts.subarray(0, j), gl.DYNAMIC_DRAW)
      gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 20, 0)
      gl.vertexAttribPointer(colLoc, 3, gl.FLOAT, false, 20, 8)
      gl.drawArrays(gl.LINES, 0, j / 5)
    }
  }

  private _drawStarPoints(
    gl: WebGLRenderingContext,
    groups: Record<string, { x: number; y: number; visible?: boolean }[]>,
    colors: string[],
    invisibleKey: string,
    buf: WebGLBuffer,
  ): void {
    const { pos: posLoc, col: colLoc } = this.pointAttribLoc
    gl.enableVertexAttribArray(posLoc); gl.enableVertexAttribArray(colLoc)
    gl.bindBuffer(gl.ARRAY_BUFFER, buf)

    for (let ci = 0; ci < colors.length; ci++) {
      const color = colors[ci]
      if (color === invisibleKey) continue
      const items = groups[color]
      if (!items || items.length === 0) continue

      const [r, g, b] = hexToRgb(color)
      const verts = new Float32Array(items.length * 5)
      let j = 0
      for (let i = 0; i < items.length; i++) {
        const p = items[i]
        if (p.visible === false) continue
        verts[j++] = p.x; verts[j++] = p.y
        verts[j++] = r; verts[j++] = g; verts[j++] = b
      }
      if (j === 0) continue

      gl.bufferData(gl.ARRAY_BUFFER, verts.subarray(0, j), gl.DYNAMIC_DRAW)
      gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 20, 0)
      gl.vertexAttribPointer(colLoc, 3, gl.FLOAT, false, 20, 8)
      gl.drawArrays(gl.POINTS, 0, j / 5)
    }
  }

  private _drawMainLines(
    gl: WebGLRenderingContext,
    data: RendererData,
  ): void {
    const { pos: posLoc, col: colLoc } = this.lineAttribLoc
    gl.enableVertexAttribArray(posLoc); gl.enableVertexAttribArray(colLoc)
    gl.bindBuffer(gl.ARRAY_BUFFER, this.mainBuf)

    for (let ci = 0; ci < data.starColors.length; ci++) {
      const color = data.starColors[ci]
      if (color === data.invisibleKey) continue
      const items = data.stars[color]
      if (!items || items.length === 0) continue

      const verts = new Float32Array(items.length * 10)
      let j = 0
      for (let i = 0; i < items.length; i++) {
        const p = items[i]
        if (!p.visible) continue
        verts[j++] = p.x; verts[j++] = p.y
        verts[j++] = 1; verts[j++] = 1; verts[j++] = 1
        verts[j++] = p.x - p.speedX * 1.6; verts[j++] = p.y - p.speedY * 1.6
        verts[j++] = 1; verts[j++] = 1; verts[j++] = 1
      }
      if (j === 0) continue

      gl.bufferData(gl.ARRAY_BUFFER, verts.subarray(0, j), gl.DYNAMIC_DRAW)
      gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 20, 0)
      gl.vertexAttribPointer(colLoc, 3, gl.FLOAT, false, 20, 8)
      gl.drawArrays(gl.LINES, 0, j / 5)
    }
  }

  private _drawBursts(
    gl: WebGLRenderingContext,
    bursts: { x: number; y: number; radius: number }[],
  ): void {
    if (bursts.length === 0 || !this.burstTex) return

    gl.useProgram(this.copyProgram)
    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, this.burstTex)
    gl.uniform1i(this.copyULoc.texture, 0)

    const { pos: posLoc, uv: uvLoc } = this.copyAttribLoc
    gl.enableVertexAttribArray(posLoc); gl.enableVertexAttribArray(uvLoc)

    const sw = this.stageW; const sh = this.stageH

    for (let i = 0; i < bursts.length; i++) {
      const bf = bursts[i]
      const r = bf.radius
      const lx = bf.x - r; const rx = bf.x + r
      const ty = bf.y - r; const by = bf.y + r

      const cl = (lx / sw) * 2 - 1; const cr = (rx / sw) * 2 - 1
      const ct = -((ty / sh) * 2 - 1); const cb = -((by / sh) * 2 - 1)

      const verts = new Float32Array([
        cl, cb, 0, 0,   cl, ct, 0, 1,   cr, cb, 1, 0,   cr, ct, 1, 1,
      ])
      gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuf)
      gl.bufferData(gl.ARRAY_BUFFER, verts, gl.DYNAMIC_DRAW)
      gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 16, 0)
      gl.vertexAttribPointer(uvLoc, 2, gl.FLOAT, false, 16, 8)
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
    }

    gl.useProgram(this.lineProgram) // restore
  }

  private _lineColor(line: string): string {
    if (/^(Renderer|FPS)/.test(line)) return '#4fc3f7'
    if (/^(Stars|Sparks)/.test(line)) return '#aed581'
    if (/^Bursts/.test(line)) return '#ffb74d'
    if (/^(Shell)/.test(line)) return '#ce93d8'
    if (/^Pool/.test(line)) return '#80cbc4'
    if (/^Speed/.test(line)) return '#90caf9'
    if (/^Stage/.test(line)) return '#80deea'
    if (/^Dirty/.test(line)) return '#ffcc80'
    return '#bdbdbd'
  }

  private _renderDebugOverlay(gl: WebGLRenderingContext, lines: string[]): void {
    if (!this._debugCtx || !this._debugCanvas || !this.debugTex) return
    const allLines = ["Renderer WebGL", ...lines]
    const ctx = this._debugCtx
    const lineH = 15; const padX = 10; const padY = 6; const fontSize = 11; const radius = 5
    ctx.font = `${fontSize}px monospace`
    let maxW = 0
    for (const l of allLines) { const w = ctx.measureText(l).width; if (w > maxW) maxW = w }
    const bgW = Math.ceil(maxW + padX * 2)
    const bgH = Math.ceil(lineH * allLines.length + padY * 2)

    if (this._debugCanvas.width !== bgW || this._debugCanvas.height !== bgH) {
      this._debugCanvas.width = bgW; this._debugCanvas.height = bgH
      ctx.font = `${fontSize}px monospace`
      gl.bindTexture(gl.TEXTURE_2D, this.debugTex)
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, bgW, bgH, 0, gl.RGBA, gl.UNSIGNED_BYTE, null)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    }

    ctx.clearRect(0, 0, bgW, bgH)

    // Rounded rect background
    ctx.beginPath()
    ctx.moveTo(radius, 0)
    ctx.lineTo(bgW - radius, 0)
    ctx.arcTo(bgW, 0, bgW, radius, radius)
    ctx.lineTo(bgW, bgH - radius)
    ctx.arcTo(bgW, bgH, bgW - radius, bgH, radius)
    ctx.lineTo(radius, bgH)
    ctx.arcTo(0, bgH, 0, bgH - radius, radius)
    ctx.lineTo(0, radius)
    ctx.arcTo(0, 0, radius, 0, radius)
    ctx.closePath()
    ctx.fillStyle = 'rgba(0,0,0,0.72)'; ctx.fill()
    ctx.strokeStyle = 'rgba(255,255,255,0.18)'; ctx.lineWidth = 1; ctx.stroke()

    // Text with shadow
    ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 2; ctx.shadowOffsetX = 0; ctx.shadowOffsetY = 1
    ctx.textBaseline = 'top'
    for (let i = 0; i < allLines.length; i++) {
      ctx.fillStyle = this._lineColor(allLines[i])
      ctx.fillText(allLines[i], padX, padY + i * lineH)
    }
    ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0

    gl.bindTexture(gl.TEXTURE_2D, this.debugTex)
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, gl.RGBA, gl.UNSIGNED_BYTE, this._debugCanvas)

    gl.enable(gl.BLEND)
    gl.blendEquation(gl.FUNC_ADD)
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA)

    gl.useProgram(this.copyProgram)
    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, this.debugTex)
    gl.uniform1i(this.copyULoc.texture, 0)

    const { pos: posLoc, uv: uvLoc } = this.copyAttribLoc
    gl.enableVertexAttribArray(posLoc); gl.enableVertexAttribArray(uvLoc)
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuf)

    // Bottom-left positioning (y=-1 is bottom in clip space)
    const qr = -1 + (bgW * this.dpr / this.w) * 2
    const qb = -1 + (bgH * this.dpr / this.h) * 2
    const verts = new Float32Array([
      -1, qb, 0, 0,   -1, -1, 0, 1,   qr, qb, 1, 0,   qr, -1, 1, 1,
    ])
    gl.bufferData(gl.ARRAY_BUFFER, verts, gl.DYNAMIC_DRAW)
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 16, 0)
    gl.vertexAttribPointer(uvLoc, 2, gl.FLOAT, false, 16, 8)
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)

    gl.disable(gl.BLEND)
    gl.useProgram(this.lineProgram)
  }

  private _drawDirtyRectVisual(gl: WebGLRenderingContext, rect: DirtyRect, skyColor: { r: number; g: number; b: number }): void {
    const { pos: posLoc, col: colLoc } = this.lineAttribLoc
    gl.enableVertexAttribArray(posLoc); gl.enableVertexAttribArray(colLoc)

    gl.useProgram(this.lineProgram)
    gl.uniform2f(this.lineULoc.stageSize, this.stageW, this.stageH)

    // Contrast color against sky background
    const skyLum = skyColor.r * 0.299 + skyColor.g * 0.587 + skyColor.b * 0.114
    const cr = skyLum > 128 ? 0.2 : 1.0
    const cg = skyLum > 128 ? 0.8 : 0.3
    const cb = skyLum > 128 ? 0.2 : 0.3

    const x = rect.x; const y = rect.y; const w = rect.w; const h = rect.h
    const verts = new Float32Array([
      x, y,     cr, cg, cb,
      x + w, y, cr, cg, cb,
      x + w, y + h, cr, cg, cb,
      x, y + h, cr, cg, cb,
    ])

    gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuf)
    gl.bufferData(gl.ARRAY_BUFFER, verts, gl.DYNAMIC_DRAW)
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 20, 0)
    gl.vertexAttribPointer(colLoc, 3, gl.FLOAT, false, 20, 8)

    gl.enable(gl.BLEND)
    gl.blendEquation(gl.FUNC_ADD)
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA)
    gl.drawArrays(gl.LINE_LOOP, 0, 4)
    gl.disable(gl.BLEND)
  }
}
