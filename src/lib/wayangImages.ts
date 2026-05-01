import type { WayangCharacter } from './gameState'

function normalizeBaseUrl(baseUrl: string): string {
  if (!baseUrl) return '/'
  return baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`
}

export function getWayangImageSrc(character: WayangCharacter, ext: 'png' | 'jpg' | 'webp' = 'png') {
  const base = normalizeBaseUrl(import.meta.env.BASE_URL ?? '/')
  return `${base}wayang/${character}.${ext}`
}
