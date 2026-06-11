'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import type { AddToast } from '@/lib/dashboard/dashboard-types'
import { Spinner } from '@/components/dashboard/ui/loading'
import {
  detectContentPlatform,
  supportsDirectVideoAnalysis,
  type ContentAnalyzerResult,
} from '@/lib/dashboard/content-analyzer'
import {
  addContentAnalyzerHistoryItem,
  loadContentAnalyzerHistory,
  type ContentAnalyzerHistoryItem,
} from '@/lib/dashboard/content-analyzer-history'

const PLATFORM_BADGE: Record<ContentAnalyzerResult['platform'], { label: string; icon: string }> = {
  youtube: { label: 'YouTube', icon: '🔴' },
  instagram: { label: 'Instagram', icon: '💗' },
  tiktok: { label: 'TikTok', icon: '⚫' },
  unknown: { label: 'URL', icon: '🔗' },
}

function SectionCard({
  icon,
  title,
  highlight,
  children,
}: {
  icon: string
  title: string
  highlight?: boolean
  children: React.ReactNode
}) {
  return (
    <div
      className={`rounded-2xl border p-5 ${
        highlight
          ? 'border-pink-300 bg-pink-50/60 dark:border-pink-800 dark:bg-pink-950/20'
          : 'border-gray-100 bg-white dark:border-gray-700 dark:bg-gray-800'
      }`}
    >
      <h3 className="flex items-center gap-2 text-sm font-bold text-gray-900 dark:text-white mb-3">
        <span>{icon}</span>
        <span>{title}</span>
        {highlight && (
          <span className="px-2 py-0.5 rounded-full bg-pink-600 text-white text-[11px] font-bold">★ 특히 중요</span>
        )}
      </h3>
      {children}
    </div>
  )
}

function NumberedList({ items }: { items: string[] }) {
  if (items.length === 0) return <p className="text-xs text-gray-400">제공된 항목이 없습니다.</p>
  return (
    <ol className="space-y-1.5">
      {items.map((item, i) => (
        <li key={i} className="flex gap-2 text-sm text-gray-700 dark:text-gray-200 leading-relaxed">
          <span className="shrink-0 w-5 h-5 rounded-full bg-gray-200 dark:bg-gray-700 text-[11px] font-bold flex items-center justify-center text-gray-600 dark:text-gray-300">
            {i + 1}
          </span>
          <span>{item}</span>
        </li>
      ))}
    </ol>
  )
}

