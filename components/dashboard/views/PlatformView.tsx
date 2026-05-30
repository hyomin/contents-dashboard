'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import Link from 'next/link'
import type { Video, AddToast } from '@/lib/dashboard/dashboard-types'
import { fetchChannelFlags } from '@/lib/dashboard/dashboard-storage'
import { dbVideoToVideo } from '@/lib/dashboard/dashboard-helpers'
import ContentTable from '@/components/dashboard/ContentTable'
import type { DBVideo } from '@/lib/data/supabase'
import { isPlatformComingSoon, isPlatformDummyPreview } from '@/lib/dashboard/platforms'
import { DUMMY_TIKTOK_CHANNELS, DUMMY_TIKTOK_VIDEOS } from '@/lib/dashboard/tiktok-dummy-data'
import { getPlatformIcon, getPlatformName } from '@/lib/dashboard/dashboard-helpers'
import { TitleWithHint } from '@/components/dashboard/info-hint'
import { SavedShortsPanel, type SavedShortItem } from '@/components/dashboard/SavedShortsPanel'
import type { ViewVideoFormat } from '@/lib/dashboard/dashboard-nav'
import { SHORTS_MAX_DURATION_SEC } from '@/lib/data/video-format'
import {
  ChannelTopicFilterBar,
  filterVideosByTopicAndChannel,
  type ChannelCategoryDto,
  type ChannelWithCategory,
} from '@/components/dashboard/ChannelTopicFilterBar'
import { N8nLv1ServicesSection } from '@/components/dashboard/n8n-lv1-services-section'
import { PlatformContentRefreshBar } from '@/components/dashboard/platform-content-refresh-bar'

