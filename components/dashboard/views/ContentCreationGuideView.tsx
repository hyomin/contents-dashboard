'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import type { AddToast, Video } from '@/lib/dashboard-types'
import { TRENDING_KEYWORDS } from '@/lib/dummy-data'
import {
  GUIDE_BY_CATEGORY,
  FALLBACK_REFERENCE_TITLES,
  buildAiScriptGuidePayload,
  type GuideCategory,
  type AiScriptGuideRequestContext,
} from '@/lib/content-creation-guide'
import { dbVideoToVideo } from '@/lib/dashboard-helpers'
import type { DBVideo } from '@/lib/supabase'
import { TitleWithHint } from '@/components/dashboard/info-hint'
import { N8nLv1ServicesSection } from '@/components/dashboard/n8n-lv1-services-section'

const CATEGORIES: { id: GuideCategory; label: string; icon: string }[] = [
  { id: 'writing', label: '글쓰기', icon: '📝' },
  { id: 'image', label: '이미지', icon: '🖼️' },
  { id: 'video', label: '영상', icon: '🎬' },
]

interface ReferenceRow {
  title: string
  platform: string
  vsAvg?: number
  channel?: string
}

function mapVideoToRef(v: Video): ReferenceRow {
  return {
    title: v.title,
    platform: v.platform,
    vsAvg: v.vsAvg,
    channel: v.channel,
  }
}

function mapCategoryToIntent(c: GuideCategory): AiScriptGuideRequestContext['intent'] {
  if (c === 'writing') return 'blog'
  if (c === 'image') return 'carousel'
  return 'longform_video'
}

