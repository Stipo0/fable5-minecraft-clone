import type { Vector3 } from 'three'
import { PLAYER_HEIGHT, PLAYER_WIDTH } from './constants'
import type { World } from './world/World'

const HALF_WIDTH = PLAYER_WIDTH / 2
// Tiny gap kept between the player and block faces to avoid re-penetration jitter.
const SKIN = 0.001

/** True when the player AABB anchored at (x, y, z) (feet center) overlaps any solid voxel. */
export function collidesAt(world: World, x: number, y: number, z: number): boolean {
  const minX = Math.floor(x - HALF_WIDTH)
  const maxX = Math.floor(x + HALF_WIDTH)
  const minY = Math.floor(y)
  const maxY = Math.floor(y + PLAYER_HEIGHT)
  const minZ = Math.floor(z - HALF_WIDTH)
  const maxZ = Math.floor(z + HALF_WIDTH)
  for (let bx = minX; bx <= maxX; bx++) {
    for (let by = minY; by <= maxY; by++) {
      for (let bz = minZ; bz <= maxZ; bz++) {
        if (world.isSolid(bx, by, bz)) return true
      }
    }
  }
  return false
}

export interface MoveResult {
  onGround: boolean
}

/**
 * Moves the position by velocity·dt one axis at a time, snapping back to the
 * nearest block face on contact. Assumes per-step displacement under one block
 * (the caller substeps), so penetration depth is always less than a voxel.
 */
export function moveWithCollisions(
  world: World,
  position: Vector3,
  velocity: Vector3,
  dt: number,
): MoveResult {
  position.x += velocity.x * dt
  if (collidesAt(world, position.x, position.y, position.z)) {
    position.x =
      velocity.x > 0
        ? Math.floor(position.x + HALF_WIDTH) - HALF_WIDTH - SKIN
        : Math.floor(position.x - HALF_WIDTH) + 1 + HALF_WIDTH + SKIN
    velocity.x = 0
  }

  position.z += velocity.z * dt
  if (collidesAt(world, position.x, position.y, position.z)) {
    position.z =
      velocity.z > 0
        ? Math.floor(position.z + HALF_WIDTH) - HALF_WIDTH - SKIN
        : Math.floor(position.z - HALF_WIDTH) + 1 + HALF_WIDTH + SKIN
    velocity.z = 0
  }

  let onGround = false
  position.y += velocity.y * dt
  if (collidesAt(world, position.x, position.y, position.z)) {
    if (velocity.y <= 0) {
      position.y = Math.floor(position.y) + 1 + SKIN
      onGround = true
    } else {
      position.y = Math.floor(position.y + PLAYER_HEIGHT) - PLAYER_HEIGHT - SKIN
    }
    velocity.y = 0
  }
  return { onGround }
}

/** Whether placing a block at the given voxel would overlap the player. */
export function aabbIntersectsBlock(
  position: Vector3,
  bx: number,
  by: number,
  bz: number,
): boolean {
  return (
    position.x + HALF_WIDTH > bx &&
    position.x - HALF_WIDTH < bx + 1 &&
    position.y + PLAYER_HEIGHT > by &&
    position.y < by + 1 &&
    position.z + HALF_WIDTH > bz &&
    position.z - HALF_WIDTH < bz + 1
  )
}
