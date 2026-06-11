import { useFrame } from '@react-three/fiber'
import { memo, useEffect, useMemo, useSyncExternalStore } from 'react'
import * as THREE from 'three'
import { REACH } from '../../game/constants'
import {
  mapToScreen,
  screenManager,
  type ScreenPanel,
  type Side,
} from '../../game/screens/ScreenManager'
import { playerSession } from '../../game/session'
import { useGameStore } from '../../state/useGameStore'

const FACE_OFFSET = 0.0016 // keeps the display quad clear of the block face
const DRAW_INTERVAL_MS = 1000 / 30
const DRAW_DISTANCE = 48

/** Display quads for both faces of a panel, UV-mapped to its OS canvas. */
function buildPanelGeometry(panel: ScreenPanel): THREE.BufferGeometry {
  const positions: number[] = []
  const uvs: number[] = []
  const indices: number[] = []
  const { axis, min, size } = panel
  const [i1, i2] = axis === 0 ? [1, 2] : axis === 1 ? [0, 2] : [0, 1]
  for (const side of [1, -1] as Side[]) {
    const base = positions.length / 3
    const plane = side > 0 ? min[axis] + size[axis] + FACE_OFFSET : min[axis] - FACE_OFFSET
    for (const [da, db] of [
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 1],
    ] as const) {
      const p: [number, number, number] = [0, 0, 0]
      p[axis] = plane
      p[i1] = min[i1] + da * size[i1]
      p[i2] = min[i2] + db * size[i2]
      positions.push(p[0], p[1], p[2])
      const [u, v] = mapToScreen(panel, side, p[0], p[1], p[2])
      uvs.push(u, 1 - v) // canvas v points down, texture v points up
    }
    indices.push(base, base + 1, base + 2, base, base + 2, base + 3)
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
  geometry.setIndex(indices)
  geometry.computeBoundingSphere()
  return geometry
}

const PanelMesh = memo(function PanelMesh({ panel }: { panel: ScreenPanel }) {
  const geometry = useMemo(() => buildPanelGeometry(panel), [panel])
  const material = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        map: panel.texture,
        side: THREE.DoubleSide,
        toneMapped: false,
      }),
    [panel],
  )
  useEffect(
    () => () => {
      geometry.dispose()
      material.dispose()
    },
    [geometry, material],
  )
  return <mesh geometry={geometry} material={material} />
})

/**
 * Renders every screen panel and runs its OS: throttled canvas redraws,
 * keyboard forwarding while a screen holds focus, wheel scrolling while
 * aimed at a display, and focus auto-release on pause or walking away.
 */
export function Screens() {
  const panels = useSyncExternalStore(screenManager.subscribe, screenManager.getPanels)

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const owner = screenManager.keyboardOwner
      if (!owner || useGameStore.getState().status !== 'playing') return
      event.preventDefault()
      if (event.code === 'Backquote') screenManager.releaseKeyboard()
      else owner.os.key(event)
    }
    const onWheel = (event: WheelEvent) => {
      const aim = screenManager.aim
      if (!aim || useGameStore.getState().status !== 'playing') return
      aim.panel.os.wheel(event.deltaY)
    }
    document.addEventListener('keydown', onKeyDown, true)
    window.addEventListener('wheel', onWheel)
    const unsubscribe = useGameStore.subscribe((state) => {
      if (state.status !== 'playing') screenManager.releaseKeyboard()
    })
    return () => {
      document.removeEventListener('keydown', onKeyDown, true)
      window.removeEventListener('wheel', onWheel)
      unsubscribe()
    }
  }, [])

  useFrame(() => {
    const now = performance.now()
    const owner = screenManager.keyboardOwner
    if (owner && playerSession.position.distanceTo(owner.center) > REACH + 2) {
      screenManager.releaseKeyboard()
    }
    for (const panel of screenManager.panels) {
      if (playerSession.position.distanceTo(panel.center) > DRAW_DISTANCE) continue
      if (now - panel.os.lastDraw < DRAW_INTERVAL_MS) continue
      panel.os.draw(now)
      panel.texture.needsUpdate = true
    }
  })

  return (
    <>
      {panels.map((panel) => (
        <PanelMesh key={panel.id} panel={panel} />
      ))}
    </>
  )
}
