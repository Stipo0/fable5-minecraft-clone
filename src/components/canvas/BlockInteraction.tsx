import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { Block, blockDef, HOTBAR_BLOCKS } from '../../game/blocks'
import { REACH } from '../../game/constants'
import { aabbIntersectsBlock } from '../../game/physics'
import { raycastVoxel } from '../../game/raycast'
import { screenManager } from '../../game/screens/ScreenManager'
import { playerSession, world } from '../../game/session'
import { useGameStore } from '../../state/useGameStore'

const REPEAT_INTERVAL = 0.22 // seconds between repeated actions while a button is held
const lookDir = new THREE.Vector3()

/**
 * Mouse handling while pointer-locked: left click breaks, right click places,
 * middle click picks the targeted block into the hotbar. Held buttons repeat.
 * Right-clicking a screen panel's display face is forwarded to its virtual
 * computer instead (hold Shift to place a block against it).
 * Also keeps `playerSession.targetBlock` fresh for the highlight box and HUD.
 */
export function BlockInteraction() {
  const camera = useThree((s) => s.camera)
  const held = useRef({ left: false, right: false })
  const cooldown = useRef(0)

  const act = (button: number, shift: boolean): void => {
    const hit = raycastVoxel(world, camera.position, camera.getWorldDirection(lookDir), REACH)
    screenManager.updateAim(camera.position, lookDir, hit)
    if (!hit) return
    if (button === 0) {
      if (blockDef(hit.id).breakable) world.setBlock(hit.x, hit.y, hit.z, Block.Air)
    } else if (button === 1) {
      const slot = HOTBAR_BLOCKS.indexOf(hit.id)
      if (slot >= 0) useGameStore.getState().selectSlot(slot)
    } else if (button === 2) {
      if (!shift && screenManager.aim) {
        screenManager.pointerDown()
        return
      }
      const tx = hit.x + hit.nx
      const ty = hit.y + hit.ny
      const tz = hit.z + hit.nz
      const occupant = world.getBlock(tx, ty, tz)
      if (occupant !== Block.Air && occupant !== Block.Water) return
      const id = HOTBAR_BLOCKS[useGameStore.getState().selectedSlot]
      if (blockDef(id).solid && aabbIntersectsBlock(playerSession.position, tx, ty, tz)) return
      world.setBlock(tx, ty, tz, id)
    }
  }
  // The document listeners are installed once; route them through a ref so they
  // always call the closure holding the current camera.
  const actRef = useRef(act)
  actRef.current = act

  useEffect(() => {
    const onMouseDown = (event: MouseEvent) => {
      if (useGameStore.getState().status !== 'playing') return
      if (screenManager.webview) return // clicks belong to the open website
      if (event.button === 1) event.preventDefault()
      if (event.button === 0) held.current.left = true
      actRef.current(event.button, event.shiftKey)
      // right-click on a screen starts a drag instead of hold-to-place
      if (event.button === 2 && !screenManager.pointerHeld) held.current.right = true
      cooldown.current = REPEAT_INTERVAL * 1.4 // slight grace before auto-repeat kicks in
    }
    const onMouseUp = (event: MouseEvent) => {
      if (event.button === 0) held.current.left = false
      if (event.button === 2) {
        held.current.right = false
        screenManager.pointerUp()
      }
    }
    document.addEventListener('mousedown', onMouseDown)
    document.addEventListener('mouseup', onMouseUp)
    return () => {
      document.removeEventListener('mousedown', onMouseDown)
      document.removeEventListener('mouseup', onMouseUp)
    }
  }, [])

  useFrame((_, delta) => {
    if (useGameStore.getState().status !== 'playing') {
      playerSession.targetBlock = null
      held.current.left = false
      held.current.right = false
      screenManager.clearAim()
      return
    }
    playerSession.targetBlock = raycastVoxel(
      world,
      camera.position,
      camera.getWorldDirection(lookDir),
      REACH,
    )
    // keeps the screen cursor fresh and feeds drags while the button is held
    screenManager.updateAim(camera.position, lookDir, playerSession.targetBlock)
    cooldown.current -= delta
    if (cooldown.current > 0) return
    if (held.current.left) {
      actRef.current(0, false)
      cooldown.current = REPEAT_INTERVAL
    } else if (held.current.right) {
      actRef.current(2, false)
      cooldown.current = REPEAT_INTERVAL
    }
  })

  return null
}
