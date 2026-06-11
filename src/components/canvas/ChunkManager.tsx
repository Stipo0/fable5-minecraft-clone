import { useFrame } from '@react-three/fiber'
import { useRef } from 'react'
import {
  CHUNK_SHIFT,
  CHUNKS_PER_FRAME,
  RENDER_DISTANCE,
  UNLOAD_DISTANCE,
} from '../../game/constants'
import { playerSession, world } from '../../game/session'
import { chunkKey, parseChunkKey } from '../../game/world/World'
import { useGameStore } from '../../state/useGameStore'

/**
 * Streams the world around the player: queues missing chunks within
 * RENDER_DISTANCE (nearest first), generates a bounded number per frame to
 * avoid hitches, and unloads chunks past UNLOAD_DISTANCE.
 */
export function ChunkManager() {
  const queue = useRef<string[]>([])
  const lastCenter = useRef('')

  useFrame(() => {
    const { x, z } = playerSession.position
    const pcx = Math.floor(x) >> CHUNK_SHIFT
    const pcz = Math.floor(z) >> CHUNK_SHIFT
    const center = chunkKey(pcx, pcz)

    if (center !== lastCenter.current) {
      lastCenter.current = center

      const pending: { key: string; d2: number }[] = []
      for (let dx = -RENDER_DISTANCE; dx <= RENDER_DISTANCE; dx++) {
        for (let dz = -RENDER_DISTANCE; dz <= RENDER_DISTANCE; dz++) {
          const d2 = dx * dx + dz * dz
          if (d2 > RENDER_DISTANCE * RENDER_DISTANCE) continue
          const key = chunkKey(pcx + dx, pcz + dz)
          if (!world.chunks.has(key)) pending.push({ key, d2 })
        }
      }
      pending.sort((a, b) => a.d2 - b.d2)
      queue.current = pending.map((entry) => entry.key)

      const dropped: string[] = []
      for (const key of world.chunks.keys()) {
        const [cx, cz] = parseChunkKey(key)
        const dx = cx - pcx
        const dz = cz - pcz
        if (dx * dx + dz * dz > UNLOAD_DISTANCE * UNLOAD_DISTANCE) dropped.push(key)
      }
      if (dropped.length > 0) {
        for (const key of dropped) world.unloadChunk(key)
        useGameStore.getState().removeChunks(dropped)
      }
    }

    let generated = 0
    while (generated < CHUNKS_PER_FRAME && queue.current.length > 0) {
      const key = queue.current.shift()
      if (!key) break
      const [cx, cz] = parseChunkKey(key)
      if (world.ensureChunk(cx, cz)) generated++
    }
  })

  return null
}
