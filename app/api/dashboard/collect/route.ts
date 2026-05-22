import { NextRequest, NextResponse } from 'next/server'
import { collectNaverBlogChannelData } from '@/lib/data/naver-blog-collect'
import { runNaverBlogViewsSync } from '@/lib/data/naver-blog-views-sync'
import { collectYoutubeChannelData } from '@/lib/data/youtube-channel-collect'
import { collectTistoryChannelData } from '@/lib/data/tistory-collect'

export async function POST(request: NextRequest) {
  const body = await request.json()
  const { channel_id, channel_name, platform: rawPlatform } = body
  if (!channel_id) {
    return NextResponse.json({ error: 'channel_id required' }, { status: 400 })
  }

  const platform = (rawPlatform ?? 'youtube').trim().toLowerCase()

  const result =
    platform === 'naver-blog'
      ? await collectNaverBlogChannelData({ channel_id, channel_name })
      : platform === 'tistory'
        ? await collectTistoryChannelData({ channel_id, channel_name })
        : await collectYoutubeChannelData({ channel_id, channel_name })

  if (!result.ok) {
    let status = 500
    if (result.error?.includes('찾을 수 없') || result.error?.includes('유효한')) status = 404
    else if (
      result.error?.includes('조회 실패') ||
      result.error?.includes('영상 목록') ||
      result.error?.includes('Naver API')
    ) {
      status = 502
    }
    return NextResponse.json({ error: result.error }, { status })
  }

  const count =
    'postCount' in result && result.postCount != null
      ? result.postCount
      : 'videoCount' in result
        ? result.videoCount
        : undefined

  let viewsSyncMessage: string | undefined
  if (platform === 'naver-blog' && (count ?? 0) > 0) {
    const sync = await runNaverBlogViewsSync({
      channelId: channel_id,
      onlyMissingViews: true,
      maxPosts: 80,
      source: 'collect',
    })
    if (sync.updated > 0) {
      viewsSyncMessage = sync.message
    }
  }

  return NextResponse.json({
    ok: true,
    platform,
    channelName: result.channelName,
    videoCount: count,
    postCount: 'postCount' in result ? result.postCount : undefined,
    avgViews: 'avgViews' in result ? result.avgViews : undefined,
    message: viewsSyncMessage
      ? `${result.message ?? '수집 완료'} · ${viewsSyncMessage}`
      : result.message,
    viewsSync: viewsSyncMessage ? { updated: true, detail: viewsSyncMessage } : undefined,
  })
}
