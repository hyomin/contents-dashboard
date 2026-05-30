'use client'
import { useState, useEffect, useCallback, useMemo } from 'react'
import type { Video, AddToast } from '@/lib/dashboard/dashboard-types'
import { dbVideoToVideo } from '@/lib/dashboard/dashboard-helpers'
import { outlierTagToVideo } from '@/lib/data/outlier-tagging'
import type { OutlierTagRow } from '@/lib/data/outlier-tagging'
import ContentTable from '@/components/dashboard/ContentTable'
import type { DBVideo } from '@/lib/data/supabase'
import { TitleWithHint } from '@/components/dashboard/info-hint'
import { N8nLv1ServicesSection } from '@/components/dashboard/n8n-lv1-services-section'
import { PageLoadingOverlay } from '@/components/dashboard/ui/loading'
import {
  getTierColor,
  getVsAvgColor,
  formatViews,
  getPlatformIcon,
} from '@/lib/dashboard/dashboard-helpers'

type FormatTab = 'all' | 'short' | 'long'

const FORMAT_LABELS: Record<FormatTab, string> = {
  all: '전체',
  short: '📱 Shorts',
  long: '🎬 Long',
}

function getContentUrl(video: Video): string | null {
  if (video.videoId.startsWith('http')) return video.videoId
  if (video.platform === 'youtube') return `https://www.youtube.com/watch?v=${video.videoId}`
  if (video.platform === 'naver-blog') return `https://blog.naver.com/${video.videoId}`
  return null
}

