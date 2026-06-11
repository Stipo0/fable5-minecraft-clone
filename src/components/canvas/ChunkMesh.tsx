import { memo, useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { world } from '../../game/session'
import { getAtlasMaterials } from '../../game/textures/materials'
import { buildChunkMesh, type GeometryData } from '../../game/world/meshing'

function toGeometry(data: GeometryData): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(data.positions, 3))
  geometry.setAttribute('normal', new THREE.BufferAttribute(data.normals, 3))
  geometry.setAttribute('uv', new THREE.BufferAttribute(data.uvs, 2))
  geometry.setAttribute('color', new THREE.BufferAttribute(data.colors, 3))
  geometry.setIndex(new THREE.BufferAttribute(data.indices, 1))
  return geometry
}

interface ChunkMeshProps {
  cx: number
  cz: number
  version: number
}

export const ChunkMesh = memo(function ChunkMesh({ cx, cz, version }: ChunkMeshProps) {
  const geometries = useMemo(() => {
    const chunk = world.getChunk(cx, cz)
    // Wait for all four neighbours so border faces cull correctly; the chunk
    // becomes visible once they exist (fog covers the perimeter until then).
    if (!chunk || !world.hasAllNeighbors(cx, cz)) return null
    const data = buildChunkMesh(world, chunk)
    return {
      opaque: data.opaque ? toGeometry(data.opaque) : null,
      water: data.water ? toGeometry(data.water) : null,
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `version` invalidates the cached mesh after edits
  }, [cx, cz, version])

  useEffect(
    () => () => {
      geometries?.opaque?.dispose()
      geometries?.water?.dispose()
    },
    [geometries],
  )

  if (!geometries) return null
  const materials = getAtlasMaterials()
  return (
    <group>
      {geometries.opaque && <mesh geometry={geometries.opaque} material={materials.opaque} />}
      {geometries.water && (
        <mesh geometry={geometries.water} material={materials.water} renderOrder={1} />
      )}
    </group>
  )
})
