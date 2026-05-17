import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

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

function clampInt(n: number) {
  return Math.min(n, 2147483647)
}

export async function POST(request: NextRequest) {
  const body = await request.json()
  const { channel_id, channel_name } = body
  if (!channel_id) {
    return NextResponse.json({ error: 'channel_id required' }, { status: 400 })
  }

  // 1. 채널 통계 조회
  const chRes = await fetch(
    `${YT_BASE}/channels?part=statistics,snippet&id=${channel_id}&key=${YT_API_KEY}`
  )
  if (!chRes.ok) {
    return NextResponse.json({ error: 'YouTube 채널 조회 실패' }, { status: 502 })
  }
  const chData = await chRes.json()
  const chItem = chData.items?.[0]
  if (!chItem) {
    return NextResponse.json({ error: '채널을 찾을 수 없습니다' }, { status: 404 })
  }

  const stats = chItem.statistics
  const totalViews = parseInt(stats.viewCount ?? '0')
  const videoCount = parseInt(stats.videoCount ?? '1')
  const avgViews = Math.round(totalViews / Math.max(videoCount, 1))
  const resolvedName = channel_name ?? chItem.snippet?.title ?? channel_id

  // 2. 채널 정보 Supabase 저장
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
    return NextResponse.json({ error: `채널 저장 실패: ${chErr.message}` }, { status: 500 })
  }

  // 3. 최신 영상 목록 조회
  const searchRes = await fetch(
    `${YT_BASE}/search?part=snippet&channelId=${channel_id}&maxResults=50&order=date&type=video&key=${YT_API_KEY}`
  )
  if (!searchRes.ok) {
    return NextResponse.json({ error: 'YouTube 영상 목록 조회 실패' }, { status: 502 })
  }
  const searchData = await searchRes.json()
  const videoIds = (searchData.items ?? [])
    .map((v: { id: { videoId?: string } }) => v.id?.videoId)
    .filter(Boolean)
    .join(',')

  if (!videoIds) {
    return NextResponse.json({ channelRow, videoCount: 0, message: '영상 없음' })
  }

  // 4. 영상 상세 통계 조회
  const vidRes = await fetch(
    `${YT_BASE}/videos?part=statistics,contentDetails,snippet&id=${videoIds}&key=${YT_API_KEY}`
  )
  if (!vidRes.ok) {
    return NextResponse.json({ error: 'YouTube 영상 상세 조회 실패' }, { status: 502 })
  }
  const vidData = await vidRes.json()

  // 5. vs.Avg + Tier 계산 및 영상 저장
  const videoRows = (vidData.items ?? [])
    .filter((v: { id?: string; snippet?: { title?: string } }) => v.id && v.snippet?.title)
    .slice(0, 20)
    .map((video: {
      id: string
      statistics?: Record<string, string>
      contentDetails?: { duration?: string }
      snippet?: { title?: string; thumbnails?: { medium?: { url?: string } }; publishedAt?: string }
    }) => {
      const vs = video.statistics ?? {}
      const views = parseInt(vs.viewCount ?? '0')
      const vsAvg = avgViews > 0 ? Math.round((views / avgViews) * 10) / 10 : 0
      return {
        platform: 'youtube',
        video_id: String(video.id),
        channel_id,
        channel_name: resolvedName,
        title: String(video.snippet?.title ?? '').slice(0, 500),
        thumbnail_url: video.snippet?.thumbnails?.medium?.url ?? '',
        views: clampInt(views),
        likes: clampInt(parseInt(vs.likeCount ?? '0')),
        comments: clampInt(parseInt(vs.commentCount ?? '0')),
        duration: parseDuration(video.contentDetails?.duration ?? ''),
        published_at: video.snippet?.publishedAt ?? null,
        avg_views: clampInt(avgViews),
        vs_avg: vsAvg,
        tier: getTier(vsAvg),
        score: Math.min(Math.round(vsAvg * 16), 100),
        scraped_at: new Date().toISOString(),
      }
    })

  const { error: vidErr } = await supabaseAdmin
    .from('videos')
    .upsert(videoRows, { onConflict: 'video_id' })
  if (vidErr) {
    return NextResponse.json({ error: `영상 저장 실패: ${vidErr.message}` }, { status: 500 })
  }

  return NextResponse.json({
    ok: true,
    channelName: resolvedName,
    videoCount: videoRows.length,
    avgViews,
    message: `${resolvedName} 수집 완료 (영상 ${videoRows.length}개)`,
  })
}
