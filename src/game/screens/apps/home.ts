import { UI_FONT, type ScreenApp } from '../ScreenOS'

interface Zone {
  x: number
  y: number
  w: number
  h: number
  open: () => void
}

/** Launcher: wallpaper, a big clock and one icon per installed app. */
export function createHomeApp(): ScreenApp {
  let zones: Zone[] = []

  return {
    title: 'Home',
    draw(os) {
      const { ctx, w, s } = os
      const h = os.contentH
      const grad = ctx.createLinearGradient(0, 0, 0, h)
      grad.addColorStop(0, '#0e1c2e')
      grad.addColorStop(1, '#13283a')
      ctx.fillStyle = grad
      ctx.fillRect(0, 0, w, h)
      // faint dot-grid wallpaper
      ctx.fillStyle = 'rgba(120, 180, 220, 0.07)'
      const step = Math.max(12, Math.round(18 * s))
      for (let dy = step; dy < h; dy += step) {
        for (let dx = step; dx < w; dx += step) ctx.fillRect(dx, dy, 2, 2)
      }

      const d = new Date()
      const clock = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'alphabetic'
      ctx.fillStyle = '#e8f4ff'
      ctx.font = `600 ${Math.round(34 * s)}px ${UI_FONT}`
      ctx.fillText(clock, w / 2, h * 0.32)
      ctx.fillStyle = 'rgba(200, 225, 245, 0.55)'
      ctx.font = `${Math.round(11 * s)}px ${UI_FONT}`
      ctx.fillText(d.toLocaleDateString(), w / 2, h * 0.32 + 18 * s)

      zones = []
      const n = os.apps.length
      const tile = Math.min(64 * s, (w * 0.82) / (n + (n - 1) * 0.35))
      const gap = tile * 0.35
      let x = (w - (n * tile + (n - 1) * gap)) / 2
      const y = Math.min(h * 0.48, h - tile - 22 * s)
      for (const entry of os.apps) {
        ctx.fillStyle = 'rgba(255,255,255,0.09)'
        ctx.beginPath()
        ctx.roundRect(x, y, tile, tile, tile * 0.22)
        ctx.fill()
        ctx.strokeStyle = 'rgba(255,255,255,0.16)'
        ctx.lineWidth = 1
        ctx.stroke()
        ctx.textBaseline = 'middle'
        ctx.font = `${Math.round(tile * 0.5)}px ${UI_FONT}`
        ctx.fillStyle = '#ffffff'
        ctx.fillText(entry.icon, x + tile / 2, y + tile * 0.54)
        ctx.textBaseline = 'alphabetic'
        ctx.font = `${Math.round(10.5 * s)}px ${UI_FONT}`
        ctx.fillStyle = '#cfe3f5'
        ctx.fillText(entry.title, x + tile / 2, y + tile + 13 * s)
        zones.push({ x, y, w: tile, h: tile + 16 * s, open: () => os.open(entry.app) })
        x += tile + gap
      }
      ctx.textAlign = 'left'
    },
    pointerDown(_os, x, y) {
      for (const zone of zones) {
        if (x >= zone.x && x <= zone.x + zone.w && y >= zone.y && y <= zone.y + zone.h) {
          zone.open()
          return
        }
      }
    },
  }
}
