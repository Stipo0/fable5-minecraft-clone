import { create } from 'zustand'
import { HOTBAR_BLOCKS } from '../game/blocks'
import { world } from '../game/session'

export type GameStatus = 'menu' | 'playing' | 'paused'

interface GameState {
  status: GameStatus
  selectedSlot: number
  debugOpen: boolean
  underwater: boolean
  /** Loaded chunk keys mapped to a version that bumps on every edit (drives remeshing). */
  chunkVersions: Record<string, number>
  setStatus: (status: GameStatus) => void
  selectSlot: (slot: number) => void
  toggleDebug: () => void
  setUnderwater: (underwater: boolean) => void
  bumpChunk: (key: string) => void
  removeChunks: (keys: readonly string[]) => void
}

export const useGameStore = create<GameState>()((set) => ({
  status: 'menu',
  selectedSlot: 0,
  debugOpen: false,
  underwater: false,
  chunkVersions: {},
  setStatus: (status) => set({ status }),
  selectSlot: (slot) =>
    set({
      selectedSlot: ((slot % HOTBAR_BLOCKS.length) + HOTBAR_BLOCKS.length) % HOTBAR_BLOCKS.length,
    }),
  toggleDebug: () => set((s) => ({ debugOpen: !s.debugOpen })),
  setUnderwater: (underwater) => set({ underwater }),
  bumpChunk: (key) =>
    set((s) => ({
      chunkVersions: { ...s.chunkVersions, [key]: (s.chunkVersions[key] ?? 0) + 1 },
    })),
  removeChunks: (keys) =>
    set((s) => {
      const next = { ...s.chunkVersions }
      for (const key of keys) delete next[key]
      return { chunkVersions: next }
    }),
}))

// Chunk edits flow through the store so React re-renders the affected meshes.
world.onChunkDirty = (key) => useGameStore.getState().bumpChunk(key)
