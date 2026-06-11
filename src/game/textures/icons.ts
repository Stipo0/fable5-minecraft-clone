import { ATLAS_COLS, blockDef, type BlockId } from '../blocks'
import { getAtlasCanvas, TILE_PX } from './atlas'

const ICON_SIZE = 64
const HALF = ICON_SIZE / 2
const SCALE = 28 / TILE_PX
const SKEW = SCALE / 2

const iconCache = new Map<BlockId, string>()

function shadedTile(tile: number, brightness: number): HTMLCanvasElement {
  const atlas = getAtlasCanvas()
  const canvas = document.createElement('canvas')
  canvas.width = TILE_PX
  canvas.height = TILE_PX
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('2D canvas is not supported')
  const sx = (tile % ATLAS_COLS) * TILE_PX
  const sy = Math.floor(tile / ATLAS_COLS) * TILE_PX
  ctx.drawImage(atlas, sx, sy, TILE_PX, TILE_PX, 0, 0, TILE_PX, TILE_PX)
  if (brightness < 1) {
    const v = Math.round(brightness * 255)
    ctx.globalCompositeOperation = 'multiply'
    ctx.fillStyle = `rgb(${v}, ${v}, ${v})`
    ctx.fillRect(0, 0, TILE_PX, TILE_PX)
    // multiply paints over transparent pixels too; clip back to the tile's alpha
    ctx.globalCompositeOperation = 'destination-in'
    ctx.drawImage(atlas, sx, sy, TILE_PX, TILE_PX, 0, 0, TILE_PX, TILE_PX)
  }
  return canvas
}

/** Isometric cube icon (top/left/right faces with distinct shading) as a data URL. */
export function getBlockIcon(id: BlockId): string {
  const cached = iconCache.get(id)
  if (cached) return cached
  const tiles = blockDef(id).tiles
  if (!tiles) return ''
  const canvas = document.createElement('canvas')
  canvas.width = ICON_SIZE
  canvas.height = ICON_SIZE
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('2D canvas is not supported')
  ctx.imageSmoothingEnabled = false
  // top face: unit square sheared into the upper diamond
  ctx.setTransform(SCALE, SKEW, -SCALE, SKEW, HALF, 4)
  ctx.drawImage(shadedTile(tiles.top, 1), 0, 0)
  // left face
  ctx.setTransform(SCALE, SKEW, 0, SCALE, 4, 18)
  ctx.drawImage(shadedTile(tiles.side, 0.62), 0, 0)
  // right face
  ctx.setTransform(SCALE, -SKEW, 0, SCALE, HALF, HALF)
  ctx.drawImage(shadedTile(tiles.side, 0.8), 0, 0)
  const url = canvas.toDataURL()
  iconCache.set(id, url)
  return url
}
