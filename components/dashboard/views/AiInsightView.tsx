'use client'

import { useEffect, useState, useCallback } from 'react'
import type { AddToast } from '@/lib/dashboard/dashboard-types'
import type { InsightSection, GroundingSource } from '@/app/api/dashboard/insights/route'
import { PageLoadingOverlay } from '@/components/dashboard/ui/loading'
import { usePlanningQueue } from '@/lib/hooks/use-planning-queue'
import { N8nLv1ServicesSection } from '@/components/dashboard/n8n-lv1-services-section'

const SECTION_STYLES: Record<
  InsightSection['type'],
  { gradient: string; border: string; badge: string; badgeText: string; tagBg: string }
> = {
  korea: {
    gradient: 'from-red-500 via-blue-600 to-blue-700',
    border: 'border-blue-100 dark:border-blue-900/40',
    badge: 'bg-blue-50 dark:bg-blue-950/40',
    badgeText: 'text-blue-700 dark:text-blue-300',
    tagBg: 'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300',
  },
  personal: {
    gradient: 'from-violet-600 via-purple-600 to-indigo-600',
    border: 'border-violet-100 dark:border-violet-900/40',
    badge: 'bg-violet-50 dark:bg-violet-950/40',
    badgeText: 'text-violet-700 dark:text-violet-300',
    tagBg: 'bg-violet-100 dark:bg-violet-900/50 text-violet-700 dark:text-violet-300',
  },
  global: {
    gradient: 'from-emerald-500 via-teal-600 to-cyan-600',
    border: 'border-emerald-100 dark:border-emerald-900/40',
    badge: 'bg-emerald-50 dark:bg-emerald-950/40',
    badgeText: 'text-emerald-700 dark:text-emerald-300',
    tagBg: 'bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300',
  },
}

