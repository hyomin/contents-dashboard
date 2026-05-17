import { supabase, DBVideo, DBChannel } from './supabase'

// ─── Videos ───────────────────────────────────────────────────────

export async function getVideos(options?: {
  platform?: string
  limit?: number
  orderBy?: 'vs_avg' | 'views' | 'published_at' | 'score'
  tier?: string
}): Promise<DBVideo[]> {
  const { platform, limit = 50, orderBy = 'published_at', tier } = options ?? {}

  let query = supabase
    .from('videos')
    .select('*')
    .order(orderBy, { ascending: false })
    .limit(limit)

  if (platform) query = query.eq('platform', platform)
  if (tier) query = query.eq('tier', tier)

  const { data, error } = await query
  if (error) { console.error('getVideos error:', error); return [] }
  return data ?? []
}

export async function getOutlierVideos(minVsAvg = 1.5, limit = 30): Promise<DBVideo[]> {
  const { data, error } = await supabase
    .from('videos')
    .select('*')
    .gte('vs_avg', minVsAvg)
    .order('vs_avg', { ascending: false })
    .limit(limit)

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
