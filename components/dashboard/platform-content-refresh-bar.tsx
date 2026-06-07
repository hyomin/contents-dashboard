'use client'

import { useEffect, useState } from 'react'
import { getPlatformIcon, getPlatformName } from '@/lib/dashboard/dashboard-helpers'
import { isCollectionEnabled, isPlatformPublishExpansion } from '@/lib/dashboard/platforms'
import { TitleWithHint } from '@/components/dashboard/info-hint'
import type { AddToast } from '@/lib/dashboard/dashboard-types'

interface PlatformContentRefreshBarProps {
  platform: string
  addToast: AddToast
  onRefreshed?: () => void | Promise<void>
  mineOnly?: boolean
}

export function PlatformContentRefreshBar({
  platform,
  addToast,
  onRefreshed,
  mineOnly = false,
}: PlatformContentRefreshBarProps) {
  const [refreshing, setRefreshing] = useState(false)
  const [policyLabel, setPolicyLabel] = useState('채널당 최근 10개 · 30일 이내')

  useEffect(() => {
    fetch('/api/dashboard/collect-config')
      .then((r) => r.json())
      .then((d: { label?: string }) => {
        if (typeof d.label === 'string') setPolicyLabel(d.label)
      })
      .catch(() => {})
  }, [])

  const canCollect = isCollectionEnabled(platform)
  const isPublishExpansion = isPlatformPublishExpansion(platform)

  const runRefresh = async () => {
    if (isPublishExpansion) {
      addToast(`${getPlatformName(platform)}은 발행 확장 전용입니다. 레퍼런스는 YouTube Shorts를 사용하세요`, 'info')
      return
    }
    if (!canCollect) return

    setRefreshing(true)
    addToast(
      `${getPlatformName(platform)} ${mineOnly ? '내 채널' : '등록 채널'} 새로고침 중…`,
      'info',
    )
    try {
      const res = await fetch('/api/dashboard/collect-platform', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ platform, mineOnly }),
      })
      const data = await res.json()
      if (!res.ok) {
        addToast(data.error ?? '새로고침 실패', 'warning')
        return
      }
      addToast(data.message ?? '새로고침 완료', data.ok ? 'success' : 'warning')
      await onRefreshed?.()
    } catch {
      addToast('새로고침 중 오류가 발생했습니다', 'warning')
    } finally {
      setRefreshing(false)
    }
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-3 shadow-sm">
      <div className="min-w-0">
        <TitleWithHint
          as="p"
          className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2"
          hint={
            canCollect
              ? mineOnly
                ? `«내 채널»로 지정된 ${getPlatformName(platform)} 채널만 YouTube API로 다시 수집합니다. 기준: ${policyLabel}.`
                : `등록된 ${getPlatformName(platform)} 채널을 YouTube API로 다시 수집합니다. 기준: ${policyLabel}. 그보다 오래된 해당 채널 영상은 DB에서 제거됩니다.`
              : isPublishExpansion
                ? 'TikTok·Instagram은 수집·분석 없이 발행 포맷·변환 가이드만 제공합니다.'
                : '이 플랫폼의 자동 수집은 추후 n8n·API로 연결 예정입니다.'
          }
        >
          <span>{getPlatformIcon(platform)}</span>
          {mineOnly ? `내 ${getPlatformName(platform)}` : `${getPlatformName(platform)} 콘텐츠`}
        </TitleWithHint>
        <p className="text-xs text-gray-500 mt-0.5">
          {canCollect
            ? `수집 기준: ${policyLabel} · ${mineOnly ? '내 채널만' : '등록 채널 일괄'} 현행화`
            : isPublishExpansion
              ? '발행 확장 · 레퍼런스는 YouTube Shorts'
              : '수집 준비 중'}
        </p>
      </div>
      <button
        type="button"
        onClick={runRefresh}
        disabled={refreshing}
        className="shrink-0 px-4 py-2 text-sm font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 transition"
      >
        {refreshing ? '새로고침 중…' : '↻ 콘텐츠 새로고침'}
      </button>
    </div>
  )
}
