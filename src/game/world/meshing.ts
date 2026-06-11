import { ATLAS_COLS, ATLAS_ROWS, Block, blockDef } from '../blocks'
import { CHUNK_SIZE, WORLD_HEIGHT } from '../constants'
import type { Chunk } from './Chunk'
import type { World } from './World'

export interface GeometryData {
  positions: Float32Array
  normals: Float32Array
  uvs: Float32Array
  colors: Float32Array
  indices: Uint32Array
}

export interface ChunkMeshData {
  opaque: GeometryData | null
  water: GeometryData | null
}

interface FaceDef {
  dir: readonly [number, number, number]
  corners: readonly (readonly [number, number, number])[]
  uvs: readonly (readonly [number, number])[]
  shade: number
}

// The six cube faces, wound counter-clockwise viewed from outside, with
// Minecraft-style directional light baked into `shade`.
const FACES: readonly FaceDef[] = [
  {
    dir: [0, 1, 0],
    corners: [
      [0, 1, 0],
      [0, 1, 1],
      [1, 1, 1],
      [1, 1, 0],
    ],
    uvs: [
      [0, 1],
      [0, 0],
      [1, 0],
      [1, 1],
    ],
    shade: 1,
  },
  {
    dir: [0, -1, 0],
    corners: [
      [0, 0, 0],
      [1, 0, 0],
      [1, 0, 1],
      [0, 0, 1],
    ],
    uvs: [
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 1],
    ],
    shade: 0.5,
  },
  {
    dir: [1, 0, 0],
    corners: [
      [1, 0, 0],
      [1, 1, 0],
      [1, 1, 1],
      [1, 0, 1],
    ],
    uvs: [
      [1, 0],
      [1, 1],
      [0, 1],
      [0, 0],
    ],
    shade: 0.65,
  },
  {
    dir: [-1, 0, 0],
    corners: [
      [0, 0, 1],
      [0, 1, 1],
      [0, 1, 0],
      [0, 0, 0],
    ],
    uvs: [
      [1, 0],
      [1, 1],
      [0, 1],
      [0, 0],
    ],
    shade: 0.65,
  },
  {
    dir: [0, 0, 1],
    corners: [
      [0, 0, 1],
      [1, 0, 1],
      [1, 1, 1],
      [0, 1, 1],
    ],
    uvs: [
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 1],
    ],
    shade: 0.82,
  },
  {
    dir: [0, 0, -1],
    corners: [
      [1, 0, 0],
      [0, 0, 0],
      [0, 1, 0],
      [1, 1, 0],
    ],
    uvs: [
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 1],
    ],
    shade: 0.82,
  },
]

// Tangent axes (perpendicular to each face normal) used for ambient-occlusion lookups.
const FACE_TANGENTS: readonly (readonly [number, number])[] = FACES.map((face) => {
  const normalAxis = face.dir.findIndex((c) => c !== 0)
  const axes = [0, 1, 2].filter((axis) => axis !== normalAxis)
  return [axes[0], axes[1]] as const
})

// Brightness per vertex-AO level (0 = fully occluded corner, 3 = open).
const AO_CURVE = [0.55, 0.72, 0.86, 1] as const
const UV_INSET = 0.001

class MeshBuilder {
  private readonly positions: number[] = []
  private readonly normals: number[] = []
  private readonly uvs: number[] = []
  private readonly colors: number[] = []
  private readonly indices: number[] = []

  addQuad(
    face: FaceDef,
    x: number,
    y: number,
    z: number,
    tile: number,
    light: readonly [number, number, number, number],
  ): void {
    const base = this.positions.length / 3
    const col = tile % ATLAS_COLS
    const row = Math.floor(tile / ATLAS_COLS)
    for (let i = 0; i < 4; i++) {
      const corner = face.corners[i]
      this.positions.push(x + corner[0], y + corner[1], z + corner[2])
      this.normals.push(face.dir[0], face.dir[1], face.dir[2])
      const [tu, tv] = face.uvs[i]
      this.uvs.push(
        (col + UV_INSET + tu * (1 - 2 * UV_INSET)) / ATLAS_COLS,
        (ATLAS_ROWS - 1 - row + UV_INSET + tv * (1 - 2 * UV_INSET)) / ATLAS_ROWS,
      )
      this.colors.push(light[i], light[i], light[i])
    }
    // Flip the quad diagonal where AO is asymmetric so interpolation has no seams.
    if (light[0] + light[2] < light[1] + light[3]) {
      this.indices.push(base, base + 1, base + 3, base + 1, base + 2, base + 3)
    } else {
      this.indices.push(base, base + 1, base + 2, base, base + 2, base + 3)
    }
  }

