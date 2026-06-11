import { useEffect, useState } from 'react'
import { blockDef } from '../../game/blocks'
import { CHUNK_SHIFT, GAME_VERSION } from '../../game/constants'
import { playerSession, world } from '../../game/session'
import { useGameStore } from '../../state/useGameStore'

const CARDINALS = ['North (-Z)', 'West (-X)', 'South (+Z)', 'East (+X)']

function facingLabel(yaw: number): string {
  const degrees = ((((yaw * 180) / Math.PI) % 360) + 360) % 360
  return CARDINALS[Math.round(degrees / 90) % 4]
}

/** F3-style overlay; samples the mutable session state on a timer, not per frame. */
export function DebugOverlay() {
  const open = useGameStore((s) => s.debugOpen)
  const [lines, setLines] = useState<readonly string[]>([])

  useEffect(() => {
    if (!open) return
    const update = () => {
      const p = playerSession.position
      const target = playerSession.targetBlock
      setLines([
        `Blockcraft ${GAME_VERSION} — ${Math.round(playerSession.fps)} fps`,
        `XYZ: ${p.x.toFixed(2)} / ${p.y.toFixed(2)} / ${p.z.toFixed(2)}`,
        `Chunk: ${Math.floor(p.x) >> CHUNK_SHIFT}, ${Math.floor(p.z) >> CHUNK_SHIFT} (${world.chunks.size} loaded)`,
        `Facing: ${facingLabel(playerSession.yaw)}`,
        `Target: ${target ? `${blockDef(target.id).name} @ ${target.x} ${target.y} ${target.z}` : '—'}`,
        `Seed: ${world.seed}`,
      ])
    }
    update()
    const id = window.setInterval(update, 200)
    return () => window.clearInterval(id)
  }, [open])

  if (!open) return null
  return (
    <div className="debug-overlay">
      {lines.map((line, index) => (
        <div key={index}>{line}</div>
      ))}
    </div>
  )
}
