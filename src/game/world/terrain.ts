import {
  createNoise2D,
  createNoise3D,
  type NoiseFunction2D,
  type NoiseFunction3D,
} from 'simplex-noise'
import { hash3, mulberry32 } from '../../lib/random'
import { Block, type BlockId } from '../blocks'
import { CHUNK_SIZE, SEA_LEVEL, SNOW_LEVEL, WORLD_HEIGHT } from '../constants'
import type { Chunk } from './Chunk'

/** Trees within this many blocks outside a chunk can reach into it with their canopy. */
const TREE_MARGIN = 3
const TREE_DENSITY = 0.007
const CAVE_THRESHOLD = 0.6

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

/**
 * Deterministic terrain: every quantity (column height, tree placement, cave shape)
 * is a pure function of world coordinates and the seed, so chunks can be generated
 * independently and in any order while staying seamless.
 */
export class TerrainGenerator {
  private readonly hillNoise: NoiseFunction2D
  private readonly mountainNoise: NoiseFunction2D
  private readonly ridgeNoise: NoiseFunction2D
  private readonly caveNoise: NoiseFunction3D

  constructor(readonly seed: number) {
    this.hillNoise = createNoise2D(mulberry32(seed))
    this.mountainNoise = createNoise2D(mulberry32(seed + 101))
    this.ridgeNoise = createNoise2D(mulberry32(seed + 202))
    this.caveNoise = createNoise3D(mulberry32(seed + 303))
  }

  /** Surface height (y of the topmost terrain block) for a world column. */
  heightAt(x: number, z: number): number {
    const hills = this.fbm(this.hillNoise, x * 0.007, z * 0.007, 3)
    const mountainMask = clamp((this.mountainNoise(x * 0.0012, z * 0.0012) + 0.55) / 1.3, 0, 1)
    const ridge = 1 - Math.abs(this.ridgeNoise(x * 0.005, z * 0.005))
    const height = 24 + hills * 6.5 + mountainMask * mountainMask * ridge * 30
    return clamp(Math.floor(height), 3, WORLD_HEIGHT - 6)
  }

  generateChunk(chunk: Chunk): void {
    for (let lx = 0; lx < CHUNK_SIZE; lx++) {
      for (let lz = 0; lz < CHUNK_SIZE; lz++) {
        const x = chunk.cx * CHUNK_SIZE + lx
        const z = chunk.cz * CHUNK_SIZE + lz
        const height = this.heightAt(x, z)
        const beach = height <= SEA_LEVEL + 1
        const deepFloor = height < SEA_LEVEL - 5
        for (let y = 0; y <= height; y++) {
          chunk.set(lx, y, lz, this.blockFor(x, y, z, height, beach, deepFloor))
        }
        for (let y = height + 1; y <= SEA_LEVEL; y++) {
          chunk.set(lx, y, lz, Block.Water)
        }
      }
    }
    this.plantTrees(chunk)
  }

  private blockFor(
    x: number,
    y: number,
    z: number,
    height: number,
    beach: boolean,
    deepFloor: boolean,
  ): BlockId {
    if (y === 0) return Block.Bedrock
    // Caves stay at least 4 blocks under the surface so lakes never leak into them.
    if (
      y >= 6 &&
      y <= height - 4 &&
      this.caveNoise(x * 0.055, y * 0.085, z * 0.055) > CAVE_THRESHOLD
    ) {
      return Block.Air
    }
    if (deepFloor && y > height - 2) return Block.Gravel
    if (beach) {
      if (y > height - 3) return Block.Sand
    } else if (y > height - 4) {
      if (y === height) return height >= SNOW_LEVEL ? Block.Snow : Block.Grass
      return Block.Dirt
    }
    return Block.Stone
  }

  /**
   * Considers every tree site within TREE_MARGIN of the chunk so canopies that
   * straddle chunk borders are identical on both sides; only voxels inside this
   * chunk are written.
   */
  private plantTrees(chunk: Chunk): void {
    for (let lx = -TREE_MARGIN; lx < CHUNK_SIZE + TREE_MARGIN; lx++) {
      for (let lz = -TREE_MARGIN; lz < CHUNK_SIZE + TREE_MARGIN; lz++) {
        const x = chunk.cx * CHUNK_SIZE + lx
        const z = chunk.cz * CHUNK_SIZE + lz
        const trunkHeight = this.treeAt(x, z)
        if (trunkHeight === 0) continue
        const base = this.heightAt(x, z)
        const top = base + trunkHeight

        for (let y = top - 1; y <= top + 2; y++) {
          const radius = y <= top ? 2 : 1
          for (let dx = -radius; dx <= radius; dx++) {
            for (let dz = -radius; dz <= radius; dz++) {
              if (y === top + 2 && Math.abs(dx) + Math.abs(dz) > 1) continue // plus-shaped cap
              if (
                radius === 2 &&
                Math.abs(dx) === 2 &&
                Math.abs(dz) === 2 &&
                hash3(x + dx, y, z + dz, this.seed) < 0.55
              ) {
                continue // ragged canopy corners
              }
              this.trySet(chunk, lx + dx, y, lz + dz, Block.OakLeaves, false)
            }
          }
        }
        for (let y = base + 1; y <= top; y++) {
          this.trySet(chunk, lx, y, lz, Block.OakLog, true)
        }
      }
    }
  }

  private trySet(
    chunk: Chunk,
    lx: number,
    y: number,
    lz: number,
    id: BlockId,
    replace: boolean,
  ): void {
    if (lx < 0 || lx >= CHUNK_SIZE || lz < 0 || lz >= CHUNK_SIZE || y < 1 || y >= WORLD_HEIGHT)
      return
    if (!replace && chunk.get(lx, y, lz) !== Block.Air) return
    chunk.set(lx, y, lz, id)
  }

  /** Trunk height when a deterministic tree spawns at this column, else 0. */
  private treeAt(x: number, z: number): number {
    if (hash3(x, 7919, z, this.seed) >= TREE_DENSITY) return 0
    const height = this.heightAt(x, z)
    if (height <= SEA_LEVEL + 1 || height >= SNOW_LEVEL - 4) return 0
    return 4 + Math.floor(hash3(x, 104729, z, this.seed) * 2)
  }

  private fbm(noise: NoiseFunction2D, x: number, y: number, octaves: number): number {
    let amplitude = 1
    let frequency = 1
    let sum = 0
    let norm = 0
    for (let i = 0; i < octaves; i++) {
      sum += noise(x * frequency, y * frequency) * amplitude
      norm += amplitude
      amplitude *= 0.5
      frequency *= 2
    }
    return sum / norm
  }
}
