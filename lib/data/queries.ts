import { supabaseAdmin } from './supabase-admin'
import type { DBVideo, DBChannel } from './supabase'
import type { VideoFormat } from './video-format'

// ─── Videos ───────────────────────────────────────────────────────

export async function getVideos(options?: {
  platform?: string
  format?: VideoFormat
  limit?: number
  orderBy?: 'vs_avg' | 'views' | 'published_at' | 'score'
  tier?: string
  channelIds?: string[]
  from?: string
  to?: string
}): Promise<DBVideo[]> {
  const { platform, format, limit = 50, orderBy = 'published_at', tier, channelIds, from, to } = options ?? {}

  let query = supabaseAdmin
    .from('videos')
    .select('*')
    .eq('is_archived', false)
    .order(orderBy, { ascending: false })
    .limit(limit)

  if (platform) query = query.eq('platform', platform)
  if (format) query = query.eq('format', format)
  if (tier) query = query.eq('tier', tier)
  if (channelIds?.length) query = query.in('channel_id', channelIds)
  if (from) query = query.gte('published_at', from)
  if (to) query = query.lte('published_at', to)

  const { data, error } = await query
  if (error) { console.error('getVideos error:', error); return [] }
  return data ?? []
}

export interface VideoFilterOptions {
  format?: VideoFormat
  channelIds?: string[]
  /** ISO 날짜 문자열 예: '2026-04-01' */
  from?: string
  to?: string
}

export async function getOutlierVideos(
  minVsAvg = 1.5,
  limit = 30,
  options?: VideoFilterOptions | VideoFormat,
): Promise<DBVideo[]> {
  const opts: VideoFilterOptions =
    typeof options === 'string' ? { format: options } : (options ?? {})

  let query = supabaseAdmin
    .from('videos')
    .select('*')
    .eq('is_archived', false)
    .gte('vs_avg', minVsAvg)
    .order('vs_avg', { ascending: false })
    .limit(limit)

  if (opts.format) query = query.eq('format', opts.format)
  if (opts.channelIds?.length) query = query.in('channel_id', opts.channelIds)
  if (opts.from) query = query.gte('published_at', opts.from)
  if (opts.to) query = query.lte('published_at', opts.to)

  const { data, error } = await query
  if (error) { console.error('getOutlierVideos error:', error); return [] }
  return data ?? []
}

// DB 집계 RPC — 전체 row fetch 없이 Postgres에서 직접 계산
export async function getVideoStats(): Promise<{
  total: number
  byPlatform: Record<string, number>
  byTier: Record<string, number>
  avgVsAvg: number
}> {
  const { data, error } = await supabaseAdmin.rpc('get_video_stats_summary')
  if (error || !data) {
    console.error('getVideoStats error:', error)
    return { total: 0, byPlatform: {}, byTier: {}, avgVsAvg: 0 }
  }
  const d = data as { total: number; byPlatform: Record<string, number>; byTier: Record<string, number>; avgVsAvg: number }
  return {
    total: Number(d.total ?? 0),
    byPlatform: d.byPlatform ?? {},
    byTier: d.byTier ?? {},
    avgVsAvg: Number(d.avgVsAvg ?? 0),
  }
}

// ─── Channels ─────────────────────────────────────────────────────

export async function getChannels(platform?: string): Promise<DBChannel[]> {
  let query = supabaseAdmin
    .from('channels')
    .select('*')
    .order('subscribers', { ascending: false })

  if (platform) query = query.eq('platform', platform)

  const { data, error } = await query
  if (error) { console.error('getChannels error:', error); return [] }
  return data ?? []
}

// DB 집계 RPC — 전체 channel_id row fetch 없이 Postgres GROUP BY
export async function getVideoCountByChannel(): Promise<Record<string, number>> {
  const { data, error } = await supabaseAdmin.rpc('get_video_count_by_channel')
  if (error || !data) {
    console.error('getVideoCountByChannel error:', error)
    return {}
  }
  const counts: Record<string, number> = {}
  for (const row of data as { channel_id: string; video_count: number }[]) {
    if (row.channel_id) counts[row.channel_id] = Number(row.video_count)
  }
  return counts
}

export async function getVideosForAnalytics(
  limit = 200,
  options?: VideoFilterOptions,
): Promise<DBVideo[]> {
  let query = supabaseAdmin
    .from('videos')
    .select('title, platform, published_at, vs_avg, channel_id, channel_name, video_id, format, duration')
    .eq('is_archived', false)
    .order('published_at', { ascending: false, nullsFirst: false })
    .limit(limit)

  if (options?.format) query = query.eq('format', options.format)
  if (options?.channelIds?.length) query = query.in('channel_id', options.channelIds)
  if (options?.from) query = query.gte('published_at', options.from)
  if (options?.to) query = query.lte('published_at', options.to)

  const { data, error } = await query
  if (error) {
    console.error('getVideosForAnalytics error:', error)
    return []
  }
  return (data ?? []) as DBVideo[]
}

export async function getChannelVideoTitles(): Promise<Record<string, string[]>> {
  const { data, error } = await supabaseAdmin
    .from('videos')
    .select('channel_id, title')
    .eq('is_archived', false)
  if (error || !data) return {}

  const map: Record<string, string[]> = {}
  for (const row of data) {
    if (!row.channel_id) continue
    if (!map[row.channel_id]) map[row.channel_id] = []
    map[row.channel_id].push(row.title)
  }
  return map
}

// DB 집계 RPC — 전체 vs_avg row fetch 없이 Postgres MAX
export async function getBestVsAvgByChannel(): Promise<Record<string, number>> {
  const { data, error } = await supabaseAdmin.rpc('get_best_vs_avg_by_channel')
  if (error || !data) {
    console.error('getBestVsAvgByChannel error:', error)
    return {}
  }
  const best: Record<string, number> = {}
  for (const row of data as { channel_id: string; best_vs_avg: number }[]) {
    if (row.channel_id) best[row.channel_id] = Number(row.best_vs_avg ?? 0)
  }
  return best
}
