'use client'

import { useState, useEffect } from 'react'
import { getCategoryStyle } from '@/lib/dashboard/categories'
import type { Category } from '@/lib/dashboard/categories'
import { Spinner } from '@/components/dashboard/ui/loading'

// ─── 타입 ────────────────────────────────────────────────────
interface RefUrl {
  id: string
  url: string
  title: string
  vsAvg: string
}

interface Suggestion {
  title: string
  hook: string
  structure: string[]
  keywords: string[]
  estimatedVsAvg: string
  reasoning: string
}

interface SuggestResult {
  category: string
  platform: string
  suggestions: Suggestion[]
  analyzedAt: string
}


const PLATFORMS = [
  { value: 'youtube',    label: 'YouTube',      icon: '🔴' },
  { value: 'instagram',  label: 'Instagram',    icon: '💗' },
  { value: 'naver-blog', label: '네이버 블로그', icon: '🟢' },
  { value: 'tistory',    label: '티스토리',      icon: '🟠' },
]

function detectPlatform(url: string) {
  if (url.includes('youtube.com') || url.includes('youtu.be')) return '🔴 YouTube'
  if (url.includes('instagram.com')) return '💗 Instagram'
  if (url.includes('blog.naver.com')) return '🟢 네이버 블로그'
  if (url.includes('tistory.com')) return '🟠 티스토리'
  return '🔗 기타'
}

// ─── 결과 카드 ────────────────────────────────────────────────
function SuggestionCard({
  s, index, onAddCalendar,
}: {
  s: Suggestion
  index: number
  onAddCalendar: (title: string) => void
}) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
      <div className="p-5">
        <div className="flex items-start gap-3 mb-3">
          <span className="w-7 h-7 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center shrink-0">{index + 1}</span>
          <div className="flex-1">
            <p className="font-bold text-gray-900 dark:text-white text-sm leading-snug">{s.title}</p>
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded-full font-medium">
                예상 vs.Avg {s.estimatedVsAvg}
              </span>
              {s.keywords.map(k => (
                <span key={k} className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded-full">#{k}</span>
              ))}
            </div>
          </div>
        </div>

        {/* 훅 */}
        <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-xl p-3 mb-3">
          <p className="text-xs font-semibold text-yellow-700 dark:text-yellow-400 mb-1">⚡ 오프닝 훅</p>
          <p className="text-xs text-yellow-800 dark:text-yellow-300">{s.hook}</p>
        </div>

        {/* 구성 토글 */}
        <button
          onClick={() => setExpanded(p => !p)}
          className="w-full text-xs text-gray-500 hover:text-blue-600 flex items-center justify-between py-1 transition"
        >
          <span>📋 콘텐츠 구성 보기</span>
          <span className={`transition-transform ${expanded ? 'rotate-180' : ''}`}>▼</span>
        </button>

        {expanded && (
          <div className="mt-3 space-y-1.5">
            {s.structure.map((step, i) => (
              <div key={i} className="flex items-start gap-2">
                <span className="w-5 h-5 rounded bg-blue-100 text-blue-700 text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">{i + 1}</span>
                <p className="text-xs text-gray-700 dark:text-gray-300">{step}</p>
              </div>
            ))}
          </div>
        )}

        {/* AI 근거 */}
        <div className="mt-3 flex items-start gap-2">
          <span className="text-xs text-blue-400 shrink-0">🔍</span>
          <p className="text-xs text-gray-400 italic">{s.reasoning}</p>
        </div>
      </div>

      {/* 액션 버튼 */}
      <div className="px-5 py-3 bg-gray-50 dark:bg-gray-700 flex gap-2 border-t border-gray-100 dark:border-gray-600">
        <button
          onClick={() => onAddCalendar(s.title)}
          className="flex-1 py-2 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium"
        >
          📅 캘린더 추가
        </button>
        <button
          onClick={() => navigator.clipboard?.writeText(s.title)}
          className="px-4 py-2 text-xs bg-white border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50 transition"
        >
          복사
        </button>
      </div>
    </div>
  )
}

