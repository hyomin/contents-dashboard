'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import type { AddToast } from '@/lib/dashboard/dashboard-types'
import { N8nLv1ServicesSection } from '@/components/dashboard/n8n-lv1-services-section'
import type {
  ContentFormat,
  ContentGenerateRequest,
  ContentGenerateResult,
  LongformResult,
  ShortformResult,
  CarouselResult,
  BlogResult,
  SnsCaptionResult,
} from '@/app/api/dashboard/content-generate/route'
import type { TrendingKeyword } from '@/lib/data/analytics-from-videos'
import type { RssTopicCandidateRow } from '@/lib/data/rss-topic-collect'
import { consumeContentStudioImport } from '@/lib/dashboard/content-studio-import'
import { Spinner } from '@/components/dashboard/ui/loading'
import { usePlanningQueue, SOURCE_LABELS } from '@/lib/hooks/use-planning-queue'

const STORAGE_KEY = 'content-studio-drafts-v2'

export interface ContentDraft {
  id: string
  title: string
  platform: string
  format: ContentFormat | 'script'
  body: string
  notes: string
  updatedAt: string
  /** 어떤 초안에서 파생됐는지 추적 */
  derivedFromId?: string
}

const PLATFORMS = [
  { value: 'youtube',      label: 'YouTube',         icon: '🔴' },
  { value: 'instagram',    label: 'Instagram',       icon: '💗' },
  { value: 'naver-blog',   label: '네이버 블로그',    icon: '🟢' },
  { value: 'tistory',      label: '티스토리',         icon: '🟠' },
  { value: 'shorts-reels', label: 'Shorts/Reels',    icon: '⚡' },
  { value: 'thread',       label: 'Thread',          icon: '🧵' },
] as const

export const FORMAT_META: Record<ContentFormat | 'script', { label: string; icon: string; desc: string }> = {
  longform:      { label: '롱폼 영상', icon: '🎬', desc: '8~12분 YouTube 대본 구조' },
  shortform:     { label: '숏폼',      icon: '⚡', desc: '60초 Shorts/Reels 스크립트' },
  carousel:      { label: '캐러셀',    icon: '🃏', desc: '인스타 카드뉴스 슬라이드' },
  blog:          { label: '블로그',    icon: '📝', desc: 'SEO 블로그 포스팅' },
  'sns-caption': { label: 'SNS 캡션', icon: '💬', desc: '인스타·네이버·Thread 캡션' },
  script:        { label: '대본 (공용)', icon: '📄', desc: '포맷 미지정 자유 작성' },
}

// ─── 결과 렌더러 ───────────────────────────────────────────────────────────────