  build(): GeometryData | null {
    if (this.positions.length === 0) return null
    return {
      positions: new Float32Array(this.positions),
      normals: new Float32Array(this.normals),
      uvs: new Float32Array(this.uvs),
      colors: new Float32Array(this.colors),
      indices: new Uint32Array(this.indices),
    }
  }
}

const lightBuffer: [number, number, number, number] = [0, 0, 0, 0]

/**
 * Builds geometry for one chunk in world coordinates: hidden faces are culled
 * against neighbours (across chunk borders too), vertex colors carry baked
 * directional shading and ambient occlusion. Water goes into a separate
 * translucent geometry.
 */
export function buildChunkMesh(world: World, chunk: Chunk): ChunkMeshData {
  const opaque = new MeshBuilder()
  const water = new MeshBuilder()
  const ox = chunk.cx * CHUNK_SIZE
  const oz = chunk.cz * CHUNK_SIZE

  for (let lx = 0; lx < CHUNK_SIZE; lx++) {
    for (let lz = 0; lz < CHUNK_SIZE; lz++) {
      for (let y = 0; y < WORLD_HEIGHT; y++) {
        const id = chunk.get(lx, y, lz)
        if (id === Block.Air) continue
        const def = blockDef(id)
        if (!def.tiles) continue
        const x = ox + lx
        const z = oz + lz
        const isWater = id === Block.Water
        const builder = isWater ? water : opaque

        for (let f = 0; f < FACES.length; f++) {
          const face = FACES[f]
          const ny = y + face.dir[1]
          if (ny < 0) continue
          const nid = world.getBlock(x + face.dir[0], ny, z + face.dir[2])
          if (nid === id || blockDef(nid).opaque) continue

          if (isWater) {
            lightBuffer[0] = lightBuffer[1] = lightBuffer[2] = lightBuffer[3] = face.shade
          } else {
            computeFaceLight(world, x, y, z, f, face)
          }
          const tile =
            face.dir[1] > 0 ? def.tiles.top : face.dir[1] < 0 ? def.tiles.bottom : def.tiles.side
          builder.addQuad(face, x, y, z, tile, lightBuffer)
        }
      }
    }
  }

  return { opaque: opaque.build(), water: water.build() }
}

function isOccluding(world: World, x: number, y: number, z: number): boolean {
  return blockDef(world.getBlock(x, y, z)).opaque
}

/** Classic 0–3 vertex AO from the three neighbours diagonal to each face corner. */
function computeFaceLight(
  world: World,
  x: number,
  y: number,
  z: number,
  faceIndex: number,
  face: FaceDef,
): void {
  const [t1, t2] = FACE_TANGENTS[faceIndex]
  const baseX = x + face.dir[0]
  const baseY = y + face.dir[1]
  const baseZ = z + face.dir[2]

  for (let i = 0; i < 4; i++) {
    const corner = face.corners[i]
    const o1 = corner[t1] === 1 ? 1 : -1
    const o2 = corner[t2] === 1 ? 1 : -1
    const o1x = t1 === 0 ? o1 : 0
    const o1y = t1 === 1 ? o1 : 0
    const o1z = t1 === 2 ? o1 : 0
    const o2x = t2 === 0 ? o2 : 0
    const o2y = t2 === 1 ? o2 : 0
    const o2z = t2 === 2 ? o2 : 0

    const side1 = isOccluding(world, baseX + o1x, baseY + o1y, baseZ + o1z)
    const side2 = isOccluding(world, baseX + o2x, baseY + o2y, baseZ + o2z)
    const cornerOcc = isOccluding(world, baseX + o1x + o2x, baseY + o1y + o2y, baseZ + o1z + o2z)

    const ao = side1 && side2 ? 0 : 3 - ((side1 ? 1 : 0) + (side2 ? 1 : 0) + (cornerOcc ? 1 : 0))
    lightBuffer[i] = face.shade * AO_CURVE[ao]
  }
}