export default function PlatformView({
  filter,
  videoFormat,
  mineOnly = false,
  onSelect,
  addToast,
}: {
  filter: string
  videoFormat?: ViewVideoFormat
  mineOnly?: boolean
  onSelect: (v: Video) => void
  addToast: AddToast
}) {
  const [selectedTopicId, setSelectedTopicId] = useState('')
  const [channelSearchQuery, setChannelSearchQuery] = useState('')
  const [topicCategories, setTopicCategories] = useState<ChannelCategoryDto[]>([])
  const [channelMeta, setChannelMeta] = useState<ChannelWithCategory[]>([])
  const [baseVideos, setBaseVideos] = useState<Video[]>([])
  const [loading, setLoading] = useState(true)
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set())
  const [savedItems, setSavedItems] = useState<SavedShortItem[]>([])
  const [backfilling, setBackfilling] = useState(false)
  const [syncingViews, setSyncingViews] = useState(false)
  const [myChannelIds, setMyChannelIds] = useState<Set<string> | null>(mineOnly ? null : new Set())

  const isShortsView = videoFormat === 'short'

  useEffect(() => {
    if (!mineOnly) {
      setMyChannelIds(new Set())
      return
    }
    let cancelled = false
    async function loadMineIds() {
      try {
        const [flags, chRes] = await Promise.all([
          fetchChannelFlags(),
          fetch(`/api/dashboard/channels?platform=${encodeURIComponent(filter)}`),
        ])
        const chs = (await chRes.json()) as { channel_id: string }[]
        const mineIds = new Set(
          (Array.isArray(chs) ? chs : [])
            .filter((c) => flags.find((f) => f.channel_id === c.channel_id)?.is_mine)
            .map((c) => c.channel_id),
        )
        if (!cancelled) setMyChannelIds(mineIds)
      } catch {
        if (!cancelled) setMyChannelIds(new Set())
      }
    }
    loadMineIds()
    return () => {
      cancelled = true
    }
  }, [mineOnly, filter])

  const loadSaved = useCallback(async () => {
    if (!isShortsView) return
    try {
      const res = await fetch('/api/dashboard/saved-shorts')
      const data = (await res.json()) as SavedShortItem[]
      setSavedItems(data)
      setSavedIds(new Set(data.map((d) => d.video_id)))
    } catch {
      /* ignore */
    }
  }, [isShortsView])

  const loadVideos = useCallback(async () => {
    if (isPlatformDummyPreview(filter)) {
      setBaseVideos(DUMMY_TIKTOK_VIDEOS)
      setLoading(false)
      return
    }
    if (isPlatformComingSoon(filter)) {
      setBaseVideos([])
      setLoading(false)
      return
    }
    setLoading(true)
    const params = new URLSearchParams({ platform: filter, limit: '100' })
    if (videoFormat) params.set('format', videoFormat)
    try {
      const res = await fetch(`/api/dashboard/videos?${params}`)
      const data = (await res.json()) as DBVideo[]
      setBaseVideos(data.map((v, i) => dbVideoToVideo(v, i)))
    } catch {
      console.error()
    } finally {
      setLoading(false)
    }
  }, [filter, videoFormat])

  const loadChannelMeta = useCallback(async () => {
    if (filter !== 'youtube' || isPlatformComingSoon(filter)) return
    try {
      await fetch('/api/dashboard/channels/sync-categories', { method: 'POST' })

      const [catsRes, chRes, flags] = await Promise.all([
        fetch('/api/dashboard/channel-categories'),
        fetch('/api/dashboard/channels?platform=youtube'),
        mineOnly ? fetchChannelFlags() : Promise.resolve([]),
      ])
      const cats = (await catsRes.json()) as ChannelCategoryDto[]
      const chs = (await chRes.json()) as { channel_id: string; channel_name: string; category_id?: string | null }[]
      let mapped = Array.isArray(chs)
        ? chs.map((c) => ({
            channel_id: c.channel_id,
            channel_name: c.channel_name,
            category_id: c.category_id ?? null,
          }))
        : []
      if (mineOnly) {
        const mineSet = new Set(
          mapped
            .filter((c) => flags.find((f) => f.channel_id === c.channel_id)?.is_mine)
            .map((c) => c.channel_id),
        )
        mapped = mapped.filter((c) => mineSet.has(c.channel_id))
        setMyChannelIds(mineSet)
      }
      setTopicCategories(Array.isArray(cats) ? cats : [])
      setChannelMeta(mapped)
    } catch {
      console.error()
    }
  }, [filter, mineOnly])

  useEffect(() => {
    loadVideos()
    loadSaved()
    loadChannelMeta()
  }, [loadVideos, loadSaved, loadChannelMeta])

  const runBackfill = async () => {
    setBackfilling(true)
    try {
      const res = await fetch('/api/dashboard/videos/backfill-format', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) {
        addToast(data.error ?? '분류 실패', 'warning')
        return
      }
      addToast(`영상 포맷 분류 완료 (${data.updated ?? 0}건 갱신)`, 'success')
      await loadVideos()
    } catch {
      addToast('분류 요청 실패', 'warning')
    } finally {
      setBackfilling(false)
    }
  }

  const toggleSave = async (video: Video) => {
    if (!video.videoId) return
    const isSaved = savedIds.has(video.videoId)
    try {
      if (isSaved) {
        const res = await fetch(`/api/dashboard/saved-shorts?video_id=${encodeURIComponent(video.videoId)}`, {
          method: 'DELETE',
        })
        if (!res.ok) throw new Error()
        setSavedIds((prev) => {
          const next = new Set(prev)
          next.delete(video.videoId)
          return next
        })
        setSavedItems((prev) => prev.filter((s) => s.video_id !== video.videoId))
        addToast('저장함에서 제거했습니다', 'info')
      } else {
        const res = await fetch('/api/dashboard/saved-shorts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ video_id: video.videoId }),
        })
        if (!res.ok) throw new Error()
        setSavedIds((prev) => new Set(prev).add(video.videoId))
        await loadSaved()
        addToast('인기 Shorts에 저장했습니다', 'success')
      }
    } catch {
      addToast('저장 처리 실패', 'warning')
    }
  }

  const scopedVideos = useMemo(() => {
    if (!mineOnly || myChannelIds === null) return baseVideos
    return baseVideos.filter((v) => v.channelId && myChannelIds.has(v.channelId))
  }, [baseVideos, mineOnly, myChannelIds])

  const videos =
    filter === 'youtube'
      ? filterVideosByTopicAndChannel(scopedVideos, channelMeta, selectedTopicId, channelSearchQuery)
      : scopedVideos
  const outliers = videos.filter((v) => v.vsAvg >= 1.5)
  const avgVsAvg = videos.length ? (videos.reduce((s, v) => s + v.vsAvg, 0) / videos.length).toFixed(1) : '0'
  const showTopicFilter = filter === 'youtube'

  const handleRefreshed = useCallback(async () => {
    await loadVideos()
    await loadChannelMeta()
  }, [loadVideos, loadChannelMeta])

  const runNaverViewsSync = useCallback(async () => {
    if (syncingViews) return
    setSyncingViews(true)
    addToast('네이버 조회수·반응 수집 중… (n8n/크롤링)', 'info')
    try {
      const res = await fetch('/api/dashboard/naver-blog-views', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ onlyMissingViews: false, maxPosts: 80, source: 'dashboard-ui' }),
      })
      const data = await res.json()
      if (!res.ok || !data.ok) {
        addToast(data.message ?? data.error ?? '갱신 실패', 'warning')
        return
      }
      addToast(data.message ?? '갱신 완료', 'success')
      await handleRefreshed()
    } catch {
      addToast('조회수 갱신 중 오류', 'warning')
    } finally {
      setSyncingViews(false)
    }
  }, [syncingViews, addToast, handleRefreshed])

  if (isPlatformComingSoon(filter)) {
    return (
      <div className="space-y-4">
        <PlatformContentRefreshBar
          platform={filter}
          mineOnly={mineOnly}
          addToast={addToast}
          onRefreshed={handleRefreshed}
        />
        <div className="rounded-2xl border border-pink-200 bg-pink-50 dark:bg-pink-950/20 dark:border-pink-900 p-8 text-center">
          <span className="text-4xl">{getPlatformIcon(filter)}</span>
          <TitleWithHint
            as="h3"
            className="text-lg font-bold text-gray-900 dark:text-white mt-3 justify-center"
            hint="네이버 블로그·YouTube는 수집 API가 연결되어 있습니다. Instagram·티스토리는 추후 연동 예정입니다."
          >
            {getPlatformName(filter)} 수집 준비 중
          </TitleWithHint>
        </div>
      </div>
    )
  }

  const isTiktokDummy = filter === 'tiktok'
  const isNaverBlog = filter === 'naver-blog'
  const isTistory = filter === 'tistory'
  const hasViewMetrics = videos.some((v) => (v.views ?? 0) > 0)

  const formatBadge =
    videoFormat === 'short'
      ? { label: 'Shorts', sub: `≤${SHORTS_MAX_DURATION_SEC}초`, color: 'bg-orange-100 text-orange-800' }
      : videoFormat === 'long'
        ? { label: '롱폼', sub: `${SHORTS_MAX_DURATION_SEC}초 초과`, color: 'bg-blue-100 text-blue-800' }
        : null

  const mineLoading = mineOnly && myChannelIds === null
  const mineCount = myChannelIds?.size ?? 0

  return (
    <div className="space-y-6">
      <PlatformContentRefreshBar
        platform={filter}
        mineOnly={mineOnly}
        addToast={addToast}
        onRefreshed={handleRefreshed}
      />

      {isTistory && (
        <>
          <div className="rounded-xl border border-orange-200 dark:border-orange-800 bg-orange-50 dark:bg-orange-950/30 px-4 py-3 text-sm text-orange-900 dark:text-orange-100 space-y-1">
            <p className="font-medium">🟠 티스토리 · RSS 수집</p>
            <p className="text-xs text-orange-800/90 dark:text-orange-200/90">
              RSS 피드로 최근 글 목록(제목·날짜·링크)을 수집합니다. 조회수는 RSS에 미제공이라 vs.Avg 계산은 어렵습니다.
              «콘텐츠 새로고침»으로 글 목록을 갱신하세요.
            </p>
          </div>
          <N8nLv1ServicesSection
            viewId="tistory"
            addToast={addToast}
            title="🔗 티스토리 수집 (n8n)"
          />
        </>
      )}

      {isNaverBlog && (
        <>
          <div className="rounded-xl border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950/30 px-4 py-3 text-sm text-green-900 dark:text-green-100 space-y-2">
            <p className="font-medium flex items-center gap-2">
              🟢 네이버 블로그
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-green-600 text-white">W04 · W07</span>
              {hasViewMetrics && <span className="text-[10px] text-green-600 dark:text-green-400">· 조회수 수집됨</span>}
            </p>
            <p className="text-xs text-green-800/90 dark:text-green-200/90">
              «데이터 수집» 탭에서 블로그 ID를 등록하면 12시간마다 자동으로 글 목록·조회수가 수집됩니다.
              수동으로 갱신하려면 아래 버튼이나 상단 «콘텐츠 새로고침»을 사용하세요.
              {!hasViewMetrics && ' 아직 조회수가 없습니다 — 아래 «조회수 갱신»을 실행하세요.'}
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={runNaverViewsSync}
                disabled={syncingViews || loading}
                className="text-xs font-medium px-3 py-1.5 rounded-lg bg-green-700 text-white hover:bg-green-800 disabled:opacity-50"
              >
                {syncingViews ? '갱신 중…' : '↻ 조회수·vs.Avg 갱신'}
              </button>
              {baseVideos.length === 0 && !loading && (
                <a
                  href="/dashboard?view=data-collect"
                  className="text-xs font-medium px-3 py-1.5 rounded-lg border border-green-500 text-green-700 dark:text-green-300 hover:bg-green-100 dark:hover:bg-green-900/30 transition"
                >
                  블로그 채널 등록하러 가기 →
                </a>
              )}
            </div>
          </div>
          <N8nLv1ServicesSection
            viewId="naver-blog"
            addToast={addToast}
            title="🔗 네이버 블로그 자동화 플로우 (n8n)"
          />
        </>
      )}

      {mineOnly && (
        <div className="rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/30 px-4 py-3 text-sm text-blue-900 dark:text-blue-100 flex flex-wrap items-center justify-between gap-2">
          <span>
            내 운영 채널만 표시 · {mineLoading ? '…' : `${mineCount}개`} 채널
          </span>
          <Link href="/dashboard?view=channels-mine" className="text-xs font-medium text-blue-700 dark:text-blue-300 hover:underline">
            운영 허브에서 채널 지정 →
          </Link>
        </div>
      )}

      {isTiktokDummy && (
        <>
        <N8nLv1ServicesSection viewId="tiktok" addToast={addToast} title="🔗 2단계 Apify 수집 (n8n 시나리오)" />
        <div className="rounded-2xl border border-gray-800 bg-gray-950 text-gray-100 p-5 space-y-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <TitleWithHint
                as="h3"
                className="text-sm font-bold text-white"
                hintVariant="light"
                hint="2단계 로드맵 «Apify 유튜브·인스타 크롤링»에 TikTok Actor를 추가하면 Supabase videos(platform=tiktok)로 적재할 예정입니다."
              >
                🎵 TikTok · Apify 수집 (더미 미리보기)
              </TitleWithHint>
              <p className="text-xs text-gray-400 mt-1">
                아래 목록은 UI 검증용 샘플입니다. YouTube Shorts와 같은 숏폼 레퍼런스로 멀티플랫폼 확장을 가정했습니다.
              </p>
            </div>
            <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-amber-500/20 text-amber-300">
              DUMMY
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {DUMMY_TIKTOK_CHANNELS.map((ch) => (
              <div
                key={ch.channel_id}
                className="rounded-xl bg-gray-900/80 border border-gray-800 px-3 py-2 text-xs"
              >
                <p className="font-semibold text-white">{ch.channel_name}</p>
                <p className="text-gray-500 mt-0.5">
                  팔로워 {(ch.followers / 1000).toFixed(0)}K · avg {(ch.avg_views / 1000).toFixed(1)}K
                </p>
              </div>
            ))}
          </div>
        </div>
        </>
      )}

      {formatBadge && (
        <div className="flex flex-wrap items-center gap-3">
          <span className={`px-3 py-1 rounded-full text-sm font-semibold ${formatBadge.color}`}>
            {formatBadge.label}
          </span>
          <span className="text-xs text-gray-500">{formatBadge.sub} · 제목 #Shorts 포함 시 숏폼으로 분류</span>
          <button
            type="button"
            onClick={runBackfill}
            disabled={backfilling}
            className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50"
          >
            {backfilling ? '분류 중…' : '기존 데이터 길이 기준 재분류'}
          </button>
        </div>
      )}

      {isShortsView && (
        <SavedShortsPanel
          items={savedItems}
          onRemove={async (videoId) => {
            const res = await fetch(`/api/dashboard/saved-shorts?video_id=${encodeURIComponent(videoId)}`, {
              method: 'DELETE',
            })
            if (res.ok) {
              setSavedIds((prev) => {
                const next = new Set(prev)
                next.delete(videoId)
                return next
              })
              setSavedItems((prev) => prev.filter((s) => s.video_id !== videoId))
              addToast('저장함에서 제거했습니다', 'info')
            }
          }}
        />
      )}

      {showTopicFilter && (
        <ChannelTopicFilterBar
          videos={scopedVideos}
          categories={topicCategories}
          channels={channelMeta}
          selectedTopicId={selectedTopicId}
          channelSearchQuery={channelSearchQuery}
          onTopicChange={setSelectedTopicId}
          onChannelSearchChange={setChannelSearchQuery}
        />
      )}

      <div className="grid grid-cols-3 gap-4">
        {[
          { label: '수집된 콘텐츠', value: loading ? '…' : `${videos.length}개`, icon: '🎬', bg: 'bg-blue-50', accent: 'text-blue-600' },
          { label: 'Outlier (≥1.5x)', value: loading ? '…' : `${outliers.length}개`, icon: '🚀', bg: 'bg-green-50', accent: 'text-green-600' },
          { label: '평균 vs.Avg', value: loading ? '…' : `${avgVsAvg}x`, icon: '📈', bg: 'bg-purple-50', accent: 'text-purple-600' },
        ].map((c) => (
          <div key={c.label} className={`${c.bg} rounded-2xl p-5`}>
            <div className="flex justify-between mb-2">
              <span className="text-xs text-gray-500">{c.label}</span>
              <span>{c.icon}</span>
            </div>
            <p className={`text-3xl font-bold ${c.accent}`}>{c.value}</p>
          </div>
        ))}
      </div>

      {loading || mineLoading ? (
        <div className="space-y-3">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="h-14 bg-gray-100 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : videos.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-12 text-center text-gray-400 border border-gray-100 dark:border-gray-700">
          <p className="text-4xl mb-3">📭</p>
          <p className="font-medium">
            {mineOnly && mineCount === 0
              ? `«내 채널»로 지정된 ${getPlatformName(filter)} 채널이 없습니다`
              : videoFormat === 'short'
                ? 'Shorts로 분류된 영상이 없습니다'
                : videoFormat === 'long'
                  ? '롱폼 영상이 없습니다'
                  : '이 플랫폼의 데이터가 없습니다'}
          </p>
          <p className="text-sm mt-1">
            {mineOnly && mineCount === 0 ? (
              <Link href="/dashboard?view=channels-mine" className="text-blue-600 hover:underline">
                운영 허브에서 내 채널 지정 →
              </Link>
            ) : isNaverBlog ? (
              <>
                <Link href="/dashboard?view=benchmark" className="text-blue-600 hover:underline">
                  채널·콘텐츠 등록
                </Link>
                에서 네이버 블로그(blogId)를 추가한 뒤 «새로고침» 또는 «데이터 수집»을 실행하세요.
              </>
            ) : filter === 'youtube' ? (
              '채널 수집 후 «기존 데이터 길이 기준 재분류»를 눌러 보세요.'
            ) : (
              '채널 등록 후 수집을 실행해 주세요.'
            )}
          </p>
        </div>
      ) : (
        <ContentTable
          videos={videos}
          onSelect={onSelect}
          addToast={addToast}
          showDuration={Boolean(videoFormat)}
          savedVideoIds={isShortsView ? savedIds : undefined}
          onToggleSave={isShortsView ? toggleSave : undefined}
        />
      )}
    </div>
  )
}
