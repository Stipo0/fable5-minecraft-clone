import { KeyboardControls, PointerLockControls, Sky } from '@react-three/drei'
import { Canvas } from '@react-three/fiber'
import {
  EYE_HEIGHT,
  FOG_COLOR,
  FOG_FAR,
  FOG_NEAR,
  FOV,
  SKY_COLOR,
  UNDERWATER_FOG_COLOR,
  UNDERWATER_FOG_FAR,
  UNDERWATER_FOG_NEAR,
} from '../../game/constants'
import { controlMap } from '../../game/controls'
import { playerSession, spawnPoint } from '../../game/session'
import { useGameStore } from '../../state/useGameStore'
import { BlockHighlight } from './BlockHighlight'
import { BlockInteraction } from './BlockInteraction'
import { ChunkManager } from './ChunkManager'
import { Player } from './Player'
import { Screens } from './Screens'
import { Terrain } from './Terrain'

export function GameCanvas() {
  const underwater = useGameStore((s) => s.underwater)
  const setStatus = useGameStore((s) => s.setStatus)

  const fogArgs: [string, number, number] = underwater
    ? [UNDERWATER_FOG_COLOR, UNDERWATER_FOG_NEAR, UNDERWATER_FOG_FAR]
    : [FOG_COLOR, FOG_NEAR, FOG_FAR]

  return (
    <div className="game-canvas" onContextMenu={(event) => event.preventDefault()}>
      <Canvas
        dpr={[1, 1.5]}
        gl={{ antialias: true, powerPreference: 'high-performance' }}
        camera={{
          fov: FOV,
          near: 0.08,
          far: 600,
          position: [spawnPoint.x, spawnPoint.y + EYE_HEIGHT, spawnPoint.z],
        }}
      >
        <color attach="background" args={[underwater ? UNDERWATER_FOG_COLOR : SKY_COLOR]} />
        <fog attach="fog" args={fogArgs} />
        {!underwater && (
          <Sky distance={450} sunPosition={[120, 90, -160]} turbidity={5} rayleigh={1.1} />
        )}
        <KeyboardControls map={controlMap}>
          <Player />
        </KeyboardControls>
        <PointerLockControls
          ref={(controls) => {
            playerSession.controls = controls
          }}
          onLock={() => setStatus('playing')}
          onUnlock={() => {
            if (useGameStore.getState().status === 'playing') setStatus('paused')
          }}
        />
        <Terrain />
        <ChunkManager />
        <BlockInteraction />
        <Screens />
        <BlockHighlight />
      </Canvas>
    </div>
  )
}