export default function ContentAnalyzerView({ addToast }: { addToast: AddToast }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const [url, setUrl] = useState('')
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<ContentAnalyzerResult | null>(null)
  const [canWatchDirectly, setCanWatchDirectly] = useState(false)
  const [activeHistoryId, setActiveHistoryId] = useState<string | null>(null)

  const historyHref = (() => {
    const p = new URLSearchParams(searchParams.toString())
    p.set('view', 'generation-history')
    p.set('category', 'analyzer')
    return `${pathname}?${p.toString()}`
  })()

  const restoreHistoryItem = (item: ContentAnalyzerHistoryItem) => {
    setUrl(item.url)
    setNotes(item.notes ?? '')
    setResult(item.result)
    setCanWatchDirectly(item.canWatchDirectly)
    setActiveHistoryId(item.id)
  }

  const loadedHistoryFromUrl = useRef<string | null>(null)
  useEffect(() => {
    const historyId = searchParams.get('historyId')
    if (!historyId || loadedHistoryFromUrl.current === historyId) return
    const item = loadContentAnalyzerHistory().find((x) => x.id === historyId)
    if (!item) return
    loadedHistoryFromUrl.current = historyId
    restoreHistoryItem(item)
    addToast('🕘 이전 분석 기록을 불러왔습니다 (AI 재호출 없음)', 'info')
  }, [searchParams, addToast])

  const trimmedUrl = url.trim()
  const previewPlatform = trimmedUrl ? detectContentPlatform(trimmedUrl) : null
  const previewCanWatch = previewPlatform ? supportsDirectVideoAnalysis(previewPlatform) : false

  const handleAnalyze = async () => {
    if (!trimmedUrl) {
      addToast('분석할 콘텐츠의 URL을 입력해 주세요', 'warning')
      return
    }
    let parsedUrl: URL
    try {
      parsedUrl = new URL(trimmedUrl)
      if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') throw new Error('invalid')
    } catch {
      addToast('올바른 URL 형식이 아닙니다 (https://로 시작해야 합니다)', 'warning')
      return
    }

    setLoading(true)
    setResult(null)
    setActiveHistoryId(null)
    try {
      const res = await fetch('/api/dashboard/content-analyzer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: trimmedUrl, notes: notes.trim() || undefined }),
      })
      const data = (await res.json()) as { result?: ContentAnalyzerResult; canWatchDirectly?: boolean; error?: string }
      if (!res.ok || data.error || !data.result) {
        addToast(data.error ?? '콘텐츠 분석에 실패했습니다', 'warning')
        return
      }
      const watchedDirectly = Boolean(data.canWatchDirectly)
      setResult(data.result)
      setCanWatchDirectly(watchedDirectly)

      const saved = addContentAnalyzerHistoryItem({
        url: trimmedUrl,
        notes: notes.trim() || undefined,
        canWatchDirectly: watchedDirectly,
        result: data.result,
      })
      setActiveHistoryId(saved.id)
      addToast('✨ 콘텐츠 분석 완료 (AI 호출 1회 · 기록도 «히스토리 관리»에 함께 저장됨)', 'success')
    } catch {
      addToast('네트워크 오류가 발생했습니다', 'warning')
    } finally {
      setLoading(false)
    }
  }

  const goToAnalyzerHistory = () => {
    router.push(historyHref)
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-gray-900 dark:text-white">🔍 콘텐츠 분석기</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          마음에 드는 YouTube·Instagram·TikTok 콘텐츠의 URL을 입력하면, 추구하는 감정·BGM·스토리·제작 가이드를 AI가 분석해드립니다.
        </p>
      </div>

      <div className="rounded-2xl border border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800 p-5 space-y-4">
        <div>
          <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1.5">콘텐츠 URL</label>
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://www.youtube.com/watch?v=... 또는 https://www.instagram.com/reel/..."
            className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-pink-400"
          />
          {previewPlatform && (
            <p className="mt-1.5 text-xs text-gray-400">
              {PLATFORM_BADGE[previewPlatform].icon} {PLATFORM_BADGE[previewPlatform].label}
              {previewCanWatch
                ? ' · AI가 영상을 직접 시청하고 분석합니다 (음성·화면 포함)'
                : ' · 이 플랫폼은 AI가 영상을 직접 재생할 수 없어, 아래 메모를 참고해 추정 분석합니다'}
            </p>
          )}
        </div>
        <div>
          <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1.5">
            관찰 메모 (선택 — Instagram·TikTok처럼 AI가 직접 볼 수 없는 콘텐츠일수록 채워주면 정확도가 올라갑니다)
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="예: 잔잔한 피아노 음악이 깔리고, 마지막에 반전이 있는 brain-rot 스타일 밈 영상이에요"
            rows={3}
            className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-pink-400 resize-none"
          />
        </div>
        <button
          onClick={handleAnalyze}
          disabled={loading || !trimmedUrl}
          className="w-full py-2.5 rounded-xl bg-pink-600 hover:bg-pink-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-bold flex items-center justify-center gap-2 transition-colors"
        >
          {loading ? (
            <>
              <Spinner className="w-4 h-4" /> 분석 중... (Gemini 호출 1회 · 10~60초 소요)
            </>
          ) : (
            <>🔍 콘텐츠 분석하기</>
          )}
        </button>
      </div>

      <button
        type="button"
        onClick={goToAnalyzerHistory}
        className="w-full flex items-center justify-between gap-2 rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50/40 dark:bg-amber-950/25 px-4 py-2.5 text-left transition hover:border-pink-300 dark:hover:border-pink-700"
      >
        <span className="text-xs font-semibold text-amber-900 dark:text-amber-200">
          🕘 이전 분석 기록은 «히스토리 관리 → 콘텐츠 분석기»에서 모아볼 수 있습니다
        </span>
        <span className="shrink-0 text-xs font-semibold text-pink-600 dark:text-pink-400">기록 보러 가기 →</span>
      </button>

      {result && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-xs text-gray-400">
            <span>{PLATFORM_BADGE[result.platform].icon} {PLATFORM_BADGE[result.platform].label}</span>
            <span>·</span>
            <span className="truncate">{result.url}</span>
            {!canWatchDirectly && (
              <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 font-bold shrink-0">
                추정 기반 분석
              </span>
            )}
            {activeHistoryId && (
              <span className="px-2 py-0.5 rounded-full bg-pink-100 text-pink-700 dark:bg-pink-900/40 dark:text-pink-300 font-bold shrink-0">
                🕘 기록에서 불러옴
              </span>
            )}
          </div>

          <SectionCard icon="🎭" title="추구하는 감정">
            <p className="text-sm text-gray-700 dark:text-gray-200 leading-relaxed mb-2">{result.targetEmotion.summary}</p>
            {result.targetEmotion.keywords.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {result.targetEmotion.keywords.map((k, i) => (
                  <span key={i} className="px-2.5 py-1 rounded-full bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300 text-xs font-bold">
                    #{k}
                  </span>
                ))}
              </div>
            )}
          </SectionCard>

          <SectionCard icon="🎵" title="BGM 분석 · 식별·확보 가이드" highlight>
            <div className="space-y-4">
              {result.bgm.preciseMatch && (
                <div className="rounded-xl border-2 border-indigo-400 dark:border-indigo-600 bg-indigo-50/80 dark:bg-indigo-950/40 p-3.5">
                  <p className="text-[11px] font-bold text-indigo-700 dark:text-indigo-300 mb-1">
                    🔬 정밀 매칭 결과 (AudD 음향 지문 매칭 — AI 추정이 아닌 실제 매칭)
                  </p>
                  <p className="text-base font-bold text-gray-900 dark:text-white">
                    {result.bgm.preciseMatch.artist
                      ? `${result.bgm.preciseMatch.artist} - ${result.bgm.preciseMatch.title}`
                      : result.bgm.preciseMatch.title}
                  </p>
                  {(result.bgm.preciseMatch.album || result.bgm.preciseMatch.releaseDate || result.bgm.preciseMatch.label) && (
                    <p className="mt-1 text-[11px] text-indigo-800/70 dark:text-indigo-200/70">
                      {[result.bgm.preciseMatch.album, result.bgm.preciseMatch.releaseDate, result.bgm.preciseMatch.label]
                        .filter(Boolean)
                        .join(' · ')}
                    </p>
                  )}
                  {(result.bgm.preciseMatch.links?.spotify || result.bgm.preciseMatch.links?.appleMusic) && (
                    <div className="mt-1.5 flex flex-wrap gap-2">
                      {result.bgm.preciseMatch.links?.spotify && (
                        <a
                          href={result.bgm.preciseMatch.links.spotify}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-600 text-white hover:bg-emerald-700 transition"
                        >
                          Spotify에서 듣기 ↗
                        </a>
                      )}
                      {result.bgm.preciseMatch.links?.appleMusic && (
                        <a
                          href={result.bgm.preciseMatch.links.appleMusic}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-pink-600 text-white hover:bg-pink-700 transition"
                        >
                          Apple Music에서 듣기 ↗
                        </a>
                      )}
                    </div>
                  )}
                  <p className="mt-2 text-[11px] text-indigo-700/70 dark:text-indigo-300/60 leading-relaxed">
                    ⓘ n8n이 영상에서 추출한 오디오 클립을 AudD 음향 지문(Shazam 방식) DB와 직접 대조한 결과입니다 — 아래 «AI가 특정한 곡»보다 신뢰도가 높습니다.
                  </p>
                </div>
              )}
              {result.bgm.identifiedTrack ? (
                <div className="rounded-xl border border-emerald-300 dark:border-emerald-700 bg-emerald-50/70 dark:bg-emerald-950/30 p-3.5">
                  <p className="text-[11px] font-bold text-emerald-700 dark:text-emerald-300 mb-1">
                    🎯 AI가 특정한 곡{result.bgm.preciseMatch ? ' (참고 — 위 정밀 매칭 결과를 우선 신뢰)' : ''}
                  </p>
                  <p className="text-base font-bold text-gray-900 dark:text-white">
                    {result.bgm.identifiedTrack.artist
                      ? `${result.bgm.identifiedTrack.artist} - ${result.bgm.identifiedTrack.title}`
                      : result.bgm.identifiedTrack.title}
                  </p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        result.bgm.identifiedTrack.confidence === 'high'
                          ? 'bg-emerald-600 text-white'
                          : result.bgm.identifiedTrack.confidence === 'medium'
                            ? 'bg-amber-500 text-white'
                            : 'bg-gray-400 text-white'
                      }`}
                    >
                      확신도{' '}
                      {result.bgm.identifiedTrack.confidence === 'high'
                        ? '높음'
                        : result.bgm.identifiedTrack.confidence === 'medium'
                          ? '보통'
                          : '낮음'}
                    </span>
                    {result.bgm.identifiedTrack.basis && (
                      <span className="text-[11px] text-emerald-800/80 dark:text-emerald-200/80">
                        근거: {result.bgm.identifiedTrack.basis}
                      </span>
                    )}
                  </div>
                  <p className="mt-2 text-[11px] text-emerald-700/70 dark:text-emerald-300/60 leading-relaxed">
                    ⓘ AI의 곡 식별은 오인식 가능성이 있으니, 정식으로 사용하기 전에 곡명으로 직접 검색해 동일곡이 맞는지 한 번 더 확인해 보세요.
                  </p>
                </div>
              ) : (
                <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/40 p-3.5">
                  <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                    🤔 AI가 이 영상의 BGM을 특정 곡으로 확신 있게 식별하지 못했습니다 (잘못된 곡명 안내를 막기 위해 확신이 없을 땐 비워둡니다). 아래 ① 식별 가이드를 따라 직접 확인해 보세요.
                  </p>
                </div>
              )}
              <div>
                <p className="text-xs font-bold text-gray-500 dark:text-gray-400 mb-1">무드 분석</p>
                <p className="text-sm text-gray-700 dark:text-gray-200 leading-relaxed">{result.bgm.moodAnalysis}</p>
              </div>
              <div>
                <p className="text-xs font-bold text-gray-500 dark:text-gray-400 mb-1.5">
                  ① 직접 따는 방법 (식별 가이드){result.bgm.identifiedTrack ? ' — AI 식별 결과를 교차 검증할 때 활용' : ''}
                </p>
                <NumberedList items={result.bgm.identifyGuide} />
              </div>
              <div>
                <p className="text-xs font-bold text-gray-500 dark:text-gray-400 mb-1.5">② 레퍼런스로 확보하는 방법 (획득 가이드)</p>
                <NumberedList items={result.bgm.acquireGuide} />
                <p className="mt-2 text-[11px] text-gray-400 leading-relaxed">
                  ⓘ 원곡을 무단으로 추출·다운로드하면 저작권 문제가 발생할 수 있습니다. 위 가이드는 로열티프리 라이브러리·정식 라이선스·AI 생성 등 합법적으로 재사용 가능한 경로 위주로 제시됩니다.
                </p>
              </div>
            </div>
          </SectionCard>

          <SectionCard icon="📖" title="스토리·전개 분석">
            <p className="text-sm text-gray-700 dark:text-gray-200 leading-relaxed mb-2">{result.story.summary}</p>
            <NumberedList items={result.story.structure} />
          </SectionCard>

          <SectionCard icon="🛠️" title="내가 만들면? (제작 가이드)">
            <NumberedList items={result.productionGuide} />
          </SectionCard>
        </div>
      )}
    </div>
  )
}
