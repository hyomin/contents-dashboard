/** YouTube 수집: 채널당 최근 N일(기본 30≈1달) 이내, 최대 M개(기본 10) */
const DEFAULT_LOOKBACK_DAYS = 30
const DEFAULT_MAX_VIDEOS_PER_CHANNEL = 10

export function getCollectLookbackDays(): number {
  const raw = process.env.YOUTUBE_COLLECT_LOOKBACK_DAYS?.trim()
  if (!raw) return DEFAULT_LOOKBACK_DAYS
  const n = Number.parseInt(raw, 10)
  if (!Number.isFinite(n) || n < 1) return DEFAULT_LOOKBACK_DAYS
  return Math.min(n, 365)
}

export function getCollectMaxVideosPerChannel(): number {
  const raw = process.env.YOUTUBE_COLLECT_MAX_VIDEOS?.trim()
  if (!raw) return DEFAULT_MAX_VIDEOS_PER_CHANNEL
  const n = Number.parseInt(raw, 10)
  if (!Number.isFinite(n) || n < 1) return DEFAULT_MAX_VIDEOS_PER_CHANNEL
  return Math.min(n, 50)
}

export function getCollectPublishedAfterIso(lookbackDays?: number): string {
  const days = lookbackDays ?? getCollectLookbackDays()
  const d = new Date()
  d.setUTCDate(d.getUTCDate() - days)
  d.setUTCHours(0, 0, 0, 0)
  return d.toISOString()
}

export function getCollectPolicyLabel(): string {
  return `채널당 최근 ${getCollectMaxVideosPerChannel()}개 · ${getCollectLookbackDays()}일 이내`
}
