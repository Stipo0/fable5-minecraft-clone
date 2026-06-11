import { UI_FONT, type ScreenApp, type ScreenOS } from '../ScreenOS'

interface SearchResult {
  title: string
  snippet: string
}

type Page =
  | { kind: 'start' }
  | { kind: 'loading'; label: string }
  | { kind: 'error'; message: string; retry: (() => void) | null }
  | { kind: 'results'; query: string; results: SearchResult[] }
  | { kind: 'article'; title: string; description: string; extract: string; image: ArticleImage }

interface ArticleImage {
  el: HTMLImageElement | null
}

interface Zone {
  x: number
  y: number
  w: number
  h: number
  act: () => void
}

interface WikiSearchResponse {
  query?: { search?: { title: string; snippet: string }[] }
}

interface WikiSummary {
  title?: string
  description?: string
  extract?: string
  thumbnail?: { source?: string }
}

const ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  '#39': "'",
  nbsp: ' ',
}

function cleanHtml(input: string): string {
  return input
    .replace(/<[^>]*>/g, '')
    .replace(/&([a-z#0-9]+);/gi, (match, name: string) => ENTITIES[name.toLowerCase()] ?? match)
}

const SUGGESTIONS: Record<'hu' | 'en', readonly string[]> = {
  hu: ['Minecraft', 'Budapest', 'Bálnák', 'Űrkutatás'],
  en: ['Minecraft', 'Budapest', 'Whales', 'Space exploration'],
}

/**
 * "BlockWiki" — an in-world browser. It loads real pages through the
 * Wikipedia search + summary APIs (both CORS-enabled, so the canvas texture
 * stays untainted) and renders them with the 2D canvas API.
 */
export function createBrowserApp(): ScreenApp {
  let lang: 'hu' | 'en' = 'hu'
  let page: Page = { kind: 'start' }
  const history: Page[] = []
  let scroll = 0
  let maxScroll = 0
  let zones: Zone[] = []
  let addrFocus = false
  let buffer = ''
  let reqId = 0

  const setPage = (next: Page): void => {
    if (page.kind === 'start' || page.kind === 'results' || page.kind === 'article') {
      history.push(page)
      if (history.length > 32) history.shift()
    }
    page = next
    scroll = 0
  }

  const goBack = (): void => {
    const prev = history.pop()
    if (prev) {
      reqId++ // cancel any in-flight load
      page = prev
      scroll = 0
    }
  }

  const search = (query: string): void => {
    const q = query.trim()
    if (!q) return
    const id = ++reqId
    setPage({ kind: 'loading', label: `Searching “${q}”…` })
    const url =
      `https://${lang}.wikipedia.org/w/api.php?action=query&list=search` +
      `&srsearch=${encodeURIComponent(q)}&utf8=1&format=json&origin=*&srlimit=10`
    fetch(url)
      .then((r) => r.json())
      .then((json: unknown) => {
        if (id !== reqId) return
        const raw = (json as WikiSearchResponse).query?.search ?? []
        page = {
          kind: 'results',
          query: q,
          results: raw.map((r) => ({ title: r.title, snippet: cleanHtml(r.snippet) })),
        }
        scroll = 0
      })
      .catch(() => {
        if (id === reqId) page = { kind: 'error', message: 'Network error.', retry: () => search(q) }
      })
  }

  const openArticle = (title: string): void => {
    const id = ++reqId
    setPage({ kind: 'loading', label: `Loading “${title}”…` })
    const url = `https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(
      title.replace(/ /g, '_'),
    )}`
    fetch(url)
      .then((r) => {
        if (!r.ok) throw new Error(String(r.status))
        return r.json()
      })
      .then((json: unknown) => {
        if (id !== reqId) return
        const data = json as WikiSummary
        const image: ArticleImage = { el: null }
        const src = data.thumbnail?.source
        if (src) {
          const img = new Image()
          img.crossOrigin = 'anonymous' // upload.wikimedia.org allows CORS
          img.onload = () => {
            image.el = img
          }
          img.src = src
        }
        page = {
          kind: 'article',
          title: data.title ?? title,
          description: data.description ?? '',
          extract: data.extract || 'No summary available for this page.',
          image,
        }
        scroll = 0
      })
      .catch(() => {
        if (id === reqId) {
          page = { kind: 'error', message: 'Could not load the page.', retry: () => openArticle(title) }
        }
      })
  }

  const unfocusAddr = (os: ScreenOS): void => {
    if (!addrFocus) return
    addrFocus = false
    os.hooks.releaseKeyboard()
  }

  return {
    title: 'BlockWiki',

    draw(os, now) {
      const { ctx, w, s } = os
      const h = os.contentH
      zones = []
      // the manager may have taken the keyboard away (backtick, distance, pause)
      if (addrFocus && !os.kbdCaptured) addrFocus = false

      const tb = Math.round(30 * s)
      const pad = Math.round(10 * s)
      const font = (px: number, weight = 400): string =>
        `${weight} ${Math.max(9, Math.round(px * s))}px ${UI_FONT}`

      ctx.fillStyle = '#fbfaf7'
      ctx.fillRect(0, 0, w, h)

      // --- content (clipped under the toolbar) ---
      ctx.save()
      ctx.beginPath()
      ctx.rect(0, tb, w, h - tb)
      ctx.clip()
      ctx.textAlign = 'left'
      ctx.textBaseline = 'alphabetic'
      let y = tb + pad + 14 * s - scroll

      if (page.kind === 'start') {
        ctx.textAlign = 'center'
        ctx.font = `${Math.round(34 * s)}px ${UI_FONT}`
        ctx.fillText('🌐', w / 2, y + 24 * s)
        ctx.fillStyle = '#1c1c1c'
        ctx.font = font(24, 700)
        ctx.fillText('BlockWiki', w / 2, y + 58 * s)
        ctx.fillStyle = '#8a8a84'
        ctx.font = font(10.5)
        ctx.fillText('Wikipedia, inside the voxel world', w / 2, y + 74 * s)
        // search box
        const bw = Math.min(w * 0.74, 360 * s)
        const bh = 26 * s
        const bx = (w - bw) / 2
        const by = y + 88 * s
        ctx.fillStyle = '#ffffff'
        ctx.strokeStyle = addrFocus ? '#2a6fdb' : '#c8c8c2'
        ctx.lineWidth = Math.max(1, 1.4 * s)
        ctx.beginPath()
        ctx.roundRect(bx, by, bw, bh, bh / 2)
        ctx.fill()
        ctx.stroke()
        ctx.textAlign = 'left'
        ctx.font = font(11.5)
        if (addrFocus) {
          ctx.fillStyle = '#1c1c1c'
          const caret = now % 1000 < 500 ? '▏' : ''
          ctx.fillText(buffer + caret, bx + 12 * s, by + bh * 0.66, bw - 24 * s)
        } else {
          ctx.fillStyle = '#9a9a94'
          ctx.fillText('Search Wikipedia…  (click, then type)', bx + 12 * s, by + bh * 0.66)
        }
        zones.push({
          x: bx,
          y: by,
          w: bw,
          h: bh,
          act: () => {
            addrFocus = true
            buffer = ''
            os.hooks.requestKeyboard()
          },
        })
        // suggestion chips
        ctx.font = font(10.5)
        const chips = SUGGESTIONS[lang]
        const chipH = 18 * s
        let cx = 0
        const widths = chips.map((c) => ctx.measureText(c).width + 18 * s)
        const totalW = widths.reduce((a, b) => a + b, 0) + (chips.length - 1) * 6 * s
        cx = (w - totalW) / 2
        const cy = by + bh + 14 * s
        chips.forEach((chip, i) => {
          ctx.fillStyle = '#eef1f6'
          ctx.strokeStyle = '#d4d9e2'
          ctx.beginPath()
          ctx.roundRect(cx, cy, widths[i], chipH, chipH / 2)
          ctx.fill()
          ctx.stroke()
          ctx.fillStyle = '#2a6fdb'
          ctx.fillText(chip, cx + 9 * s, cy + chipH * 0.68)
          zones.push({ x: cx, y: cy, w: widths[i], h: chipH, act: () => search(chip) })
          cx += widths[i] + 6 * s
        })
        ctx.textAlign = 'left'
        y = cy + chipH + 20 * s
      } else if (page.kind === 'loading') {
        const cx = w / 2
        const cy = tb + (h - tb) / 2
        ctx.strokeStyle = '#2a6fdb'
        ctx.lineWidth = Math.max(2, 3 * s)
        ctx.beginPath()
        const a = (now / 140) % (Math.PI * 2)
        ctx.arc(cx, cy - 10 * s, 12 * s, a, a + Math.PI * 1.4)
        ctx.stroke()
        ctx.fillStyle = '#6a6a64'
        ctx.font = font(11)
        ctx.textAlign = 'center'
        ctx.fillText(page.label, cx, cy + 18 * s, w - pad * 2)
        ctx.textAlign = 'left'
        y = cy + 30 * s
      } else if (page.kind === 'error') {
        const current = page
        ctx.fillStyle = '#b3372f'
        ctx.font = font(13, 600)
        ctx.fillText(`⚠ ${current.message}`, pad, y)
        if (current.retry) {
          y += 22 * s
          ctx.fillStyle = '#2a6fdb'
          ctx.font = font(12)
          const label = '↻ Retry'
          ctx.fillText(label, pad, y)
          const lw = ctx.measureText(label).width
          zones.push({ x: pad, y: y - 12 * s, w: lw, h: 16 * s, act: current.retry })
        }
        y += 20 * s
      } else if (page.kind === 'results') {
        ctx.fillStyle = '#8a8a84'
        ctx.font = font(10)
        ctx.fillText(
          `${page.results.length} result${page.results.length === 1 ? '' : 's'} for “${page.query}”`,
          pad,
          y,
        )
        y += 16 * s
        if (page.results.length === 0) {
          ctx.fillStyle = '#55554f'
          ctx.font = font(12)
          ctx.fillText('No results.', pad, y + 8 * s)
          y += 24 * s
        }
        for (const result of page.results) {
          ctx.fillStyle = '#1a4b8c'
          ctx.font = font(13, 600)
          ctx.fillText(result.title, pad, y, w - pad * 2)
          const tw = Math.min(ctx.measureText(result.title).width, w - pad * 2)
          ctx.fillRect(pad, y + 2 * s, tw, 1)
          zones.push({
            x: pad,
            y: y - 12 * s,
            w: tw,
            h: 16 * s,
            act: () => openArticle(result.title),
          })
          y += 16 * s
          ctx.fillStyle = '#55554f'
          ctx.font = font(10.5)
          const lines = wrapText(ctx, result.snippet, w - pad * 2)
          for (const line of lines.slice(0, 2)) {
            ctx.fillText(line, pad, y)
            y += 13 * s
          }
          y += 10 * s
        }
      } else {
        // article
        ctx.fillStyle = '#1c1c1c'
        ctx.font = font(19, 700)
        const titleLines = wrapText(ctx, page.title, w - pad * 2)
        for (const line of titleLines) {
          ctx.fillText(line, pad, y)
          y += 24 * s
        }
        if (page.description) {
          ctx.fillStyle = '#8a8a84'
          ctx.font = `italic ${font(10.5)}`
          ctx.fillText(page.description, pad, y, w - pad * 2)
          y += 14 * s
        }
        ctx.fillStyle = '#d8d8d2'
        ctx.fillRect(pad, y, w - pad * 2, 1)
        y += 14 * s

        // optional thumbnail, floated to the right
        const img = page.image.el
        let imgBottom = y
        let imgW = 0
        if (img) {
          imgW = Math.min(w * 0.36, img.width * s)
          const imgH = (imgW / img.width) * img.height
          const ix = w - pad - imgW
          ctx.drawImage(img, ix, y - 10 * s, imgW, imgH)
          ctx.strokeStyle = '#d8d8d2'
          ctx.lineWidth = 1
          ctx.strokeRect(ix, y - 10 * s, imgW, imgH)
          imgBottom = y - 10 * s + imgH + 8 * s
        }

        ctx.fillStyle = '#1c1c1c'
        ctx.font = font(12)
        const lineH = Math.round(12 * s * 1.5)
        const words = page.extract.split(/\s+/)
        let line = ''
        for (const word of words) {
          const avail = img && y < imgBottom ? w - pad * 3 - imgW : w - pad * 2
          const test = line ? `${line} ${word}` : word
          if (line && ctx.measureText(test).width > avail) {
            ctx.fillText(line, pad, y)
            y += lineH
            line = word
          } else {
            line = test
          }
        }
        if (line) {
          ctx.fillText(line, pad, y)
          y += lineH
        }
        y = Math.max(y, imgBottom)
        y += 10 * s
        ctx.fillStyle = '#a0a09a'
        ctx.font = font(9)
        ctx.fillText(`${lang}.wikipedia.org · text CC BY-SA`, pad, y)
        y += 12 * s
      }

      maxScroll = Math.max(0, y + scroll - tb - (h - tb) + pad)
      ctx.restore()

      // --- toolbar (drawn last so content scrolls underneath) ---
      ctx.fillStyle = '#2a2f3a'
      ctx.fillRect(0, 0, w, tb)
      ctx.textBaseline = 'middle'
      const btnW = 22 * s
      const btnH = tb - 8 * s
      const btnY = 4 * s
      const drawBtn = (x: number, label: string, enabled: boolean, act: () => void): number => {
        ctx.fillStyle = enabled ? '#3b4250' : '#323843'
        ctx.beginPath()
        ctx.roundRect(x, btnY, btnW, btnH, 4 * s)
        ctx.fill()
        ctx.fillStyle = enabled ? '#dbe6f3' : '#6b7380'
        ctx.font = font(11)
        ctx.textAlign = 'center'
        ctx.fillText(label, x + btnW / 2, tb / 2 + 0.5)
        if (enabled) zones.push({ x, y: btnY, w: btnW, h: btnH, act })
        return x + btnW + 4 * s
      }
      let x = 4 * s
      x = drawBtn(x, '◀', history.length > 0, goBack)
      x = drawBtn(x, '⌂', page.kind !== 'start', () => setPage({ kind: 'start' }))
      // language toggle on the right
      const langW = 26 * s
      const langX = w - langW - 4 * s
      drawBtn(langX, lang.toUpperCase(), true, () => {
        lang = lang === 'hu' ? 'en' : 'hu'
      })
      // address box
      const ax = x
      const aw = langX - x - 4 * s
      ctx.fillStyle = '#ffffff'
      ctx.beginPath()
      ctx.roundRect(ax, btnY, aw, btnH, btnH / 2)
      ctx.fill()
      if (addrFocus) {
        ctx.strokeStyle = '#2a6fdb'
        ctx.lineWidth = Math.max(1, 1.4 * s)
        ctx.stroke()
      }
      ctx.textAlign = 'left'
      ctx.font = font(10.5)
      let addrLabel: string
      if (addrFocus) {
        addrLabel = buffer + (now % 1000 < 500 ? '▏' : '')
        ctx.fillStyle = '#1c1c1c'
      } else {
        addrLabel =
          page.kind === 'article'
            ? `${lang}.wikipedia.org / ${page.title}`
            : page.kind === 'results'
              ? `search: ${page.query}`
              : `${lang}.wikipedia.org`
        ctx.fillStyle = '#6a6a64'
      }
      ctx.fillText(addrLabel, ax + 10 * s, tb / 2 + 0.5, aw - 20 * s)
      zones.push({
        x: ax,
        y: btnY,
        w: aw,
        h: btnH,
        act: () => {
          addrFocus = true
          buffer = ''
          os.hooks.requestKeyboard()
        },
      })
      ctx.textBaseline = 'alphabetic'
    },

    pointerDown(os, x, y) {
      for (let i = zones.length - 1; i >= 0; i--) {
        const zone = zones[i]
        if (x >= zone.x && x <= zone.x + zone.w && y >= zone.y && y <= zone.y + zone.h) {
          zone.act()
          return
        }
      }
      unfocusAddr(os)
    },

    key(os, event) {
      if (!addrFocus) return
      if (event.key === 'Enter') {
        const query = buffer
        unfocusAddr(os)
        search(query)
      } else if (event.key === 'Backspace') {
        buffer = buffer.slice(0, -1)
      } else if (event.key.length === 1 && buffer.length < 64) {
        buffer += event.key
      }
    },

    wheel(_os, deltaY) {
      scroll = Math.min(maxScroll, Math.max(0, scroll + deltaY * 0.5))
    },

    blur(os) {
      unfocusAddr(os)
    },
  }
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const lines: string[] = []
  let line = ''
  for (const word of text.split(/\s+/)) {
    const test = line ? `${line} ${word}` : word
    if (line && ctx.measureText(test).width > maxWidth) {
      lines.push(line)
      line = word
    } else {
      line = test
    }
  }
  if (line) lines.push(line)
  return lines
}
