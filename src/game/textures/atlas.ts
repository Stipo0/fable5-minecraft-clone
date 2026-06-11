import { mulberry32 } from '../../lib/random'
import { ATLAS_COLS, ATLAS_ROWS, Tile } from '../blocks'

export const TILE_PX = 16
const ATLAS_SEED = 0x5eed

type Ctx = CanvasRenderingContext2D
type Rng = () => number
/** Draws one 16×16 tile with its origin already translated to (0, 0). */
type Painter = (ctx: Ctx, rng: Rng) => void

const GRASS = ['#69b04a', '#5ea540', '#74bb52', '#549939']
const DIRT = ['#7a5a3c', '#6f5034', '#856444', '#684a2e']
const STONE = ['#7e7e7e', '#777777', '#868686', '#717171']
const SAND = ['#dbd19b', '#d4c992', '#e3d9a6', '#cdc289']
const SNOW = ['#f2f8fa', '#e9f1f4', '#fafdfe', '#e2ecf0']
const LEAVES = ['#2e7a1e', '#286f19', '#357f24', '#1f5c12', '#16400c']
const PLANKS = ['#a3824f', '#9c7b49', '#aa8955']
const BEDROCK = ['#3c3c3c', '#2e2e2e', '#474747', '#242424', '#555555']
const BARK = ['#5d4427', '#553e23']

function pixel(ctx: Ctx, x: number, y: number, color: string): void {
  ctx.fillStyle = color
  ctx.fillRect(x, y, 1, 1)
}

function pick(rng: Rng, palette: readonly string[]): string {
  return palette[(rng() * palette.length) | 0]
}

function speckle(ctx: Ctx, rng: Rng, palette: readonly string[]): void {
  for (let y = 0; y < TILE_PX; y++) {
    for (let x = 0; x < TILE_PX; x++) {
      pixel(ctx, x, y, pick(rng, palette))
    }
  }
}

/** Nearest-point cells with shaded interiors — reads as rounded stones or pebbles. */
function stoneCells(
  ctx: Ctx,
  rng: Rng,
  base: readonly [number, number, number],
  mortar: string | null,
  cells: number,
  jitter: number,
): void {
  const points = Array.from({ length: cells }, () => ({
    x: rng() * TILE_PX,
    y: rng() * TILE_PX,
    shade: 0.72 + rng() * 0.45,
  }))
  for (let y = 0; y < TILE_PX; y++) {
    for (let x = 0; x < TILE_PX; x++) {
      let d1 = Infinity
      let d2 = Infinity
      let shade = 1
      for (const p of points) {
        const d = Math.hypot(x + 0.5 - p.x, y + 0.5 - p.y)
        if (d < d1) {
          d2 = d1
          d1 = d
          shade = p.shade
        } else if (d < d2) {
          d2 = d
        }
      }
      if (mortar && d2 - d1 < 1.25) {
        pixel(ctx, x, y, mortar)
      } else {
        const s = shade * (1 + (rng() - 0.5) * jitter)
        const r = Math.min(255, Math.round(base[0] * s))
        const g = Math.min(255, Math.round(base[1] * s))
        const b = Math.min(255, Math.round(base[2] * s))
        pixel(ctx, x, y, `rgb(${r}, ${g}, ${b})`)
      }
    }
  }
}

