export const Block = {
  Air: 0,
  Grass: 1,
  Dirt: 2,
  Stone: 3,
  Cobblestone: 4,
  Sand: 5,
  Gravel: 6,
  OakLog: 7,
  OakLeaves: 8,
  OakPlanks: 9,
  Glass: 10,
  Bricks: 11,
  Snow: 12,
  Bedrock: 13,
  Water: 14,
} as const

export type BlockId = (typeof Block)[keyof typeof Block]

/** Tile indices into the procedurally drawn texture atlas. */
export const Tile = {
  GrassTop: 0,
  GrassSide: 1,
  Dirt: 2,
  Stone: 3,
  Cobblestone: 4,
  Sand: 5,
  LogSide: 6,
  LogTop: 7,
  Leaves: 8,
  Planks: 9,
  Glass: 10,
  Bricks: 11,
  Snow: 12,
  Gravel: 13,
  Bedrock: 14,
  Water: 15,
} as const

export const ATLAS_COLS = 4
export const ATLAS_ROWS = 4

export interface BlockTiles {
  readonly top: number
  readonly bottom: number
  readonly side: number
}

export interface BlockDef {
  readonly id: BlockId
  readonly name: string
  /** Atlas tiles per face group; null for air. */
  readonly tiles: BlockTiles | null
  /** Fully hides faces of adjacent blocks and occludes ambient light. */
  readonly opaque: boolean
  /** Takes part in player collision. */
  readonly solid: boolean
  readonly breakable: boolean
}

function uniform(tile: number): BlockTiles {
  return { top: tile, bottom: tile, side: tile }
}

const defs: readonly BlockDef[] = [
  { id: Block.Air, name: 'Air', tiles: null, opaque: false, solid: false, breakable: false },
  {
    id: Block.Grass,
    name: 'Grass Block',
    tiles: { top: Tile.GrassTop, bottom: Tile.Dirt, side: Tile.GrassSide },
    opaque: true,
    solid: true,
    breakable: true,
  },
  {
    id: Block.Dirt,
    name: 'Dirt',
    tiles: uniform(Tile.Dirt),
    opaque: true,
    solid: true,
    breakable: true,
  },
  {
    id: Block.Stone,
    name: 'Stone',
    tiles: uniform(Tile.Stone),
    opaque: true,
    solid: true,
    breakable: true,
  },
  {
    id: Block.Cobblestone,
    name: 'Cobblestone',
    tiles: uniform(Tile.Cobblestone),
    opaque: true,
    solid: true,
    breakable: true,
  },
  {
    id: Block.Sand,
    name: 'Sand',
    tiles: uniform(Tile.Sand),
    opaque: true,
    solid: true,
    breakable: true,
  },
  {
    id: Block.Gravel,
    name: 'Gravel',
    tiles: uniform(Tile.Gravel),
    opaque: true,
    solid: true,
    breakable: true,
  },
  {
    id: Block.OakLog,
    name: 'Oak Log',
    tiles: { top: Tile.LogTop, bottom: Tile.LogTop, side: Tile.LogSide },
    opaque: true,
    solid: true,
    breakable: true,
  },
  {
    id: Block.OakLeaves,
    name: 'Oak Leaves',
    tiles: uniform(Tile.Leaves),
    opaque: true,
    solid: true,
    breakable: true,
  },
  {
    id: Block.OakPlanks,
    name: 'Oak Planks',
    tiles: uniform(Tile.Planks),
    opaque: true,
    solid: true,
    breakable: true,
  },
  {
    id: Block.Glass,
    name: 'Glass',
    tiles: uniform(Tile.Glass),
    opaque: false,
    solid: true,
    breakable: true,
  },
  {
    id: Block.Bricks,
    name: 'Bricks',
    tiles: uniform(Tile.Bricks),
    opaque: true,
    solid: true,
    breakable: true,
  },
  {
    id: Block.Snow,
    name: 'Snow',
    tiles: uniform(Tile.Snow),
    opaque: true,
    solid: true,
    breakable: true,
  },
  {
    id: Block.Bedrock,
    name: 'Bedrock',
    tiles: uniform(Tile.Bedrock),
    opaque: true,
    solid: true,
    breakable: false,
  },
  {
    id: Block.Water,
    name: 'Water',
    tiles: uniform(Tile.Water),
    opaque: false,
    solid: false,
    breakable: false,
  },
]

export function blockDef(id: number): BlockDef {
  return defs[id] ?? defs[Block.Air]
}

/** Blocks the player can place, in hotbar order. */
export const HOTBAR_BLOCKS: readonly BlockId[] = [
  Block.Grass,
  Block.Dirt,
  Block.Stone,
  Block.Cobblestone,
  Block.OakPlanks,
  Block.OakLog,
  Block.Glass,
  Block.Bricks,
  Block.Sand,
]
