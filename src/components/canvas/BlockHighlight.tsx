import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { playerSession } from '../../game/session'

/** Thin black outline around the block under the crosshair. */
export function BlockHighlight() {
  const ref = useRef<THREE.LineSegments>(null)
  const geometry = useMemo(
    () => new THREE.EdgesGeometry(new THREE.BoxGeometry(1.002, 1.002, 1.002)),
    [],
  )

  useFrame(() => {
    const lines = ref.current
    if (!lines) return
    const target = playerSession.targetBlock
    lines.visible = target !== null
    if (target) {
      lines.position.set(target.x + 0.5, target.y + 0.5, target.z + 0.5)
    }
  })

  return (
    <lineSegments ref={ref} geometry={geometry} visible={false}>
      <lineBasicMaterial color="#0b0b0e" transparent opacity={0.6} />
    </lineSegments>
  )
}
