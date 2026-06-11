import { parseChunkKey } from '../../game/world/World'
import { useGameStore } from '../../state/useGameStore'
import { ChunkMesh } from './ChunkMesh'

/** Renders one ChunkMesh per loaded chunk; versions drive remeshing on edits. */
export function Terrain() {
  const versions = useGameStore((s) => s.chunkVersions)
  return (
    <>
      {Object.entries(versions).map(([key, version]) => {
        const [cx, cz] = parseChunkKey(key)
        return <ChunkMesh key={key} cx={cx} cz={cz} version={version} />
      })}
    </>
  )
}
