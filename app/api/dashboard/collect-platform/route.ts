import { NextRequest, NextResponse } from 'next/server'
import { verifyDashboardApiAuth } from '@/lib/dashboard/api-auth'
import { supabaseAdmin } from '@/lib/data/supabase-admin'
import { collectNaverBlogChannelData } from '@/lib/data/naver-blog-collect'
import { runNaverBlogViewsSync } from '@/lib/data/naver-blog-views-sync'
import { collectYoutubeChannelData } from '@/lib/data/youtube-channel-collect'
import { collectTistoryChannelData } from '@/lib/data/tistory-collect'
import { getCollectLookbackDays, getCollectMaxVideosPerChannel, getCollectPolicyLabel } from '@/lib/dashboard/collect-config'
import { isCollectionEnabled } from '@/lib/dashboard/platforms'
import { getChannelFlags } from '@/lib/data/workspace-queries'

type CollectResult =
  | Awaited<ReturnType<typeof collectYoutubeChannelData>>
  | Awaited<ReturnType<typeof collectNaverBlogChannelData>>
  | Awaited<ReturnType<typeof collectTistoryChannelData>>

async function collectByPlatform(
  platform: string,
  row: { channel_id: string; channel_name: string },
): Promise<CollectResult> {
  if (platform === 'naver-blog') {
    return collectNaverBlogChannelData({
      channel_id: row.channel_id,
      channel_name: row.channel_name,
    })
  }
  if (platform === 'tistory') {
    return collectTistoryChannelData({
      channel_id: row.channel_id,
      channel_name: row.channel_name,
    })
  }
  return collectYoutubeChannelData({
    channel_id: row.channel_id,
    channel_name: row.channel_name,
  })
}

/** 플랫폼별 등록 채널 일괄 수집 */
export async function POST(request: NextRequest) {
  const denied = await verifyDashboardApiAuth(request)
  if (denied) return denied

  let body: { platform?: string; mineOnly?: boolean }
  try {
    body = await request.json()
  } catch {
    body = {}
  }

  const platform = (body.platform ?? 'youtube').trim().toLowerCase()
  const mineOnly = body.mineOnly === true
  const isNoLookback = platform === 'naver-blog' || platform === 'tistory'
  const lookbackDays = isNoLookback ? 0 : getCollectLookbackDays()
  const maxVideosPerChannel = getCollectMaxVideosPerChannel()
  const policyLabel = isNoLookback
    ? platform === 'tistory'
      ? `채널당 최근 RSS 분량 · 날짜 무관`
      : `채널당 최근 ${Math.max(maxVideosPerChannel, 30)}개 · 날짜 무관`
    : getCollectPolicyLabel()

  if (!isCollectionEnabled(platform)) {
    return NextResponse.json(
      {
        ok: false,
        platform,
        lookbackDays,
        maxVideosPerChannel,
        policyLabel,
        error: `${platform} 수집은 아직 연결되지 않았습니다.`,
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

  const results: CollectResult[] = []
  for (const row of list) {
    const r = await collectByPlatform(platform, row)
    results.push(r)
    await new Promise((resolve) => setTimeout(resolve, 400))
  }

  const okCount = results.filter((r) => r.ok).length
  const failCount = results.length - okCount

  let viewsSync: Awaited<ReturnType<typeof runNaverBlogViewsSync>> | undefined
  if (platform === 'naver-blog' && okCount > 0) {
    viewsSync = await runNaverBlogViewsSync({
      onlyMissingViews: true,
      maxPosts: 120,
      source: 'collect-platform',
    })
  }

  let message = `${platform} 새로고침: 성공 ${okCount} / 실패 ${failCount} (${policyLabel})`
  if (viewsSync?.updated) {
    message += ` · ${viewsSync.message}`
  }

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
    viewsSync,
    message,
  })
}
