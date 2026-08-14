type StageEventType = "pointerstart" | "pointerend" | "pointermove" | "ticker"

export interface StagePointerEvent {
  x: number
  y: number
  onCanvas: boolean
}

class Stage {
  public canvas: HTMLCanvasElement
  public ctx: CanvasRenderingContext2D
  public width: number = 0
  public height: number = 0
  public dpr: number = 1

  private listeners: Map<StageEventType, Set<(...args: any[]) => void>> = new Map()
  private _boundPointerStart: (e: PointerEvent) => void
  private _boundPointerEnd: (e: PointerEvent) => void
  private _boundPointerMove: (e: PointerEvent) => void

  constructor(canvasId?: string) {
    this.canvas = document.createElement("canvas")
    if (canvasId) {
      this.canvas.id = canvasId
    }
    this.ctx = this.canvas.getContext("2d")!
    this.dpr = window.devicePixelRatio || 1

    this._boundPointerStart = this._handlePointerStart.bind(this)
    this._boundPointerEnd = this._handlePointerEnd.bind(this)
    this._boundPointerMove = this._handlePointerMove.bind(this)

    this.canvas.addEventListener("pointerdown", this._boundPointerStart)
    this.canvas.addEventListener("pointerup", this._boundPointerEnd)
    this.canvas.addEventListener("pointermove", this._boundPointerMove)
  }

  resize(width: number, height: number): void {
    this.width = width
    this.height = height
    this.canvas.width = width * this.dpr
    this.canvas.height = height * this.dpr
    this.canvas.style.width = width + "px"
    this.canvas.style.height = height + "px"
  }

  addEventListener(type: StageEventType, listener: (...args: any[]) => void): void {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, new Set())
    }
    this.listeners.get(type)!.add(listener)
  }

  removeEventListener(type: StageEventType, listener: (...args: any[]) => void): void {
    this.listeners.get(type)?.delete(listener)
  }

  dispatchTicker(frameTime: number, lag: number): void {
    const tickerListeners = this.listeners.get("ticker")
    if (tickerListeners) {
      tickerListeners.forEach((fn) => fn(frameTime, lag))
    }
  }

  mount(container: HTMLElement): void {
    container.appendChild(this.canvas)
  }

  destroy(): void {
    this.canvas.removeEventListener("pointerdown", this._boundPointerStart)
    this.canvas.removeEventListener("pointerup", this._boundPointerEnd)
    this.canvas.removeEventListener("pointermove", this._boundPointerMove)
    this.listeners.clear()
  }

  private _dispatch(type: StageEventType, event?: StagePointerEvent): void {
    const set = this.listeners.get(type)
    if (set) {
      set.forEach((fn) => fn(event))
    }
  }

  private _handlePointerStart(e: PointerEvent): void {
    const rect = this.canvas.getBoundingClientRect()
    this._dispatch("pointerstart", {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
      onCanvas: true,
    })
  }

  private _handlePointerEnd(e: PointerEvent): void {
    const rect = this.canvas.getBoundingClientRect()
    this._dispatch("pointerend", {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
      onCanvas: true,
    })
  }

  private _handlePointerMove(e: PointerEvent): void {
    const rect = this.canvas.getBoundingClientRect()
    this._dispatch("pointermove", {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
      onCanvas: true,
    })
  }
}

export default Stage
