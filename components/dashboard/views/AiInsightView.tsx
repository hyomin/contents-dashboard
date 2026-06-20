'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import type { AddToast } from '@/lib/dashboard/dashboard-types'
import type { InsightSection, InsightItem, GroundingSource } from '@/app/api/dashboard/insights/route'
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
  onGoGuide,
}: {
  section: InsightSection
  onAddPlan: (text: string, icon?: string) => void
  onGoGuide: (text: string, action?: string, format?: InsightItem['format']) => void
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
                    <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition shrink-0">
                      <button
                        type="button"
                        onClick={() => onAddPlan(item.text, item.icon)}
                        className="text-[10px] px-2.5 py-1 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600"
                      >
                        기획 추가
                      </button>
                      <button
                        type="button"
                        onClick={() => onGoGuide(item.text, item.action, item.format)}
                        className="text-[10px] px-2.5 py-1 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                      >
                        가이드 →
                      </button>
                    </div>
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

/** "OO분 전 / OO시간 전" 형태의 상대 시간 표시 */
function formatRelativeTime(ts: number | null): string {
  if (!ts) return '-'
  const diffMin = Math.floor((Date.now() - ts) / 60000)
  if (diffMin < 1) return '방금 전'
  if (diffMin < 60) return `${diffMin}분 전`
  const h = Math.floor(diffMin / 60)
  if (h < 24) return `${h}시간 전`
  return `${Math.floor(h / 24)}일 전`
}

// ─── 클라이언트 localStorage 캐시 (24h) ────────────────────────────
const LS_KEY = 'dashboard_ai_insight_v1'
const LS_TTL = 24 * 60 * 60 * 1000

interface InsightLsCache {
  sections: InsightSection[]
  personalCachedAt: number | null
  scoutCachedAt: number | null
  savedAt: number
}

function loadInsightLs(): InsightLsCache | null {
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (!raw) return null
    const d = JSON.parse(raw) as InsightLsCache
    if (Date.now() - d.savedAt > LS_TTL) return null
    return d
  } catch { return null }
}

function saveInsightLs(d: Omit<InsightLsCache, 'savedAt'>) {
  try { localStorage.setItem(LS_KEY, JSON.stringify({ ...d, savedAt: Date.now() })) } catch {}
}

function clearInsightLs() {
  try { localStorage.removeItem(LS_KEY) } catch {}
}
// ──────────────────────────────────────────────────────────────────

type BustMode = 'personal' | 'scout' | 'all'

