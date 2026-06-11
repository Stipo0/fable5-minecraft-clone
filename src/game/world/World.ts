import { Block, blockDef, type BlockId } from '../blocks'
import { CHUNK_MASK, CHUNK_SHIFT, WORLD_HEIGHT } from '../constants'
import { Chunk } from './Chunk'
import { TerrainGenerator } from './terrain'

export function chunkKey(cx: number, cz: number): string {
  return `${cx},${cz}`
}

export function parseChunkKey(key: string): [number, number] {
  const comma = key.indexOf(',')
  return [Number(key.slice(0, comma)), Number(key.slice(comma + 1))]
}

const NEIGHBOUR_OFFSETS: readonly (readonly [number, number])[] = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
]

/** Mutable voxel world: owns chunk storage and generation, and reports edits for remeshing. */
export class World {
  readonly chunks = new Map<string, Chunk>()
  /** Called whenever a chunk's contents change and its mesh must be rebuilt. */
  onChunkDirty: ((key: string) => void) | null = null

  private readonly terrain: TerrainGenerator
  // One-slot lookup cache; meshing and physics access blocks in tight spatial loops.
  private cacheCx = NaN
  private cacheCz = NaN
  private cacheChunk: Chunk | null = null

  constructor(readonly seed: number) {
    this.terrain = new TerrainGenerator(seed)
  }

  heightAt(x: number, z: number): number {
    return this.terrain.heightAt(x, z)
  }

  getChunk(cx: number, cz: number): Chunk | null {
    if (this.cacheChunk !== null && this.cacheCx === cx && this.cacheCz === cz) {
      return this.cacheChunk
    }
    const chunk = this.chunks.get(chunkKey(cx, cz)) ?? null
    if (chunk) {
      this.cacheCx = cx
      this.cacheCz = cz
      this.cacheChunk = chunk
    }
    return chunk
  }

  hasAllNeighbors(cx: number, cz: number): boolean {
    return NEIGHBOUR_OFFSETS.every(([dx, dz]) => this.chunks.has(chunkKey(cx + dx, cz + dz)))
  }

  /** Generates the chunk if missing. Returns true when a new chunk was created. */
  ensureChunk(cx: number, cz: number): boolean {
    const key = chunkKey(cx, cz)
    if (this.chunks.has(key)) return false
    const chunk = new Chunk(cx, cz)
    this.terrain.generateChunk(chunk)
    this.chunks.set(key, chunk)
    this.markDirty(key)
    // Fresh border data can change face culling on already-loaded neighbours.
    for (const [dx, dz] of NEIGHBOUR_OFFSETS) {
      this.markDirtyIfLoaded(cx + dx, cz + dz)
    }
    return true
  }

  unloadChunk(key: string): void {
    this.chunks.delete(key)
    this.cacheChunk = null
  }

  getBlock(x: number, y: number, z: number): BlockId {
    if (y < 0 || y >= WORLD_HEIGHT) return Block.Air
    const chunk = this.getChunk(x >> CHUNK_SHIFT, z >> CHUNK_SHIFT)
    return chunk ? chunk.get(x & CHUNK_MASK, y, z & CHUNK_MASK) : Block.Air
  }

  setBlock(x: number, y: number, z: number, id: BlockId): void {
    if (y < 0 || y >= WORLD_HEIGHT) return
    const cx = x >> CHUNK_SHIFT
    const cz = z >> CHUNK_SHIFT
    const chunk = this.getChunk(cx, cz)
    if (!chunk) return
    const lx = x & CHUNK_MASK
    const lz = z & CHUNK_MASK
    if (chunk.get(lx, y, lz) === id) return
    chunk.set(lx, y, lz, id)
    this.markDirty(chunkKey(cx, cz))
    // Border edits affect the neighbour's face culling too.
    if (lx === 0) this.markDirtyIfLoaded(cx - 1, cz)
    if (lx === CHUNK_MASK) this.markDirtyIfLoaded(cx + 1, cz)
    if (lz === 0) this.markDirtyIfLoaded(cx, cz - 1)
    if (lz === CHUNK_MASK) this.markDirtyIfLoaded(cx, cz + 1)
  }

  /** Collision query; unloaded terrain and the void below are impassable. */
  isSolid(x: number, y: number, z: number): boolean {
    if (y < 0) return true
    if (y >= WORLD_HEIGHT) return false
    const chunk = this.getChunk(x >> CHUNK_SHIFT, z >> CHUNK_SHIFT)
    if (!chunk) return true
    return blockDef(chunk.get(x & CHUNK_MASK, y, z & CHUNK_MASK)).solid
  }

  private markDirty(key: string): void {
    this.onChunkDirty?.(key)
  }

  private markDirtyIfLoaded(cx: number, cz: number): void {
    const key = chunkKey(cx, cz)
    if (this.chunks.has(key)) this.markDirty(key)
  }
}
