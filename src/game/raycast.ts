import type { Vector3 } from 'three'
import { Block, type BlockId } from './blocks'
import type { World } from './world/World'

export interface RayHit {
  x: number
  y: number
  z: number
  /** Unit normal of the struck face. */
  nx: number
  ny: number
  nz: number
  id: BlockId
}

/**
 * Voxel traversal (Amanatides & Woo DDA): walks the grid cell by cell along the
 * ray and returns the first targetable block, with the face that was entered.
 * Water and air are passed through.
 */
export function raycastVoxel(
  world: World,
  origin: Vector3,
  dir: Vector3,
  maxDistance: number,
): RayHit | null {
  let x = Math.floor(origin.x)
  let y = Math.floor(origin.y)
  let z = Math.floor(origin.z)

  const stepX = dir.x > 0 ? 1 : -1
  const stepY = dir.y > 0 ? 1 : -1
  const stepZ = dir.z > 0 ? 1 : -1

  const tDeltaX = Math.abs(1 / dir.x) // Infinity when the ray is axis-parallel
  const tDeltaY = Math.abs(1 / dir.y)
  const tDeltaZ = Math.abs(1 / dir.z)

  let tMaxX = dir.x === 0 ? Infinity : tDeltaX * (dir.x > 0 ? x + 1 - origin.x : origin.x - x)
  let tMaxY = dir.y === 0 ? Infinity : tDeltaY * (dir.y > 0 ? y + 1 - origin.y : origin.y - y)
  let tMaxZ = dir.z === 0 ? Infinity : tDeltaZ * (dir.z > 0 ? z + 1 - origin.z : origin.z - z)

  let nx: number
  let ny: number
  let nz: number

  for (;;) {
    if (tMaxX < tMaxY && tMaxX < tMaxZ) {
      if (tMaxX > maxDistance) return null
      x += stepX
      tMaxX += tDeltaX
      nx = -stepX
      ny = 0
      nz = 0
    } else if (tMaxY < tMaxZ) {
      if (tMaxY > maxDistance) return null
      y += stepY
      tMaxY += tDeltaY
      nx = 0
      ny = -stepY
      nz = 0
    } else {
      if (tMaxZ > maxDistance) return null
      z += stepZ
      tMaxZ += tDeltaZ
      nx = 0
      ny = 0
      nz = -stepZ
    }

    const id = world.getBlock(x, y, z)
    if (id !== Block.Air && id !== Block.Water) {
      return { x, y, z, nx, ny, nz, id }
    }
  }
}
