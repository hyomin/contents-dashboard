'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import type { AddToast } from '@/lib/dashboard/dashboard-types'
import { N8nLv1ServicesSection } from '@/components/dashboard/n8n-lv1-services-section'

const STORAGE_KEY = 'content-studio-drafts-v1'

export interface ContentDraft {
  id: string
  title: string
  platform: string
  format: string
  body: string
  notes: string
  updatedAt: string
}

const PLATFORMS = [
  { value: 'youtube', label: 'YouTube' },
  { value: 'tiktok', label: 'TikTok' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'naver-blog', label: '네이버 블로그' },
  { value: 'tistory', label: '티스토리' },
  { value: 'shorts-reels', label: '숏폼 (Shorts/Reels)' },
] as const

const FORMATS = [
  { value: 'longform', label: '롱폼 영상 / 장문' },
  { value: 'shortform', label: '숏폼 / 릴스' },
  { value: 'carousel', label: '카드뉴스·캐러셀' },
  { value: 'blog', label: '블로그 포스팅' },
  { value: 'script', label: '대본만 (공용)' },
] as const

function newDraft(): ContentDraft {
  const id =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `draft-${Date.now()}`
  return {
    id,
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

export default function ContentStudioView({ addToast }: { addToast: AddToast }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [drafts, setDrafts] = useState<ContentDraft[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const [platform, setPlatform] = useState('youtube')
  const [format, setFormat] = useState('longform')
  const [body, setBody] = useState('')
  const [notes, setNotes] = useState('')

  const applyToForm = useCallback((d: ContentDraft) => {
    setTitle(d.title)
    setPlatform(d.platform)
    setFormat(d.format)
    setBody(d.body)
    setNotes(d.notes)
  }, [])

  function mergeFormIntoDrafts(list: ContentDraft[]): ContentDraft[] {
    const now = new Date().toISOString()
    if (activeId == null) return list
    return list.map(d =>
      d.id === activeId ? { ...d, title, platform, format, body, notes, updatedAt: now } : d,
    )
  }

  useEffect(() => {
    const list = loadDrafts()
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
  }, [applyToForm])

  useEffect(() => {
    if (drafts.length === 0) return
    persistDrafts(drafts)
  }, [drafts])

  const saveNow = useCallback(() => {
    if (activeId == null) return
    const now = new Date().toISOString()
    setDrafts(prev =>
      prev.map(d =>
        d.id === activeId
          ? { ...d, title, platform, format, body, notes, updatedAt: now }
          : d,
      ),
    )
    addToast('초안이 저장되었습니다 (이 브라우저)', 'success')
  }, [activeId, title, platform, format, body, notes, addToast])

  const selectDraft = (id: string) => {
    const merged = mergeFormIntoDrafts(drafts)
    setDrafts(merged)
    const d = merged.find(x => x.id === id)
    if (!d) return
    setActiveId(id)
    applyToForm(d)
  }

  const createDraft = () => {
    const merged = mergeFormIntoDrafts(drafts)
    const d = newDraft()
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
    const block = [
      `# ${title || '(제목 없음)'}`,
      `플랫폼: ${PLATFORMS.find(p => p.value === platform)?.label ?? platform}`,
      `포맷: ${FORMATS.find(f => f.value === format)?.label ?? format}`,
      '',
      '--- 본문 ---',
      body,
      '',
      '--- 메모 ---',
      notes,
    ].join('\n')
    try {
      await navigator.clipboard.writeText(block)
      addToast('전체 초안이 클립보드에 복사되었습니다', 'success')
    } catch {
      addToast('복사에 실패했습니다', 'warning')
    }
  }

  const exportTxt = () => {
    const block = [
      `# ${title || '(제목 없음)'}`,
      `플랫폼: ${PLATFORMS.find(p => p.value === platform)?.label ?? platform}`,
      `포맷: ${FORMATS.find(f => f.value === format)?.label ?? format}`,
      '',
      body,
      '',
      notes,
    ].join('\n\n')
    const blob = new Blob([block], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${(title || 'draft').slice(0, 40).replace(/\s+/g, '_')}.txt`
    a.click()
    URL.revokeObjectURL(url)
    addToast('.txt 파일로 내보냈습니다', 'success')
  }

  const goGuide = () => {
    setDrafts(mergeFormIntoDrafts(drafts))
    const p = new URLSearchParams(searchParams.toString())
    p.set('view', 'content-guide')
    router.push(`${pathname}?${p.toString()}`)
  }

  return (
    <div className="space-y-6 max-w-6xl">
      <N8nLv1ServicesSection viewId="content-studio" addToast={addToast} />

      <div className="flex flex-col lg:flex-row gap-6">
      <aside className="lg:w-56 shrink-0 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">초안 목록</p>
          <button
            type="button"
            onClick={createDraft}
            className="text-xs px-2 py-1 rounded-lg bg-violet-600 text-white font-semibold hover:bg-violet-700"
          >
            + 새 초안
          </button>
        </div>
        <ul className="space-y-1 max-h-64 lg:max-h-[28rem] overflow-y-auto">
          {drafts.map(d => (
            <li key={d.id}>
              <div className="flex items-stretch gap-1">
                <button
                  type="button"
                  onClick={() => selectDraft(d.id)}
                  className={`flex-1 text-left px-3 py-2 rounded-xl text-sm transition border
                    ${
                      d.id === activeId
                        ? 'border-violet-500 bg-violet-50 dark:bg-violet-950/40 text-violet-900 dark:text-violet-100 font-semibold'
                        : 'border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-800 dark:text-gray-200'
                    }`}
                >
                  <span className="line-clamp-2">{d.title || '(제목 없음)'}</span>
                  <span className="block text-[10px] text-gray-400 mt-1">
                    {new Date(d.updatedAt).toLocaleString('ko-KR', {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
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

      <div className="flex-1 space-y-4 min-w-0">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={saveNow}
            className="px-4 py-2 rounded-xl text-sm font-semibold bg-gray-900 dark:bg-white text-white dark:text-gray-900"
          >
            저장
          </button>
          <button
            type="button"
            onClick={copyAll}
            className="px-4 py-2 rounded-xl text-sm font-medium border border-gray-300 dark:border-gray-600"
          >
            전체 복사
          </button>
          <button
            type="button"
            onClick={exportTxt}
            className="px-4 py-2 rounded-xl text-sm font-medium border border-gray-300 dark:border-gray-600"
          >
            .txt 내보내기
          </button>
        </div>

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
            <select
              value={platform}
              onChange={e => setPlatform(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm"
            >
              {PLATFORMS.map(p => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-xs font-semibold text-gray-500 mb-1 block">포맷</span>
            <select
              value={format}
              onChange={e => setFormat(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm"
            >
              {FORMATS.map(f => (
                <option key={f.value} value={f.value}>
                  {f.label}
                </option>
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
            placeholder="여기에 실제로 쓸 문장을 적습니다. 장면 나눔은 --- 로 구분해 두면 편합니다."
            className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-gray-100 font-mono leading-relaxed resize-y min-h-[12rem]"
          />
        </label>

        <label className="block">
          <span className="text-xs font-semibold text-gray-500 mb-1 block">메모 (촬영·썸네일·링크 등)</span>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            rows={4}
            placeholder="촬영 일정, 레퍼런스 URL, 자막에 넣을 키워드…"
            className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-gray-100 resize-y"
          />
        </label>

        <p className="text-xs text-gray-400">
          초안은 이 브라우저의 localStorage에만 저장됩니다. 다른 기기나 시크릿 창과는 공유되지 않습니다.
        </p>
      </div>
      </div>
    </div>
  )
}
