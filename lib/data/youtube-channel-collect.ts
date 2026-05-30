import { supabaseAdmin } from '@/lib/data/supabase-admin'
import { classifyVideoFormat, type VideoFormat } from '@/lib/data/video-format'
import {
  getCollectLookbackDays,
  getCollectMaxVideosPerChannel,
  getCollectPublishedAfterIso,
} from '@/lib/dashboard/collect-config'
import { clampInt } from '@/lib/utils/number'
import {
  pickLatestUploadAt,
  resolveTrackingStatus,
} from '@/lib/dashboard/channel-tracking-status'

const YT_API_KEY = process.env.YOUTUBE_API_KEY!
const YT_BASE = 'https://www.googleapis.com/youtube/v3'

function getTier(vsAvg: number) {
  if (vsAvg >= 5.0) return 'S'
  if (vsAvg >= 3.0) return 'A'
  if (vsAvg >= 1.5) return 'B'
  return 'C'
}

function parseDuration(iso: string): number {
  if (!iso) return 0
  const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/)
  return (parseInt(m?.[1] ?? '0') * 3600) + (parseInt(m?.[2] ?? '0') * 60) + parseInt(m?.[3] ?? '0')
}

export interface CollectYoutubeChannelResult {
  ok: boolean
  channel_id: string
  channelName?: string
  videoCount?: number
  avgViews?: number
  lookbackDays?: number
  maxVideosPerChannel?: number
  message?: string
  error?: string
}

