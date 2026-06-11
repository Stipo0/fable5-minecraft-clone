import * as THREE from 'three'
import { Block, blockDef, type BlockId } from '../blocks'
import { CHUNK_SHIFT } from '../constants'
import type { RayHit } from '../raycast'
import { world } from '../session'
import { ScreenOS } from './ScreenOS'

export type Axis = 0 | 1 | 2
export type Side = 1 | -1

/**
 * A connected, fully-filled, one-block-thick rectangle of Screen blocks.
 * All blocks share one virtual computer whose canvas is shown on both faces.
 */
export interface ScreenPanel {
  readonly id: string
  /** Axis of the display normal (the dimension with thickness 1). */
  readonly axis: Axis
  readonly min: readonly [number, number, number]
  readonly size: readonly [number, number, number]
  readonly wBlocks: number
  readonly hBlocks: number
  readonly center: THREE.Vector3
  readonly os: ScreenOS
  readonly texture: THREE.CanvasTexture
}

export interface ScreenAim {
  readonly panel: ScreenPanel
  readonly side: Side
  /** Cursor position in canvas pixels. */
  readonly x: number
  readonly y: number
}

/** An active real-website session: a live iframe projected onto a panel face. */
export interface WebviewState {
  readonly panel: ScreenPanel
  readonly side: Side
  readonly url: string
}

interface PanelSpec {
  axis: Axis
  min: [number, number, number]
  size: [number, number, number]
}

const AIM_SLACK = 0.02

function posKey(x: number, y: number, z: number): string {
  return `${x},${y},${z}`
}

/**
 * Maps a world-space point on a panel face to normalized canvas coordinates
 * (u rightwards, v downwards as seen by a viewer facing that side).
 */
export function mapToScreen(
  panel: Pick<ScreenPanel, 'axis' | 'min' | 'size'>,
  side: Side,
  x: number,
  y: number,
  z: number,
): [number, number] {
  const [mx, my, mz] = panel.min
  const [sx, sy, sz] = panel.size
  switch (panel.axis) {
    case 0:
      return [side > 0 ? (mz + sz - z) / sz : (z - mz) / sz, (my + sy - y) / sy]
    case 1:
      return [side > 0 ? (x - mx) / sx : (mx + sx - x) / sx, (z - mz) / sz]
    default:
      return [side > 0 ? (x - mx) / sx : (mx + sx - x) / sx, (my + sy - y) / sy]
  }
}

/** Groups screen blocks into rectangular panels; flat shapes only. */
function detectPanels(blocks: ReadonlyMap<string, readonly [number, number, number]>): PanelSpec[] {
  const visited = new Set<string>()
  const specs: PanelSpec[] = []
  for (const [key, start] of blocks) {
    if (visited.has(key)) continue
    visited.add(key)
    const component: (readonly [number, number, number])[] = []
    const queue: (readonly [number, number, number])[] = [start]
    while (queue.length > 0) {
      const p = queue.pop()
      if (!p) break
      component.push(p)
      for (const [dx, dy, dz] of [
        [1, 0, 0],
        [-1, 0, 0],
        [0, 1, 0],
        [0, -1, 0],
        [0, 0, 1],
        [0, 0, -1],
      ] as const) {
        const nk = posKey(p[0] + dx, p[1] + dy, p[2] + dz)
        const neighbour = blocks.get(nk)
        if (neighbour && !visited.has(nk)) {
          visited.add(nk)
          queue.push(neighbour)
        }
      }
    }
    const min: [number, number, number] = [Infinity, Infinity, Infinity]
    const max: [number, number, number] = [-Infinity, -Infinity, -Infinity]
    for (const p of component) {
      for (let a = 0; a < 3; a++) {
        min[a] = Math.min(min[a], p[a])
        max[a] = Math.max(max[a], p[a])
      }
    }
    const size: [number, number, number] = [
      max[0] - min[0] + 1,
      max[1] - min[1] + 1,
      max[2] - min[2] + 1,
    ]
    // a panel must be a completely filled box, one block thick
    if (component.length !== size[0] * size[1] * size[2]) continue
    const flatAxes = ([0, 1, 2] as const).filter((a) => size[a] === 1)
    if (flatAxes.length === 0) continue
    const axis = flatAxes.length === 1 ? flatAxes[0] : pickAxisByExposure(component, flatAxes)
    specs.push({ axis, min, size })
  }
  return specs
}

