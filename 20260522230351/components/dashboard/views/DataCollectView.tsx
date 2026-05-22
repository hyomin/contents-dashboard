'use client'

import { useState, useEffect, useCallback } from 'react'
import type { AddToast } from '@/lib/dashboard-types'
import { getPlatformIcon, getPlatformName } from '@/lib/dashboard-helpers'
import { TitleWithHint } from '@/components/dashboard/info-hint'
import { N8nLv1ServicesSection } from '@/components/dashboard/n8n-lv1-services-section'
import { PLATFORMS_WITH_COLLECTION } from '@/lib/platforms'

// ─── 타입 ──────────────────────────────────────────────────────────
interface CollectChannelRow {
  channel_id: string
  channel_name: string
  platform: string
  subscribers: number | null
  avg_views: number | null
  updated_at: string | null
  videos_in_db: number
}

interface CollectStatusResponse {
  stats: { total: number; byPlatform: Record<string, number>; avgVsAvg: number }
  channels: CollectChannelRow[]
}

interface CollectLog {
  time: string
  type: 'success' | 'warning' | 'error'
  message: string
}

// ─── 플랫폼 탭 설정 ────────────────────────────────────────────────
const PLATFORM_TABS = [
  { id: 'all', label: '전체', icon: '📋' },
  ...PLATFORMS_WITH_COLLECTION.map((p) => ({
    id: p,
    label: getPlatformName(p),
    icon: getPlatformIcon(p),
  })),
] as const

type TabId = (typeof PLATFORM_TABS)[number]['id']

// ─── 플랫폼별 힌트 ────────────────────────────────────────────────
const PLATFORM_HINT: Record<string, string> = {
  youtube: 'YouTube Data API로 채널 통계·영상 목록을 수집합니다. n8n 스케줄 1일 자동 실행.',
  'naver-blog':
    '네이버 검색 Open API + PostTitleListAsync로 글 목록을 수집합니다. «조회수 갱신»으로 좋아요·댓글 기반 vs.Avg를 계산합니다.',
  tistory: 'RSS 피드로 최근 글 목록(제목·날짜·링크)을 수집합니다. 조회수는 RSS에 미제공입니다.',
}

// ─── 플랫폼별 수집 API 결정 ───────────────────────────────────────
function collectApiForPlatform(platform: string): { url: string; body: Record<string, unknown> } {
  return {
    url: '/api/dashboard/collect',
    body: { channel_id: '', channel_name: '', platform },
  }
}

