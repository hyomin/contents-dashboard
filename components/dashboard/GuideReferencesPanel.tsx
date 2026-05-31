'use client'

import { useCallback, useState } from 'react'
import { getPlatformName, formatViews } from '@/lib/dashboard/dashboard-helpers'
import {
  createWebGuideReference,
  getReferenceModeLabel,
  getReferenceSourceLabel,
  type GuideReference,
} from '@/lib/dashboard/guide-references'
import type { GuideReferenceMode } from '@/lib/dashboard/guide-reference-modes'
import type { SuggestedReferenceSite } from '@/lib/dashboard/reference-suggest-sites'
import type { GuideCategory } from '@/lib/dashboard/content-creation-guide'
import type { AddToast } from '@/lib/dashboard/dashboard-types'
import { Spinner } from '@/components/dashboard/ui/loading'

interface GuideReferencesPanelProps {
  references: GuideReference[]
  refsLoaded: boolean
  publishTopic: string
  category: GuideCategory
  onReferencesChange: (refs: GuideReference[]) => void
  onOpenPicker: () => void
  addToast: AddToast
}

function ReferenceModeToggle({
  mode,
  onChange,
  disabled,
}: {
  mode: GuideReferenceMode
  onChange: (mode: GuideReferenceMode) => void
  disabled?: boolean
}) {
  return (
    <div className="flex rounded-lg border border-gray-200 dark:border-gray-600 overflow-hidden text-[10px] font-semibold">
      <button
        type="button"
        disabled={disabled}
        onClick={() => onChange('structure')}
        title="제목·H2·톤만 참고 (기본)"
        className={`px-2 py-1 transition ${
          mode !== 'content'
            ? 'bg-violet-600 text-white'
            : 'bg-white dark:bg-gray-800 text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-700'
        } disabled:opacity-50`}
      >
        구조·톤
      </button>
      <button
        type="button"
        disabled={disabled}
        onClick={() => onChange('content')}
        title="페이지 내용·사실을 반영 (출처 표현 없이 재서술)"
        className={`px-2 py-1 transition ${
          mode === 'content'
            ? 'bg-emerald-600 text-white'
            : 'bg-white dark:bg-gray-800 text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-700'
        } disabled:opacity-50`}
      >
        내용 반영
      </button>
    </div>
  )
}

