import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { collectYoutubeChannelData } from '@/lib/youtube-channel-collect'
import { getCollectLookbackDays, getCollectMaxVideosPerChannel, getCollectPolicyLabel } from '@/lib/collect-config'
import { isCollectionEnabled } from '@/lib/platforms'
import { getChannelFlags } from '@/lib/workspace-queries'

/** 플랫폼별 등록 채널 일괄 수집 (현재 YouTube만 실제 수집) */
export async function POST(request: NextRequest) {
  let body: { platform?: string; mineOnly?: boolean }
  try {
    body = await request.json()
  } catch {
    body = {}
  }

  const platform = (body.platform ?? 'youtube').trim().toLowerCase()
  const mineOnly = body.mineOnly === true
  const lookbackDays = getCollectLookbackDays()
  const maxVideosPerChannel = getCollectMaxVideosPerChannel()
  const policyLabel = getCollectPolicyLabel()

  if (!isCollectionEnabled(platform)) {
    return NextResponse.json(
      {
        ok: false,
        platform,
        lookbackDays,
        maxVideosPerChannel,
        policyLabel,
        error: `${platform} 수집은 아직 연결되지 않았습니다. (YouTube만 지원)`,
      },
      { status: 501 },
    )
  }

  const { data: rows, error } = await supabaseAdmin
    .from('channels')
    .select('channel_id, channel_name')
    .eq('platform', platform)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  let list = rows ?? []

  if (mineOnly) {
    const flags = await getChannelFlags()
    const mineIds = new Set(flags.filter((f) => f.is_mine).map((f) => f.channel_id))
    list = list.filter((row) => mineIds.has(row.channel_id))
  }

  if (list.length === 0) {
    return NextResponse.json({
      ok: true,
      platform,
      mineOnly,
      lookbackDays,
      maxVideosPerChannel,
      policyLabel,
      total: 0,
      message: mineOnly
        ? `«내 채널»로 지정된 ${platform} 채널이 없습니다. «운영 허브»에서 먼저 지정해 주세요.`
        : `등록된 ${platform} 채널이 없습니다. «채널·콘텐츠 등록»에서 먼저 추가해 주세요.`,
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
    await new Promise((resolve) => setTimeout(resolve, 400))
  }

  const okCount = results.filter((r) => r.ok).length
  const failCount = results.length - okCount

  return NextResponse.json({
    ok: failCount === 0,
    platform,
    mineOnly,
    lookbackDays,
    maxVideosPerChannel,
    policyLabel,
    total: results.length,
    succeeded: okCount,
    failed: failCount,
    results,
    message: `${platform} 새로고침: 성공 ${okCount} / 실패 ${failCount} (${policyLabel})`,
  })
}