export async function collectYoutubeChannelData(params: {
  channel_id: string
  channel_name?: string | null
}): Promise<CollectYoutubeChannelResult> {
  const { channel_id, channel_name } = params
  if (!YT_API_KEY) {
    return { ok: false, channel_id, error: 'YOUTUBE_API_KEY가 설정되지 않았습니다' }
  }

  const chRes = await fetch(
    `${YT_BASE}/channels?part=statistics,snippet&id=${encodeURIComponent(channel_id)}&key=${YT_API_KEY}`
  )
  if (!chRes.ok) {
    return { ok: false, channel_id, error: 'YouTube 채널 조회 실패' }
  }
  const chData = await chRes.json()
  const chItem = chData.items?.[0]
  if (!chItem) {
    const checkedAt = new Date().toISOString()
    await supabaseAdmin
      .from('channels')
      .update({
        tracking_status: 'untrackable',
        last_upload_at: null,
        status_checked_at: checkedAt,
        updated_at: checkedAt,
      })
      .eq('channel_id', channel_id)
    return { ok: false, channel_id, error: '채널을 찾을 수 없습니다' }
  }

  const stats = chItem.statistics
  const totalViews = parseInt(stats.viewCount ?? '0')
  const videoCount = parseInt(stats.videoCount ?? '1')
  const avgViews = Math.round(totalViews / Math.max(videoCount, 1))
  const resolvedName = (channel_name && String(channel_name).trim()) || chItem.snippet?.title || channel_id

  const channelRow = {
    channel_id,
    channel_name: resolvedName,
    platform: 'youtube',
    subscribers: clampInt(parseInt(stats.subscriberCount ?? '0')),
    total_views: clampInt(totalViews),
    video_count: clampInt(videoCount),
    avg_views: clampInt(avgViews),
    updated_at: new Date().toISOString(),
  }

  const { error: chErr } = await supabaseAdmin
    .from('channels')
    .upsert(channelRow, { onConflict: 'channel_id' })
  if (chErr) {
    return { ok: false, channel_id, error: `채널 저장 실패: ${chErr.message}` }
  }

  const lookbackDays = getCollectLookbackDays()
  const maxVideos = getCollectMaxVideosPerChannel()
  const publishedAfter = getCollectPublishedAfterIso(lookbackDays)

  const searchRes = await fetch(
    `${YT_BASE}/search?part=snippet&channelId=${encodeURIComponent(channel_id)}&maxResults=${maxVideos}&order=date&type=video&publishedAfter=${encodeURIComponent(publishedAfter)}&key=${YT_API_KEY}`
  )
  if (!searchRes.ok) {
    return { ok: false, channel_id, error: 'YouTube 영상 목록 조회 실패' }
  }
  const searchData = await searchRes.json()
  const videoIds = (searchData.items ?? [])
    .map((v: { id: { videoId?: string } }) => v.id?.videoId)
    .filter(Boolean)
    .join(',')

  if (!videoIds) {
    const checkedAt = new Date().toISOString()
    await supabaseAdmin
      .from('channels')
      .update({
        tracking_status: 'inactive',
        last_upload_at: null,
        status_checked_at: checkedAt,
      })
      .eq('channel_id', channel_id)
    return {
      ok: true,
      channel_id,
      channelName: resolvedName,
      videoCount: 0,
      avgViews,
      message: `${resolvedName}: 영상 없음 (비활성)`,
    }
  }

  const vidRes = await fetch(
    `${YT_BASE}/videos?part=statistics,contentDetails,snippet&id=${videoIds}&key=${YT_API_KEY}`
  )
  if (!vidRes.ok) {
    return { ok: false, channel_id, error: 'YouTube 영상 상세 조회 실패' }
  }
  const vidData = await vidRes.json()

  type ParsedRow = {
    platform: string
    video_id: string
    channel_id: string
    channel_name: string
    title: string
    thumbnail_url: string
    views: number
    likes: number
    comments: number
    duration: number
    format: VideoFormat
    published_at: string | null
    avg_views: number
    vs_avg: number
    tier: string
    score: number
    scraped_at: string
  }

  const cutoffMs = new Date(publishedAfter).getTime()

  type YtVideoItem = {
    id: string
    statistics?: Record<string, string>
    contentDetails?: { duration?: string }
    snippet?: { title?: string; thumbnails?: { medium?: { url?: string } }; publishedAt?: string }
  }

  const inRange = (vidData.items ?? []).filter(
    (v: { id?: string; snippet?: { title?: string; publishedAt?: string } }) => {
      if (!v.id || !v.snippet?.title) return false
      const pub = v.snippet?.publishedAt
      if (!pub) return true
      return new Date(pub).getTime() >= cutoffMs
    },
  ) as YtVideoItem[]

  inRange.sort((a, b) => {
    const ta = new Date(a.snippet?.publishedAt ?? 0).getTime()
    const tb = new Date(b.snippet?.publishedAt ?? 0).getTime()
    return tb - ta
  })

  const parsed: ParsedRow[] = inRange.slice(0, maxVideos).map((video) => {
    const vs = video.statistics ?? {}
    const views = parseInt(vs.viewCount ?? '0')
    const title = String(video.snippet?.title ?? '').slice(0, 500)
    const duration = parseDuration(video.contentDetails?.duration ?? '')
    const format = classifyVideoFormat(duration, title)
    return {
      platform: 'youtube',
      video_id: String(video.id),
      channel_id,
      channel_name: resolvedName,
      title,
      thumbnail_url: video.snippet?.thumbnails?.medium?.url ?? '',
      views: clampInt(views),
      likes: clampInt(parseInt(vs.likeCount ?? '0')),
      comments: clampInt(parseInt(vs.commentCount ?? '0')),
      duration,
      format,
      published_at: video.snippet?.publishedAt ?? null,
      avg_views: 0,
      vs_avg: 0,
      tier: 'C',
      score: 0,
      scraped_at: new Date().toISOString(),
    }
  })

  const avgByFormat: Record<VideoFormat, number> = { short: 0, long: 0, unknown: 0 }
  for (const fmt of ['short', 'long'] as const) {
    const subset = parsed.filter((r) => r.format === fmt)
    if (subset.length > 0) {
      avgByFormat[fmt] = Math.round(
        subset.reduce((s, r) => s + r.views, 0) / subset.length,
      )
    } else {
      avgByFormat[fmt] = avgViews
    }
  }
  avgByFormat.unknown = avgViews

  const videoRows = parsed.map((row) => {
    const formatAvg =
      row.format === 'short' || row.format === 'long'
        ? avgByFormat[row.format]
        : avgViews
    const vsAvg =
      formatAvg > 0 ? Math.round((row.views / formatAvg) * 10) / 10 : 0
    return {
      ...row,
      avg_views: clampInt(formatAvg),
      vs_avg: vsAvg,
      tier: getTier(vsAvg),
      score: Math.min(Math.round(vsAvg * 16), 100),
    }
  })

  const checkedAt = new Date().toISOString()
  const lastUploadAt = pickLatestUploadAt(parsed.map((row) => row.published_at))
  const trackingStatus = resolveTrackingStatus({
    channelFound: true,
    lastUploadAt,
  })

  await supabaseAdmin
    .from('channels')
    .update({
      tracking_status: trackingStatus,
      last_upload_at: lastUploadAt,
      status_checked_at: checkedAt,
    })
    .eq('channel_id', channel_id)

  const { error: vidErr } = await supabaseAdmin
    .from('videos')
    .upsert(videoRows, { onConflict: 'video_id' })
  if (vidErr) {
    return { ok: false, channel_id, error: `영상 저장 실패: ${vidErr.message}` }
  }

  await supabaseAdmin
    .from('videos')
    .delete()
    .eq('channel_id', channel_id)
    .eq('platform', 'youtube')
    .lt('published_at', publishedAfter)

  return {
    ok: true,
    channel_id,
    channelName: resolvedName,
    videoCount: videoRows.length,
    avgViews,
    lookbackDays,
    maxVideosPerChannel: maxVideos,
    message: `${resolvedName} 수집 완료 (${lookbackDays}일 이내 · 최대 ${maxVideos}개 · ${videoRows.length}개 저장)`,
  }
}
