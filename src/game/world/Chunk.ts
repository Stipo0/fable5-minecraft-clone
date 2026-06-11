import type { BlockId } from '../blocks'
import { CHUNK_SIZE, WORLD_HEIGHT } from '../constants'

/** A 16×64×16 column of voxels addressed in chunk-local coordinates. */
export class Chunk {
  readonly data: Uint8Array

  constructor(
    readonly cx: number,
    readonly cz: number,
  ) {
    this.data = new Uint8Array(CHUNK_SIZE * CHUNK_SIZE * WORLD_HEIGHT)
  }

  private static index(lx: number, y: number, lz: number): number {
    return (lx * CHUNK_SIZE + lz) * WORLD_HEIGHT + y
  }

  get(lx: number, y: number, lz: number): BlockId {
    return this.data[Chunk.index(lx, y, lz)] as BlockId
  }

  set(lx: number, y: number, lz: number, id: BlockId): void {
    this.data[Chunk.index(lx, y, lz)] = id
  }
}