function ResultRenderer({ result, onApply, onNewDraft }: {
  result: ContentGenerateResult
  onApply: (body: string, title?: string) => void
  onNewDraft: (body: string, title: string, format: ContentFormat) => void
}) {
  const fmt = result.format

  const toMarkdown = (): string => {
    if (fmt === 'longform') {
      const r = result as LongformResult
      return [
        `# ${r.title}`,
        '',
        `## 오프닝 훅\n${r.hook}`,
        '',
        ...r.chapters.map(c => `## ${c.heading}\n${c.bullets.map(b => `- ${b}`).join('\n')}\n*(약 ${Math.round(c.durationSec / 60)}분)*`),
        '',
        `## CTA\n${r.cta}`,
        '',
        `**SEO 키워드:** ${r.seoKeywords.join(', ')}`,
        '',
        '---',
        r.fullScript,
      ].join('\n')
    }
    if (fmt === 'shortform') {
      const r = result as ShortformResult
      return [
        `# ${r.title}`,
        `**훅:** ${r.hook}`,
        '',
        r.keyPoints.map((p, i) => `${i + 1}. ${p}`).join('\n'),
        '',
        `**CTA:** ${r.cta}`,
        `**자막:** ${r.onScreenText.join(' / ')}`,
        `**예상 길이:** ${r.durationHint}`,
        '',
        '---',
        r.fullScript,
      ].join('\n')
    }
    if (fmt === 'carousel') {
      const r = result as CarouselResult
      return [
        `# ${r.title}`,
        '',
        ...r.slides.map((s, i) => `## 슬라이드 ${i + 1}: ${s.heading}\n${s.body}`),
        '',
        `**CTA:** ${r.cta}`,
        `**해시태그:** ${r.hashtags.map(h => `#${h}`).join(' ')}`,
      ].join('\n')
    }
    if (fmt === 'blog') {
      const r = result as BlogResult
      return r.fullContent || [
        `# ${r.title}`,
        `> ${r.metaDescription}`,
        '',
        ...r.h2Sections.flatMap(s => [`## ${s.heading}`, ...s.paragraphs, '']),
        r.closingCta,
        '',
        `**SEO 키워드:** ${r.seoKeywords.join(', ')}`,
      ].join('\n')
    }
    if (fmt === 'sns-caption') {
      const r = result as SnsCaptionResult
      return [
        `# ${r.title}`,
        '',
        `**Instagram:**\n${r.captions.instagram}`,
        '',
        `**네이버 블로그:**\n${r.captions.naver}`,
        '',
        `**Thread:**\n${r.captions.thread}`,
        '',
        `**해시태그:** ${r.hashtags.map(h => `#${h}`).join(' ')}`,
      ].join('\n')
    }
    return ''
  }

  const md = toMarkdown()
  const title = 'title' in result ? (result as { title: string }).title : ''

  return (
    <div className="space-y-3">
      {/* 미리보기 */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-4 text-xs text-gray-700 dark:text-gray-300 font-mono whitespace-pre-wrap max-h-72 overflow-y-auto leading-relaxed">
        {md}
      </div>

      {/* 포맷별 구조 요약 */}
      {fmt === 'longform' && (
        <div className="space-y-1.5">
          {(result as LongformResult).chapters.map((c, i) => (
            <div key={i} className="flex items-center gap-2 text-xs">
              <span className="w-5 h-5 rounded bg-violet-100 dark:bg-violet-900 text-violet-700 dark:text-violet-300 font-bold flex items-center justify-center shrink-0">{i + 1}</span>
              <span className="font-medium text-gray-800 dark:text-gray-200">{c.heading}</span>
              <span className="text-gray-400 ml-auto">~{Math.round(c.durationSec / 60)}분</span>
            </div>
          ))}
        </div>
      )}
      {fmt === 'carousel' && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {(result as CarouselResult).slides.map((s, i) => (
            <div key={i} className="shrink-0 w-28 bg-gradient-to-br from-pink-50 to-rose-50 dark:from-pink-950/30 dark:to-rose-950/30 border border-pink-200 dark:border-pink-800 rounded-lg p-2">
              <p className="text-[10px] font-bold text-pink-700 dark:text-pink-300 mb-1">슬라이드 {i + 1}</p>
              <p className="text-[10px] text-gray-700 dark:text-gray-300 line-clamp-3">{s.heading}</p>
            </div>
          ))}
        </div>
      )}
      {fmt === 'sns-caption' && (
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: 'Instagram', icon: '💗', text: (result as SnsCaptionResult).captions.instagram },
            { label: '네이버', icon: '🟢', text: (result as SnsCaptionResult).captions.naver },
            { label: 'Thread', icon: '🧵', text: (result as SnsCaptionResult).captions.thread },
          ].map(p => (
            <div key={p.label} className="bg-gray-50 dark:bg-gray-800 rounded-lg p-2">
              <p className="text-[10px] font-bold mb-1">{p.icon} {p.label}</p>
              <p className="text-[10px] text-gray-600 dark:text-gray-400 line-clamp-4">{p.text}</p>
            </div>
          ))}
        </div>
      )}

      {/* 액션 버튼 */}
      <div className="flex gap-2 pt-1">
        <button
          type="button"
          onClick={() => onApply(md, title)}
          className="flex-1 py-2 text-xs font-semibold bg-violet-600 hover:bg-violet-700 text-white rounded-lg transition"
        >
          현재 초안에 적용
        </button>
        <button
          type="button"
          onClick={() => onNewDraft(md, title, fmt)}
          className="flex-1 py-2 text-xs font-medium border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition"
        >
          새 초안으로 저장
        </button>
      </div>
    </div>
  )
}

// ─── AI 생성 패널 ──────────────────────────────────────────────────────────────

