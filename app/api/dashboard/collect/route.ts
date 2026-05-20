import { NextRequest, NextResponse } from 'next/server'
import { collectYoutubeChannelData } from '@/lib/youtube-channel-collect'

export async function POST(request: NextRequest) {
  const body = await request.json()
  const { channel_id, channel_name } = body
  if (!channel_id) {
    return NextResponse.json({ error: 'channel_id required' }, { status: 400 })
  }

  const result = await collectYoutubeChannelData({ channel_id, channel_name })
  if (!result.ok) {
    let status = 500
    if (result.error?.includes('찾을 수 없')) status = 404
    else if (result.error?.includes('조회 실패') || result.error?.includes('영상 목록') || result.error?.includes('영상 상세')) {
      status = 502
    }
    return NextResponse.json({ error: result.error }, { status })
  }

  return NextResponse.json({
    ok: true,
    channelName: result.channelName,
    videoCount: result.videoCount,
    avgViews: result.avgViews,
    message: result.message,
  })
}