export function GuideReferencesPanel({
  references,
  refsLoaded,
  publishTopic,
  category,
  onReferencesChange,
  onOpenPicker,
  addToast,
}: GuideReferencesPanelProps) {
  const [webUrl, setWebUrl] = useState('')
  const [defaultMode, setDefaultMode] = useState<GuideReferenceMode>('structure')
  const [addingWeb, setAddingWeb] = useState(false)
  const [fetchingIndex, setFetchingIndex] = useState<number | null>(null)
  const [suggestLoading, setSuggestLoading] = useState(false)
  const [suggestedSites, setSuggestedSites] = useState<SuggestedReferenceSite[]>([])
  const [addingSuggestUrl, setAddingSuggestUrl] = useState<string | null>(null)

  const structureCount = references.filter((r) => r.referenceMode !== 'content').length
  const contentCount = references.filter((r) => r.referenceMode === 'content').length

  const fetchPageExcerpt = useCallback(async (url: string) => {
    const res = await fetch('/api/dashboard/reference-page-fetch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    })
    const data = (await res.json()) as {
      title?: string
      siteName?: string
      excerpt?: string
      error?: string
    }
    if (!res.ok || data.error) {
      throw new Error(data.error ?? '페이지 수집 실패')
    }
    return data
  }, [])

  const addWebReference = async (url: string, mode: GuideReferenceMode, preset?: Partial<SuggestedReferenceSite>) => {
    const trimmed = url.trim()
    if (!trimmed) return
    if (references.some((r) => r.url === trimmed)) {
      addToast('이미 추가된 URL입니다', 'info')
      return
    }

    setAddingWeb(true)
    try {
      let title = preset?.title ?? trimmed
      let siteName = preset?.siteName
      let contentExcerpt: string | undefined

      if (mode === 'content') {
        const data = await fetchPageExcerpt(trimmed)
        title = data.title ?? title
        siteName = data.siteName ?? siteName
        contentExcerpt = data.excerpt
      }

      const ref = createWebGuideReference({
        url: trimmed,
        title,
        siteName,
        referenceMode: mode,
        contentExcerpt,
      })
      onReferencesChange([...references, ref])
      addToast(
        mode === 'content' ? '웹 페이지 내용을 수집해 레퍼런스에 추가했습니다' : '웹 URL을 레퍼런스에 추가했습니다',
        'success',
      )
      setWebUrl('')
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'URL 추가 실패', 'warning')
    } finally {
      setAddingWeb(false)
      setAddingSuggestUrl(null)
    }
  }

  const updateReferenceMode = async (index: number, mode: GuideReferenceMode) => {
    const ref = references[index]
    if (ref.referenceMode === mode) return

    if (mode === 'content' && ref.url && !ref.contentExcerpt) {
      setFetchingIndex(index)
      try {
        const data = await fetchPageExcerpt(ref.url)
        onReferencesChange(
          references.map((r, i) =>
            i === index
              ? {
                  ...r,
                  referenceMode: 'content',
                  contentExcerpt: data.excerpt,
                  title: data.title ?? r.title,
                  siteName: data.siteName ?? r.siteName,
                }
              : r,
          ),
        )
        addToast('페이지 내용을 수집했습니다', 'success')
      } catch (err) {
        onReferencesChange(
          references.map((r, i) => (i === index ? { ...r, referenceMode: 'content' } : r)),
        )
        addToast(
          err instanceof Error ? err.message : '본문 수집 실패 — URL만 참고합니다',
          'warning',
        )
      } finally {
        setFetchingIndex(null)
      }
      return
    }

    onReferencesChange(
      references.map((r, i) => (i === index ? { ...r, referenceMode: mode } : r)),
    )
  }

  const removeReference = (index: number) => {
    onReferencesChange(references.filter((_, i) => i !== index))
    addToast('레퍼런스가 제거되었습니다', 'info')
  }

  const fetchSuggestedSites = async () => {
    if (publishTopic.trim().length < 2) {
      addToast('발행 주제를 먼저 입력해 주세요', 'warning')
      return
    }
    setSuggestLoading(true)
    setSuggestedSites([])
    try {
      const res = await fetch('/api/dashboard/reference-suggest-sites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ publishTopic: publishTopic.trim(), category }),
      })
      const data = (await res.json()) as { sites?: SuggestedReferenceSite[]; error?: string }
      if (!res.ok || data.error) {
        addToast(data.error ?? '추천 사이트 검색 실패', 'warning')
        return
      }
      setSuggestedSites(data.sites ?? [])
      if ((data.sites ?? []).length === 0) {
        addToast('추천 결과가 없습니다', 'warning')
      }
    } catch {
      addToast('네트워크 오류', 'warning')
    } finally {
      setSuggestLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* 웹 URL · 추천 사이트 */}
      <div className="rounded-xl border border-violet-200 dark:border-violet-800 bg-violet-50/40 dark:bg-violet-950/20 p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs font-bold text-violet-900 dark:text-violet-200">🌐 웹 페이지 레퍼런스</p>
          <ReferenceModeToggle mode={defaultMode} onChange={setDefaultMode} />
        </div>
        <p className="text-[10px] text-violet-700/80 dark:text-violet-300/80">
          Wowhead·공식 포럼·위키 등 대표 페이지 URL을 직접 추가하거나, 발행 주제 기준 AI 추천을 받을 수 있습니다.
          «구조·톤»은 목차·문체만, «내용 반영»은 페이지 사실·데이터를 스크립트에 반영합니다.
        </p>
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            type="url"
            value={webUrl}
            onChange={(e) => setWebUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void addWebReference(webUrl, defaultMode)
            }}
            placeholder="https://www.wowhead.com/... 또는 공식 가이드 URL"
            className="flex-1 rounded-lg border border-violet-200 dark:border-violet-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-500"
          />
          <button
            type="button"
            onClick={() => void addWebReference(webUrl, defaultMode)}
            disabled={addingWeb || !webUrl.trim()}
            className="shrink-0 px-4 py-2 rounded-lg text-sm font-semibold bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-50 transition"
          >
            {addingWeb ? '추가 중…' : '+ URL 추가'}
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void fetchSuggestedSites()}
            disabled={suggestLoading || publishTopic.trim().length < 2}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-white dark:bg-gray-800 border border-violet-300 dark:border-violet-700 text-violet-700 dark:text-violet-300 hover:bg-violet-100 dark:hover:bg-violet-900/30 disabled:opacity-50 transition"
          >
            {suggestLoading ? (
              <span className="flex items-center gap-1.5">
                <Spinner size="sm" />
                추천 검색 중…
              </span>
            ) : (
              '🔍 발행 주제로 추천 사이트 찾기'
            )}
          </button>
          <button
            type="button"
            onClick={onOpenPicker}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:border-violet-300 transition"
          >
            + 채널 콘텐츠 (YouTube·블로그)
          </button>
        </div>

        {suggestedSites.length > 0 && (
          <ul className="space-y-2 pt-1 border-t border-violet-200/60 dark:border-violet-800/60">
            {suggestedSites.map((site) => (
              <li
                key={site.url}
                className="flex flex-col sm:flex-row sm:items-center gap-2 rounded-lg bg-white/80 dark:bg-gray-900/60 border border-violet-100 dark:border-violet-900 px-3 py-2"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{site.title}</p>
                  <p className="text-[10px] text-gray-500 truncate">
                    {site.siteName} · {site.url}
                  </p>
                  {site.reason && (
                    <p className="text-[10px] text-violet-600 dark:text-violet-400 mt-0.5 line-clamp-2">{site.reason}</p>
                  )}
                </div>
                <div className="flex shrink-0 gap-1.5">
                  <button
                    type="button"
                    disabled={addingSuggestUrl === site.url}
                    onClick={() => {
                      setAddingSuggestUrl(site.url)
                      void addWebReference(site.url, 'structure', site)
                    }}
                    className="px-2 py-1 rounded text-[10px] font-semibold bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300 hover:bg-violet-200 disabled:opacity-50"
                  >
                    구조
                  </button>
                  <button
                    type="button"
                    disabled={addingSuggestUrl === site.url}
                    onClick={() => {
                      setAddingSuggestUrl(site.url)
                      void addWebReference(site.url, 'content', site)
                    }}
                    className="px-2 py-1 rounded text-[10px] font-semibold bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-200 disabled:opacity-50"
                  >
                    내용
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* 역할 요약 */}
      {references.length > 0 && (structureCount > 0 || contentCount > 0) && (
        <p className="text-[10px] text-gray-500 dark:text-gray-400 px-1">
          {structureCount > 0 && `구조·톤 ${structureCount}개`}
          {structureCount > 0 && contentCount > 0 && ' · '}
          {contentCount > 0 && `내용 반영 ${contentCount}개`}
          {structureCount > 0 && contentCount > 0 && ' — 형태는 구조 레퍼런스, 사실은 내용 레퍼런스에서 가져옵니다'}
        </p>
      )}

      {/* 레퍼런스 목록 */}
      {!refsLoaded ? (
        <div className="py-8 text-center text-sm text-gray-400">불러오는 중…</div>
      ) : references.length === 0 ? (
        <div className="py-8 text-center border border-dashed border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50/50 dark:bg-gray-900/30">
          <p className="text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">레퍼런스 없이도 생성 가능</p>
          <p className="text-xs text-gray-400 max-w-sm mx-auto">
            위에서 웹 URL을 추가하거나, 급상승·RSS 탭에서 카드를 클릭하세요.
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {references.map((ref, i) => {
            const mode = ref.referenceMode ?? 'structure'
            const isFetching = fetchingIndex === i
            return (
              <li
                key={`${i}-${ref.id}`}
                className="group rounded-xl border border-gray-100 dark:border-gray-600 p-3 bg-gray-50/50 dark:bg-gray-900/30 hover:border-violet-200 dark:hover:border-violet-800 transition"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <p className="text-sm font-medium text-gray-900 dark:text-white line-clamp-2 flex-1 min-w-0 pr-2">
                    {ref.url ? (
                      <a
                        href={ref.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:text-blue-600 dark:hover:text-blue-400 hover:underline"
                      >
                        {ref.title}
                      </a>
                    ) : (
                      ref.title
                    )}
                  </p>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {isFetching ? (
                      <Spinner size="sm" />
                    ) : (
                      <ReferenceModeToggle
                        mode={mode}
                        onChange={(m) => void updateReferenceMode(i, m)}
                      />
                    )}
                    <button
                      type="button"
                      onClick={() => removeReference(i)}
                      title="제거"
                      className="w-6 h-6 flex items-center justify-center rounded-full text-gray-300 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-900/30 transition text-xs font-bold"
                    >
                      ×
                    </button>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-1.5 mt-2 text-xs text-gray-500">
                  <span
                    className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                      mode === 'content'
                        ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300'
                        : 'bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300'
                    }`}
                  >
                    {getReferenceModeLabel(mode)}
                  </span>
                  <span className="px-2 py-0.5 rounded-md bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-[10px]">
                    {getReferenceSourceLabel(ref)}
                  </span>
                  {ref.sourceType === 'web' && ref.siteName && (
                    <span className="text-[10px] text-gray-400">{ref.siteName}</span>
                  )}
                  {ref.platform !== 'topic' && ref.platform !== 'insight' && ref.platform !== 'web' && (
                    <span className="text-[10px]">{getPlatformName(ref.platform)}</span>
                  )}
                  {ref.vsAvg != null && (
                    <span className="text-amber-600 dark:text-amber-400 font-semibold text-[10px]">
                      vs.Avg {ref.vsAvg}x
                    </span>
                  )}
                  {ref.views != null && <span className="text-[10px]">{formatViews(ref.views)} 조회</span>}
                  {mode === 'content' && ref.contentExcerpt && (
                    <span className="text-[10px] text-emerald-600 dark:text-emerald-400">본문 수집됨</span>
                  )}
                  {mode === 'content' && ref.url && !ref.contentExcerpt && !isFetching && (
                    <span className="text-[10px] text-amber-600">본문 미수집</span>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