// ─── 유틸 ─────────────────────────────────────────────────────────
function formatRelativeTime(iso: string | null): string {
  if (!iso) return '—'
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return '방금 전'
  if (mins < 60) return `${mins}분 전`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}시간 전`
  return `${Math.floor(hours / 24)}일 전`
}

function staleBadge(updatedAt: string | null) {
  if (!updatedAt) return { label: '미수집', cls: 'bg-gray-100 text-gray-500' }
  const hrs = (Date.now() - new Date(updatedAt).getTime()) / 3600000
  if (hrs > 24) return { label: '24h 경과', cls: 'bg-red-100 text-red-600' }
  if (hrs > 6) return { label: '6h 경과', cls: 'bg-yellow-100 text-yellow-700' }
  return { label: '정상', cls: 'bg-green-100 text-green-700' }
}

// ─── 컴포넌트 ─────────────────────────────────────────────────────
export default function DataCollectView({ addToast }: { addToast: AddToast }) {
  const [activeTab, setActiveTab] = useState<TabId>('all')
  const [allChannels, setAllChannels] = useState<CollectChannelRow[]>([])
  const [stats, setStats] = useState<CollectStatusResponse['stats'] | null>(null)
  const [logs, setLogs] = useState<CollectLog[]>([])
  const [loading, setLoading] = useState(true)
  const [runningId, setRunningId] = useState<string | null>(null)
  const [collectingPlatform, setCollectingPlatform] = useState<string | null>(null)
  const [syncingNaverViews, setSyncingNaverViews] = useState(false)

  const pushLog = useCallback((type: CollectLog['type'], message: string) => {
    const time = new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
    setLogs((prev) => [{ time, type, message }, ...prev].slice(0, 30))
  }, [])

  const loadStatus = useCallback(async () => {
    const res = await fetch('/api/dashboard/collect-status')
    if (!res.ok) throw new Error('수집 현황 로드 실패')
    const data = (await res.json()) as CollectStatusResponse
    setAllChannels(data.channels)
    setStats(data.stats)
  }, [])

  useEffect(() => {
    loadStatus()
      .catch(() => addToast('수집 현황 로드 실패', 'warning'))
      .finally(() => setLoading(false))
  }, [loadStatus, addToast])

  // 탭에 맞게 채널 필터
  const visibleChannels =
    activeTab === 'all' ? allChannels : allChannels.filter((ch) => ch.platform === activeTab)

  const isBusy = runningId !== null || collectingPlatform !== null || syncingNaverViews

  // ─── 단일 채널 수집 ────────────────────────────────────────────
  const runChannel = async (ch: CollectChannelRow) => {
    if (isBusy) return
    setRunningId(ch.channel_id)
    addToast(`${ch.channel_name} 수집 중…`, 'info')
    try {
      const res = await fetch('/api/dashboard/collect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channel_id: ch.channel_id,
          channel_name: ch.channel_name,
          platform: ch.platform,
        }),
      })
      const data = await res.json()
      if (!res.ok || !data.ok) {
        pushLog('error', `${ch.channel_name}: ${data.error ?? res.status}`)
        addToast(data.error ?? '수집 실패', 'warning')
        return
      }
      pushLog('success', data.message ?? `${ch.channel_name} 수집 완료`)
      addToast(data.message ?? '수집 완료', 'success')
      await loadStatus()
    } catch {
      pushLog('error', `${ch.channel_name}: 네트워크 오류`)
      addToast('수집 중 오류', 'warning')
    } finally {
      setRunningId(null)
    }
  }

  // ─── 플랫폼 전체 수집 ─────────────────────────────────────────
  const runPlatformAll = async (platform: string) => {
    if (isBusy) return
    const pChannels = allChannels.filter((ch) => ch.platform === platform)
    if (pChannels.length === 0) return
    setCollectingPlatform(platform)
    addToast(`${getPlatformName(platform)} ${pChannels.length}개 채널 수집 시작`, 'info')
    try {
      const res = await fetch('/api/dashboard/collect-platform', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ platform }),
      })
      const data = await res.json()
      const msg = data.message ?? `성공 ${data.succeeded ?? '?'}/${data.total ?? '?'}`
      pushLog(data.ok ? 'success' : 'warning', msg)
      addToast(msg, data.ok ? 'success' : 'warning')
      if (Array.isArray(data.results)) {
        for (const r of data.results) {
          if (!r.ok && r.error) pushLog('error', `${r.channel_id}: ${r.error}`)
        }
      }
      await loadStatus()
    } catch {
      pushLog('error', `${getPlatformName(platform)} 전체 수집: 네트워크 오류`)
      addToast('전체 수집 중 오류', 'warning')
    } finally {
      setCollectingPlatform(null)
    }
  }

  // ─── 네이버 조회수·vs.Avg 갱신 ─────────────────────────────────
  const runNaverViewsSync = async () => {
    if (isBusy) return
    setSyncingNaverViews(true)
    addToast('네이버 블로그 조회수·vs.Avg 갱신 중…', 'info')
    try {
      const res = await fetch('/api/dashboard/naver-blog-views', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ onlyMissingViews: false, maxPosts: 120, source: 'data-collect' }),
      })
      const data = await res.json()
      const msg = data.message ?? `${data.updated ?? 0}건 갱신`
      pushLog(data.ok ? 'success' : 'warning', msg)
      addToast(msg, data.ok ? 'success' : 'warning')
      await loadStatus()
    } catch {
      pushLog('error', '조회수 갱신: 네트워크 오류')
      addToast('조회수 갱신 중 오류', 'warning')
    } finally {
      setSyncingNaverViews(false)
    }
  }

  // ─── 통계 카드 데이터 ──────────────────────────────────────────
  const tabChannelCount =
    activeTab === 'all' ? allChannels.length : allChannels.filter((c) => c.platform === activeTab).length
  const tabPostCount =
    activeTab === 'all'
      ? (stats?.total ?? 0)
      : Object.entries(stats?.byPlatform ?? {})
          .filter(([p]) => p === activeTab)
          .reduce((s, [, n]) => s + n, 0)

  return (
    <div className="space-y-5">
      {/* n8n 서비스 */}
      <N8nLv1ServicesSection viewId="data-collect" addToast={addToast} />

      {/* 플랫폼 탭 */}
      <div className="flex gap-2 flex-wrap">
        {PLATFORM_TABS.map((tab) => {
          const count =
            tab.id === 'all'
              ? allChannels.length
              : allChannels.filter((c) => c.platform === tab.id).length
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition ${
                activeTab === tab.id
                  ? 'bg-blue-600 text-white shadow'
                  : 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:border-blue-400'
              }`}
            >
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
              {!loading && (
                <span
                  className={`text-xs px-1.5 py-0.5 rounded-full font-mono ${
                    activeTab === tab.id ? 'bg-white/20 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-500'
                  }`}
                >
                  {count}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* 통계 카드 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          {
            label: activeTab === 'all' ? '전체 채널' : `${getPlatformName(activeTab)} 채널`,
            value: loading ? '…' : `${tabChannelCount}개`,
            sub: activeTab === 'all' ? '전 플랫폼' : getPlatformName(activeTab),
          },
          {
            label: '수집 글·영상',
            value: loading ? '…' : `${tabPostCount.toLocaleString()}개`,
            sub: 'Supabase videos',
          },
          {
            label: '평균 vs.Avg',
            value: loading ? '…' : `${stats?.avgVsAvg?.toFixed(1) ?? '0'}x`,
            sub: '전체 플랫폼',
          },
          ...((stats?.byPlatform && activeTab === 'all')
            ? [{
                label: '플랫폼 분포',
                value: loading ? '…' : Object.entries(stats.byPlatform)
                  .map(([p, n]) => `${getPlatformIcon(p)}${n}`)
                  .join(' '),
                sub: '플랫폼별 글·영상 수',
              }]
            : []),
        ].map((c) => (
          <div
            key={c.label}
            className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-gray-700"
          >
            <p className="text-xs text-gray-500 dark:text-gray-400">{c.label}</p>
            <p className="text-xl font-bold text-gray-900 dark:text-white mt-1 truncate">{c.value}</p>
            <p className="text-xs text-gray-400 mt-0.5">{c.sub}</p>
          </div>
        ))}
      </div>

      {/* 채널 목록 + 플랫폼 수집 버튼 */}
      {(activeTab === 'all' ? [...PLATFORMS_WITH_COLLECTION] : [activeTab]).map((platform) => {
        if (platform === 'all') return null
        const platformChannels = allChannels.filter((ch) => ch.platform === platform)
        if (activeTab !== 'all' && activeTab !== platform) return null
        if (activeTab === 'all' && platformChannels.length === 0) return null
        const isCollectingThis = collectingPlatform === platform
        const hint = PLATFORM_HINT[platform] ?? '수집 API로 채널 글·영상 목록을 갱신합니다.'

        return (
          <div
            key={platform}
            className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm overflow-hidden border border-gray-100 dark:border-gray-700"
          >
            {/* 섹션 헤더 */}
            <div className="p-5 border-b border-gray-100 dark:border-gray-700 flex flex-wrap justify-between items-center gap-3">
              <TitleWithHint
                as="h3"
                className="font-bold text-gray-900 dark:text-white flex items-center gap-2"
                hint={hint}
              >
                <span>{getPlatformIcon(platform)}</span>
                <span>{getPlatformName(platform)} 수집</span>
                <span className="text-xs font-normal text-gray-400">
                  ({platformChannels.length}개 채널)
                </span>
              </TitleWithHint>

              <div className="flex gap-2 flex-wrap">
                {/* 네이버 블로그 전용 조회수 갱신 버튼 */}
                {platform === 'naver-blog' && (
                  <button
                    type="button"
                    onClick={runNaverViewsSync}
                    disabled={isBusy}
                    className="px-3 py-2 text-sm rounded-lg font-medium bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 transition"
                  >
                    {syncingNaverViews ? '갱신 중…' : '↻ 조회수·vs.Avg 갱신'}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => runPlatformAll(platform)}
                  disabled={isBusy || platformChannels.length === 0}
                  className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                >
                  {isCollectingThis ? '수집 중…' : `▶ 전체 수집`}
                </button>
              </div>
            </div>

            {/* 채널 행 */}
            {loading ? (
              <p className="p-8 text-center text-sm text-gray-400">불러오는 중…</p>
            ) : platformChannels.length === 0 ? (
              <p className="p-8 text-center text-sm text-gray-500">
                등록된 {getPlatformName(platform)} 채널이 없습니다. «채널·콘텐츠 등록»에서 채널을 추가하세요.
              </p>
            ) : (
              <div className="divide-y divide-gray-100 dark:divide-gray-700">
                {platformChannels.map((ch) => {
                  const isRunning = runningId === ch.channel_id
                  const badge = staleBadge(ch.updated_at)
                  return (
                    <div key={ch.channel_id} className="p-4 flex items-center gap-4">
                      <span className="text-xl shrink-0">{getPlatformIcon(ch.platform)}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                            {ch.channel_name}
                          </p>
                          <span className={`px-2 py-0.5 text-xs rounded-full ${isRunning ? 'bg-blue-100 text-blue-700' : badge.cls}`}>
                            {isRunning ? '수집 중' : badge.label}
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-3 text-xs text-gray-400 mt-1">
                          <span>마지막: {formatRelativeTime(ch.updated_at)}</span>
                          <span>DB 글·영상: {ch.videos_in_db}개</span>
                          {platform === 'youtube' && ch.avg_views != null && (
                            <span>채널 avg: {ch.avg_views.toLocaleString()}</span>
                          )}
                          <span className="font-mono text-gray-300 dark:text-gray-600">{ch.channel_id}</span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => runChannel(ch)}
                        disabled={isBusy}
                        className={`px-4 py-2 text-sm rounded-lg font-medium transition shrink-0 ${
                          isRunning
                            ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                            : 'bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50'
                        }`}
                      >
                        {isRunning ? '수집 중…' : '▶'}
                      </button>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )
      })}

      {/* 빈 탭 안내 */}
      {!loading && visibleChannels.length === 0 && activeTab !== 'all' && (
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-10 text-center text-gray-400 border border-gray-100 dark:border-gray-700">
          <p className="text-3xl mb-2">{getPlatformIcon(activeTab)}</p>
          <p className="font-medium text-gray-600 dark:text-gray-300">
            {getPlatformName(activeTab)} 채널이 없습니다
          </p>
          <p className="text-sm mt-1">«채널·콘텐츠 등록»에서 채널을 추가하세요.</p>
        </div>
      )}

      {/* 수집 로그 */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm p-5 border border-gray-100 dark:border-gray-700">
        <h3 className="font-bold text-gray-900 dark:text-white mb-4 text-sm">
          최근 수집 로그
          {logs.length > 0 && (
            <button
              type="button"
              onClick={() => setLogs([])}
              className="ml-2 text-xs text-gray-400 hover:text-gray-600 font-normal"
            >
              지우기
            </button>
          )}
        </h3>
        {logs.length === 0 ? (
          <p className="text-sm text-gray-400">이 세션에서 실행한 수집 기록이 여기 표시됩니다.</p>
        ) : (
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {logs.map((log, i) => (
              <div key={i} className="flex items-start gap-3 text-sm">
                <span className="text-xs text-gray-400 shrink-0 w-12">{log.time}</span>
                <span className="shrink-0">
                  {log.type === 'success' ? '✅' : log.type === 'warning' ? '⚠️' : '❌'}
                </span>
                <span className="text-gray-600 dark:text-gray-300 break-all">{log.message}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