// ─── 메인 뷰 ─────────────────────────────────────────────────
export default function TopicSuggestView({
  addToast,
}: {
  addToast: (m: string, t?: 'success' | 'info' | 'warning') => void
}) {
  const [categories, setCategories] = useState<Category[]>([])
  const [categoryId, setCategoryId] = useState('')
  const [platform, setPlatform] = useState('youtube')

  useEffect(() => {
    fetch('/api/dashboard/benchmark-categories')
      .then(r => r.json())
      .then((data: { id: string; name: string; bg_color: string; text_color: 'auto' | 'white' | 'dark'; created_at: string }[]) => {
        const cats: Category[] = data.map(c => ({
          id: c.id, name: c.name, bgColor: c.bg_color, textColor: c.text_color, createdAt: c.created_at?.slice(0, 10) ?? '',
        }))
        setCategories(cats)
        if (cats.length > 0) setCategoryId(cats[0].id)
      })
      .catch(() => {})
  }, [])
  const [urls, setUrls] = useState<RefUrl[]>([
    { id: '1', url: 'https://www.youtube.com/watch?v=example1', title: '2024 경제 전망 - 금리 인상의 끝은?', vsAvg: '5.2' },
    { id: '2', url: 'https://www.youtube.com/watch?v=example2', title: '부동산 투자 가이드 - 초보자도 쉽게', vsAvg: '4.1' },
  ])
  const [newUrl, setNewUrl] = useState('')
  const [newTitle, setNewTitle] = useState('')
  const [newVsAvg, setNewVsAvg] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<SuggestResult | null>(null)
  const [mode, setMode] = useState<'gemini' | 'n8n' | 'error' | null>(null)

  const selectedCat = categories.find(c => c.id === categoryId)
  const catStyle = selectedCat ? getCategoryStyle(selectedCat) : null

  const addUrl = () => {
    if (!newUrl.trim()) return
    setUrls(prev => [...prev, {
      id: Date.now().toString(),
      url: newUrl.trim(),
      title: newTitle.trim() || newUrl.trim(),
      vsAvg: newVsAvg.trim() || '?',
    }])
    setNewUrl('')
    setNewTitle('')
    setNewVsAvg('')
  }

  const removeUrl = (id: string) => setUrls(prev => prev.filter(u => u.id !== id))

  const handleSuggest = async () => {
    if (urls.length === 0) {
      addToast('레퍼런스 URL을 최소 1개 추가해주세요', 'warning')
      return
    }
    setLoading(true)
    setResult(null)
    try {
      const res = await fetch('/api/topic-suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ categoryId, category: selectedCat?.name, platform, urls }),
      })
      const data = await res.json() as SuggestResult & { mode?: string; error?: string }
      if (!res.ok || data.error) {
        addToast(data.error ?? 'AI 분석 실패. GEMINI_API_KEY를 확인해주세요', 'warning')
        setMode('error')
      } else {
        setResult({ ...data, analyzedAt: new Date().toLocaleTimeString('ko-KR') })
        setMode((data.mode as 'gemini' | 'n8n') ?? 'gemini')
        addToast('주제 분석 완료! 추천 결과를 확인하세요 🎯', 'success')
      }
    } catch {
      addToast('네트워크 오류가 발생했습니다', 'warning')
      setMode('error')
    }
    setLoading(false)
  }

  return (
    <div className="space-y-6">
      {/* 연동 상태 배너 */}
      <div className={`flex items-center gap-3 px-5 py-3 rounded-xl text-sm
        ${mode === 'n8n' ? 'bg-green-50 border border-green-200'
          : mode === 'gemini' ? 'bg-blue-50 border border-blue-200'
          : mode === 'error' ? 'bg-red-50 border border-red-200'
          : 'bg-gray-50 border border-gray-200'}`}>
        <span className={`w-2 h-2 rounded-full
          ${mode === 'n8n' ? 'bg-green-500 animate-pulse'
            : mode === 'gemini' ? 'bg-blue-500 animate-pulse'
            : mode === 'error' ? 'bg-red-400'
            : 'bg-gray-300'}`} />
        <span className={
          mode === 'n8n' ? 'text-green-700'
          : mode === 'gemini' ? 'text-blue-700'
          : mode === 'error' ? 'text-red-700'
          : 'text-gray-500'}>
          {mode === 'n8n' ? 'n8n 연결됨 · 실제 AI 분석 활성화'
            : mode === 'gemini' ? 'Gemini 2.5 Flash · AI 주제 분석 활성화'
            : mode === 'error' ? 'AI 분석 불가 · GEMINI_API_KEY 또는 N8N_WEBHOOK_URL을 확인해주세요'
            : 'AI 주제 분석 준비 완료 · 레퍼런스 URL을 추가하고 분석을 시작해주세요'}
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ─ 입력 패널 ─ */}
        <div className="space-y-5">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm p-5 space-y-4">
            <h3 className="font-bold text-gray-900 dark:text-white">⚙️ 분석 설정</h3>

            {/* 주제 카테고리 */}
            <div>
              <label className="text-xs font-semibold text-gray-500 mb-2 block">주제 카테고리</label>
              {categories.length === 0 && (
                <p className="text-xs text-gray-400">
                  카테고리가 없습니다.{' '}
                  <a href="/dashboard?view=benchmark" className="text-blue-500 hover:underline">채널·콘텐츠 등록</a>
                  에서 카테고리를 먼저 추가해주세요.
                </p>
              )}
              <div className="flex flex-wrap gap-2">
                {categories.map(cat => {
                  const style = getCategoryStyle(cat)
                  const isActive = categoryId === cat.id
                  return (
                    <button
                      key={cat.id}
                      onClick={() => setCategoryId(cat.id)}
                      className="px-3 py-1.5 text-sm rounded-xl font-medium transition border"
                      style={isActive ? style : { background: 'white', color: '#6b7280', borderColor: '#e5e7eb' }}
                    >
                      {cat.name}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* 플랫폼 */}
            <div>
              <label className="text-xs font-semibold text-gray-500 mb-2 block">대상 플랫폼</label>
              <div className="flex gap-2 flex-wrap">
                {PLATFORMS.map(p => (
                  <button
                    key={p.value}
                    onClick={() => setPlatform(p.value)}
                    className={`px-3 py-1.5 text-sm rounded-xl border font-medium transition
                      ${platform === p.value ? 'bg-gray-900 text-white border-gray-900' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                  >
                    {p.icon} {p.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* 레퍼런스 URL */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-gray-900 dark:text-white">🔗 레퍼런스 콘텐츠</h3>
              <span className="text-xs text-gray-400">{urls.length}개 추가됨</span>
            </div>

            {/* 기존 URL 목록 */}
            <div className="space-y-2 mb-4">
              {urls.map(u => (
                <div key={u.id} className="flex items-center gap-2 p-3 bg-gray-50 dark:bg-gray-700 rounded-xl group">
                  <span className="text-sm shrink-0">{detectPlatform(u.url).split(' ')[0]}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-gray-800 dark:text-gray-200 truncate">{u.title}</p>
                    <p className="text-xs text-gray-400 truncate">{u.url}</p>
                  </div>
                  {u.vsAvg !== '?' && (
                    <span className="text-xs font-bold text-green-600 shrink-0">{u.vsAvg}x</span>
                  )}
                  <button
                    onClick={() => removeUrl(u.id)}
                    className="text-gray-300 hover:text-red-500 text-xs opacity-0 group-hover:opacity-100 transition shrink-0"
                  >
                    ✕
                  </button>
                </div>
              ))}
              {urls.length === 0 && (
                <p className="text-center text-sm text-gray-400 py-4">URL을 추가해주세요</p>
              )}
            </div>

            {/* 새 URL 추가 */}
            <div className="border-t border-gray-100 dark:border-gray-700 pt-4 space-y-2">
              <input
                value={newUrl}
                onChange={e => setNewUrl(e.target.value)}
                placeholder="https://www.youtube.com/watch?v=..."
                className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white"
              />
              <div className="flex gap-2">
                <input
                  value={newTitle}
                  onChange={e => setNewTitle(e.target.value)}
                  placeholder="콘텐츠 제목 (선택)"
                  className="flex-1 px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white"
                />
                <input
                  value={newVsAvg}
                  onChange={e => setNewVsAvg(e.target.value)}
                  placeholder="vs.Avg"
                  className="w-20 px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white"
                />
              </div>
              <button
                onClick={addUrl}
                disabled={!newUrl.trim()}
                className="w-full py-2 text-sm border border-dashed border-gray-300 text-gray-500 rounded-xl hover:border-blue-400 hover:text-blue-500 disabled:opacity-40 transition"
              >
                + URL 추가
              </button>
            </div>
          </div>

          {/* 실행 버튼 */}
          <button
            onClick={handleSuggest}
            disabled={loading || urls.length === 0}
            className={`w-full py-4 rounded-2xl text-base font-bold transition
              ${loading
                ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                : 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:from-blue-700 hover:to-indigo-700 shadow-lg hover:shadow-xl'
              }`}
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <Spinner size="sm" color="border-gray-400" />
                AI가 패턴을 분석하고 있습니다…
              </span>
            ) : (
              '🎯 주제 선정 시작'
            )}
          </button>
        </div>

        {/* ─ 결과 패널 ─ */}
        <div className="space-y-4">
          {!result && !loading && (
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm p-10 flex flex-col items-center justify-center text-center h-full min-h-64">
              <span className="text-5xl mb-4">🎯</span>
              <p className="text-base font-semibold text-gray-700 dark:text-gray-300">주제 선정 대기 중</p>
              <p className="text-sm text-gray-400 mt-2">
                레퍼런스 URL을 추가하고<br />"주제 선정 시작" 버튼을 눌러주세요
              </p>
            </div>
          )}

          {loading && (
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm p-10 flex flex-col items-center justify-center text-center min-h-64">
              <Spinner size="xl" color="border-blue-500" className="mb-5" />
              <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">패턴 분석 중...</p>
              <div className="mt-4 space-y-1.5 text-xs text-gray-400">
                <p>✅ 레퍼런스 콘텐츠 수집</p>
                <p>✅ vs.Avg 패턴 분석</p>
                <p className="animate-pulse">⏳ 제목·구성안 생성 중...</p>
              </div>
            </div>
          )}

          {result && (
            <>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-bold text-gray-900 dark:text-white">
                    추천 결과 {result.suggestions.length}개
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {result.category} · {result.platform} · {result.analyzedAt} 분석
                  </p>
                </div>
                <button
                  onClick={() => setResult(null)}
                  className="text-xs text-gray-400 hover:text-gray-600 px-3 py-1 border border-gray-200 rounded-lg"
                >
                  초기화
                </button>
              </div>
              {result.suggestions.map((s, i) => (
                <SuggestionCard
                  key={i}
                  s={s}
                  index={i}
                  onAddCalendar={title => addToast(`"${title.slice(0, 20)}..." 캘린더에 추가됐습니다 📅`, 'success')}
                />
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
