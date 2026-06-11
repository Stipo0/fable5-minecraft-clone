import { createBrowserApp } from './apps/browser'
import { createHomeApp } from './apps/home'
import { createPaintApp } from './apps/paint'
import { createSnakeApp } from './apps/snake'
import { createWebApp } from './apps/web'

/**
 * A full-screen "application" running on an in-world display. Apps draw with
 * the 2D canvas API and receive pointer/keyboard/wheel events that the game
 * forwards from the player's crosshair and real keyboard.
 */
export interface ScreenApp {
  readonly title: string
  draw(os: ScreenOS, now: number, dt: number): void
  pointerDown?(os: ScreenOS, x: number, y: number): void
  /** Only called while the pointer button is held (drag). */
  pointerMove?(os: ScreenOS, x: number, y: number): void
  pointerUp?(os: ScreenOS, x: number, y: number): void
  key?(os: ScreenOS, event: KeyboardEvent): void
  wheel?(os: ScreenOS, deltaY: number): void
  /** Called when the user navigates away from the app. */
  blur?(os: ScreenOS): void
}

export interface LauncherEntry {
  readonly icon: string
  readonly title: string
  readonly app: ScreenApp
}

/** Callbacks into the screen manager (keyboard capture is a global resource). */
export interface OsHooks {
  requestKeyboard(): void
  releaseKeyboard(): void
  /** Opens a real, interactive web page (iframe) over this panel. */
  openWebview(url: string): void
  closeWebview(): void
  /** URL of this panel's active webview session, or null. */
  webviewUrl(): string | null
}

const MAX_TEXTURE = 2048
const PX_PER_BLOCK = 256
const BOOT_MS = 1300

export const UI_FONT = "'Segoe UI', system-ui, sans-serif"

/**
 * One virtual computer per screen panel: owns the backing canvas (used as a
 * three.js texture), a boot splash, a taskbar and a set of launchable apps.
 */
export class ScreenOS {
  readonly canvas: HTMLCanvasElement
  readonly ctx: CanvasRenderingContext2D
  readonly w: number
  readonly h: number
  /** UI scale; 1 roughly matches a 320px-tall display. */
  readonly s: number
  readonly taskH: number
  readonly apps: readonly LauncherEntry[]
  /** Crosshair-projected cursor in canvas pixels; null while not aimed at. */
  cursor: { x: number; y: number } | null = null
  /** True while this screen owns the real keyboard (set by the manager). */
  kbdCaptured = false
  lastDraw = 0

  private current: ScreenApp
  private readonly home: ScreenApp
  private bootUntil = performance.now() + BOOT_MS

  constructor(
    wBlocks: number,
    hBlocks: number,
    readonly hooks: OsHooks,
  ) {
    const px = Math.max(
      48,
      Math.min(PX_PER_BLOCK, Math.floor(MAX_TEXTURE / Math.max(wBlocks, hBlocks))),
    )
    this.w = wBlocks * px
    this.h = hBlocks * px
    this.s = Math.max(0.7, Math.min(3.2, Math.min(this.w, this.h) / 320))
    this.canvas = document.createElement('canvas')
    this.canvas.width = this.w
    this.canvas.height = this.h
    const ctx = this.canvas.getContext('2d')
    if (!ctx) throw new Error('2D canvas is not supported')
    this.ctx = ctx
    this.taskH = Math.round(Math.max(18, 22 * this.s))
    this.home = createHomeApp()
    this.apps = [
      { icon: '🌍', title: 'Web', app: createWebApp() },
      { icon: '🌐', title: 'BlockWiki', app: createBrowserApp() },
      { icon: '🎨', title: 'Paint', app: createPaintApp() },
      { icon: '🐍', title: 'Snake', app: createSnakeApp() },
    ]
    this.current = this.home
  }

  get contentH(): number {
    return this.h - this.taskH
  }

  open(app: ScreenApp): void {
    if (this.current === app) return
    this.current.blur?.(this)
    this.hooks.releaseKeyboard()
    this.current = app
  }

  goHome(): void {
    this.open(this.home)
  }

  draw(now: number): void {
    const dt = this.lastDraw === 0 ? 0 : Math.min(0.1, (now - this.lastDraw) / 1000)
    this.lastDraw = now
    const { ctx } = this
    ctx.fillStyle = '#0b0e14'
    ctx.fillRect(0, 0, this.w, this.h)
    if (now < this.bootUntil) {
      this.drawBoot(now)
    } else {
      ctx.save()
      ctx.beginPath()
      ctx.rect(0, 0, this.w, this.contentH)
      ctx.clip()
      this.current.draw(this, now, dt)
      ctx.restore()
      this.drawTaskbar()
    }
    this.drawCursor()
  }

