import { UI_FONT, type ScreenApp, type ScreenOS } from '../ScreenOS'

interface Zone {
  x: number
  y: number
  w: number
  h: number
  act: () => void
}

const QUICK_LINKS: readonly { label: string; url: string }[] = [
  {
    label: '🗺 Budapest map',
    url: 'https://www.openstreetmap.org/export/embed.html?bbox=18.98%2C47.45%2C19.12%2C47.55&layer=mapnik',
  },
  { label: '🧱 This game', url: 'https://stipo0.github.io/fable5-minecraft-clone/' },
  { label: '📄 example.com', url: 'https://example.com' },
]

function normalizeUrl(input: string): string {
  const trimmed = input.trim()
  if (!trimmed) return ''
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`
}

/**
 * "Web" — opens real, interactive websites. The page itself is a live iframe
 * that the game projects onto the panel (see Screens.tsx); this canvas app is
 * the launcher: type a URL or pick a link, and resume past sessions.
 */
export function createWebApp(): ScreenApp {
  let lastUrl: string | null = null
  let buffer = ''
  let focus = false
  let zones: Zone[] = []

  const open = (os: ScreenOS, url: string): void => {
    const target = normalizeUrl(url)
    if (!target) return
    lastUrl = target
    os.hooks.openWebview(target)
  }

  const unfocus = (os: ScreenOS): void => {
    if (!focus) return
    focus = false
    os.hooks.releaseKeyboard()
  }

  return {
    title: 'Web',

    draw(os, now) {
      const { ctx, w, s } = os
      const h = os.contentH
      zones = []
      if (focus && !os.kbdCaptured) focus = false
      const active = os.hooks.webviewUrl()
      if (active) lastUrl = active // track navigations made in the DOM bar

      const grad = ctx.createLinearGradient(0, 0, 0, h)
      grad.addColorStop(0, '#101b2b')
      grad.addColorStop(1, '#16263a')
      ctx.fillStyle = grad
      ctx.fillRect(0, 0, w, h)

      const font = (px: number, weight = 400): string =>
        `${weight} ${Math.max(9, Math.round(px * s))}px ${UI_FONT}`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'alphabetic'
      ctx.font = `${Math.round(30 * s)}px ${UI_FONT}`
      ctx.fillText('🌍', w / 2, h * 0.2)
      ctx.fillStyle = '#e8f4ff'
      ctx.font = font(20, 700)
      ctx.fillText('Web', w / 2, h * 0.2 + 26 * s)

      if (active) {
        ctx.fillStyle = '#8df2a6'
        ctx.font = font(11)
        ctx.fillText('● session active', w / 2, h * 0.2 + 44 * s)
        ctx.fillStyle = '#9fb2c4'
        ctx.fillText(active, w / 2, h * 0.2 + 60 * s, w * 0.9)
        ctx.textAlign = 'left'
        return
      }

      // URL input
      const bw = Math.min(w * 0.78, 420 * s)
      const bh = 26 * s
      const bx = (w - bw) / 2
      const by = h * 0.38
      ctx.fillStyle = '#ffffff'
      ctx.strokeStyle = focus ? '#2a6fdb' : 'rgba(255,255,255,0.35)'
      ctx.lineWidth = Math.max(1, 1.4 * s)
      ctx.beginPath()
      ctx.roundRect(bx, by, bw, bh, bh / 2)
      ctx.fill()
      ctx.stroke()
      ctx.textAlign = 'left'
      ctx.font = font(11.5)
      if (focus) {
        ctx.fillStyle = '#1c1c1c'
        const caret = now % 1000 < 500 ? '▏' : ''
        ctx.fillText(buffer + caret, bx + 12 * s, by + bh * 0.66, bw - 24 * s)
      } else {
        ctx.fillStyle = '#9a9a94'
        ctx.fillText('Type a URL…  (click, then type, Enter opens)', bx + 12 * s, by + bh * 0.66)
      }
      zones.push({
        x: bx,
        y: by,
        w: bw,
        h: bh,
        act: () => {
          focus = true
          buffer = ''
          os.hooks.requestKeyboard()
        },
      })

      // quick links (plus resume, when there is a previous session)
      const chips: { label: string; url: string }[] = []
      if (lastUrl) chips.push({ label: '↻ Resume last page', url: lastUrl })
      chips.push(...QUICK_LINKS)
      ctx.font = font(10.5)
      const chipH = 19 * s
      let cy = by + bh + 16 * s
      let cx = 0
      let rowWidths: number[] = []
      const measure = (c: { label: string }) => ctx.measureText(c.label).width + 18 * s
      // simple centered rows
      let row: { label: string; url: string }[] = []
      const flushRow = () => {
        if (row.length === 0) return
        const total = rowWidths.reduce((a, b) => a + b, 0) + (row.length - 1) * 6 * s
        cx = (w - total) / 2
        row.forEach((chip, i) => {
          ctx.fillStyle = 'rgba(255,255,255,0.1)'
          ctx.strokeStyle = 'rgba(255,255,255,0.25)'
          ctx.beginPath()
          ctx.roundRect(cx, cy, rowWidths[i], chipH, chipH / 2)
          ctx.fill()
          ctx.stroke()
          ctx.fillStyle = '#9fd1ff'
          ctx.fillText(chip.label, cx + 9 * s, cy + chipH * 0.68)
          const url = chip.url
          zones.push({ x: cx, y: cy, w: rowWidths[i], h: chipH, act: () => open(os, url) })
          cx += rowWidths[i] + 6 * s
        })
        cy += chipH + 8 * s
        row = []
        rowWidths = []
      }
      for (const chip of chips) {
        const cw = measure(chip)
        const total = rowWidths.reduce((a, b) => a + b, 0) + cw + row.length * 6 * s
        if (row.length > 0 && total > w * 0.9) flushRow()
        row.push(chip)
        rowWidths.push(cw)
      }
      flushRow()

      ctx.fillStyle = 'rgba(200, 225, 245, 0.5)'
      ctx.font = font(9.5)
      ctx.textAlign = 'center'
      ctx.fillText('Opens the real page — your mouse is released while browsing.', w / 2, h - 26 * s)
      ctx.fillText('Some sites refuse to load in frames (X-Frame-Options).', w / 2, h - 13 * s)
      ctx.textAlign = 'left'
    },

    pointerDown(os, x, y) {
      for (let i = zones.length - 1; i >= 0; i--) {
        const zone = zones[i]
        if (x >= zone.x && x <= zone.x + zone.w && y >= zone.y && y <= zone.y + zone.h) {
          zone.act()
          return
        }
      }
      unfocus(os)
    },

    key(os, event) {
      if (!focus) return
      if (event.key === 'Enter') {
        const url = buffer
        unfocus(os)
        open(os, url)
      } else if (event.key === 'Backspace') {
        buffer = buffer.slice(0, -1)
      } else if (event.key.length === 1 && buffer.length < 128) {
        buffer += event.key
      }
    },

    blur(os) {
      unfocus(os)
    },
  }
}
