'use client'

import { useState, useEffect, useCallback } from 'react'
import type { AddToast } from '@/lib/dashboard/dashboard-types'
import { getPlatformIcon, getPlatformName } from '@/lib/dashboard/dashboard-helpers'
import { TitleWithHint } from '@/components/dashboard/info-hint'
import { N8nLv1ServicesSection } from '@/components/dashboard/n8n-lv1-services-section'
import { PLATFORMS_WITH_COLLECTION } from '@/lib/dashboard/platforms'
import { PageLoadingOverlay } from '@/components/dashboard/ui/loading'

// ─── 네이버 블로그 ID 파싱 헬퍼 ───────────────────────────────
function parseNaverBlogIdInput(raw: string): string | null {
  const s = raw.trim()
  // URL 형식: https://blog.naver.com/myblogid 또는 blog.naver.com/myblogid
  const urlMatch = s.match(/blog\.naver\.com\/([a-zA-Z0-9_.-]+)/i)
  if (urlMatch) return urlMatch[1].toLowerCase()
  // 순수 ID
  if (/^[a-zA-Z0-9_.-]+$/.test(s) && s.length >= 3) return s.toLowerCase()
  return null
}

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
  // 네이버 블로그 채널 빠른 등록
  const [naverAddInput, setNaverAddInput] = useState('')
  const [naverAddName, setNaverAddName] = useState('')
  const [naverAdding, setNaverAdding] = useState(false)
  const [naverDeleteId, setNaverDeleteId] = useState<string | null>(null)

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

  // ─── 네이버 블로그 채널 등록 + 즉시 수집 ────────────────────────
  const addNaverChannel = useCallback(async () => {
    const blogId = parseNaverBlogIdInput(naverAddInput)
    if (!blogId) {
      addToast('올바른 블로그 ID 또는 URL을 입력하세요 (예: myblog 또는 blog.naver.com/myblog)', 'warning')
      return
    }
    setNaverAdding(true)
    try {
      // 1. 채널 등록
      const regRes = await fetch('/api/dashboard/channels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channel_id: blogId,
          channel_name: naverAddName.trim() || blogId,
          platform: 'naver-blog',
        }),
      })
      if (!regRes.ok) {
        const d = await regRes.json()
        addToast(d.error ?? '채널 등록 실패', 'warning')
        return
      }
      addToast(`${blogId} 채널 등록 완료. 수집 시작…`, 'info')
      setNaverAddInput('')
      setNaverAddName('')

      // 2. 즉시 수집
      const res = await fetch('/api/dashboard/collect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channel_id: blogId, channel_name: naverAddName.trim() || blogId, platform: 'naver-blog' }),
      })
      const data = await res.json()
      pushLog(data.ok ? 'success' : 'warning', data.message ?? `${blogId} 수집 완료`)
      addToast(data.message ?? '수집 완료', data.ok ? 'success' : 'warning')
      await loadStatus()
    } catch {
      addToast('채널 등록 중 오류가 발생했습니다', 'warning')
    } finally {
      setNaverAdding(false)
    }
  }, [naverAddInput, naverAddName, addToast, pushLog, loadStatus])

  // ─── 채널 삭제 ─────────────────────────────────────────────────
  const deleteChannel = useCallback(async (channelId: string, channelName: string) => {
    if (!window.confirm(`"${channelName}" 채널을 삭제하시겠습니까? 수집된 글도 함께 삭제됩니다.`)) return
    setNaverDeleteId(channelId)
    try {
      const res = await fetch(`/api/dashboard/channels?channel_id=${encodeURIComponent(channelId)}`, { method: 'DELETE' })
      if (!res.ok) {
        addToast('채널 삭제 실패', 'warning')
        return
      }
      addToast(`"${channelName}" 채널 삭제 완료`, 'success')
      await loadStatus()
    } catch {
      addToast('채널 삭제 중 오류', 'warning')
    } finally {
      setNaverDeleteId(null)
    }
  }, [addToast, loadStatus])

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
    <PageLoadingOverlay loading={loading} label="수집 현황을 불러오는 중…">
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

            {/* 네이버 블로그 채널 등록 폼 (항상 표시) */}
            {platform === 'naver-blog' && (
              <div className="px-5 py-4 bg-green-50/60 dark:bg-green-950/20 border-b border-green-100 dark:border-green-900">
                <p className="text-xs font-semibold text-green-800 dark:text-green-200 mb-2">
                  🟢 네이버 블로그 채널 추가
                </p>
                <div className="flex flex-wrap gap-2">
                  <input
                    type="text"
                    value={naverAddInput}
                    onChange={(e) => setNaverAddInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && addNaverChannel()}
                    placeholder="블로그 ID 또는 URL (예: myblog, blog.naver.com/myblog)"
                    className="flex-1 min-w-[200px] text-sm px-3 py-2 rounded-xl border border-green-200 dark:border-green-700 bg-white dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-green-400"
                    disabled={naverAdding}
                  />
                  <input
                    type="text"
                    value={naverAddName}
                    onChange={(e) => setNaverAddName(e.target.value)}
                    placeholder="블로그 이름 (선택, 자동 감지)"
                    className="flex-1 min-w-[160px] text-sm px-3 py-2 rounded-xl border border-green-200 dark:border-green-700 bg-white dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-green-400"
                    disabled={naverAdding}
                  />
                  <button
                    type="button"
                    onClick={addNaverChannel}
                    disabled={naverAdding || !naverAddInput.trim()}
                    className="px-4 py-2 text-sm font-semibold rounded-xl bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 transition"
                  >
                    {naverAdding ? '등록+수집 중…' : '+ 등록 & 수집'}
                  </button>
                </div>
                <p className="text-[10px] text-green-700 dark:text-green-400 mt-1.5">
                  등록 즉시 글 목록을 수집하고 조회수·vs.Avg를 갱신합니다. n8n W04·W07이 12시간마다 자동 실행됩니다.
                </p>
              </div>
            )}

            {/* 채널 행 */}
            {loading ? (
              <p className="p-8 text-center text-sm text-gray-400">불러오는 중…</p>
            ) : platformChannels.length === 0 ? (
              <p className="p-6 text-center text-sm text-gray-500">
                {platform === 'naver-blog'
                  ? '위 입력란에 블로그 ID를 입력하고 «+ 등록 & 수집»을 클릭하세요.'
                  : `등록된 ${getPlatformName(platform)} 채널이 없습니다. «채널·콘텐츠 등록»에서 채널을 추가하세요.`}
              </p>
            ) : (
              <div className="divide-y divide-gray-100 dark:divide-gray-700">
                {platformChannels.map((ch) => {
                  const isRunning = runningId === ch.channel_id
                  const isDeleting = naverDeleteId === ch.channel_id
                  const badge = staleBadge(ch.updated_at)
                  return (
                    <div key={ch.channel_id} className="p-4 flex items-center gap-3">
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
                          {platform === 'naver-blog' && (
                            <a
                              href={`https://blog.naver.com/${ch.channel_id}`}
                              target="_blank"
                              rel="noreferrer"
                              className="text-green-600 hover:underline"
                            >
                              blog.naver.com/{ch.channel_id} ↗
                            </a>
                          )}
                          <span className="font-mono text-gray-300 dark:text-gray-600">{ch.channel_id}</span>
                        </div>
                      </div>
                      <div className="flex gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => runChannel(ch)}
                          disabled={isBusy}
                          className={`px-3 py-1.5 text-sm rounded-xl font-medium transition ${
                            isRunning
                              ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                              : 'bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50'
                          }`}
                        >
                          {isRunning ? '…' : '▶'}
                        </button>
                        {platform === 'naver-blog' && (
                          <button
                            type="button"
                            onClick={() => deleteChannel(ch.channel_id, ch.channel_name)}
                            disabled={isBusy || isDeleting}
                            className="px-2 py-1.5 text-xs rounded-xl text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 disabled:opacity-40 transition"
                            title="채널 삭제"
                          >
                            {isDeleting ? '…' : '🗑'}
                          </button>
                        )}
                      </div>
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
    </PageLoadingOverlay>
  )
}
