import { NextResponse } from 'next/server'
import {
  getCollectLookbackDays,
  getCollectMaxVideosPerChannel,
  getCollectPolicyLabel,
} from '@/lib/dashboard/collect-config'

export async function GET() {
  const lookbackDays = getCollectLookbackDays()
  const maxVideosPerChannel = getCollectMaxVideosPerChannel()
  return NextResponse.json({
    lookbackDays,
    maxVideosPerChannel,
    label: getCollectPolicyLabel(),
    hint: '채널당 최근 업로드 순 최대 N개, 업로드일이 M일 이내인 영상만 수집·저장합니다. .env: YOUTUBE_COLLECT_LOOKBACK_DAYS, YOUTUBE_COLLECT_MAX_VIDEOS',
  })
}
