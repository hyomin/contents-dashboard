import { supabaseAdmin } from '@/lib/data/supabase-admin'
import {
  blogIdFromChannelOrVideo,
  fetchNaverBlogPostMetrics,
  fetchNaverBlogTitleListMetricsMap,
  logNoFromVideoId,
  metricForVsAvg,
} from '@/lib/data/naver-blog-metrics'

function getTier(vsAvg: number): 'S' | 'A' | 'B' | 'C' {
  if (vsAvg >= 5) return 'S'
  if (vsAvg >= 3) return 'A'
  if (vsAvg >= 1.5) return 'B'
  return 'C'
}

function clampInt(n: number) {
  return Math.min(Math.max(0, Math.round(n)), 2147483647)
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function recomputeNaverChannelVsAvg(blogId: string, useEngagementFallback: boolean) {
  const { data: rows } = await supabaseAdmin
    .from('videos')
    .select('video_id, views, likes, comments')
    .eq('channel_id', blogId)
    .eq('platform', 'naver-blog')

  if (!rows?.length) return

  const metrics = rows.map((r) => {
    const m = metricForVsAvg(
      {
        views: r.views ?? 0,
        likes: r.likes ?? 0,
        comments: r.comments ?? 0,
      },
      useEngagementFallback,
    )
    return { video_id: r.video_id as string, metric: m.value, kind: m.kind }
  })

  const positive = metrics.map((m) => m.metric).filter((v) => v > 0)
  const channelAvg =
    positive.length > 0
      ? Math.round(positive.reduce((s, v) => s + v, 0) / positive.length)
      : 0

  for (const row of metrics) {
    if (row.metric <= 0 && channelAvg <= 0) continue
    const vsAvg =
      channelAvg > 0 ? Math.round((row.metric / channelAvg) * 10) / 10 : 0
    await supabaseAdmin
      .from('videos')
      .update({
        avg_views: clampInt(channelAvg),
        vs_avg: vsAvg,
        tier: getTier(vsAvg),
        score: Math.min(Math.round(vsAvg * 16), 100),
      })
      .eq('video_id', row.video_id)
  }
}

export interface NaverBlogViewsSyncOptions {
  channelId?: string
  onlyMissingViews?: boolean
  maxPosts?: number
  delayMs?: number
  useEngagementFallback?: boolean
  source?: string
}

export interface NaverBlogViewsSyncResult {
  ok: boolean
  source: string
  processed: number
  updated: number
  withReadViews: number
  withEngagementMetric: number
  skipped: number
  failed: number
  message: string
  errors: string[]
}

interface VideoRow {
  video_id: string
  channel_id: string | null
  channel_name: string | null
  title: string
  views: number
  likes: number
  comments: number
}

export async function runNaverBlogViewsSync(
  options: NaverBlogViewsSyncOptions = {},
): Promise<NaverBlogViewsSyncResult> {
  const source = options.source ?? 'dashboard'
  const onlyMissingViews = options.onlyMissingViews !== false
  const maxPosts = Math.min(Math.max(options.maxPosts ?? 80, 1), 200)
  const delayMs = Math.min(Math.max(options.delayMs ?? 280, 0), 2000)
  const useEngagementFallback = options.useEngagementFallback !== false

  let query = supabaseAdmin
    .from('videos')
    .select('video_id, channel_id, channel_name, title, views, likes, comments')
    .eq('platform', 'naver-blog')
    .order('published_at', { ascending: false })
    .limit(maxPosts)

  if (options.channelId?.trim()) {
    query = query.eq('channel_id', options.channelId.trim())
  }
  if (onlyMissingViews) {
    query = query.eq('views', 0)
  }

  const { data: rows, error } = await query
  if (error) {
    return {
      ok: false,
      source,
      processed: 0,
      updated: 0,
      withReadViews: 0,
      withEngagementMetric: 0,
      skipped: 0,
      failed: 0,
      message: `조회 실패: ${error.message}`,
      errors: [error.message],
    }
  }

  const videos = (rows ?? []) as VideoRow[]
  if (videos.length === 0) {
    return {
      ok: true,
      source,
      processed: 0,
      updated: 0,
      withReadViews: 0,
      withEngagementMetric: 0,
      skipped: 0,
      failed: 0,
      message: onlyMissingViews
        ? '갱신할 네이버 블로그 글이 없습니다. 먼저 «콘텐츠 새로고침»으로 글 목록을 수집하세요.'
        : '네이버 블로그 글이 없습니다.',
      errors: [],
    }
  }

  const byChannel = new Map<string, VideoRow[]>()
  for (const v of videos) {
    const blogId = blogIdFromChannelOrVideo(v.channel_id ?? '', v.video_id)
    if (!blogId) continue
    const list = byChannel.get(blogId) ?? []
    list.push(v)
    byChannel.set(blogId, list)
  }

  const listCache = new Map<string, Awaited<ReturnType<typeof fetchNaverBlogTitleListMetricsMap>>>()
  const errors: string[] = []
  let processed = 0
  let updated = 0
  let withReadViews = 0
  let withEngagementMetric = 0
  let skipped = 0
  let failed = 0

  type PendingUpdate = {
    video_id: string
    channel_id: string
    views: number
    likes: number
    comments: number
    avg_views: number
    vs_avg: number
    tier: string
    score: number
    scraped_at: string
    metricKind: 'views' | 'engagement' | 'none'
  }

  const pendingByChannel = new Map<string, PendingUpdate[]>()

  for (const [blogId, channelVideos] of byChannel) {
    if (!listCache.has(blogId)) {
      try {
        listCache.set(blogId, await fetchNaverBlogTitleListMetricsMap(blogId))
      } catch (e) {
        listCache.set(blogId, new Map())
        errors.push(`${blogId} 목록 API: ${e instanceof Error ? e.message : '오류'}`)
      }
    }
    const listMap = listCache.get(blogId)!

    for (const row of channelVideos) {
      processed++
      const logNo = logNoFromVideoId(row.video_id)
      if (!logNo) {
        skipped++
        continue
      }

      try {
        const metrics = await fetchNaverBlogPostMetrics(blogId, logNo, listMap)
        const vsMetric = metricForVsAvg(metrics, useEngagementFallback)
        if (vsMetric.kind === 'none') {
          skipped++
          if (delayMs > 0) await sleep(delayMs)
          continue
        }

        if (metrics.views > 0) withReadViews++
        else if (vsMetric.kind === 'engagement') withEngagementMetric++

        const channelPending = pendingByChannel.get(blogId) ?? []
        channelPending.push({
          video_id: row.video_id,
          channel_id: blogId,
          views: metrics.views,
          likes: metrics.likes,
          comments: metrics.comments,
          avg_views: 0,
          vs_avg: 0,
          tier: 'C',
          score: 0,
          scraped_at: new Date().toISOString(),
          metricKind: vsMetric.kind,
        })
        pendingByChannel.set(blogId, channelPending)
      } catch (e) {
        failed++
        errors.push(
          `${blogId}/${logNo}: ${e instanceof Error ? e.message : '메트릭 수집 실패'}`,
        )
      }

      if (delayMs > 0) await sleep(delayMs)
    }
  }

  for (const [blogId, pending] of pendingByChannel) {
    if (pending.length === 0) continue

    const metricValues = pending.map((p) => {
      const m = metricForVsAvg(
        {
          views: p.views,
          likes: p.likes,
          comments: p.comments,
        },
        useEngagementFallback,
      )
      return m.value
    })
    const positive = metricValues.filter((v) => v > 0)
    const channelAvg =
      positive.length > 0
        ? Math.round(positive.reduce((s, v) => s + v, 0) / positive.length)
        : 0

    for (const item of pending) {
      const m = metricForVsAvg(
        { views: item.views, likes: item.likes, comments: item.comments },
        useEngagementFallback,
      )
      const vsAvg =
        channelAvg > 0 ? Math.round((m.value / channelAvg) * 10) / 10 : 0
      const tier = getTier(vsAvg)

      const { error: upErr } = await supabaseAdmin
        .from('videos')
        .update({
          views: clampInt(item.views),
          likes: clampInt(item.likes),
          comments: clampInt(item.comments),
          avg_views: clampInt(channelAvg),
          vs_avg: vsAvg,
          tier,
          score: Math.min(Math.round(vsAvg * 16), 100),
          scraped_at: item.scraped_at,
        })
        .eq('video_id', item.video_id)

      if (upErr) {
        failed++
        errors.push(`${item.video_id}: ${upErr.message}`)
      } else {
        updated++
      }
    }

    await recomputeNaverChannelVsAvg(blogId, useEngagementFallback)

    const { data: chVideos } = await supabaseAdmin
      .from('videos')
      .select('views')
      .eq('channel_id', blogId)
      .eq('platform', 'naver-blog')

    const totalViews = (chVideos ?? []).reduce((s, r) => s + (r.views ?? 0), 0)
    await supabaseAdmin
      .from('channels')
      .update({
        avg_views: clampInt(channelAvg),
        total_views: clampInt(totalViews),
        video_count: clampInt((chVideos ?? []).length),
        updated_at: new Date().toISOString(),
      })
      .eq('channel_id', blogId)
      .eq('platform', 'naver-blog')
  }

  const ok = failed === 0 || updated > 0
  let message = `네이버 메트릭 갱신: ${updated}/${processed}건 저장`
  if (withReadViews > 0) message += ` · 조회수 ${withReadViews}건`
  if (withEngagementMetric > 0) {
    message += ` · 조회수 미공개 → 좋아요·댓글 기준 vs.Avg ${withEngagementMetric}건`
  }
  if (skipped > 0) message += ` · 스킵 ${skipped}`
  if (failed > 0) message += ` · 실패 ${failed}`

  return {
    ok,
    source,
    processed,
    updated,
    withReadViews,
    withEngagementMetric,
    skipped,
    failed,
    message,
    errors: errors.slice(0, 20),
  }
}