const painters: Record<number, Painter> = {
  [Tile.GrassTop]: (ctx, rng) => speckle(ctx, rng, GRASS),
  [Tile.Dirt]: (ctx, rng) => speckle(ctx, rng, DIRT),
  [Tile.GrassSide]: (ctx, rng) => {
    speckle(ctx, rng, DIRT)
    for (let x = 0; x < TILE_PX; x++) {
      const depth = 3 + ((rng() * 2) | 0) // ragged grass fringe
      for (let y = 0; y < depth; y++) pixel(ctx, x, y, pick(rng, GRASS))
    }
  },
  [Tile.Stone]: (ctx, rng) => {
    speckle(ctx, rng, STONE)
    for (let i = 0; i < 9; i++) {
      pixel(ctx, (rng() * TILE_PX) | 0, (rng() * TILE_PX) | 0, '#646464')
    }
  },
  [Tile.Cobblestone]: (ctx, rng) => stoneCells(ctx, rng, [125, 125, 125], '#4c4c4c', 5, 0.12),
  [Tile.Gravel]: (ctx, rng) => stoneCells(ctx, rng, [128, 120, 112], null, 9, 0.3),
  [Tile.Sand]: (ctx, rng) => speckle(ctx, rng, SAND),
  [Tile.LogSide]: (ctx, rng) => {
    for (let x = 0; x < TILE_PX; x++) {
      const stripe = x % 4 < 2 ? ['#6b502f', '#735734'] : BARK
      for (let y = 0; y < TILE_PX; y++) pixel(ctx, x, y, pick(rng, stripe))
    }
  },
  [Tile.LogTop]: (ctx, rng) => {
    for (let y = 0; y < TILE_PX; y++) {
      for (let x = 0; x < TILE_PX; x++) {
        const d = Math.max(Math.abs(x - 7.5), Math.abs(y - 7.5)) // square growth rings
        const color = d > 6.5 ? pick(rng, BARK) : Math.floor(d) % 2 === 0 ? '#a8854f' : '#8a6b3d'
        pixel(ctx, x, y, color)
      }
    }
  },
  [Tile.Leaves]: (ctx, rng) => speckle(ctx, rng, LEAVES),
  [Tile.Planks]: (ctx, rng) => {
    speckle(ctx, rng, PLANKS)
    for (let board = 0; board < 4; board++) {
      const seamY = board * 4
      for (let x = 0; x < TILE_PX; x++) pixel(ctx, x, seamY, '#6e5532')
      const jointX = (board * 5 + 3) % TILE_PX
      for (let y = seamY + 1; y < seamY + 4; y++) pixel(ctx, jointX, y, '#7d6038')
    }
  },
  [Tile.Glass]: (ctx) => {
    // Transparent body with an opaque frame and a couple of glints (alpha-test cutout).
    ctx.fillStyle = '#dff2f3'
    ctx.fillRect(0, 0, TILE_PX, 1)
    ctx.fillRect(0, TILE_PX - 1, TILE_PX, 1)
    ctx.fillRect(0, 0, 1, TILE_PX)
    ctx.fillRect(TILE_PX - 1, 0, 1, TILE_PX)
    ctx.fillStyle = '#ffffff'
    for (const [x, y] of [
      [11, 2],
      [12, 3],
      [13, 4],
      [2, 9],
      [3, 10],
      [4, 11],
    ]) {
      ctx.fillRect(x, y, 1, 1)
    }
  },
  [Tile.Bricks]: (ctx, rng) => {
    speckle(ctx, rng, ['#9a9a9a', '#909090'])
    const reds = ['#9c5048', '#a35a51', '#8f463e']
    for (let row = 0; row < 4; row++) {
      const offset = row % 2 === 0 ? 0 : 4
      for (let bx = -1; bx < 3; bx++) {
        const startX = bx * 8 + offset
        for (let x = startX; x < startX + 7; x++) {
          if (x < 0 || x >= TILE_PX) continue
          for (let y = row * 4; y < row * 4 + 3; y++) pixel(ctx, x, y, pick(rng, reds))
        }
      }
    }
  },
  [Tile.Snow]: (ctx, rng) => speckle(ctx, rng, SNOW),
  [Tile.Bedrock]: (ctx, rng) => speckle(ctx, rng, BEDROCK),
  [Tile.Water]: (ctx, rng) => {
    const blues = ['45, 105, 200', '38, 96, 190', '52, 115, 210']
    for (let y = 0; y < TILE_PX; y++) {
      const alpha = y % 5 === 0 ? 0.86 : 0.76 // faint wave banding
      for (let x = 0; x < TILE_PX; x++) {
        pixel(ctx, x, y, `rgba(${pick(rng, blues)}, ${alpha})`)
      }
    }
  },
  [Tile.Screen]: (ctx, rng) => {
    // dark casing with an inset glassy panel and a power LED
    speckle(ctx, rng, ['#23262c', '#1f2227', '#262a31'])
    ctx.fillStyle = '#15171c'
    ctx.fillRect(1, 1, TILE_PX - 2, TILE_PX - 2)
    for (let y = 2; y < TILE_PX - 2; y++) {
      for (let x = 2; x < TILE_PX - 2; x++) {
        const glow = 16 + ((rng() * 5) | 0) + (TILE_PX - 2 - y)
        pixel(ctx, x, y, `rgb(${glow - 8}, ${glow + 4}, ${glow + 12})`)
      }
    }
    pixel(ctx, 3, 3, '#5fd3c4')
    pixel(ctx, 4, 3, '#3b8f86')
    pixel(ctx, 3, 4, '#3b8f86')
    pixel(ctx, TILE_PX - 4, TILE_PX - 4, '#37e08b')
  },
}

let atlasCanvas: HTMLCanvasElement | null = null

/** The full block texture atlas, drawn once per page load (deterministic). */
export function getAtlasCanvas(): HTMLCanvasElement {
  if (atlasCanvas) return atlasCanvas
  const canvas = document.createElement('canvas')
  canvas.width = ATLAS_COLS * TILE_PX
  canvas.height = ATLAS_ROWS * TILE_PX
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('2D canvas is not supported')
  for (const [tileId, paint] of Object.entries(painters)) {
    const tile = Number(tileId)
    ctx.save()
    ctx.translate((tile % ATLAS_COLS) * TILE_PX, Math.floor(tile / ATLAS_COLS) * TILE_PX)
    paint(ctx, mulberry32(ATLAS_SEED + tile * 7919))
    ctx.restore()
  }
  atlasCanvas = canvas
  return canvas
}

const tileUrlCache = new Map<number, string>()

/** A single tile as a data URL, e.g. for CSS backgrounds. */
export function getTileDataUrl(tile: number): string {
  const cached = tileUrlCache.get(tile)
  if (cached) return cached
  const canvas = document.createElement('canvas')
  canvas.width = TILE_PX
  canvas.height = TILE_PX
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('2D canvas is not supported')
  ctx.drawImage(
    getAtlasCanvas(),
    (tile % ATLAS_COLS) * TILE_PX,
    Math.floor(tile / ATLAS_COLS) * TILE_PX,
    TILE_PX,
    TILE_PX,
    0,
    0,
    TILE_PX,
    TILE_PX,
  )
  const url = canvas.toDataURL()
  tileUrlCache.set(tile, url)
  return url
}