/** For ambiguous shapes (single block, 1×1×N) face whichever way is most open. */
function pickAxisByExposure(
  component: readonly (readonly [number, number, number])[],
  candidates: readonly Axis[],
): Axis {
  let best: Axis = candidates[0]
  let bestScore = -Infinity
  for (const axis of candidates) {
    let score = axis === 1 ? 0 : 0.5 // prefer upright screens on ties
    const d: [number, number, number] = [0, 0, 0]
    d[axis] = 1
    for (const [x, y, z] of component) {
      if (!blockDef(world.getBlock(x + d[0], y + d[1], z + d[2])).solid) score++
      if (!blockDef(world.getBlock(x - d[0], y - d[1], z - d[2])).solid) score++
    }
    if (score > bestScore) {
      bestScore = score
      best = axis
    }
  }
  return best
}

function displayDims(spec: PanelSpec): [number, number] {
  switch (spec.axis) {
    case 0:
      return [spec.size[2], spec.size[1]]
    case 1:
      return [spec.size[0], spec.size[2]]
    default:
      return [spec.size[0], spec.size[1]]
  }
}

/**
 * Tracks every placed Screen block, merges them into panels, and owns the
 * pointer-aim and keyboard-capture state shared with the React layer.
 */
class ScreenManager {
  panels: ScreenPanel[] = []
  aim: ScreenAim | null = null
  pointerHeld = false
  keyboardOwner: ScreenPanel | null = null
  webview: WebviewState | null = null

  private readonly blocks = new Map<string, readonly [number, number, number]>()
  private readonly panelByBlock = new Map<string, ScreenPanel>()
  private readonly listeners = new Set<() => void>()

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  getPanels = (): ScreenPanel[] => this.panels

  isKeyboardCaptured = (): boolean => this.keyboardOwner !== null

  getWebview = (): WebviewState | null => this.webview

  private notify(): void {
    for (const listener of this.listeners) listener()
  }

  handleBlockChanged(x: number, y: number, z: number, prev: BlockId, next: BlockId): void {
    let touched = false
    const key = posKey(x, y, z)
    if (next === Block.Screen) {
      this.blocks.set(key, [x, y, z])
      touched = true
    } else if (this.blocks.delete(key)) {
      touched = true
    }
    if (touched && prev !== next) this.rebuild()
  }

  handleChunkUnloaded(cx: number, cz: number): void {
    let touched = false
    for (const [key, [x, , z]] of this.blocks) {
      if (x >> CHUNK_SHIFT === cx && z >> CHUNK_SHIFT === cz) {
        this.blocks.delete(key)
        touched = true
      }
    }
    if (touched) this.rebuild()
  }

  panelAt(x: number, y: number, z: number): ScreenPanel | null {
    return this.panelByBlock.get(posKey(x, y, z)) ?? null
  }

  /** Recomputed every frame from the crosshair raycast. */
  updateAim(origin: THREE.Vector3, dir: THREE.Vector3, hit: RayHit | null): void {
    let next: ScreenAim | null = null
    if (hit && hit.id === Block.Screen) {
      const panel = this.panelAt(hit.x, hit.y, hit.z)
      if (panel) {
        const n = panel.axis === 0 ? hit.nx : panel.axis === 1 ? hit.ny : hit.nz
        if (n !== 0) {
          const side: Side = n > 0 ? 1 : -1
          const plane = side > 0 ? panel.min[panel.axis] + 1 : panel.min[panel.axis]
          const o = panel.axis === 0 ? origin.x : panel.axis === 1 ? origin.y : origin.z
          const d = panel.axis === 0 ? dir.x : panel.axis === 1 ? dir.y : dir.z
          if (d !== 0) {
            const t = (plane - o) / d
            if (t > 0 && Number.isFinite(t)) {
              const [u, v] = mapToScreen(
                panel,
                side,
                origin.x + dir.x * t,
                origin.y + dir.y * t,
                origin.z + dir.z * t,
              )
              if (u > -AIM_SLACK && u < 1 + AIM_SLACK && v > -AIM_SLACK && v < 1 + AIM_SLACK) {
                next = {
                  panel,
                  side,
                  x: Math.min(1, Math.max(0, u)) * panel.os.w,
                  y: Math.min(1, Math.max(0, v)) * panel.os.h,
                }
              }
            }
          }
        }
      }
    }
    this.applyAim(next)
  }

  clearAim(): void {
    this.applyAim(null)
  }

  /** Routes a right-click press to the aimed screen; starts a drag. */
  pointerDown(): boolean {
    if (!this.aim || this.pointerHeld) return this.aim !== null
    this.pointerHeld = true
    this.aim.panel.os.pointerDown(this.aim.x, this.aim.y)
    return true
  }

  pointerUp(): void {
    if (!this.pointerHeld) return
    this.pointerHeld = false
    if (this.aim) this.aim.panel.os.pointerUp(this.aim.x, this.aim.y)
  }