  pointerDown(x: number, y: number): void {
    if (performance.now() < this.bootUntil) {
      this.bootUntil = 0 // clicking skips the boot splash
      return
    }
    if (y >= this.contentH) {
      if (x <= this.taskH * 1.7) this.goHome()
      return
    }
    this.current.pointerDown?.(this, x, y)
  }

  pointerMove(x: number, y: number): void {
    this.current.pointerMove?.(this, x, y)
  }

  pointerUp(x: number, y: number): void {
    this.current.pointerUp?.(this, x, y)
  }

  key(event: KeyboardEvent): void {
    this.current.key?.(this, event)
  }

  wheel(deltaY: number): void {
    this.current.wheel?.(this, deltaY)
  }

  private drawBoot(now: number): void {
    const { ctx, w, h, s } = this
    const progress = Math.min(1, 1 - (this.bootUntil - now) / BOOT_MS)
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillStyle = '#74e0c9'
    ctx.font = `700 ${Math.round(28 * s)}px ${UI_FONT}`
    ctx.fillText('BlockOS', w / 2, h * 0.4)
    ctx.fillStyle = 'rgba(160, 190, 210, 0.6)'
    ctx.font = `${Math.round(10 * s)}px ${UI_FONT}`
    ctx.fillText('voxel display system', w / 2, h * 0.4 + 24 * s)
    const barW = w * 0.42
    const barH = Math.max(4, 5 * s)
    const barY = h * 0.62
    ctx.fillStyle = 'rgba(255,255,255,0.12)'
    ctx.fillRect((w - barW) / 2, barY, barW, barH)
    ctx.fillStyle = '#74e0c9'
    ctx.fillRect((w - barW) / 2, barY, barW * progress, barH)
    ctx.textAlign = 'left'
    ctx.textBaseline = 'alphabetic'
  }

  private drawTaskbar(): void {
    const { ctx, w, s, taskH } = this
    const y0 = this.contentH
    ctx.fillStyle = '#10141c'
    ctx.fillRect(0, y0, w, taskH)
    ctx.fillStyle = 'rgba(110, 150, 190, 0.35)'
    ctx.fillRect(0, y0, w, 1)
    ctx.textBaseline = 'middle'
    const mid = y0 + taskH / 2
    // home button
    ctx.fillStyle = this.current === this.home ? '#2c5d8f' : '#1d2330'
    ctx.beginPath()
    ctx.roundRect(3, y0 + 3, taskH * 1.4, taskH - 6, 4 * s)
    ctx.fill()
    ctx.fillStyle = '#cfe3f5'
    ctx.font = `${Math.round(11 * s)}px ${UI_FONT}`
    ctx.textAlign = 'center'
    ctx.fillText('⌂', 3 + (taskH * 1.4) / 2, mid + 0.5)
    // current app title
    ctx.textAlign = 'left'
    ctx.fillStyle = '#8da6bd'
    ctx.fillText(this.current.title, taskH * 1.7 + 6 * s, mid + 0.5)
    // clock (and keyboard indicator) on the right
    const d = new Date()
    const clock = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
    ctx.textAlign = 'right'
    ctx.fillStyle = '#cfe3f5'
    ctx.fillText(clock, w - 6 * s, mid + 0.5)
    if (this.kbdCaptured) {
      ctx.fillStyle = '#ffd166'
      ctx.fillText('⌨ [`] exit', w - 6 * s - ctx.measureText(clock).width - 14 * s, mid + 0.5)
    }
    ctx.textAlign = 'left'
    ctx.textBaseline = 'alphabetic'
  }

  private drawCursor(): void {
    if (!this.cursor) return
    const { ctx, s } = this
    const { x, y } = this.cursor
    ctx.beginPath()
    ctx.moveTo(x, y)
    ctx.lineTo(x, y + 12 * s)
    ctx.lineTo(x + 3.4 * s, y + 8.8 * s)
    ctx.lineTo(x + 8.4 * s, y + 8.4 * s)
    ctx.closePath()
    ctx.fillStyle = '#ffffff'
    ctx.fill()
    ctx.strokeStyle = '#10141c'
    ctx.lineWidth = Math.max(1, 1.2 * s)
    ctx.stroke()
  }
}