function AiGeneratePanel({
  currentBody,
  currentFormat,
  addToast,
  onApply,
  onNewDraft,
}: {
  currentBody: string
  currentFormat: ContentFormat | 'script'
  addToast: AddToast
  onApply: (body: string, title?: string) => void
  onNewDraft: (body: string, title: string, format: ContentFormat) => void
}) {
  const [mode, setMode] = useState<'create' | 'convert'>(currentBody.trim() ? 'create' : 'create')
  const [targetFormat, setTargetFormat] = useState<ContentFormat>('longform')
  const [topic, setTopic] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<ContentGenerateResult | null>(null)
  const [trendingKeywords, setTrendingKeywords] = useState<string[]>([])
  const [rssTopics, setRssTopics] = useState<string[]>([])
  const { items: queueItems, removeItem: removeFromQueue, markUsed, clearUsed } = usePlanningQueue()
  const pendingQueue = queueItems.filter((q) => !q.used)

  useEffect(() => {
    fetch('/api/dashboard/trending?limit=6')
      .then(r => r.json())
      .then((d: { keywords?: TrendingKeyword[] }) => setTrendingKeywords((d.keywords ?? []).map(k => k.keyword)))
      .catch(() => {})
    fetch('/api/dashboard/rss-topics?limit=5')
      .then(r => r.json())
      .then((d: { topics?: RssTopicCandidateRow[] }) => setRssTopics((d.topics ?? []).map(t => t.ai_title ?? t.title)))
      .catch(() => {})
  }, [])

  const generate = async () => {
    if (mode === 'create' && !topic.trim()) {
      addToast('주제를 입력해주세요', 'warning')
      return
    }
    if (mode === 'convert' && !currentBody.trim()) {
      addToast('변환할 초안 내용이 없습니다. 본문을 먼저 작성해주세요', 'warning')
      return
    }
    setLoading(true)
    setResult(null)
    try {
      const reqBody: ContentGenerateRequest = {
        targetFormat,
        ...(mode === 'create' ? { topic: topic.trim() } : {
          sourceContent: currentBody,
          sourceFormat: currentFormat !== 'script' ? currentFormat : undefined,
        }),
        context: {
          trendingKeywords,
          rssTopics,
        },
      }
      const res = await fetch('/api/dashboard/content-generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(reqBody),
      })
      const data = await res.json() as ContentGenerateResult & { error?: string }
      if (!res.ok || data.error) {
        addToast(data.error ?? 'AI 생성 실패', 'warning')
      } else {
        setResult(data)
        addToast(`${FORMAT_META[targetFormat].label} 생성 완료 ✨`, 'success')
      }
    } catch {
      addToast('네트워크 오류', 'warning')
    } finally {
      setLoading(false)
    }
  }

  const FORMATS_FOR_SELECT: ContentFormat[] = ['longform', 'shortform', 'carousel', 'blog', 'sns-caption']

  return (
    <div className="bg-gradient-to-br from-violet-50 to-indigo-50 dark:from-violet-950/30 dark:to-indigo-950/30 border border-violet-200 dark:border-violet-800 rounded-2xl p-5 space-y-4">
      <div className="flex items-center gap-2">
        <span className="text-base">✨</span>
        <h3 className="text-sm font-bold text-violet-900 dark:text-violet-200">AI 콘텐츠 생성</h3>
        <span className="ml-auto text-[10px] text-violet-500 dark:text-violet-400">Gemini 2.5 Flash</span>
      </div>

      {/* 모드 토글 */}
      <div className="flex gap-2 p-1 bg-white/60 dark:bg-gray-900/40 rounded-xl">
        {([
          { v: 'create' as const, label: '✏️ 처음부터 생성' },
          { v: 'convert' as const, label: '🔄 현재 초안 변환' },
        ] as const).map(m => (
          <button
            key={m.v}
            type="button"
            onClick={() => setMode(m.v)}
            className={`flex-1 py-2 text-xs font-semibold rounded-lg transition ${
              mode === m.v
                ? 'bg-violet-600 text-white shadow-sm'
                : 'text-gray-600 dark:text-gray-400 hover:bg-white/80 dark:hover:bg-gray-800/60'
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>

      {/* 목표 포맷 선택 */}
      <div>
        <p className="text-[11px] font-semibold text-violet-700 dark:text-violet-400 mb-2">목표 포맷</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {FORMATS_FOR_SELECT.map(f => {
            const meta = FORMAT_META[f]
            return (
              <button
                key={f}
                type="button"
                onClick={() => setTargetFormat(f)}
                className={`p-2.5 rounded-xl text-left border transition ${
                  targetFormat === f
                    ? 'border-violet-500 bg-violet-600 text-white shadow-sm'
                    : 'border-gray-200 dark:border-gray-700 bg-white/70 dark:bg-gray-800/60 hover:border-violet-300'
                }`}
              >
                <span className="block text-base">{meta.icon}</span>
                <span className={`block text-[11px] font-semibold mt-1 ${targetFormat === f ? 'text-white' : 'text-gray-800 dark:text-gray-200'}`}>{meta.label}</span>
                <span className={`block text-[10px] mt-0.5 ${targetFormat === f ? 'text-violet-200' : 'text-gray-400'}`}>{meta.desc}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* 기획 큐 */}
      {pendingQueue.length > 0 && (
        <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl p-3">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[11px] font-bold text-amber-800 dark:text-amber-200 flex items-center gap-1">
              📋 기획 큐
              <span className="ml-1 bg-amber-200 dark:bg-amber-800 text-amber-800 dark:text-amber-200 rounded-full px-1.5 py-0.5 text-[10px]">
                {pendingQueue.length}
              </span>
            </p>
            <button
              type="button"
              onClick={() => clearUsed()}
              className="text-[10px] text-amber-600 hover:text-amber-800 transition"
            >
              사용됨 정리
            </button>
          </div>
          <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto">
            {pendingQueue.map((item) => (
              <div key={item.id} className="flex items-center gap-1 bg-white dark:bg-gray-800 border border-amber-200 dark:border-amber-700 rounded-lg pl-2 pr-1 py-0.5">
                <button
                  type="button"
                  onClick={() => {
                    setTopic(item.keyword)
                    setMode('create')
                    markUsed(item.id)
                  }}
                  className="text-[11px] text-gray-800 dark:text-gray-200 hover:text-violet-600 dark:hover:text-violet-400 transition font-medium"
                >
                  {item.keyword.slice(0, 30)}{item.keyword.length > 30 ? '…' : ''}
                </button>
                <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${SOURCE_LABELS[item.source].color}`}>
                  {SOURCE_LABELS[item.source].label}
                </span>
                <button
                  type="button"
                  onClick={() => removeFromQueue(item.id)}
                  className="text-gray-300 hover:text-red-400 transition text-[10px] ml-0.5"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 모드별 입력 */}
      {mode === 'create' ? (
        <div>
          <label className="text-[11px] font-semibold text-violet-700 dark:text-violet-400 mb-1.5 block">
            주제 키워드
          </label>
          <input
            type="text"
            value={topic}
            onChange={e => setTopic(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && generate()}
            placeholder="예: 금리 인상 시대 재테크 전략"
            className="w-full px-3 py-2 text-sm rounded-xl border border-violet-200 dark:border-violet-700 bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-violet-500"
          />
          {/* 빠른 RSS 주제 삽입 */}
          {rssTopics.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {rssTopics.slice(0, 4).map((t, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setTopic(t.slice(0, 40))}
                  className="text-[10px] px-2 py-1 rounded-full bg-white dark:bg-gray-800 border border-violet-200 dark:border-violet-700 text-violet-700 dark:text-violet-300 hover:bg-violet-50 transition"
                >
                  {t.slice(0, 25)}…
                </button>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="bg-white/60 dark:bg-gray-800/50 rounded-xl p-3 text-xs text-gray-500 dark:text-gray-400">
          <span className="font-semibold text-gray-700 dark:text-gray-300">변환 소스:</span>{' '}
          {currentBody.trim()
            ? `현재 초안 (${FORMAT_META[currentFormat]?.label ?? currentFormat}) · ${currentBody.length}자`
            : '⚠️ 본문이 비어 있습니다. 먼저 내용을 작성해주세요.'}
        </div>
      )}

      {/* 생성 버튼 */}
      <button
        type="button"
        onClick={generate}
        disabled={loading}
        className={`w-full py-3 rounded-xl text-sm font-bold transition ${
          loading
            ? 'bg-gray-300 dark:bg-gray-700 text-gray-500 cursor-not-allowed'
            : 'bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white shadow-md hover:shadow-lg'
        }`}
      >
        {loading ? (
          <span className="flex items-center justify-center gap-2">
            <Spinner size="sm" color="border-white" />
            {FORMAT_META[targetFormat].label} 생성 중...
          </span>
        ) : (
          `✨ ${FORMAT_META[targetFormat].label} ${mode === 'convert' ? '변환' : '생성'}`
        )}
      </button>

      {/* 결과 */}
      {result && (
        <div className="border-t border-violet-200 dark:border-violet-800 pt-4">
          <p className="text-[11px] font-bold text-violet-700 dark:text-violet-400 mb-3">
            생성 결과 · {FORMAT_META[result.format].icon} {FORMAT_META[result.format].label}
          </p>
          <ResultRenderer
            result={result}
            onApply={onApply}
            onNewDraft={onNewDraft}
          />
        </div>
      )}
    </div>
  )
}

// ─── 로컬스토리지 헬퍼 ────────────────────────────────────────────────────────

function newDraft(): ContentDraft {
  return {
    id: typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `draft-${Date.now()}`,
    title: '',
    platform: 'youtube',
    format: 'longform',
    body: '',
    notes: '',
    updatedAt: new Date().toISOString(),
  }
}

function loadDrafts(): ContentDraft[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as ContentDraft[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function persistDrafts(list: ContentDraft[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list))
}

// ─── 메인 뷰 ─────────────────────────────────────────────────────────────────

export default function ContentStudioView({ addToast }: { addToast: AddToast }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [drafts, setDrafts] = useState<ContentDraft[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const [platform, setPlatform] = useState('youtube')
  const [format, setFormat] = useState<ContentFormat | 'script'>('longform')
  const [body, setBody] = useState('')
  const [notes, setNotes] = useState('')
  const [showAiPanel, setShowAiPanel] = useState(false)

  const applyToForm = useCallback((d: ContentDraft) => {
    setTitle(d.title)
    setPlatform(d.platform)
    setFormat(d.format)
    setBody(d.body)
    setNotes(d.notes)
  }, [])

  function mergeFormIntoDrafts(list: ContentDraft[]): ContentDraft[] {
    if (activeId == null) return list
    const now = new Date().toISOString()
    return list.map(d =>
      d.id === activeId ? { ...d, title, platform, format, body, notes, updatedAt: now } : d,
    )
  }

  useEffect(() => {
    const imported = consumeContentStudioImport()
    const list = loadDrafts()

    if (imported) {
      const d: ContentDraft = {
        ...newDraft(),
        title: imported.title,
        platform: imported.platform,
        format: imported.format,
        body: imported.body,
        notes: imported.notes ?? '',
      }
      const next = [d, ...list]
      setDrafts(next)
      setActiveId(d.id)
      applyToForm(d)
      persistDrafts(next)
      addToast('콘텐츠 가이드에서 스크립트를 불러왔습니다', 'success')
      return
    }

    if (list.length === 0) {
      const d = newDraft()
      setDrafts([d])
      setActiveId(d.id)
      applyToForm(d)
      persistDrafts([d])
      return
    }
    setDrafts(list)
    const first = list[0]
    setActiveId(first.id)
    applyToForm(first)
  }, [applyToForm, addToast])

  useEffect(() => {
    if (drafts.length === 0) return
    persistDrafts(drafts)
  }, [drafts])

  const saveNow = useCallback(() => {
    if (activeId == null) return
    const now = new Date().toISOString()
    setDrafts(prev =>
      prev.map(d =>
        d.id === activeId ? { ...d, title, platform, format, body, notes, updatedAt: now } : d,
      ),
    )
    addToast('초안이 저장되었습니다', 'success')
  }, [activeId, title, platform, format, body, notes, addToast])

  const selectDraft = (id: string) => {
    const merged = mergeFormIntoDrafts(drafts)
    setDrafts(merged)
    const d = merged.find(x => x.id === id)
    if (!d) return
    setActiveId(id)
    applyToForm(d)
    setShowAiPanel(false)
  }

  const createDraft = (prefill?: Partial<ContentDraft>) => {
    const merged = mergeFormIntoDrafts(drafts)
    const d: ContentDraft = { ...newDraft(), ...prefill }
    setDrafts([d, ...merged])
    setActiveId(d.id)
    applyToForm(d)
    addToast('새 초안이 만들어졌습니다', 'info')
  }

  const deleteDraft = (id: string) => {
    const merged = mergeFormIntoDrafts(drafts)
    if (merged.length <= 1) {
      addToast('마지막 초안은 삭제할 수 없습니다', 'warning')
      return
    }
    const next = merged.filter(d => d.id !== id)
    setDrafts(next)
    if (activeId === id) {
      setActiveId(next[0].id)
      applyToForm(next[0])
    }
    addToast('초안 삭제됨', 'info')
  }

  const copyAll = async () => {
    const block = [`# ${title || '(제목 없음)'}`, `포맷: ${FORMAT_META[format]?.label ?? format}`, '', body, '', notes].join('\n')
    try {
      await navigator.clipboard.writeText(block)
      addToast('클립보드에 복사됐습니다', 'success')
    } catch {
      addToast('복사 실패', 'warning')
    }
  }

  const exportTxt = () => {
    const block = [`# ${title || '(제목 없음)'}`, `포맷: ${FORMAT_META[format]?.label}`, '', body, '', notes].join('\n\n')
    const blob = new Blob([block], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${(title || 'draft').slice(0, 40).replace(/\s+/g, '_')}.txt`
    a.click()
    URL.revokeObjectURL(url)
    addToast('.txt 내보내기 완료', 'success')
  }

  const goGuide = () => {
    setDrafts(mergeFormIntoDrafts(drafts))
    const p = new URLSearchParams(searchParams.toString())
    p.set('view', 'content-guide')
    router.push(`${pathname}?${p.toString()}`)
  }

  // AI 생성 결과 적용
  const handleApply = (generatedBody: string, generatedTitle?: string) => {
    if (generatedTitle) setTitle(generatedTitle)
    setBody(generatedBody)
    const now = new Date().toISOString()
    setDrafts(prev =>
      prev.map(d =>
        d.id === activeId
          ? { ...d, title: generatedTitle ?? d.title, body: generatedBody, format, updatedAt: now }
          : d,
      ),
    )
    addToast('초안에 적용됐습니다', 'success')
    setShowAiPanel(false)
  }

  // AI 생성 결과 → 새 초안
  const handleNewDraft = (generatedBody: string, generatedTitle: string, generatedFormat: ContentFormat) => {
    createDraft({ body: generatedBody, title: generatedTitle, format: generatedFormat, derivedFromId: activeId ?? undefined })
    addToast('새 초안으로 저장됐습니다', 'success')
    setShowAiPanel(false)
  }

  const activeDraft = drafts.find(d => d.id === activeId)
  const FORMATS_OPTIONS: Array<ContentFormat | 'script'> = ['longform', 'shortform', 'carousel', 'blog', 'sns-caption', 'script']

  return (
    <div className="space-y-6 max-w-6xl">
      <N8nLv1ServicesSection viewId="content-studio" addToast={addToast} />

      <div className="flex flex-col lg:flex-row gap-6">
        {/* ─ 사이드바: 초안 목록 ─ */}
        <aside className="lg:w-56 shrink-0 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">초안 목록</p>
            <button
              type="button"
              onClick={() => createDraft()}
              className="text-xs px-2 py-1 rounded-lg bg-violet-600 text-white font-semibold hover:bg-violet-700"
            >
              + 새 초안
            </button>
          </div>
          <ul className="space-y-1 max-h-64 lg:max-h-[32rem] overflow-y-auto">
            {drafts.map(d => (
              <li key={d.id}>
                <div className="flex items-stretch gap-1">
                  <button
                    type="button"
                    onClick={() => selectDraft(d.id)}
                    className={`flex-1 text-left px-3 py-2 rounded-xl text-sm transition border ${
                      d.id === activeId
                        ? 'border-violet-500 bg-violet-50 dark:bg-violet-950/40 text-violet-900 dark:text-violet-100 font-semibold'
                        : 'border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-800 dark:text-gray-200'
                    }`}
                  >
                    <span className="flex items-center gap-1 text-[10px] text-gray-400 mb-0.5">
                      <span>{FORMAT_META[d.format]?.icon ?? '📄'}</span>
                      <span>{FORMAT_META[d.format]?.label ?? d.format}</span>
                      {d.derivedFromId && <span title="파생 초안">↳</span>}
                    </span>
                    <span className="line-clamp-2 text-xs">{d.title || '(제목 없음)'}</span>
                    <span className="block text-[10px] text-gray-400 mt-1">
                      {new Date(d.updatedAt).toLocaleString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteDraft(d.id)}
                    className="px-2 rounded-xl border border-gray-200 dark:border-gray-600 text-gray-400 hover:text-red-500 text-xs"
                    aria-label="삭제"
                  >
                    ✕
                  </button>
                </div>
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={goGuide}
            className="w-full py-2 text-xs font-medium rounded-xl border border-dashed border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
          >
            ← 콘텐츠 가이드
          </button>
        </aside>

        {/* ─ 메인 에디터 ─ */}
        <div className="flex-1 space-y-4 min-w-0">
          {/* 툴바 */}
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={saveNow}
              className="px-4 py-2 rounded-xl text-sm font-semibold bg-gray-900 dark:bg-white text-white dark:text-gray-900">
              저장
            </button>
            <button type="button" onClick={copyAll}
              className="px-4 py-2 rounded-xl text-sm font-medium border border-gray-300 dark:border-gray-600">
              전체 복사
            </button>
            <button type="button" onClick={exportTxt}
              className="px-4 py-2 rounded-xl text-sm font-medium border border-gray-300 dark:border-gray-600">
              .txt
            </button>
            <button
              type="button"
              onClick={() => setShowAiPanel(v => !v)}
              className={`ml-auto px-4 py-2 rounded-xl text-sm font-bold transition ${
                showAiPanel
                  ? 'bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300 border border-violet-300'
                  : 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-sm hover:shadow-md'
              }`}
            >
              {showAiPanel ? '✨ AI 패널 닫기' : '✨ AI 생성'}
            </button>
          </div>

          {/* AI 패널 */}
          {showAiPanel && (
            <AiGeneratePanel
              currentBody={body}
              currentFormat={format}
              addToast={addToast}
              onApply={handleApply}
              onNewDraft={handleNewDraft}
            />
          )}

          {/* 포맷 정보 배너 */}
          {activeDraft && (
            <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 dark:bg-gray-800/50 rounded-xl text-xs text-gray-500">
              <span className="text-base">{FORMAT_META[format]?.icon}</span>
              <span className="font-medium text-gray-700 dark:text-gray-300">{FORMAT_META[format]?.label}</span>
              <span className="text-gray-400">—</span>
              <span>{FORMAT_META[format]?.desc}</span>
              {activeDraft.derivedFromId && (
                <span className="ml-auto text-violet-500">↳ 파생 초안</span>
              )}
            </div>
          )}

          <input
            type="text"
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="제목"
            className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-lg font-bold text-gray-900 dark:text-white placeholder:text-gray-400"
          />

          <div className="grid sm:grid-cols-2 gap-3">
            <label className="block">
              <span className="text-xs font-semibold text-gray-500 mb-1 block">플랫폼</span>
              <select value={platform} onChange={e => setPlatform(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm">
                {PLATFORMS.map(p => <option key={p.value} value={p.value}>{p.icon} {p.label}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-gray-500 mb-1 block">포맷</span>
              <select value={format} onChange={e => setFormat(e.target.value as ContentFormat | 'script')}
                className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm">
                {FORMATS_OPTIONS.map(f => (
                  <option key={f} value={f}>{FORMAT_META[f]?.icon} {FORMAT_META[f]?.label}</option>
                ))}
              </select>
            </label>
          </div>

          <label className="block">
            <span className="text-xs font-semibold text-gray-500 mb-1 block">본문 · 대본 · 개요</span>
            <textarea
              value={body}
              onChange={e => setBody(e.target.value)}
              rows={14}
              placeholder="AI 생성 버튼으로 초안을 채우거나, 직접 작성하세요. 장면 나눔은 --- 로 구분해 두면 편합니다."
              className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-gray-100 font-mono leading-relaxed resize-y min-h-[12rem]"
            />
          </label>

          <label className="block">
            <span className="text-xs font-semibold text-gray-500 mb-1 block">메모 (촬영·썸네일·링크 등)</span>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={3}
              placeholder="촬영 일정, 레퍼런스 URL, 자막 키워드…"
              className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-gray-100 resize-y"
            />
          </label>

          <p className="text-xs text-gray-400">
            초안은 이 브라우저 localStorage에 저장됩니다.
          </p>
        </div>
      </div>
    </div>
  )
}