  releaseKeyboard(): void {
    if (!this.keyboardOwner) return
    this.keyboardOwner.os.kbdCaptured = false
    this.keyboardOwner = null
    this.notify()
  }

  /** Starts a real-website session; the pointer is released for the iframe. */
  openWebview(os: ScreenOS, url: string): void {
    const panel = this.panels.find((p) => p.os === os)
    if (!panel) return
    const side: Side = this.aim && this.aim.panel === panel ? this.aim.side : 1
    this.releaseKeyboard()
    this.webview = { panel, side, url }
    document.exitPointerLock?.()
    this.notify()
  }

  /** Updates the URL of the running session (typed into the DOM address bar). */
  navigateWebview(url: string): void {
    if (!this.webview) return
    this.webview = { ...this.webview, url }
    this.notify()
  }

  closeWebview(): void {
    if (!this.webview) return
    this.webview = null
    this.notify()
  }

  private captureKeyboard(os: ScreenOS): void {
    const panel = this.panels.find((p) => p.os === os)
    if (!panel) return
    if (this.keyboardOwner && this.keyboardOwner !== panel) {
      this.keyboardOwner.os.kbdCaptured = false
    }
    this.keyboardOwner = panel
    os.kbdCaptured = true
    this.notify()
  }

  private applyAim(next: ScreenAim | null): void {
    const prev = this.aim
    this.aim = next
    if (prev && prev.panel !== next?.panel) prev.panel.os.cursor = null
    if (this.pointerHeld && prev && prev.panel !== next?.panel) {
      prev.panel.os.pointerUp(prev.x, prev.y)
      this.pointerHeld = false
    }
    if (next) {
      next.panel.os.cursor = { x: next.x, y: next.y }
      if (this.pointerHeld) next.panel.os.pointerMove(next.x, next.y)
    }
  }

  private rebuild(): void {
    const stale = new Map(this.panels.map((p) => [p.id, p]))
    const next: ScreenPanel[] = []
    this.panelByBlock.clear()
    for (const spec of detectPanels(this.blocks)) {
      const id = `${spec.axis}|${spec.min.join(',')}|${spec.size.join(',')}`
      let panel = stale.get(id)
      if (panel) {
        stale.delete(id)
      } else {
        panel = this.createPanel(id, spec)
      }
      next.push(panel)
      for (let x = spec.min[0]; x < spec.min[0] + spec.size[0]; x++) {
        for (let y = spec.min[1]; y < spec.min[1] + spec.size[1]; y++) {
          for (let z = spec.min[2]; z < spec.min[2] + spec.size[2]; z++) {
            this.panelByBlock.set(posKey(x, y, z), panel)
          }
        }
      }
    }
    for (const panel of stale.values()) {
      panel.texture.dispose()
      if (this.keyboardOwner === panel) this.releaseKeyboard()
      if (this.aim?.panel === panel) this.clearAim()
      if (this.webview?.panel === panel) this.closeWebview()
    }
    this.panels = next
    this.notify()
  }

  private createPanel(id: string, spec: PanelSpec): ScreenPanel {
    const [wBlocks, hBlocks] = displayDims(spec)
    const os: ScreenOS = new ScreenOS(wBlocks, hBlocks, {
      requestKeyboard: () => this.captureKeyboard(os),
      releaseKeyboard: () => {
        if (this.keyboardOwner?.os === os) this.releaseKeyboard()
      },
      openWebview: (url) => this.openWebview(os, url),
      closeWebview: () => {
        if (this.webview?.panel.os === os) this.closeWebview()
      },
      webviewUrl: () => (this.webview?.panel.os === os ? this.webview.url : null),
    })
    const texture = new THREE.CanvasTexture(os.canvas)
    texture.colorSpace = THREE.SRGBColorSpace
    texture.minFilter = THREE.LinearMipmapLinearFilter
    texture.magFilter = THREE.LinearFilter
    texture.generateMipmaps = true
    texture.anisotropy = 8
    return {
      id,
      axis: spec.axis,
      min: spec.min,
      size: spec.size,
      wBlocks,
      hBlocks,
      center: new THREE.Vector3(
        spec.min[0] + spec.size[0] / 2,
        spec.min[1] + spec.size[1] / 2,
        spec.min[2] + spec.size[2] / 2,
      ),
      os,
      texture,
    }
  }
}

export const screenManager = new ScreenManager()

world.onBlockChanged = (x, y, z, prev, next) =>
  screenManager.handleBlockChanged(x, y, z, prev, next)
world.onChunkUnloaded = (cx, cz) => screenManager.handleChunkUnloaded(cx, cz)