export default function ContentCreationGuideView({ addToast }: { addToast: AddToast }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [category, setCategory] = useState<GuideCategory>('writing')
  const [references, setReferences] = useState<ReferenceRow[]>([])

  useEffect(() => {
    let cancelled = false
    fetch('/api/dashboard/videos?type=outliers&limit=8')
      .then(r => (r.ok ? r.json() : Promise.reject()))
      .then((data: unknown) => {
        if (cancelled) return
        if (Array.isArray(data) && data.length > 0 && typeof (data[0] as DBVideo)?.title === 'string') {
          const videos = (data as DBVideo[]).map((v, i) => dbVideoToVideo(v, i))
          setReferences(videos.map(mapVideoToRef))
          return
        }
        setReferences(
          FALLBACK_REFERENCE_TITLES.map(f => ({
            title: f.title,
            platform: f.platform,
            vsAvg: undefined,
            channel: f.hint,
          })),
        )
      })
      .catch(() => {
        if (!cancelled) {
          setReferences(
            FALLBACK_REFERENCE_TITLES.map(f => ({
              title: f.title,
              platform: f.platform,
              channel: f.hint,
            })),
          )
        }
      })
    return () => {
      cancelled = true
    }
  }, [])

  const guide = GUIDE_BY_CATEGORY[category]

  const aiPreviewPayload = useMemo(
    () =>
      buildAiScriptGuidePayload({
        category,
        keywords: TRENDING_KEYWORDS.slice(0, 3).map(k => k.keyword),
        referenceTitles: references.slice(0, 5).map(r => r.title),
        intent: mapCategoryToIntent(category),
      }),
    [category, references],
  )

  return (
    <div className="space-y-8 max-w-4xl">
      <N8nLv1ServicesSection viewId="content-guide" addToast={addToast} />

      <div className="rounded-2xl border border-dashed border-indigo-200 dark:border-indigo-800/60 bg-indigo-50/80 dark:bg-indigo-950/30 p-5">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div>
            <TitleWithHint
              as="h3"
              className="text-sm font-bold text-indigo-900 dark:text-indigo-200"
              hint="현재는 정적 체크리스트만 표시합니다. 추후 LLM·n8n 연동 시 유형·키워드·Outlier 레퍼런스로 스크립트 가이드를 생성합니다. 아래 JSON은 백엔드 요청 형태 초안입니다."
            >
              AI 스크립트·대본 가이드 (연동 예정)
            </TitleWithHint>
          </div>
          <button
            type="button"
            disabled
            title="API 연결 후 활성화 예정"
            className="shrink-0 px-4 py-2 rounded-xl text-xs font-semibold bg-gray-300 dark:bg-gray-600 text-gray-600 dark:text-gray-300 cursor-not-allowed"
          >
            AI 가이드 생성
          </button>
        </div>
        <details className="mt-4 group">
          <summary className="text-[11px] font-medium text-indigo-700 dark:text-indigo-400 cursor-pointer select-none">
            개발용: 예상 요청 페이로드 (script_guide_v1)
          </summary>
          <pre className="mt-2 text-[10px] leading-snug overflow-x-auto rounded-lg bg-white/80 dark:bg-gray-900/80 p-3 border border-indigo-100 dark:border-indigo-900 text-gray-700 dark:text-gray-300">
            {JSON.stringify(aiPreviewPayload, null, 2)}
          </pre>
        </details>
      </div>

      <div className="rounded-2xl border border-violet-200 dark:border-violet-900/50 bg-gradient-to-br from-violet-50 to-white dark:from-violet-950/40 dark:to-gray-900 p-6">
        <TitleWithHint
          as="h3"
          className="text-sm font-bold text-violet-800 dark:text-violet-200 mb-2"
          hint="대시보드 트렌딩(참고)과 Outlier 레퍼런스를 바탕으로 주제를 좁혀 보세요."
        >
          이번에 다룰 키워드 힌트
        </TitleWithHint>
        <div className="flex flex-wrap gap-2">
          {TRENDING_KEYWORDS.slice(0, 5).map(kw => (
            <button
              key={kw.rank}
              type="button"
              onClick={() => {
                void navigator.clipboard.writeText(kw.keyword)
                addToast(`키워드 "${kw.keyword}" 복사됨`, 'success')
              }}
              className="text-xs px-3 py-1.5 rounded-full bg-white dark:bg-gray-800 border border-violet-200 dark:border-violet-800 text-gray-800 dark:text-gray-100 hover:border-violet-400 transition"
            >
              <span className="font-semibold">#{kw.keyword}</span>
              <span className="ml-1.5 text-violet-600 dark:text-violet-300 tabular-nums">{kw.rank}위</span>
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {CATEGORIES.map(c => (
          <button
            key={c.id}
            type="button"
            onClick={() => setCategory(c.id)}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition
              ${
                category === c.id
                  ? 'bg-violet-600 text-white shadow-md'
                  : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-gray-600 hover:border-violet-300'
              }`}
          >
            <span>{c.icon}</span>
            {c.label}
          </button>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 p-6 shadow-sm space-y-4">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
            {CATEGORIES.find(c => c.id === category)?.icon} {guide.title} 가이드
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">{guide.intro}</p>
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-gray-400 mb-2">체크리스트</p>
            <ul className="space-y-2">
              {guide.checklist.map((item, i) => (
                <li key={i} className="text-sm text-gray-800 dark:text-gray-200 flex gap-2">
                  <span className="text-violet-500 shrink-0">□</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
          {guide.sections.map((sec, i) => (
            <div key={i} className="pt-2 border-t border-gray-100 dark:border-gray-700">
              <p className="text-sm font-bold text-gray-900 dark:text-white mb-2">{sec.heading}</p>
              <ul className="space-y-1.5">
                {sec.bullets.map((b, j) => (
                  <li key={j} className="text-sm text-gray-600 dark:text-gray-300 list-disc list-inside">
                    {b}
                  </li>
                ))}
              </ul>
            </div>
          ))}
          <p className="text-sm italic text-violet-700 dark:text-violet-300 bg-violet-50 dark:bg-violet-950/30 rounded-xl p-3">
            💡 {guide.closingTip}
          </p>
        </div>

        <div className="rounded-2xl bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 p-6 shadow-sm">
          <TitleWithHint
            as="h3"
            className="text-lg font-bold text-gray-900 dark:text-white mb-4"
            hint="Outlier 영상·글 패턴이 높은 성과를 낸 예시입니다. 구조만 벤치마킹하세요."
          >
            참고 레퍼런스
          </TitleWithHint>
          <ul className="space-y-3">
            {references.map((ref, i) => (
              <li
                key={`${ref.title}-${i}`}
                className="rounded-xl border border-gray-100 dark:border-gray-600 p-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition"
              >
                <p className="text-sm font-medium text-gray-900 dark:text-white line-clamp-2">{ref.title}</p>
                <div className="flex flex-wrap gap-2 mt-2 text-xs text-gray-500">
                  <span className="px-2 py-0.5 rounded-md bg-gray-100 dark:bg-gray-600 text-gray-700 dark:text-gray-200">
                    {ref.platform}
                  </span>
                  {ref.vsAvg != null && (
                    <span className="text-amber-600 dark:text-amber-400 font-semibold">vs {ref.vsAvg}x</span>
                  )}
                  {ref.channel && !ref.vsAvg && (
                    <span className="text-gray-400">{ref.channel}</span>
                  )}
                  {ref.channel && ref.vsAvg != null && (
                    <span className="text-gray-400 truncate max-w-[12rem]">{ref.channel}</span>
                  )}
                </div>
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={() => {
              const p = new URLSearchParams(searchParams.toString())
              p.set('view', 'content-studio')
              router.push(`${pathname}?${p.toString()}`)
              addToast('콘텐츠 제작 화면으로 이동했습니다', 'success')
            }}
            className="mt-4 w-full py-2.5 rounded-xl text-sm font-semibold bg-gray-900 dark:bg-white text-white dark:text-gray-900 hover:opacity-90 transition"
          >
            이 가이드를 바탕으로 초안 작성 →
          </button>
        </div>
      </div>
    </div>
  )
}