export default function AiInsightView({ addToast }: { addToast: AddToast }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [sections, setSections] = useState<InsightSection[]>([])
  const [loading, setLoading] = useState(false)
  const [scoutLoading, setScoutLoading] = useState(false)
  const [personalCachedAt, setPersonalCachedAt] = useState<number | null>(null)
  const [scoutCachedAt, setScoutCachedAt] = useState<number | null>(null)
  const [lastUpdatedAt, setLastUpdatedAt] = useState<number | null>(null)
  const [fetchError, setFetchError] = useState(false)
  const { addItem: addToQueue } = usePlanningQueue()

  const goToContentGuide = useCallback(
    (text: string, action?: string, format?: InsightItem['format']) => {
      const p = new URLSearchParams(searchParams.toString())
      p.set('view', 'content-guide')
      // action = Gemini가 생성한 짧은 추천 액션 → 발행 주제로 매핑
      // text   = 2-3문장 설명 → 주제 키워드 가이드(seedKeyword)로 매핑
      // format = Gemini 추천 포맷 → 콘텐츠 가이드 포맷 자동 설정
      const topic = action?.trim() || ''
      if (topic) p.set('topic', topic)
      const seed = text.trim()
      if (seed) p.set('seedKeyword', encodeURIComponent(seed))
      if (format) p.set('insightFormat', format)
      router.push(`${pathname}?${p.toString()}`)
      addToast('콘텐츠 가이드로 이동합니다 ✨', 'success')
    },
    [router, pathname, searchParams, addToast],
  )

  const load = useCallback(
    (bust?: BustMode) => {
      // bust가 있으면 localStorage 캐시 삭제 후 강제 재요청
      if (bust) clearInsightLs()
      if (bust === 'scout') setScoutLoading(true)
      else setLoading(true)
      setFetchError(false)
      fetch(`/api/dashboard/insights${bust ? `?bust=${bust}` : ''}`)
        .then((r) => r.json())
        .then(
          (d: {
            sections?: InsightSection[]
            personalCachedAt?: number
            scoutCachedAt?: number
          }) => {
            const sections = d.sections ?? []
            const personal = d.personalCachedAt ?? null
            const scout = d.scoutCachedAt ?? null
            setSections(sections)
            setPersonalCachedAt(personal)
            setScoutCachedAt(scout)
            const now = Date.now()
            setLastUpdatedAt(now)
            saveInsightLs({ sections, personalCachedAt: personal, scoutCachedAt: scout })
          },
        )
        .catch(() => {
          setFetchError(true)
          addToast('인사이트 로드 실패', 'warning')
        })
        .finally(() => {
          setLoading(false)
          setScoutLoading(false)
        })
    },
    [addToast],
  )

  useEffect(() => {
    // localStorage 캐시가 있으면 즉시 표시 (로딩 오버레이 없음)
    // 없으면 최초 1회만 자동 로드 — 이후는 버튼으로만 업데이트
    const cached = loadInsightLs()
    if (cached) {
      setSections(cached.sections)
      setPersonalCachedAt(cached.personalCachedAt)
      setScoutCachedAt(cached.scoutCachedAt)
      setLastUpdatedAt(cached.savedAt)
    } else {
      load()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const aiSuccessCount = sections.filter((s) => s.isAi).length
  const hasScoutSections = sections.some((s) => s.type === 'korea' || s.type === 'global')

  return (
    <PageLoadingOverlay
      loading={loading && sections.length === 0}
      label="Gemini가 처음 분석 중입니다… (약 20~40초 · 이후 24시간 캐시)"
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
              {lastUpdatedAt
                ? `마지막 업데이트: ${formatRelativeTime(lastUpdatedAt)} · 24시간 주기`
                : sections.length > 0
                  ? '캐시 데이터 표시 중'
                  : '데이터 없음 · 업데이트 버튼을 눌러주세요'}
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
                  ? `✦ AI ${aiSuccessCount}/${sections.length}`
                  : aiSuccessCount > 0
                    ? `⚡ AI ${aiSuccessCount}/${sections.length}`
                    : '⚠ AI 실패'}
              </span>
            )}
            {hasScoutSections && (
              <button
                type="button"
                onClick={() => {
                  load('scout')
                  addToast('한국/글로벌 트렌드를 다시 스캔합니다 (약 20~40초 소요)', 'success')
                }}
                disabled={scoutLoading || loading}
                title="한국·글로벌 트렌드 섹션만 재스캔"
                className="shrink-0 text-xs bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-40 px-3 py-2 rounded-xl font-semibold transition"
              >
                {scoutLoading ? '스캔 중…' : '🔍 트렌드 갱신'}
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                load('all')
                addToast('전체 인사이트를 새로 분석합니다 (약 20~40초 소요)', 'success')
              }}
              disabled={loading || scoutLoading}
              title="모든 섹션 재분석 · 24시간마다 자동 만료"
              className="shrink-0 text-xs bg-gray-900 dark:bg-white text-white dark:text-gray-900 hover:opacity-80 disabled:opacity-40 px-4 py-2 rounded-xl font-semibold transition"
            >
              {loading ? '분석 중…' : '↻ 업데이트'}
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
              Gemini가 분석 중입니다… 완료 후 24시간 동안 즉시 표시됩니다.
            </p>
          </div>
        ) : fetchError || sections.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <p className="text-4xl mb-3">🤖</p>
            <p className="text-sm font-medium">인사이트를 불러오지 못했습니다.</p>
            <p className="text-xs mt-1 text-gray-300">
              N8N_WEBHOOK_AI_INSIGHTS 연동 여부나 n8n·네트워크 상태를 확인해주세요.
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
            {(loading || scoutLoading) && (
              <div className="rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 px-4 py-3 text-sm text-blue-700 dark:text-blue-300 flex items-center gap-2">
                <svg className="animate-spin w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                {scoutLoading
                  ? 'Gemini가 한국/글로벌 트렌드를 다시 스캔 중입니다… 완료되면 자동으로 업데이트됩니다.'
                  : 'Gemini가 내 데이터 기반 추천을 다시 분석 중입니다… 완료되면 자동으로 업데이트됩니다.'}
              </div>
            )}

            {sections.map((sec) => (
              <InsightCard
                key={sec.type}
                section={sec}
                onGoGuide={(text, action, format) => goToContentGuide(text, action, format)}
                onAddPlan={(text, icon) => {
                  // 한국/글로벌 트렌드 = 신규 카테고리 확장 후보, 개인맞춤 = 현재 운영 채널 최적화
                  const category = sec.type === 'personal' ? 'current' : 'expansion'
                  const added = addToQueue(text.slice(0, 80), 'insight', { detail: text, icon, category })
                  addToast(
                    added
                      ? `기획 큐에 추가됨 (${category === 'expansion' ? '확장 후보' : '현재 운영'}) ✓`
                      : '이미 기획 큐에 있는 항목입니다',
                    added ? 'success' : 'warning',
                  )
                }}
              />
            ))}
            <p className="text-center text-[11px] text-gray-400">
              ✦ Gemini 분석 · 24시간 캐시 · 수동 업데이트 방식 ｜ 한국·글로벌 트렌드: Google Search Grounding
            </p>
          </div>
        )}
      </div>
    </PageLoadingOverlay>
  )
}
