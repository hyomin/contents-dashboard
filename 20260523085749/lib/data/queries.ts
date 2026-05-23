import { supabase, DBVideo, DBChannel } from './supabase'
import type { VideoFormat } from './video-format'

// ─── Videos ───────────────────────────────────────────────────────

export async function getVideos(options?: {
  platform?: string
  format?: VideoFormat
  limit?: number
  orderBy?: 'vs_avg' | 'views' | 'published_at' | 'score'
  tier?: string
}): Promise<DBVideo[]> {
  const { platform, format, limit = 50, orderBy = 'published_at', tier } = options ?? {}

  let query = supabase
    .from('videos')
    .select('*')
    .order(orderBy, { ascending: false })
    .limit(limit)

  if (platform) query = query.eq('platform', platform)
  if (format) query = query.eq('format', format)
  if (tier) query = query.eq('tier', tier)

  const { data, error } = await query
  if (error) { console.error('getVideos error:', error); return [] }
  return data ?? []
}

export async function getOutlierVideos(
  minVsAvg = 1.5,
  limit = 30,
  format?: VideoFormat,
): Promise<DBVideo[]> {
  let query = supabase
    .from('videos')
    .select('*')
    .gte('vs_avg', minVsAvg)
    .order('vs_avg', { ascending: false })
    .limit(limit)

  if (format) query = query.eq('format', format)

  const { data, error } = await query

  if (error) { console.error('getOutlierVideos error:', error); return [] }
  return data ?? []
}

export async function getVideoStats(): Promise<{
  total: number
  byPlatform: Record<string, number>
  byTier: Record<string, number>
  avgVsAvg: number
}> {
  const { data, error } = await supabase.from('videos').select('platform, tier, vs_avg')
  if (error || !data) return { total: 0, byPlatform: {}, byTier: {}, avgVsAvg: 0 }

  const byPlatform: Record<string, number> = {}
  const byTier: Record<string, number> = {}
  let vsSum = 0

  for (const v of data) {
    byPlatform[v.platform] = (byPlatform[v.platform] ?? 0) + 1
    if (v.tier) byTier[v.tier] = (byTier[v.tier] ?? 0) + 1
    vsSum += Number(v.vs_avg ?? 0)
  }

  return {
    total: data.length,
    byPlatform,
    byTier,
    avgVsAvg: data.length > 0 ? Math.round((vsSum / data.length) * 10) / 10 : 0,
  }
}

// ─── Channels ─────────────────────────────────────────────────────

export async function getChannels(platform?: string): Promise<DBChannel[]> {
  let query = supabase
    .from('channels')
    .select('*')
    .order('subscribers', { ascending: false })

  if (platform) query = query.eq('platform', platform)

  const { data, error } = await query
  if (error) { console.error('getChannels error:', error); return [] }
  return data ?? []
}

/** 채널별 DB에 저장된 영상 수 (YouTube 수집 현황용) */
export async function getVideoCountByChannel(): Promise<Record<string, number>> {
  const { data, error } = await supabase.from('videos').select('channel_id')
  if (error || !data) {
    console.error('getVideoCountByChannel error:', error)
    return {}
  }
  const counts: Record<string, number> = {}
  for (const row of data) {
    if (!row.channel_id) continue
    counts[row.channel_id] = (counts[row.channel_id] ?? 0) + 1
  }
  return counts
}

export async function getVideosForAnalytics(limit = 200): Promise<DBVideo[]> {
  const { data, error } = await supabase
    .from('videos')
    .select('title, platform, published_at, vs_avg, channel_id, channel_name, video_id')
    .order('published_at', { ascending: false, nullsFirst: false })
    .limit(limit)

  if (error) {
    console.error('getVideosForAnalytics error:', error)
    return []
  }
  return (data ?? []) as DBVideo[]
}

export async function getChannelVideoTitles(): Promise<Record<string, string[]>> {
  const { data, error } = await supabase.from('videos').select('channel_id, title')
  if (error || !data) return {}

  const map: Record<string, string[]> = {}
  for (const row of data) {
    if (!row.channel_id) continue
    if (!map[row.channel_id]) map[row.channel_id] = []
    map[row.channel_id].push(row.title)
  }
  return map
}

export async function getBestVsAvgByChannel(): Promise<Record<string, number>> {
  const { data, error } = await supabase.from('videos').select('channel_id, vs_avg')
  if (error || !data) return {}

  const best: Record<string, number> = {}
  for (const row of data) {
    if (!row.channel_id) continue
    const v = Number(row.vs_avg ?? 0)
    best[row.channel_id] = Math.max(best[row.channel_id] ?? 0, v)
  }
  return best
}
