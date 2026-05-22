'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import type { AddToast } from '@/lib/dashboard/dashboard-types'
import {
  getTierColor,
  getPlatformName,
  getPlatformIcon,
  getPlatformColor,
  formatViews,
} from '@/lib/dashboard/dashboard-helpers'
import {
  fetchChannelFlags,
  patchChannelFlag,
  isChannelTracked,
  type ChannelFlagStored,
} from '@/lib/dashboard/dashboard-storage'
import { TitleWithHint } from '@/components/dashboard/info-hint'

interface EnrichedChannel {
  id: number
  channel_id: string
  name: string
  platform: string
  subs: number
  avgViews: number
  videos: number
  topKeyword: string
  tier: string
}

export default function CompetitorChannelsView({ addToast }: { addToast: AddToast }) {
  const [channels, setChannels] = useState<EnrichedChannel[]>([])
  const [flags, setFlags] = useState<ChannelFlagStored[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    const [chRes, fl] = await Promise.all([
      fetch('/api/dashboard/channels/enriched').then((r) => r.json()),
      fetchChannelFlags().catch(() => [] as ChannelFlagStored[]),
    ])
    setChannels(chRes)
    setFlags(fl)
  }, [])

  useEffect(() => {
    load()
      .catch(() => addToast('채널 목록 로드 실패', 'warning'))
      .finally(() => setLoading(false))
  }, [load, addToast])

  const toggleTrack = async (channelId: string, name: string) => {
    const current = isChannelTracked(channelId, flags, true)
    try {
      const row = await patchChannelFlag(channelId, { is_tracked: !current })
      setFlags((prev) => {
        const rest = prev.filter((f) => f.channel_id !== channelId)
        return [...rest, row]
      })
      addToast(!current ? `"${name}" 추적 시작` : `"${name}" 추적 해제`, !current ? 'success' : 'warning')
    } catch {
      addToast('저장 실패', 'warning')
    }
  }

  const trackedCount = channels.filter((c) => isChannelTracked(c.channel_id, flags, true)).length

  return (
    <div className="space-y-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm overflow-hidden border border-gray-100 dark:border-gray-700">
        <div className="p-5 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center">
          <div>
            <TitleWithHint
              as="h3"
              className="font-bold text-gray-900 dark:text-white"
              hint="Supabase에 등록된 YouTube 채널입니다. 추적 여부는 DB에 저장됩니다. 채널 추가는 «채널·콘텐츠 등록» 메뉴에서 하세요."
            >
              경쟁 채널 목록
            </TitleWithHint>
            <p className="text-xs text-gray-400 mt-0.5">
              추적 중: {trackedCount}개 / {channels.length}개
            </p>
          </div>
          <Link
            href="/dashboard?view=benchmark"
            className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition"
          >
            + 채널 등록
          </Link>
        </div>

        {loading ? (
          <p className="p-8 text-center text-sm text-gray-400">불러오는 중…</p>
        ) : channels.length === 0 ? (
          <p className="p-8 text-center text-sm text-gray-500">등록된 채널이 없습니다.</p>
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-gray-700">
            {channels.map((ch) => {
              const tracked = isChannelTracked(ch.channel_id, flags, true)
              return (
                <div
                  key={ch.channel_id}
                  className="p-5 flex items-center gap-4 hover:bg-gray-50 dark:hover:bg-gray-700 transition"
                >
                  <div className="w-10 h-10 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-lg shrink-0">
                    {getPlatformIcon(ch.platform)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold text-gray-900 dark:text-white">{ch.name}</p>
                      <span className={`px-1.5 py-0.5 text-xs rounded-full ${getPlatformColor(ch.platform)}`}>
                        {getPlatformName(ch.platform)}
                      </span>
                      <span className={`px-1.5 py-0.5 text-xs rounded ${getTierColor(ch.tier)}`}>{ch.tier}</span>
                    </div>
                    <div className="flex gap-4 mt-1 text-xs text-gray-400 flex-wrap">
                      <span>구독자 {(ch.subs / 10000).toFixed(1)}만</span>
                      <span>평균 {formatViews(ch.avgViews)} views</span>
                      <span>DB 영상 {ch.videos}개</span>
                      <span className="text-blue-500">#{ch.topKeyword}</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => toggleTrack(ch.channel_id, ch.name)}
                    className={`px-3 py-1.5 text-xs rounded-lg font-medium transition shrink-0 ${
                      tracked
                        ? 'bg-green-100 text-green-700 hover:bg-red-100 hover:text-red-700'
                        : 'bg-gray-100 text-gray-500 hover:bg-blue-100 hover:text-blue-700'
                    }`}
                  >
                    {tracked ? '✓ 추적 중' : '+ 추적'}
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
