'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import type { AddToast } from '@/lib/dashboard/dashboard-types'
import { getPlatformIcon } from '@/lib/dashboard/dashboard-helpers'
import { fetchChannelFlags, patchChannelFlag, type ChannelFlagStored } from '@/lib/dashboard/dashboard-storage'
import { TitleWithHint } from '@/components/dashboard/info-hint'

interface ChannelRow {
  channel_id: string
  channel_name: string
  platform: string
  subscribers: number | null
  video_count: number | null
  avg_views: number | null
}

const GOAL_DEFAULT = 1000

export default function MyChannelsView({ addToast }: { addToast: AddToast }) {
  const [allChannels, setAllChannels] = useState<ChannelRow[]>([])
  const [flags, setFlags] = useState<ChannelFlagStored[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    const [data, fl] = await Promise.all([
      fetch('/api/dashboard/channels').then((r) => r.json()) as Promise<ChannelRow[]>,
      fetchChannelFlags().catch(() => [] as ChannelFlagStored[]),
    ])
    setAllChannels(data)
    setFlags(fl)
  }, [])

  useEffect(() => {
    load()
      .catch(() => addToast('채널 로드 실패', 'warning'))
      .finally(() => setLoading(false))
  }, [load, addToast])

  const myChannels = allChannels.filter((c) => flags.find((f) => f.channel_id === c.channel_id)?.is_mine)

  const toggleMine = async (channelId: string) => {
    const current = flags.find((f) => f.channel_id === channelId)?.is_mine ?? false
    try {
      const row = await patchChannelFlag(channelId, { is_mine: !current })
      setFlags((prev) => [...prev.filter((f) => f.channel_id !== channelId), row])
      addToast('내 채널 설정이 저장되었습니다', 'success')
    } catch {
      addToast('저장 실패', 'warning')
    }
  }

  const quickLinks = [
    { view: 'calendar', label: '콘텐츠 캘린더', icon: '🗓️', desc: '업로드·제작 일정' },
    { view: 'my-youtube-shorts', label: 'YouTube Shorts', icon: '⚡', desc: '내 숏폼 통계' },
    { view: 'my-youtube-longform', label: 'YouTube 롱폼', icon: '🎬', desc: '내 롱폼 통계' },
    { view: 'my-tiktok', label: 'TikTok', icon: '🎵', desc: '내 TikTok (더미)' },
  ]

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-blue-100 dark:border-blue-900 bg-gradient-to-br from-blue-50 to-white dark:from-blue-950/40 dark:to-gray-800 p-5">
        <TitleWithHint
          as="h3"
          className="text-sm font-bold text-gray-900 dark:text-white mb-1"
          hint="내가 운영하는 채널·콘텐츠를 한곳에서 관리합니다. 아래에서 플랫폼별 통계·캘린더로 이동할 수 있습니다."
        >
          운영 허브
        </TitleWithHint>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
          «내 채널»로 지정한 항목만 하위 메뉴(YouTube·TikTok 등)에 표시됩니다. 등록·수집은 «채널·콘텐츠 등록»에서 진행합니다.
        </p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {quickLinks.map((link) => (
            <Link
              key={link.view}
              href={`/dashboard?view=${link.view}`}
              className="rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900/60 px-3 py-2.5 hover:border-blue-300 dark:hover:border-blue-700 transition"
            >
              <span className="text-lg">{link.icon}</span>
              <p className="text-xs font-semibold text-gray-900 dark:text-white mt-1">{link.label}</p>
              <p className="text-[10px] text-gray-500 mt-0.5">{link.desc}</p>
            </Link>
          ))}
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-gray-400 text-center py-8">불러오는 중…</p>
      ) : myChannels.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-8 text-center border border-gray-100 dark:border-gray-700">
          <p className="text-sm text-gray-500 mb-4">내 채널로 지정된 항목이 없습니다.</p>
          <p className="text-xs text-gray-400 mb-4">아래에서 채널을 선택하거나 새로 등록하세요.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {myChannels.map((ch) => {
            const subs = ch.subscribers ?? 0
            const videos = ch.video_count ?? 0
            const progress = Math.min((subs / GOAL_DEFAULT) * 100, 100)
            const status = videos > 0 ? '운영중' : '준비중'
            return (
              <div key={ch.channel_id} className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm p-5 border border-gray-100 dark:border-gray-700">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{getPlatformIcon(ch.platform)}</span>
                    <span className="text-sm font-semibold text-gray-900 dark:text-white">{ch.channel_name}</span>
                  </div>
                  <span
                    className={`px-2 py-1 text-xs rounded-full font-medium ${
                      status === '운영중' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                    }`}
                  >
                    {status}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div className="bg-gray-50 dark:bg-gray-700 rounded-xl p-3 text-center">
                    <p className="text-xl font-bold text-gray-900 dark:text-white">{subs.toLocaleString()}</p>
                    <p className="text-xs text-gray-400 mt-0.5">구독자</p>
                  </div>
                  <div className="bg-gray-50 dark:bg-gray-700 rounded-xl p-3 text-center">
                    <p className="text-xl font-bold text-gray-900 dark:text-white">{videos}</p>
                    <p className="text-xs text-gray-400 mt-0.5">채널 영상(YouTube)</p>
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-xs text-gray-500 mb-1">
                    <span>목표: {GOAL_DEFAULT.toLocaleString()} 구독자</span>
                    <span>{progress.toFixed(0)}%</span>
                  </div>
                  <div className="bg-gray-100 dark:bg-gray-700 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full ${progress > 0 ? 'bg-blue-500' : 'bg-gray-300'}`}
                      style={{ width: `${Math.max(progress, 2)}%` }}
                    />
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm p-5 border border-gray-100 dark:border-gray-700">
        <TitleWithHint
          as="h3"
          className="font-bold text-gray-900 dark:text-white mb-3 text-sm"
          hint="Supabase 채널 중 «내 채널»로 표시할 항목을 선택합니다. 구독자·영상 수는 YouTube 수집 데이터 기준입니다."
        >
          내 채널로 지정
        </TitleWithHint>
        <div className="space-y-2 max-h-48 overflow-y-auto">
          {allChannels.map((ch) => (
            <label key={ch.channel_id} className="flex items-center gap-3 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={flags.find((f) => f.channel_id === ch.channel_id)?.is_mine ?? false}
                onChange={() => toggleMine(ch.channel_id)}
                className="rounded"
              />
              <span>{getPlatformIcon(ch.platform)}</span>
              <span className="text-gray-800 dark:text-gray-200">{ch.channel_name}</span>
            </label>
          ))}
        </div>
        <Link
          href="/dashboard?view=benchmark"
          className="inline-block mt-4 text-xs text-blue-600 hover:underline"
        >
          + 새 채널 등록 →
        </Link>
      </div>
    </div>
  )
}
