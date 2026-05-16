'use client'

import { useState } from 'react'
import { DEFAULT_CATEGORIES, getCategoryStyle } from '@/lib/categories'

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

// ─── 더미 결과 생성기 ─────────────────────────────────────────
const DUMMY_RESULTS: Record<string, Suggestion[]> = {
  'cat-1': [
    {
      title: '2025 금리 동결 이후 재테크 전략 TOP 5 (지금 당장 해야 할 것)',
      hook: '첫 15초: "금리 동결이 오히려 더 위험한 이유" — 반전 오프닝으로 시청 유지율 극대화',
      structure: ['인트로: 현재 금리 수치 + 충격적 전망 제시', '본론1: 예금/적금 전략 변화', '본론2: 채권·달러 투자 시점', '본론3: 부동산 관망 vs 매수 판단', '결론: 개인 상황별 체크리스트 + CTA'],
      keywords: ['금리 동결', '재테크 2025', '금리 인하', '투자 전략'],
      estimatedVsAvg: '3.8x ~ 5.5x',
      reasoning: '수집된 레퍼런스 중 "금리" 키워드 + "숫자 나열" 제목 패턴이 평균 4.2x 기록. 현재 시의성과 결합',
    },
    {
      title: '월급쟁이가 진짜 부자 되는 법 - 재테크 전문가가 알려주는 3단계',
      hook: '"당신이 지금 하는 저축이 오히려 가난해지는 이유" — 역설 오프닝',
      structure: ['인트로: 평범한 직장인의 10년 후 시뮬레이션', '본론1: 1단계 - 부채 최적화', '본론2: 2단계 - 시드머니 만들기', '본론3: 3단계 - 레버리지 투자', '결론: 나이별 포트폴리오 제안'],
      keywords: ['월급쟁이 재테크', '부자 되는 법', '직장인 투자'],
      estimatedVsAvg: '4.1x ~ 6.0x',
      reasoning: '"월급쟁이/직장인 + 부자" 조합 제목이 레퍼런스에서 일관되게 높은 vs.Avg 기록',
    },
    {
      title: '2025 하반기 돈이 몰리는 곳은 여기 - 전문가 5인 공통 픽',
      hook: '전문가 의견 취합 구조 → 신뢰도 + 궁금증 동시 자극',
      structure: ['인트로: 경제 불확실성 현황', '본론: 전문가별 핵심 픽 소개', '비교표: 수익률 vs 리스크', '결론: 내 상황에 맞는 선택 가이드'],
      keywords: ['2025 투자', '전문가 추천', '하반기 재테크'],
      estimatedVsAvg: '3.2x ~ 4.5x',
      reasoning: '"전문가 N인" 형식이 신뢰 지표로 작용, 클릭율 상승 패턴 관찰됨',
    },
  ],
  'cat-2': [
    {
      title: '매일 30분으로 인생이 바뀌는 루틴 - 3개월 실험 결과 공개',
      hook: '실험 결과 공개 포맷 → 진정성 + 호기심 유발',
      structure: ['인트로: 3개월 전/후 비교', '본론1: 아침 루틴 5가지', '본론2: 실패한 것들', '결론: 당신에게 맞는 루틴 찾기'],
      keywords: ['자기계발 루틴', '아침 루틴', '생산성 향상'],
      estimatedVsAvg: '3.5x ~ 4.8x',
      reasoning: '"실험/결과 공개" 패턴이 진정성 있는 콘텐츠로 알고리즘 친화적',
    },
  ],
  'default': [
    {
      title: '지금 당장 시작해야 하는 이유 - 전문가가 말하는 핵심',
      hook: '긴박감 + 권위 호소 조합',
      structure: ['인트로: 문제 제기', '본론: 핵심 3가지', '결론: 실천 방법'],
      keywords: ['지금 시작', '전문가 조언'],
      estimatedVsAvg: '2.8x ~ 4.0x',
      reasoning: '선택한 레퍼런스 패턴 분석 기반 일반 제안',
    },
  ],
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
  const [categoryId, setCategoryId] = useState(DEFAULT_CATEGORIES[0]?.id ?? '')
  const [platform, setPlatform] = useState('youtube')
  const [urls, setUrls] = useState<RefUrl[]>([
    { id: '1', url: 'https://www.youtube.com/watch?v=example1', title: '2024 경제 전망 - 금리 인상의 끝은?', vsAvg: '5.2' },
    { id: '2', url: 'https://www.youtube.com/watch?v=example2', title: '부동산 투자 가이드 - 초보자도 쉽게', vsAvg: '4.1' },
  ])
  const [newUrl, setNewUrl] = useState('')
  const [newTitle, setNewTitle] = useState('')
  const [newVsAvg, setNewVsAvg] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<SuggestResult | null>(null)
  const [mode] = useState<'dummy' | 'n8n'>('dummy') // 실제 연동 시 'n8n'으로 변경

  const selectedCat = DEFAULT_CATEGORIES.find(c => c.id === categoryId)
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

    if (mode === 'dummy') {
      // 더미 모드: 2초 딜레이 후 목업 결과
      await new Promise(r => setTimeout(r, 2200))
      const suggestions = DUMMY_RESULTS[categoryId] ?? DUMMY_RESULTS['default']
      setResult({
        category: selectedCat?.name ?? '',
        platform,
        suggestions,
        analyzedAt: new Date().toLocaleTimeString('ko-KR'),
      })
      addToast('주제 분석 완료! 추천 결과를 확인하세요 🎯', 'success')
    } else {
      // 실제 n8n 연동 모드
      try {
        const res = await fetch('/api/topic-suggest', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ categoryId, category: selectedCat?.name, platform, urls }),
        })
        const data = await res.json()
        setResult({ ...data, analyzedAt: new Date().toLocaleTimeString('ko-KR') })
        addToast('주제 분석 완료! 🎯', 'success')
      } catch {
        addToast('n8n 연결 실패. .env.local의 WEBHOOK_URL을 확인해주세요', 'warning')
      }
    }
    setLoading(false)
  }

  return (
    <div className="space-y-6">
      {/* 연동 상태 배너 */}
      <div className={`flex items-center gap-3 px-5 py-3 rounded-xl text-sm
        ${mode === 'dummy' ? 'bg-yellow-50 border border-yellow-200' : 'bg-green-50 border border-green-200'}`}>
        <span className={`w-2 h-2 rounded-full ${mode === 'dummy' ? 'bg-yellow-400' : 'bg-green-500 animate-pulse'}`} />
        <span className={mode === 'dummy' ? 'text-yellow-700' : 'text-green-700'}>
          {mode === 'dummy'
            ? '더미 모드 · n8n 연동 전 미리보기 상태 (.env.local에 N8N_WEBHOOK_URL 추가 시 실제 분석)'
            : 'n8n 연결됨 · 실제 AI 분석 활성화'}
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
              <div className="flex flex-wrap gap-2">
                {DEFAULT_CATEGORIES.map(cat => {
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
                <span className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
                AI가 패턴을 분석하고 있습니다...
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
              <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mb-5" />
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
