import { useKeyboardControls } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { Block } from '../../game/blocks'
import {
  CHUNK_SHIFT,
  EYE_HEIGHT,
  FOV,
  GRAVITY,
  JUMP_SPEED,
  SINK_SPEED,
  SPRINT_FOV,
  SPRINT_SPEED,
  SWIM_UP_SPEED,
  TERMINAL_VELOCITY,
  WALK_SPEED,
  WATER_DRAG,
} from '../../game/constants'
import { Controls } from '../../game/controls'
import { moveWithCollisions } from '../../game/physics'
import { screenManager } from '../../game/screens/ScreenManager'
import { playerSession, spawnPoint, world } from '../../game/session'
import { useGameStore } from '../../state/useGameStore'

/** Movement input is suppressed while an in-world screen owns the keyboard. */
const NO_KEYS: Record<Controls, boolean> = {
  forward: false,
  back: false,
  left: false,
  right: false,
  jump: false,
  sprint: false,
}

interface Body {
  position: THREE.Vector3
  velocity: THREE.Vector3
  onGround: boolean
}

/**
 * First-person controller: WASD + sprint + jump, swimming, gravity and AABB
 * collision against the voxel world. Runs in substeps so fast falls can't
 * tunnel through blocks. The camera is moved to the eye position every frame;
 * PointerLockControls owns its rotation.
 */
export function Player() {
  const camera = useThree((s) => s.camera)
  const [, getKeys] = useKeyboardControls<Controls>()

  const bodyRef = useRef<Body | null>(null)
  bodyRef.current ??= {
    position: spawnPoint.clone(),
    velocity: new THREE.Vector3(),
    onGround: false,
  }

  useEffect(() => {
    // YXZ keeps rotation.y a plain yaw angle, matching PointerLockControls' model.
    camera.rotation.order = 'YXZ'
  }, [camera])

  useFrame((_, delta) => {
    playerSession.fps += (1 / Math.max(delta, 1e-4) - playerSession.fps) * 0.08
    playerSession.yaw = camera.rotation.y
    if (useGameStore.getState().status !== 'playing') return

    const body = bodyRef.current
    if (!body) return
    const { position, velocity } = body
    // Hold the simulation until the terrain under the player exists.
    if (
      !world.getChunk(Math.floor(position.x) >> CHUNK_SHIFT, Math.floor(position.z) >> CHUNK_SHIFT)
    ) {
      return
    }

    const keys = screenManager.keyboardOwner || screenManager.webview ? NO_KEYS : getKeys()
    const yaw = camera.rotation.y
    const forwardX = -Math.sin(yaw)
    const forwardZ = -Math.cos(yaw)
    const forwardInput = (keys.forward ? 1 : 0) - (keys.back ? 1 : 0)
    const strafeInput = (keys.right ? 1 : 0) - (keys.left ? 1 : 0)

    let moveX = forwardX * forwardInput - forwardZ * strafeInput
    let moveZ = forwardZ * forwardInput + forwardX * strafeInput
    const moveLen = Math.hypot(moveX, moveZ)
    if (moveLen > 0) {
      moveX /= moveLen
      moveZ /= moveLen
    }

    const inWater =
      world.getBlock(
        Math.floor(position.x),
        Math.floor(position.y + 0.4),
        Math.floor(position.z),
      ) === Block.Water
    const sprinting = keys.sprint && forwardInput > 0 && !inWater
    let speed = sprinting ? SPRINT_SPEED : WALK_SPEED
    if (inWater) speed *= WATER_DRAG

    const dt = Math.min(delta, 0.1)
    const steps = Math.max(1, Math.ceil(dt * 90))
    const h = dt / steps
    for (let i = 0; i < steps; i++) {
      velocity.x = moveX * speed
      velocity.z = moveZ * speed
      if (inWater) {
        velocity.y = keys.jump
          ? SWIM_UP_SPEED
          : Math.max(velocity.y - GRAVITY * 0.4 * h, -SINK_SPEED)
      } else {
        if (keys.jump && body.onGround) velocity.y = JUMP_SPEED
        velocity.y = Math.max(velocity.y - GRAVITY * h, -TERMINAL_VELOCITY)
      }
      body.onGround = moveWithCollisions(world, position, velocity, h).onGround
    }

    // Safety net: teleport home if the player somehow leaves the world.
    if (position.y < -16) {
      position.copy(spawnPoint)
      velocity.set(0, 0, 0)
    }

    camera.position.set(position.x, position.y + EYE_HEIGHT, position.z)
    playerSession.position.copy(position)

    if (camera instanceof THREE.PerspectiveCamera) {
      const targetFov = sprinting ? SPRINT_FOV : FOV
      if (Math.abs(camera.fov - targetFov) > 0.05) {
        camera.fov += (targetFov - camera.fov) * Math.min(1, dt * 10)
        camera.updateProjectionMatrix()
      }
    }

    const eyeUnderwater =
      world.getBlock(
        Math.floor(camera.position.x),
        Math.floor(camera.position.y),
        Math.floor(camera.position.z),
      ) === Block.Water
    const store = useGameStore.getState()
    if (eyeUnderwater !== store.underwater) store.setUnderwater(eyeUnderwater)
  })

  return null
}
