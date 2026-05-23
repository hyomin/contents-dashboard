import type { Video } from '@/lib/dashboard/dashboard-types'
import { supabase } from './supabase'
import { getOutlierVideos } from './queries'

export interface OutlierTagRow {
  video_id: string
  title: string
  channel_id: string | null
  channel_name: string | null
  platform: string
  vs_avg: number
  min_vs_avg_threshold: number
  tagged_at: string
  source: string
  updated_at: string
}

export interface OutlierTaggingResult {
  ok: boolean
  minVsAvg: number
  candidateCount: number
  taggedCount: number
  tierUpdatedCount: number
  preview?: boolean
  message: string
}

function tierForVsAvg(vsAvg: number): 'S' | 'A' | 'B' | 'C' {
  if (vsAvg >= 5) return 'S'
  if (vsAvg >= 3) return 'A'
  if (vsAvg >= 1.5) return 'B'
  return 'C'
}

const TIER_RANK: Record<string, number> = { C: 0, B: 1, A: 2, S: 3 }

function shouldUpgradeTier(current: string | null | undefined, next: 'S' | 'A' | 'B' | 'C'): boolean {
  const cur = TIER_RANK[current ?? 'C'] ?? 0
  return TIER_RANK[next] > cur
}

export function outlierTagToVideo(row: OutlierTagRow, index = 0): Video {
  const vsAvg = Number(row.vs_avg ?? 0)
  const tier = tierForVsAvg(vsAvg)
  return {
    id: index,
    videoId: row.video_id,
    tier,
    title: row.title,
    channel: row.channel_name ?? '',
    channelId: row.channel_id ?? undefined,
    views: 0,
    vsAvg,
    platform: (row.platform ?? 'youtube') as Video['platform'],
    publishedAt: row.tagged_at?.split('T')[0] ?? '',
    keyword: 'outlier-tag',
  }
}

export async function getTaggedOutlierVideos(limit = 50): Promise<OutlierTagRow[]> {
  const { data, error } = await supabase
    .from('outlier_tags')
    .select('*')
    .order('vs_avg', { ascending: false })
    .limit(limit)

  if (error) {
    console.error('getTaggedOutlierVideos error:', error)
    return []
  }
  return (data ?? []) as OutlierTagRow[]
}

export async function runOutlierTagging(options?: {
  minVsAvg?: number
  persistTagged?: boolean
  source?: string
  limit?: number
}): Promise<OutlierTaggingResult> {
  const minVsAvg = options?.minVsAvg ?? 3
  const persistTagged = options?.persistTagged ?? true
  const source = options?.source ?? 'dashboard'
  const limit = options?.limit ?? 100

  const candidates = await getOutlierVideos(minVsAvg, limit)
  if (candidates.length === 0) {
    return {
      ok: true,
      minVsAvg,
      candidateCount: 0,
      taggedCount: 0,
      tierUpdatedCount: 0,
      message: `vs.Avg ${minVsAvg}x 이상 영상이 없습니다. 먼저 YouTube 수집을 실행하세요.`,
    }
  }

  if (!persistTagged) {
    return {
      ok: true,
      minVsAvg,
      candidateCount: candidates.length,
      taggedCount: 0,
      tierUpdatedCount: 0,
      preview: true,
      message: `미리보기: ${candidates.length}개 후보 (저장 안 함)`,
    }
  }

  const now = new Date().toISOString()
  const tagRows: OutlierTagRow[] = candidates.map((v) => ({
    video_id: v.video_id,
    title: v.title,
    channel_id: v.channel_id ?? null,
    channel_name: v.channel_name ?? null,
    platform: v.platform ?? 'youtube',
    vs_avg: Number(v.vs_avg ?? 0),
    min_vs_avg_threshold: minVsAvg,
    tagged_at: now,
    source,
    updated_at: now,
  }))

  const { error: upsertError } = await supabase
    .from('outlier_tags')
    .upsert(tagRows, { onConflict: 'video_id' })

  if (upsertError) {
    console.error('runOutlierTagging upsert error:', upsertError)
    return {
      ok: false,
      minVsAvg,
      candidateCount: candidates.length,
      taggedCount: 0,
      tierUpdatedCount: 0,
      message: upsertError.message,
    }
  }

  let tierUpdatedCount = 0
  for (const v of candidates) {
    const vsAvg = Number(v.vs_avg ?? 0)
    const nextTier = tierForVsAvg(vsAvg)
    if (!shouldUpgradeTier(v.tier, nextTier)) continue
    const { error } = await supabase
      .from('videos')
      .update({ tier: nextTier, updated_at: now })
      .eq('video_id', v.video_id)
    if (!error) tierUpdatedCount += 1
  }

  return {
    ok: true,
    minVsAvg,
    candidateCount: candidates.length,
    taggedCount: tagRows.length,
    tierUpdatedCount,
    message: `아웃라이어 ${tagRows.length}개 태깅 · Tier 상향 ${tierUpdatedCount}건`,
  }
}
