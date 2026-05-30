import { NextResponse } from 'next/server'
import { supabase } from '@/lib/data/supabase'

export interface ChannelQuality {
  channel_id: string
  channel_name: string
  total: number
  /** format이 null/unknown인 영상 수 */
  unclassified: number
  /** avg_views가 null인 영상 수 (vs_avg 계산 불가) */
  no_avg_views: number
  /** vs_avg가 null인 영상 수 */
  no_vs_avg: number
  avg_vs_avg: number | null
  /** 마지막 수집 시각 */
  latest_scraped_at: string | null
}

export interface QualityCheckResult {
  summary: {
    total: number
    unclassified: number
    no_avg_views: number
    no_vs_avg: number
    duplicate_video_ids: number
    quality_score: number
  }
  channels: ChannelQuality[]
  checkedAt: string
}

/** 메모리 캐시 (5분) */
let cache: { data: QualityCheckResult; cachedAt: number } | null = null
const CACHE_TTL = 5 * 60 * 1000

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const bust = searchParams.has('bust')

  if (!bust && cache && Date.now() - cache.cachedAt < CACHE_TTL) {
    return NextResponse.json({ ...cache.data, cached: true })
  }
  if (bust) cache = null

  const { data, error } = await supabase
    .from('videos')
    .select('video_id, channel_id, channel_name, format, avg_views, vs_avg, scraped_at')

  if (error || !data) {
    return NextResponse.json({ error: '데이터 조회 실패' }, { status: 500 })
  }

  // 전체 요약
  const total = data.length
  const unclassified = data.filter((v) => !v.format || v.format === 'unknown').length
  const noAvgViews = data.filter((v) => v.avg_views == null).length
  const noVsAvg = data.filter((v) => v.vs_avg == null).length

  // 중복 video_id 검사
  const videoIdCounts = new Map<string, number>()
  for (const v of data) {
    if (!v.video_id) continue
    videoIdCounts.set(v.video_id, (videoIdCounts.get(v.video_id) ?? 0) + 1)
  }
  const duplicateVideoIds = [...videoIdCounts.values()].filter((c) => c > 1).length

  // 품질 점수 (0~100): 분류율 + vs_avg 충족률 + 중복 없음 가중
  const classifyRate = total > 0 ? (total - unclassified) / total : 1
  const vsAvgRate = total > 0 ? (total - noVsAvg) / total : 1
  const dupPenalty = total > 0 ? duplicateVideoIds / total : 0
  const qualityScore = Math.round(((classifyRate * 0.4 + vsAvgRate * 0.5) * (1 - dupPenalty * 0.5)) * 100)

  // 채널별 집계
  const channelMap = new Map<
    string,
    { name: string; rows: typeof data }
  >()

  for (const v of data) {
    const cid = v.channel_id ?? '__unknown__'
    if (!channelMap.has(cid)) channelMap.set(cid, { name: v.channel_name ?? '미확인', rows: [] })
    channelMap.get(cid)!.rows.push(v)
  }

  const channels: ChannelQuality[] = [...channelMap.entries()]
    .map(([cid, { name, rows }]) => {
      const vsAvgValues = rows.map((r) => Number(r.vs_avg)).filter((n) => !isNaN(n) && n > 0)
      return {
        channel_id: cid,
        channel_name: name,
        total: rows.length,
        unclassified: rows.filter((r) => !r.format || r.format === 'unknown').length,
        no_avg_views: rows.filter((r) => r.avg_views == null).length,
        no_vs_avg: rows.filter((r) => r.vs_avg == null).length,
        avg_vs_avg: vsAvgValues.length
          ? Math.round((vsAvgValues.reduce((a, b) => a + b, 0) / vsAvgValues.length) * 100) / 100
          : null,
        latest_scraped_at:
          rows.map((r) => r.scraped_at).sort().reverse()[0] ?? null,
      }
    })
    .sort((a, b) => b.total - a.total)

  const result: QualityCheckResult = {
    summary: {
      total,
      unclassified,
      no_avg_views: noAvgViews,
      no_vs_avg: noVsAvg,
      duplicate_video_ids: duplicateVideoIds,
      quality_score: qualityScore,
    },
    channels,
    checkedAt: new Date().toISOString(),
  }

  cache = { data: result, cachedAt: Date.now() }
  return NextResponse.json(result)
}
