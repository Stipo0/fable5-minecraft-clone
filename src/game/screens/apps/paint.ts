import { UI_FONT, type ScreenApp, type ScreenOS } from '../ScreenOS'

interface Zone {
  x: number
  y: number
  w: number
  h: number
  act: () => void
}

const COLORS = [
  '#1d1d1f',
  '#ffffff',
  '#e53935',
  '#fb8c00',
  '#fdd835',
  '#43a047',
  '#1e88e5',
  '#8e24aa',
] as const

const BRUSHES = [2, 5, 10] as const

/** Free-hand drawing on a persistent offscreen canvas; drag with right-click. */
export function createPaintApp(): ScreenApp {
  let surface: HTMLCanvasElement | null = null
  let sctx: CanvasRenderingContext2D | null = null
  let color: string = COLORS[0]
  let brush: number = BRUSHES[1]
  let last: { x: number; y: number } | null = null
  let zones: Zone[] = []
  let toolbarH = 0

  const ensureSurface = (os: ScreenOS): CanvasRenderingContext2D => {
    if (!sctx) {
      surface = document.createElement('canvas')
      surface.width = os.w
      surface.height = os.contentH
      const c = surface.getContext('2d')
      if (!c) throw new Error('2D canvas is not supported')
      c.fillStyle = '#ffffff'
      c.fillRect(0, 0, surface.width, surface.height)
      c.lineCap = 'round'
      c.lineJoin = 'round'
      sctx = c
    }
    return sctx
  }

  const stroke = (os: ScreenOS, x: number, y: number): void => {
    const c = ensureSurface(os)
    c.strokeStyle = color
    c.lineWidth = brush * os.s
    c.beginPath()
    c.moveTo(last?.x ?? x, last?.y ?? y)
    c.lineTo(x, y)
    c.stroke()
    last = { x, y }
  }

  return {
    title: 'Paint',

    draw(os) {
      const { ctx, w, s } = os
      const h = os.contentH
      ensureSurface(os)
      if (surface) ctx.drawImage(surface, 0, 0)

      // toolbar overlays the top of the drawing
      toolbarH = Math.round(24 * s)
      zones = []
      ctx.fillStyle = 'rgba(28, 32, 40, 0.92)'
      ctx.fillRect(0, 0, w, toolbarH)
      const sw = toolbarH - 8 * s
      let x = 4 * s
      for (const c of COLORS) {
        ctx.fillStyle = c
        ctx.fillRect(x, 4 * s, sw, sw)
        if (c === color) {
          ctx.strokeStyle = '#ffd166'
          ctx.lineWidth = Math.max(1, 1.6 * s)
          ctx.strokeRect(x - 1, 4 * s - 1, sw + 2, sw + 2)
        }
        const cc = c
        zones.push({ x, y: 0, w: sw, h: toolbarH, act: () => (color = cc) })
        x += sw + 4 * s
      }
      x += 6 * s
      for (const b of BRUSHES) {
        ctx.fillStyle = b === brush ? '#ffd166' : '#9fb2c4'
        ctx.beginPath()
        ctx.arc(x + sw / 2, toolbarH / 2, (b * s) / 2 + 1, 0, Math.PI * 2)
        ctx.fill()
        const bb = b
        zones.push({ x, y: 0, w: sw, h: toolbarH, act: () => (brush = bb) })
        x += sw + 4 * s
      }
      ctx.fillStyle = '#dbe6f3'
      ctx.font = `${Math.max(9, Math.round(10 * s))}px ${UI_FONT}`
      ctx.textBaseline = 'middle'
      const clearLabel = '🗑 Clear'
      const clearW = ctx.measureText(clearLabel).width
      ctx.fillText(clearLabel, w - clearW - 6 * s, toolbarH / 2 + 0.5)
      zones.push({
        x: w - clearW - 10 * s,
        y: 0,
        w: clearW + 10 * s,
        h: toolbarH,
        act: () => {
          if (sctx && surface) {
            sctx.fillStyle = '#ffffff'
            sctx.fillRect(0, 0, surface.width, surface.height)
          }
        },
      })
      ctx.textBaseline = 'alphabetic'
      // hint
      ctx.fillStyle = 'rgba(28, 32, 40, 0.45)'
      ctx.font = `${Math.max(9, Math.round(9.5 * s))}px ${UI_FONT}`
      ctx.fillText('hold right-click to draw', 6 * s, h - 6 * s)
    },

    pointerDown(os, x, y) {
      if (y < toolbarH) {
        for (const zone of zones) {
          if (x >= zone.x && x <= zone.x + zone.w && y >= zone.y && y <= zone.y + zone.h) {
            zone.act()
            return
          }
        }
        return
      }
      last = null
      stroke(os, x, y)
    },

    pointerMove(os, x, y) {
      if (last && y >= toolbarH) stroke(os, x, y)
    },

    pointerUp() {
      last = null
    },
  }
}
