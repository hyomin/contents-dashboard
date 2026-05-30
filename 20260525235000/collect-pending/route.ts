import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/data/supabase-admin'
import { collectYoutubeChannelData } from '@/lib/data/youtube-channel-collect'
import { getCollectLookbackDays, getCollectMaxVideosPerChannel, getCollectPolicyLabel } from '@/lib/dashboard/collect-config'
import { isPendingCollect } from '@/lib/dashboard/channel-collect-status'

/** 구독자·영상 수가 없는(미수집) YouTube 채널만 순차 수집 */
export async function POST() {
  const { data: rows, error } = await supabaseAdmin
    .from('channels')
    .select('channel_id, channel_name, platform, subscribers, video_count, avg_views, updated_at')
    .eq('platform', 'youtube')

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const pending = (rows ?? []).filter((r) =>
    isPendingCollect({
      channel_id: r.channel_id,
      channel_name: r.channel_name,
      platform: r.platform,
      subscribers: r.subscribers,
      avg_views: r.avg_views,
      video_count: r.video_count,
      updated_at: r.updated_at ?? '',
    })
  )

  if (pending.length === 0) {
    return NextResponse.json({
      ok: true,
      total: 0,
      succeeded: 0,
      failed: 0,
      message: '미수집 YouTube 채널이 없습니다.',
      results: [],
    })
  }

  const results: Awaited<ReturnType<typeof collectYoutubeChannelData>>[] = []
  for (const row of pending) {
    const r = await collectYoutubeChannelData({
      channel_id: row.channel_id,
      channel_name: row.channel_name,
    })
    results.push(r)
    await new Promise((resolve) => setTimeout(resolve, 400))
  }

  const okCount = results.filter((r) => r.ok).length
  const failCount = results.length - okCount

  return NextResponse.json({
    ok: failCount === 0,
    lookbackDays: getCollectLookbackDays(),
    maxVideosPerChannel: getCollectMaxVideosPerChannel(),
    policyLabel: getCollectPolicyLabel(),
    total: results.length,
    succeeded: okCount,
    failed: failCount,
    results,
    message: `미수집 채널 수집 완료: 성공 ${okCount} / 실패 ${failCount} (${pending.length}개)`,
  })
}