function SourceLinks({ sources }: { sources: GroundingSource[] }) {
  if (!sources.length) return null
  return (
    <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
      <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1.5">검색 출처</p>
      <div className="flex flex-wrap gap-1.5">
        {sources.map((s, i) => (
          <a
            key={i}
            href={s.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition truncate max-w-[180px]"
          >
            {s.title || s.url}
          </a>
        ))}
      </div>
    </div>
  )
}

function InsightCard({
  section,
  onAddPlan,
}: {
  section: InsightSection
  onAddPlan: (text: string, icon?: string) => void
}) {
  const style = SECTION_STYLES[section.type]

  return (
    <div className={`rounded-2xl border ${style.border} bg-white dark:bg-gray-800 shadow-sm overflow-hidden`}>
      {/* 헤더 */}
      <div className={`bg-gradient-to-r ${style.gradient} px-5 py-4`}>
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 className="text-base font-bold text-white">{section.title}</h3>
            <p className="text-xs text-white/70 mt-0.5">{section.subtitle}</p>
          </div>
          <span className={`shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full ${section.isAi ? 'bg-white/20 text-white' : 'bg-white/10 text-white/60'}`}>
            {section.isAi ? '✦ AI' : '규칙 기반'}
          </span>
        </div>
      </div>

      {/* 아이템 목록 */}
      <div className="p-4 space-y-3">
        {section.items.map((item, i) => (
          <div
            key={i}
            className={`rounded-xl ${style.badge} p-4 group relative`}
          >
            <div className="flex gap-3">
              <span className="text-2xl shrink-0 mt-0.5">{item.icon}</span>
              <div className="flex-1 min-w-0">
                <p className={`text-sm leading-relaxed ${style.badgeText} font-medium`}>{item.text}</p>
                {item.action && (
                  <div className="flex items-center justify-between mt-2 gap-2">
                    <span className={`text-[11px] px-2 py-0.5 rounded-md ${style.tagBg} font-medium`}>
                      → {item.action}
                    </span>
                    <button
                      type="button"
                      onClick={() => onAddPlan(item.text, item.icon)}
                      className="opacity-0 group-hover:opacity-100 transition text-[10px] px-2.5 py-1 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-50 shrink-0"
                    >
                      기획 추가
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}

        {section.sources && section.sources.length > 0 && (
          <SourceLinks sources={section.sources} />
        )}
      </div>
    </div>
  )
}

export default function AiInsightView({ addToast }: { addToast: AddToast }) {
  const [sections, setSections] = useState<InsightSection[]>([])
  const [loading, setLoading] = useState(true)
  const [cached, setCached] = useState(false)
  const [cachedAt, setCachedAt] = useState<Date | null>(null)
  const [fetchError, setFetchError] = useState(false)
  const { addItem: addToQueue } = usePlanningQueue()

  const load = useCallback(
    (bust = false) => {
      setLoading(true)
      setFetchError(false)
      fetch(`/api/dashboard/insights${bust ? '?bust=1' : ''}`)
        .then((r) => r.json())
        .then((d: { sections?: InsightSection[]; cached?: boolean }) => {
          setSections(d.sections ?? [])
          setCached(d.cached ?? false)
          setCachedAt(new Date())
        })
        .catch(() => {
          setFetchError(true)
          addToast('인사이트 로드 실패', 'warning')
        })
        .finally(() => setLoading(false))
    },
    [addToast],
  )

  useEffect(() => {
    load()
  }, [load])

  const aiSuccessCount = sections.filter((s) => s.isAi).length

  return (
    <PageLoadingOverlay
      loading={loading && sections.length === 0}
      label="Gemini가 트렌드를 분석 중입니다… (약 20~40초)"
    >
      <div className="space-y-6">
        <N8nLv1ServicesSection viewId="ai-insight" addToast={addToast} />

        {/* 헤더 */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
              🤖 AI 인사이트 &amp; 추천 액션
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              {cached && cachedAt
                ? `캐시된 결과 · ${cachedAt.toLocaleTimeString('ko-KR')} 기준 (최대 30분 유효)`
                : cachedAt
                  ? `업데이트: ${cachedAt.toLocaleTimeString('ko-KR')} · Gemini + Google Search 실시간 분석`
                  : 'Gemini 2.5 Flash + Google Search Grounding 실시간 분석'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {/* AI 성공 지표 */}
            {!loading && sections.length > 0 && (
              <span
                className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                  aiSuccessCount === sections.length
                    ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                    : aiSuccessCount > 0
                      ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                      : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                }`}
              >
                {aiSuccessCount === sections.length
                  ? `✦ AI ${aiSuccessCount}/${sections.length} 성공`
                  : aiSuccessCount > 0
                    ? `⚡ AI ${aiSuccessCount}/${sections.length} 부분 성공`
                    : '⚠ AI 분석 실패'}
              </span>
            )}
            <button
              type="button"
              onClick={() => {
                load(true)
                addToast('인사이트를 새로 분석합니다 (약 20~40초 소요)', 'success')
              }}
              disabled={loading}
              className="shrink-0 text-xs bg-gray-900 dark:bg-white text-white dark:text-gray-900 hover:opacity-80 disabled:opacity-40 px-4 py-2 rounded-xl font-semibold transition"
            >
              {loading ? '분석 중…' : '↻ 새로 분석'}
            </button>
          </div>
        </div>

        {/* 로딩 스켈레톤 */}
        {loading && sections.length === 0 ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="rounded-2xl overflow-hidden animate-pulse">
                <div className="h-16 bg-gradient-to-r from-gray-200 to-gray-300 dark:from-gray-700 dark:to-gray-600" />
                <div className="bg-white dark:bg-gray-800 p-4 space-y-3 border border-gray-100 dark:border-gray-700 rounded-b-2xl">
                  {[1, 2, 3].map((j) => (
                    <div key={j} className="h-16 bg-gray-100 dark:bg-gray-700 rounded-xl" />
                  ))}
                </div>
              </div>
            ))}
            <p className="text-center text-sm text-gray-400 py-2">
              Gemini가 한국·글로벌 트렌드를 검색 중입니다…
            </p>
          </div>
        ) : fetchError || sections.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <p className="text-4xl mb-3">🤖</p>
            <p className="text-sm font-medium">인사이트를 불러오지 못했습니다.</p>
            <p className="text-xs mt-1 text-gray-300">
              GEMINI_API_KEY 설정 여부나 네트워크 상태를 확인해주세요.
            </p>
            <button
              type="button"
              onClick={() => load()}
              className="mt-4 text-xs px-4 py-2 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-xl hover:opacity-80 transition"
            >
              다시 시도
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            {/* 재분석 중 오버레이 */}
            {loading && (
              <div className="rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 px-4 py-3 text-sm text-blue-700 dark:text-blue-300 flex items-center gap-2">
                <svg className="animate-spin w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                Gemini가 새 분석을 요청 중입니다… 완료되면 자동으로 업데이트됩니다.
              </div>
            )}

            {sections.map((sec) => (
              <InsightCard
                key={sec.type}
                section={sec}
                onAddPlan={(text, icon) => {
                  const added = addToQueue(text.slice(0, 80), 'insight', { detail: text, icon })
                  addToast(
                    added
                      ? '기획 큐에 추가됨 · 콘텐츠 가이드 참고 레퍼런스에서 연결하세요 ✓'
                      : '이미 기획 큐에 있는 항목입니다',
                    added ? 'success' : 'warning',
                  )
                }}
              />
            ))}
            <p className="text-center text-[11px] text-gray-400">
              ✦ Gemini 2.5 Flash + Google Search Grounding 기반 · 30분 캐시
            </p>
          </div>
        )}
      </div>
    </PageLoadingOverlay>
  )
}
