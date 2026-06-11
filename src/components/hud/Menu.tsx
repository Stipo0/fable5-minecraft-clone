import { useMemo } from 'react'
import { Tile } from '../../game/blocks'
import { playerSession, world } from '../../game/session'
import { getTileDataUrl } from '../../game/textures/atlas'
import { useGameStore } from '../../state/useGameStore'

const SPLASHES = [
  'Now with 100% more React!',
  'Powered by Bun!',
  'Blazingly voxel!',
  'Punch-free tree harvesting!',
  'Chunks! Chunks everywhere!',
  'Greedy? No, lazy meshing!',
  'Also try the real thing!',
  'Made of triangles!',
]

const CONTROLS: readonly (readonly [string, string])[] = [
  ['W A S D', 'Move'],
  ['Mouse', 'Look around'],
  ['Space', 'Jump / swim'],
  ['Shift', 'Sprint'],
  ['Left click', 'Break block'],
  ['Right click', 'Place block'],
  ['Middle click', 'Pick block'],
  ['1–9 / wheel', 'Select block'],
  ['F3', 'Debug overlay'],
  ['Esc', 'Pause'],
]

function lockPointer(): void {
  playerSession.controls?.lock()
}

export function Menu() {
  const status = useGameStore((s) => s.status)
  const setStatus = useGameStore((s) => s.setStatus)
  const splash = useMemo(() => SPLASHES[Math.floor(Math.random() * SPLASHES.length)], [])
  const dirtUrl = useMemo(() => getTileDataUrl(Tile.Dirt), [])

  if (status === 'playing') return null

  if (status === 'menu') {
    return (
      <div className="menu menu--title" onClick={lockPointer}>
        <div className="menu-dirt" style={{ backgroundImage: `url(${dirtUrl})` }} />
        <div className="menu-content">
          <h1 className="logo">
            BLOCK<span>CRAFT</span>
          </h1>
          <div className="splash">{splash}</div>
          <button type="button" className="mc-button mc-button--primary">
            Enter world
          </button>
          <div className="controls-card">
            <h2>Controls</h2>
            <dl>
              {CONTROLS.map(([key, action]) => (
                <div key={key}>
                  <dt>
                    <kbd>{key}</kbd>
                  </dt>
                  <dd>{action}</dd>
                </div>
              ))}
            </dl>
          </div>
          <p className="menu-footer">
            seed {world.seed} · react + three.js + bun · not affiliated with Mojang
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="menu menu--paused">
      <div className="pause-panel">
        <h2>Game paused</h2>
        <button type="button" className="mc-button mc-button--primary" onClick={lockPointer}>
          Resume
        </button>
        <button type="button" className="mc-button" onClick={() => setStatus('menu')}>
          Title screen
        </button>
        <p className="pause-hint">
          If the click seems ignored, wait a second and try again — browsers rate-limit pointer lock
          after Esc.
        </p>
      </div>
    </div>
  )
}
