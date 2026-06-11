export const GAME_VERSION = '0.1.0'

// World layout
export const CHUNK_SHIFT = 4
export const CHUNK_SIZE = 1 << CHUNK_SHIFT // 16
export const CHUNK_MASK = CHUNK_SIZE - 1
export const WORLD_HEIGHT = 64

// Streaming
export const RENDER_DISTANCE = 6 // chunks
export const UNLOAD_DISTANCE = RENDER_DISTANCE + 2
export const CHUNKS_PER_FRAME = 2

// Terrain
export const SEA_LEVEL = 22
export const SNOW_LEVEL = 46

// Player movement
export const GRAVITY = 27
export const JUMP_SPEED = 8.6
export const TERMINAL_VELOCITY = 38
export const WALK_SPEED = 4.3
export const SPRINT_SPEED = 6.8
export const SWIM_UP_SPEED = 3.9
export const SINK_SPEED = 3.1
export const WATER_DRAG = 0.45

// Player body
export const PLAYER_WIDTH = 0.6
export const PLAYER_HEIGHT = 1.8
export const EYE_HEIGHT = 1.62
export const REACH = 5.5

// Camera & atmosphere
export const FOV = 75
export const SPRINT_FOV = 84
export const SKY_COLOR = '#a8cdee'
export const FOG_COLOR = '#c2d8ee'
export const FOG_NEAR = 28
export const FOG_FAR = 78
export const UNDERWATER_FOG_COLOR = '#10408c'
export const UNDERWATER_FOG_NEAR = 2
export const UNDERWATER_FOG_FAR = 22
