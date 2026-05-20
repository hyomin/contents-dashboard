import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { collectYoutubeChannelData } from '@/lib/youtube-channel-collect'
import { getCollectLookbackDays, getCollectMaxVideosPerChannel, getCollectPolicyLabel } from '@/lib/collect-config'

/** 등록된 YouTube 채널 전부 순차 수집 (API 할당량 고려 약간 간격) */
export async function POST() {
  const { data: rows, error } = await supabaseAdmin
    .from('channels')
    .select('channel_id, channel_name')
    .eq('platform', 'youtube')

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const list = rows ?? []
  if (list.length === 0) {
    return NextResponse.json({
      ok: true,
      total: 0,
      message: 'YouTube 채널이 없습니다. 채널·콘텐츠 등록에서 먼저 추가해 주세요.',
      results: [],
    })
  }

  const results: Awaited<ReturnType<typeof collectYoutubeChannelData>>[] = []
  for (const row of list) {
    const r = await collectYoutubeChannelData({
      channel_id: row.channel_id,
      channel_name: row.channel_name,
    })
    results.push(r)
    await new Promise((r) => setTimeout(r, 400))
  }

  const okCount = results.filter((r) => r.ok).length
  const failCount = results.length - okCount
  const lookbackDays = getCollectLookbackDays()
  const maxVideosPerChannel = getCollectMaxVideosPerChannel()
  const policyLabel = getCollectPolicyLabel()

  return NextResponse.json({
    ok: failCount === 0,
    lookbackDays,
    maxVideosPerChannel,
    policyLabel,
    total: results.length,
    succeeded: okCount,
    failed: failCount,
    results,
    message: `전체 수집 완료: 성공 ${okCount} / 실패 ${failCount} (${policyLabel} · ${results.length}개 채널)`,
  })
}