// ─── 통계 카드 행 ─────────────────────────────────────────────
function StatCards({ videos }: { videos: Video[] }) {
  const stats = useMemo(() => {
    const tiers: Record<string, number> = { S: 0, A: 0, B: 0, C: 0 }
    let totalVsAvg = 0
    let maxVsAvg = 0
    videos.forEach((v) => {
      tiers[v.tier] = (tiers[v.tier] ?? 0) + 1
      totalVsAvg += v.vsAvg
      if (v.vsAvg > maxVsAvg) maxVsAvg = v.vsAvg
    })
    return { tiers, avgVsAvg: videos.length ? totalVsAvg / videos.length : 0, maxVsAvg }
  }, [videos])

  const TIER_CARDS = [
    { tier: 'S', label: 'S Tier', bg: 'bg-purple-50 dark:bg-purple-900/20', text: 'text-purple-700 dark:text-purple-300', bar: 'bg-purple-400' },
    { tier: 'A', label: 'A Tier', bg: 'bg-blue-50 dark:bg-blue-900/20', text: 'text-blue-700 dark:text-blue-300', bar: 'bg-blue-400' },
    { tier: 'B', label: 'B Tier', bg: 'bg-green-50 dark:bg-green-900/20', text: 'text-green-700 dark:text-green-300', bar: 'bg-green-400' },
    { tier: 'C', label: 'C Tier', bg: 'bg-gray-50 dark:bg-gray-700', text: 'text-gray-600 dark:text-gray-300', bar: 'bg-gray-300' },
  ]
  const maxTierCount = Math.max(...TIER_CARDS.map((t) => stats.tiers[t.tier] ?? 0), 1)

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
      {/* 총 Outlier */}
      <div className="col-span-1 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl p-4">
        <p className="text-xs text-gray-400 font-medium">총 Outlier</p>
        <p className="text-3xl font-black text-gray-900 dark:text-white mt-1">{videos.length}</p>
      </div>

      {/* 평균 vs.Avg */}
      <div className="col-span-1 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl p-4">
        <p className="text-xs text-gray-400 font-medium">평균 vs.Avg</p>
        <p className={`text-3xl font-black mt-1 ${getVsAvgColor(stats.avgVsAvg)}`}>
          {stats.avgVsAvg.toFixed(1)}x
        </p>
      </div>

      {/* 티어 카드 */}
      {TIER_CARDS.map(({ tier, label, bg, text, bar }) => (
        <div key={tier} className={`rounded-2xl p-4 border border-transparent ${bg}`}>
          <div className="flex items-center justify-between mb-2">
            <p className={`text-xs font-semibold ${text}`}>{label}</p>
            <span className={`text-xl font-black ${text}`}>{stats.tiers[tier] ?? 0}</span>
          </div>
          {/* 미니 바 */}
          <div className="h-1.5 bg-white/50 dark:bg-black/20 rounded-full overflow-hidden">
            <div
              className={`h-full ${bar} rounded-full transition-all`}
              style={{ width: `${((stats.tiers[tier] ?? 0) / maxTierCount) * 100}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Top 3 스포트라이트 ────────────────────────────────────────
function TopSpotlight({ videos, onSelect }: { videos: Video[]; onSelect: (v: Video) => void }) {
  const top3 = videos.slice(0, 3)
  if (top3.length === 0) return null

  const MEDALS = ['🥇', '🥈', '🥉']
  const RANK_STYLES = [
    'border-yellow-200 dark:border-yellow-700 bg-gradient-to-br from-yellow-50 to-amber-50 dark:from-yellow-900/20 dark:to-amber-900/10',
    'border-gray-200 dark:border-gray-600 bg-gradient-to-br from-gray-50 to-slate-50 dark:from-gray-800 dark:to-slate-800',
    'border-orange-200 dark:border-orange-700 bg-gradient-to-br from-orange-50 to-amber-50 dark:from-orange-900/20 dark:to-amber-900/10',
  ]

  return (
    <div>
      <h3 className="text-sm font-bold text-gray-700 dark:text-gray-200 mb-3">🏆 최고 성과 Outlier</h3>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {top3.map((v, i) => (
          <div
            key={v.videoId}
            onClick={() => onSelect(v)}
            className={`rounded-2xl border p-5 cursor-pointer hover:shadow-md transition group ${RANK_STYLES[i]}`}
          >
            <div className="flex items-start justify-between mb-3">
              <span className="text-2xl">{MEDALS[i]}</span>
              <div className="text-right">
                <p className={`text-3xl font-black leading-none ${getVsAvgColor(v.vsAvg)}`}>
                  {v.vsAvg.toFixed(1)}x
                </p>
                <p className="text-[10px] text-gray-400 mt-0.5">vs.Avg</p>
              </div>
            </div>

            <p className="text-sm font-bold text-gray-900 dark:text-white line-clamp-2 leading-snug mb-2 group-hover:text-green-700 dark:group-hover:text-green-400 transition">
              {v.title}
            </p>

            <div className="flex items-center justify-between mt-auto">
              <p className="text-xs text-gray-500 dark:text-gray-400 truncate flex-1 mr-2">
                {getPlatformIcon(v.platform)} {v.channel}
              </p>
              <div className="flex items-center gap-1.5 shrink-0">
                <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${getTierColor(v.tier)}`}>
                  {v.tier}
                </span>
                <span className="text-[11px] text-gray-400">{formatViews(v.views ?? 0)}</span>
              </div>
            </div>

            {getContentUrl(v) && (
              <a
                href={getContentUrl(v)!}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="mt-3 block text-center text-[11px] text-gray-400 hover:text-green-600 transition border border-gray-200 dark:border-gray-600 hover:border-green-400 rounded-lg py-1"
              >
                원본 보기 ↗
              </a>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── 채널 리더보드 ────────────────────────────────────────────
function ChannelLeaderboard({ videos }: { videos: Video[] }) {
  const channelStats = useMemo(() => {
    const map = new Map<string, { count: number; maxVsAvg: number; totalVsAvg: number; platform: string }>()
    videos.forEach((v) => {
      const ch = v.channel ?? '알 수 없음'
      const prev = map.get(ch) ?? { count: 0, maxVsAvg: 0, totalVsAvg: 0, platform: v.platform }
      map.set(ch, {
        count: prev.count + 1,
        maxVsAvg: Math.max(prev.maxVsAvg, v.vsAvg),
        totalVsAvg: prev.totalVsAvg + v.vsAvg,
        platform: v.platform,
      })
    })
    return [...map.entries()]
      .map(([ch, s]) => ({ channel: ch, ...s, avgVsAvg: s.totalVsAvg / s.count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8)
  }, [videos])

  const maxCount = channelStats[0]?.count ?? 1

  if (channelStats.length === 0) return null

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl p-5">
      <h3 className="text-sm font-bold text-gray-700 dark:text-gray-200 mb-4">📊 채널별 Outlier 수</h3>
      <div className="space-y-3">
        {channelStats.map((s, i) => (
          <div key={s.channel}>
            <div className="flex items-center justify-between text-xs mb-1">
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="shrink-0 w-4 h-4 rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-[10px] font-bold flex items-center justify-center">
                  {i + 1}
                </span>
                <span className="text-gray-500 dark:text-gray-400 shrink-0">{getPlatformIcon(s.platform)}</span>
                <span className="font-medium text-gray-800 dark:text-gray-200 truncate">{s.channel}</span>
              </div>
              <div className="shrink-0 flex items-center gap-2 ml-2">
                <span className="text-gray-400">{s.count}개</span>
                <span className={`font-semibold ${getVsAvgColor(s.maxVsAvg)}`}>max {s.maxVsAvg.toFixed(1)}x</span>
              </div>
            </div>
            <div className="h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-green-400 to-emerald-500 rounded-full transition-all"
                style={{ width: `${(s.count / maxCount) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── vs.Avg 구간 분포 ─────────────────────────────────────────
function VsAvgDistribution({ videos }: { videos: Video[] }) {
  const BUCKETS = [
    { label: '1.5x~2x', min: 1.5, max: 2, color: 'bg-yellow-300 dark:bg-yellow-600' },
    { label: '2x~3x', min: 2, max: 3, color: 'bg-orange-400 dark:bg-orange-500' },
    { label: '3x~5x', min: 3, max: 5, color: 'bg-red-400 dark:bg-red-500' },
    { label: '5x+', min: 5, max: Infinity, color: 'bg-purple-500 dark:bg-purple-400' },
  ]

  const counts = BUCKETS.map((b) => ({
    ...b,
    count: videos.filter((v) => v.vsAvg >= b.min && v.vsAvg < b.max).length,
  }))
  const maxCount = Math.max(...counts.map((b) => b.count), 1)

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl p-5">
      <h3 className="text-sm font-bold text-gray-700 dark:text-gray-200 mb-4">📈 vs.Avg 구간 분포</h3>
      <div className="space-y-3">
        {counts.map((b) => (
          <div key={b.label}>
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="font-semibold text-gray-700 dark:text-gray-300">{b.label}</span>
              <span className="text-gray-500 dark:text-gray-400">{b.count}개</span>
            </div>
            <div className="h-3 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
              <div
                className={`h-full ${b.color} rounded-full transition-all`}
                style={{ width: `${(b.count / maxCount) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </div>

      {/* 포맷 비교 */}
      {videos.some((v) => v.format) && (
        <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
          <p className="text-xs font-semibold text-gray-500 mb-2">포맷 분포</p>
          {(['short', 'long'] as const).map((fmt) => {
            const cnt = videos.filter((v) => v.format === fmt).length
            return (
              <div key={fmt} className="flex items-center gap-2 mb-2">
                <span className="text-xs w-14 text-gray-500 shrink-0">
                  {fmt === 'short' ? '📱 Shorts' : '🎬 Long'}
                </span>
                <div className="flex-1 h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${fmt === 'short' ? 'bg-purple-400' : 'bg-blue-400'}`}
                    style={{ width: `${(cnt / (videos.length || 1)) * 100}%` }}
                  />
                </div>
                <span className="text-xs text-gray-400 w-6 text-right shrink-0">{cnt}</span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── 메인 뷰 ─────────────────────────────────────────────────
export default function OutlierView({
  onSelect,
  addToast,
}: {
  onSelect: (v: Video) => void
  addToast: AddToast
}) {
  const [outliers, setOutliers] = useState<Video[]>([])
  const [taggedCount, setTaggedCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [tagging, setTagging] = useState(false)
  const [minVsAvg, setMinVsAvg] = useState(1.5)
  const [showTaggedOnly, setShowTaggedOnly] = useState(false)
  const [formatTab, setFormatTab] = useState<FormatTab>('all')
  const [showTable, setShowTable] = useState(false)

  const loadOutliers = useCallback(() => {
    setLoading(true)
    const type = showTaggedOnly ? 'tagged-outliers' : 'outliers'
    const params = new URLSearchParams({ type, limit: '50' })
    if (formatTab !== 'all' && !showTaggedOnly) params.set('format', formatTab)
    fetch(`/api/dashboard/videos?${params}`)
      .then((r) => r.json())
      .then((data: DBVideo[] | OutlierTagRow[]) => {
        if (showTaggedOnly) {
          setOutliers((data as OutlierTagRow[]).map((row, i) => outlierTagToVideo(row, i)))
        } else {
          setOutliers((data as DBVideo[]).map(dbVideoToVideo))
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false))
    fetch('/api/dashboard/outlier-tag')
      .then((r) => r.json())
      .then((d: { count?: number }) => setTaggedCount(d.count ?? 0))
      .catch(() => setTaggedCount(0))
  }, [showTaggedOnly, formatTab])

  useEffect(() => {
    loadOutliers()
  }, [loadOutliers])

  const runTagging = async () => {
    setTagging(true)
    try {
      const res = await fetch('/api/n8n/lv1-services/outlier-tagging', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ minVsAvg: 3, persistTagged: true }),
      })
      const data = await res.json()
      addToast(
        typeof data.message === 'string' ? data.message : '태깅 완료',
        data.ok !== false ? 'success' : 'warning',
      )
      loadOutliers()
    } catch {
      addToast('태깅 실행 실패', 'warning')
    } finally {
      setTagging(false)
    }
  }

  const filtered = useMemo(
    () => outliers.filter((v) => v.vsAvg >= minVsAvg),
    [outliers, minVsAvg],
  )

  // vs.Avg 내림차순 정렬
  const sorted = useMemo(
    () => [...filtered].sort((a, b) => b.vsAvg - a.vsAvg),
    [filtered],
  )

  return (
    <PageLoadingOverlay loading={loading} label="아웃라이어 데이터 로딩 중…">
      <div className="space-y-5">
        <N8nLv1ServicesSection viewId="outlier" addToast={addToast} />

        {/* 헤더 */}
        <div className="bg-gradient-to-r from-green-500 to-emerald-600 rounded-2xl p-5 sm:p-6 text-white">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <TitleWithHint
                as="h2"
                className="text-lg font-bold"
                hintVariant="light"
                hint="채널 평균 조회수 대비 성과(vs.Avg)가 기준 배수 이상인 콘텐츠를 분석합니다. 포맷 탭으로 숏폼·롱폼을 분리할 수 있습니다."
              >
                🚀 Outlier 분석
              </TitleWithHint>
              <p className="text-sm opacity-80 mt-1">
                {loading
                  ? '로딩 중…'
                  : `${minVsAvg}x 이상 · ${filtered.length}개 · 태깅 저장 ${taggedCount}개`}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={runTagging}
                disabled={tagging}
                className="text-sm font-semibold px-3 py-2 rounded-xl bg-white text-green-700 hover:bg-green-50 disabled:opacity-60 transition"
              >
                {tagging ? '태깅 중…' : '▶ 3x+ 자동 태깅'}
              </button>
              <label className="flex items-center gap-1.5 text-xs bg-white/20 rounded-lg px-3 py-2 cursor-pointer hover:bg-white/30 transition">
                <input
                  type="checkbox"
                  checked={showTaggedOnly}
                  onChange={(e) => setShowTaggedOnly(e.target.checked)}
                  className="rounded"
                />
                태깅만 보기
              </label>
              {/* 기준 필터 */}
              <div className="flex items-center gap-1 bg-white/20 rounded-xl px-2 py-1.5">
                <span className="text-xs mr-1 opacity-80">기준:</span>
                {[1.5, 2.0, 3.0, 5.0].map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setMinVsAvg(v)}
                    className={`text-xs px-2 py-0.5 rounded-lg font-bold transition ${
                      minVsAvg === v ? 'bg-white text-green-700' : 'text-white hover:bg-white/20'
                    }`}
                  >
                    {v}x
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* 포맷 탭 */}
        <div className="flex gap-2">
          {(Object.keys(FORMAT_LABELS) as FormatTab[]).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFormatTab(f)}
              className={`px-4 py-2 rounded-xl text-sm font-semibold transition border ${
                formatTab === f
                  ? 'bg-green-500 text-white border-green-500 shadow-sm'
                  : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:border-green-300 hover:text-green-600'
              }`}
            >
              {FORMAT_LABELS[f]}
              {!loading && (
                <span className="ml-1.5 text-xs opacity-70">
                  (
                  {f === 'all'
                    ? filtered.length
                    : filtered.filter((v) => v.format === f).length}
                  )
                </span>
              )}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="h-24 bg-gray-100 dark:bg-gray-700 rounded-2xl animate-pulse" />
              ))}
            </div>
            <div className="h-40 bg-gray-100 dark:bg-gray-700 rounded-2xl animate-pulse" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-12 text-center text-gray-400">
            <p className="text-4xl mb-3">🔍</p>
            <p className="font-medium">
              {formatTab !== 'all'
                ? `${FORMAT_LABELS[formatTab]} Outlier가 없습니다. "전체"에서 확인하세요.`
                : 'n8n 워크플로를 실행해서 데이터를 수집해주세요'}
            </p>
          </div>
        ) : (
          <>
            {/* 통계 카드 */}
            <StatCards videos={sorted} />

            {/* Top 3 스포트라이트 */}
            <TopSpotlight videos={sorted} onSelect={onSelect} />

            {/* 채널 리더보드 + 분포 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <ChannelLeaderboard videos={sorted} />
              <VsAvgDistribution videos={sorted} />
            </div>

            {/* 전체 목록 토글 */}
            <div>
              <button
                type="button"
                onClick={() => setShowTable((p) => !p)}
                className="w-full flex items-center justify-between px-5 py-3.5 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl text-sm font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition"
              >
                <span>📋 전체 목록 ({sorted.length}개)</span>
                <span className={`transition-transform text-gray-400 ${showTable ? 'rotate-180' : ''}`}>▼</span>
              </button>

              {showTable && (
                <div className="mt-3">
                  <ContentTable videos={sorted} onSelect={onSelect} addToast={addToast} />
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </PageLoadingOverlay>
  )
}
