import { Vector3 } from 'three'
import { hashString } from '../lib/random'
import { SEA_LEVEL, WORLD_HEIGHT } from './constants'
import type { RayHit } from './raycast'
import { World } from './world/World'

function resolveSeed(): number {
  const param = new URLSearchParams(window.location.search).get('seed')
  if (param) {
    const numeric = Number(param)
    return Number.isInteger(numeric) ? numeric : hashString(param)
  }
  return (Math.random() * 0x7fffffff) | 0
}

export const world = new World(resolveSeed())

/** First dry-land column scanning east from the origin, a step above the surface. */
function findSpawn(): Vector3 {
  for (let x = 0; x < 512; x += 4) {
    const height = world.heightAt(x, 0)
    if (height > SEA_LEVEL + 1) return new Vector3(x + 0.5, height + 1.05, 0.5)
  }
  return new Vector3(0.5, WORLD_HEIGHT - 8, 0.5)
}

export const spawnPoint = findSpawn()

interface PlayerSession {
  readonly position: Vector3
  yaw: number
  fps: number
  targetBlock: RayHit | null
  controls: { lock(): void } | null
}

/**
 * Mutable per-frame state shared between the simulation loop and the DOM HUD.
 * Kept outside the store on purpose: it changes every frame and must not
 * trigger React renders; the HUD samples it on a timer instead.
 */
export const playerSession: PlayerSession = {
  position: spawnPoint.clone(),
  yaw: 0,
  fps: 60,
  targetBlock: null,
  controls: null,
}
