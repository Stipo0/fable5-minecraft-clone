import * as THREE from 'three'
import { getAtlasCanvas } from './atlas'

export interface AtlasMaterials {
  opaque: THREE.MeshBasicMaterial
  water: THREE.MeshBasicMaterial
}

let cached: AtlasMaterials | null = null

/**
 * Shared chunk materials. MeshBasicMaterial is intentional: all lighting
 * (directional face shade + ambient occlusion) is baked into vertex colors by
 * the mesher, which is both faster and closer to the classic Minecraft look
 * than dynamic lights.
 */
export function getAtlasMaterials(): AtlasMaterials {
  if (cached) return cached
  const texture = new THREE.CanvasTexture(getAtlasCanvas())
  texture.magFilter = THREE.NearestFilter
  texture.minFilter = THREE.NearestFilter
  texture.generateMipmaps = false
  texture.colorSpace = THREE.SRGBColorSpace
  cached = {
    opaque: new THREE.MeshBasicMaterial({
      map: texture,
      vertexColors: true,
      alphaTest: 0.4, // glass cutout
    }),
    water: new THREE.MeshBasicMaterial({
      map: texture,
      vertexColors: true,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide, // visible from underneath while swimming
    }),
  }
  return cached
}
