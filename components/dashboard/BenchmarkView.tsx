'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Category, BenchmarkItem,
  getCategoryStyle, resolveTextColor, autoTextColor,
} from '@/lib/categories'

// ─── 타입 ─────────────────────────────────────────────────────
interface DBCategory {
  id: string
  name: string
  bg_color: string
  text_color: 'auto' | 'white' | 'dark'
  created_at: string
}

interface DBBenchmark {
  id: string
  url: string
  title: string
  memo: string
  category_id: string | null
  platform: string
  views: number | null
  vs_avg: number | null
  created_at: string
  benchmark_categories?: DBCategory | null
}

interface DBChannel {
  id: number
  channel_id: string
  channel_name: string
  platform: string
  subscribers: number | null
  avg_views: number | null
  total_videos: number | null
  updated_at: string
}

// ─── 헬퍼 ─────────────────────────────────────────────────────
const PLATFORMS = [
  { value: 'youtube',    label: 'YouTube',      icon: '🔴' },
  { value: 'instagram',  label: 'Instagram',    icon: '💗' },
  { value: 'naver-blog', label: '네이버 블로그', icon: '🟢' },
  { value: 'tistory',    label: '티스토리',      icon: '🟠' },
  { value: 'other',      label: '기타',          icon: '🔗' },
]

function getPlatformIcon(p: string) {
  return PLATFORMS.find(pl => pl.value === p)?.icon ?? '🔗'
}

function detectPlatform(url: string): BenchmarkItem['platform'] {
  if (url.includes('youtube.com') || url.includes('youtu.be')) return 'youtube'
  if (url.includes('instagram.com')) return 'instagram'
  if (url.includes('blog.naver.com')) return 'naver-blog'
  if (url.includes('tistory.com')) return 'tistory'
  return 'other'
}

function formatNum(v?: number | null) {
  if (v == null) return '-'
  return v >= 10000 ? `${(v / 10000).toFixed(1)}만` : v.toLocaleString()
}

function dbCatToCategory(c: DBCategory): Category {
  return {
    id: c.id,
    name: c.name,
    bgColor: c.bg_color,
    textColor: c.text_color,
    createdAt: c.created_at?.slice(0, 10) ?? '',
  }
}

function dbBenchmarkToItem(b: DBBenchmark): BenchmarkItem {
  const diff = Math.round((Date.now() - new Date(b.created_at).getTime()) / 86400000)
  const addedAt = diff === 0 ? '오늘' : `${diff}일 전`
  return {
    id: b.id,
    url: b.url,
    title: b.title,
    memo: b.memo ?? '',
    categoryId: b.category_id ?? '',
    platform: b.platform as BenchmarkItem['platform'],
    addedAt,
    views: b.views ?? undefined,
    vsAvg: b.vs_avg ? Number(b.vs_avg) : undefined,
  }
}

// ─── 카테고리 태그 ────────────────────────────────────────────
function CategoryTag({ cat, size = 'sm' }: { cat: Category; size?: 'xs' | 'sm' }) {
  const style = getCategoryStyle(cat)
  return (
    <span
      className={`inline-flex items-center rounded-full font-medium border ${size === 'xs' ? 'px-2 py-0.5 text-xs' : 'px-3 py-1 text-sm'}`}
      style={{ background: style.background, color: style.color, borderColor: style.border }}
    >
      {cat.name}
    </span>
  )
}

// ─── 카테고리 관리 모달 ───────────────────────────────────────
function CategoryManagerModal({
  categories,
  onSave,
  onClose,
}: {
  categories: Category[]
  onSave: (cats: Category[]) => void
  onClose: () => void
}) {
  const [list, setList] = useState<Category[]>(categories)
  const [newName, setNewName] = useState('')
  const [newBgColor, setNewBgColor] = useState('#3B82F6')
  const [newTextColor, setNewTextColor] = useState<Category['textColor']>('auto')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editBgColor, setEditBgColor] = useState('#3B82F6')
  const [editTextColor, setEditTextColor] = useState<Category['textColor']>('auto')

  const addCategory = () => {
    if (!newName.trim()) return
    const cat: Category = {
      id: `cat-${Date.now()}`,
      name: newName.trim(),
      bgColor: newBgColor,
      textColor: newTextColor,
      createdAt: new Date().toISOString().slice(0, 10),
    }
    setList(prev => [...prev, cat])
    setNewName('')
    setNewBgColor('#3B82F6')
    setNewTextColor('auto')
  }

  const removeCategory = (id: string) => setList(prev => prev.filter(c => c.id !== id))

  const startEdit = (cat: Category) => {
    setEditingId(cat.id)
    setEditName(cat.name)
    setEditBgColor(cat.bgColor)
    setEditTextColor(cat.textColor)
  }

  const saveEdit = (id: string) => {
    if (!editName.trim()) return
    setList(prev => prev.map(c => c.id === id
      ? { ...c, name: editName.trim(), bgColor: editBgColor, textColor: editTextColor }
      : c
    ))
    setEditingId(null)
  }

  const previewStyle = (bg: string, tc: Category['textColor']) => {
    const textCol = tc === 'white' ? '#ffffff' : tc === 'dark' ? '#1f2937' : autoTextColor(bg)
    const isLight = textCol === '#1f2937'
    return {
      background: isLight ? `${bg}40` : bg,
      color: textCol,
      borderColor: isLight ? `${bg}80` : bg,
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white">🏷️ 주제 카테고리 관리</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
        </div>

        {/* 새 카테고리 추가 */}
        <div className="bg-gray-50 dark:bg-gray-700 rounded-xl p-4 mb-5">
          <p className="text-xs font-semibold text-gray-500 mb-3">새 카테고리 추가</p>
          <input
            value={newName}
            onChange={e => setNewName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addCategory()}
            placeholder="카테고리명 입력 (예: 경제/재테크)"
            className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white mb-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <div className="flex items-center gap-3 mb-3">
            <label className="text-xs text-gray-500 whitespace-nowrap">배경색</label>
            <input
              type="color"
              value={newBgColor}
              onChange={e => setNewBgColor(e.target.value)}
              className="w-10 h-10 rounded-lg border border-gray-200 cursor-pointer p-0.5 bg-white"
            />
            <span className="text-xs font-mono text-gray-500 uppercase">{newBgColor}</span>
          </div>
          <div className="flex items-center gap-2 mb-3">
            <label className="text-xs text-gray-500 whitespace-nowrap">글씨색</label>
            {(['auto', 'white', 'dark'] as const).map(opt => (
              <button
                key={opt}
                onClick={() => setNewTextColor(opt)}
                className={`px-3 py-1 text-xs rounded-lg border font-medium transition
                  ${newTextColor === opt ? 'bg-blue-600 text-white border-blue-600' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}
              >
                {opt === 'auto' ? '자동' : opt === 'white' ? '⬜ 흰색' : '⬛ 검정'}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xs text-gray-500">미리보기:</span>
            <span className="px-3 py-1 text-sm rounded-full border font-medium" style={previewStyle(newBgColor, newTextColor)}>
              {newName || '카테고리명'}
            </span>
          </div>
          <button
            onClick={addCategory}
            disabled={!newName.trim()}
            className="w-full py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition"
          >
            + 추가
          </button>
        </div>

        {/* 카테고리 목록 */}
        <div className="space-y-2">
          {list.map(cat => {
            const style = getCategoryStyle(cat)
            return (
              <div key={cat.id} className="rounded-xl border border-gray-200 dark:border-gray-600 overflow-hidden">
                {editingId === cat.id ? (
                  <div className="p-4 bg-gray-50 dark:bg-gray-700 space-y-3">
                    <input
                      autoFocus
                      value={editName}
                      onChange={e => setEditName(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-blue-400 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <div className="flex items-center gap-3">
                      <label className="text-xs text-gray-500">배경색</label>
                      <input
                        type="color"
                        value={editBgColor}
                        onChange={e => setEditBgColor(e.target.value)}
                        className="w-9 h-9 rounded-lg border border-gray-200 cursor-pointer p-0.5 bg-white"
                      />
                      <span className="text-xs font-mono text-gray-500 uppercase">{editBgColor}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <label className="text-xs text-gray-500">글씨색</label>
                      {(['auto', 'white', 'dark'] as const).map(opt => (
                        <button
                          key={opt}
                          onClick={() => setEditTextColor(opt)}
                          className={`px-2.5 py-1 text-xs rounded-lg border font-medium transition
                            ${editTextColor === opt ? 'bg-blue-600 text-white border-blue-600' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                        >
                          {opt === 'auto' ? '자동' : opt === 'white' ? '⬜ 흰색' : '⬛ 검정'}
                        </button>
                      ))}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-500">미리보기:</span>
                      <span className="px-3 py-1 text-sm rounded-full border font-medium" style={previewStyle(editBgColor, editTextColor)}>
                        {editName || '카테고리명'}
                      </span>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => saveEdit(cat.id)} className="flex-1 py-1.5 bg-blue-600 text-white text-xs rounded-lg hover:bg-blue-700 transition">저장</button>
                      <button onClick={() => setEditingId(null)} className="flex-1 py-1.5 bg-gray-200 text-gray-700 text-xs rounded-lg hover:bg-gray-300 transition">취소</button>
                    </div>
                  </div>
                ) : (
                  <div className="p-3 flex items-center gap-3">
                    <span className="px-3 py-1 text-sm rounded-full border font-medium" style={{ background: style.background, color: style.color, borderColor: style.border }}>
                      {cat.name}
                    </span>
                    <span className="text-xs font-mono text-gray-400 flex-1">{cat.bgColor}</span>
                    <button onClick={() => startEdit(cat)} className="text-xs text-gray-400 hover:text-blue-500 px-2">수정</button>
                    <button onClick={() => removeCategory(cat.id)} className="text-xs text-gray-400 hover:text-red-500 px-2">삭제</button>
                  </div>
                )}
              </div>
            )
          })}
          {list.length === 0 && (
            <p className="text-center text-sm text-gray-400 py-4">카테고리가 없습니다</p>
          )}
        </div>

        <button
          onClick={() => { onSave(list); onClose() }}
          className="w-full mt-5 py-2.5 bg-gray-900 text-white text-sm rounded-xl hover:bg-gray-700 transition font-medium"
        >
          저장 완료
        </button>
      </div>
    </div>
  )
}

// ─── 벤치마킹 추가 모달 ──────────────────────────────────────
function AddBenchmarkModal({
  categories,
  onAdd,
  onClose,
}: {
  categories: Category[]
  onAdd: (item: BenchmarkItem) => void
  onClose: () => void
}) {
  const [url, setUrl] = useState('')
  const [title, setTitle] = useState('')
  const [memo, setMemo] = useState('')
  const [categoryId, setCategoryId] = useState(categories[0]?.id ?? '')
  const [views, setViews] = useState('')
  const [vsAvg, setVsAvg] = useState('')
  const [saving, setSaving] = useState(false)

  const platform = detectPlatform(url)
  const platformInfo = PLATFORMS.find(p => p.value === platform)
  const selectedCat = categories.find(c => c.id === categoryId)

  const handleAdd = async () => {
    if (!url.trim() || !title.trim() || !categoryId) return
    setSaving(true)
    const id = `bm-${Date.now()}`
    const payload = {
      id,
      url: url.trim(),
      title: title.trim(),
      memo: memo.trim(),
      category_id: categoryId,
      platform,
      views: views ? parseInt(views.replace(/,/g, '')) : null,
      vs_avg: vsAvg ? parseFloat(vsAvg) : null,
    }
    const res = await fetch('/api/dashboard/benchmarks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    setSaving(false)
    if (!res.ok) return
    onAdd({
      id,
      url: payload.url,
      title: payload.title,
      memo: payload.memo,
      categoryId: payload.category_id,
      platform: payload.platform as BenchmarkItem['platform'],
      addedAt: '방금',
      views: payload.views ?? undefined,
      vsAvg: payload.vs_avg ?? undefined,
    })
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-lg p-6" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white">🔖 콘텐츠(레퍼런스) 추가</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-gray-500 mb-1 block">콘텐츠 URL *</label>
            <div className="relative">
              <input
                value={url}
                onChange={e => setUrl(e.target.value)}
                placeholder="https://www.youtube.com/watch?v=..."
                className="w-full px-3 py-2.5 pr-24 text-sm border border-gray-200 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {url && (
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm">
                  {platformInfo?.icon} <span className="text-xs text-gray-400">{platformInfo?.label}</span>
                </span>
              )}
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500 mb-1 block">콘텐츠 제목 *</label>
            <input
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="콘텐츠 제목 입력"
              className="w-full px-3 py-2.5 text-sm border border-gray-200 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500 mb-1 block">주제 카테고리 *</label>
            <div className="flex items-center gap-2">
              <select
                value={categoryId}
                onChange={e => setCategoryId(e.target.value)}
                className="flex-1 px-3 py-2.5 text-sm border border-gray-200 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">카테고리 선택</option>
                {categories.map(cat => (
                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
              </select>
              {selectedCat && <CategoryTag cat={selectedCat} />}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-gray-500 mb-1 block">조회수 (선택)</label>
              <input
                value={views}
                onChange={e => setViews(e.target.value)}
                placeholder="예: 150000"
                className="w-full px-3 py-2.5 text-sm border border-gray-200 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 mb-1 block">vs.Avg (선택)</label>
              <input
                value={vsAvg}
                onChange={e => setVsAvg(e.target.value)}
                placeholder="예: 4.2"
                className="w-full px-3 py-2.5 text-sm border border-gray-200 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500 mb-1 block">분석 메모 (선택)</label>
            <textarea
              value={memo}
              onChange={e => setMemo(e.target.value)}
              placeholder="참고할 점, 등록 이유 등..."
              rows={2}
              className="w-full px-3 py-2.5 text-sm border border-gray-200 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>
        </div>
        <div className="flex gap-3 mt-6">
          <button
            onClick={handleAdd}
            disabled={!url.trim() || !title.trim() || !categoryId || saving}
            className="flex-1 py-2.5 bg-blue-600 text-white text-sm rounded-xl hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition font-medium"
          >
            {saving ? '저장 중...' : '저장'}
          </button>
          <button onClick={onClose} className="flex-1 py-2.5 bg-gray-100 text-gray-700 text-sm rounded-xl hover:bg-gray-200 transition">
            취소
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── 채널 추가 모달 ───────────────────────────────────────────
function AddChannelModal({
  onAdd,
  onClose,
}: {
  onAdd: (ch: DBChannel) => void
  onClose: () => void
}) {
  const [channelId, setChannelId] = useState('')
  const [channelName, setChannelName] = useState('')
  const [platform, setPlatform] = useState('youtube')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const handleAdd = async () => {
    const rawId = channelId.trim()
    const name = channelName.trim()
    if (!rawId || !name) return
    setSaving(true)
    setError('')

    // URL로 입력한 경우 channel_id 추출 (예: youtube.com/channel/UC...)
    const idMatch = rawId.match(/(?:channel\/|@)([\w-]+)/) ?? null
    const finalId = idMatch ? idMatch[1] : rawId

    const res = await fetch('/api/dashboard/channels', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ channel_id: finalId, channel_name: name, platform }),
    })
    setSaving(false)
    if (!res.ok) {
      const { error: msg } = await res.json()
      setError(msg ?? '등록 실패')
      return
    }
    const data = await res.json()
    onAdd(data)
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white">📡 채널 등록</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-gray-500 mb-1 block">플랫폼</label>
            <div className="flex gap-2">
              {PLATFORMS.filter(p => p.value !== 'other').map(p => (
                <button
                  key={p.value}
                  onClick={() => setPlatform(p.value)}
                  className={`flex items-center gap-1.5 px-3 py-2 text-sm rounded-xl border font-medium transition
                    ${platform === p.value ? 'bg-gray-900 text-white border-gray-900' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                >
                  <span>{p.icon}</span> {p.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-500 mb-1 block">
              채널 ID
              <span className="font-normal text-gray-400 ml-1">(예: UCsJ6RuBiTVWRX156FVbeaGg 또는 채널 URL)</span>
            </label>
            <input
              value={channelId}
              onChange={e => setChannelId(e.target.value)}
              placeholder="UC... 또는 https://youtube.com/channel/UC..."
              className="w-full px-3 py-2.5 text-sm border border-gray-200 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-500 mb-1 block">채널명 *</label>
            <input
              value={channelName}
              onChange={e => setChannelName(e.target.value)}
              placeholder="예: 슈카월드"
              className="w-full px-3 py-2.5 text-sm border border-gray-200 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {error && <p className="text-xs text-red-500">{error}</p>}

          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-3">
            <p className="text-xs text-blue-600 dark:text-blue-400">
              💡 채널을 등록한 뒤 목록의 <strong>데이터 수집</strong>을 누르면 구독자 수·조회수 등이 갱신됩니다. (또는 n8n 자동화로 일괄 수집)
            </p>
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button
            onClick={handleAdd}
            disabled={!channelId.trim() || !channelName.trim() || saving}
            className="flex-1 py-2.5 bg-blue-600 text-white text-sm rounded-xl hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition font-medium"
          >
            {saving ? '등록 중...' : '등록'}
          </button>
          <button onClick={onClose} className="flex-1 py-2.5 bg-gray-100 text-gray-700 text-sm rounded-xl hover:bg-gray-200 transition">
            취소
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── 수집 채널 현황 탭 ────────────────────────────────────────
function ChannelStatusTab({ addToast }: { addToast: (m: string, t?: 'success' | 'info' | 'warning') => void }) {
  const [channels, setChannels] = useState<DBChannel[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showAddModal, setShowAddModal] = useState(false)
  // 채널별 수집 진행 중 상태 (channel_id → boolean)
  const [collectingIds, setCollectingIds] = useState<Record<string, boolean>>({})

  const loadChannels = useCallback(() => {
    setIsLoading(true)
    fetch('/api/dashboard/channels')
      .then(r => r.json())
      .then((data: DBChannel[]) => { setChannels(data); setIsLoading(false) })
      .catch(() => setIsLoading(false))
  }, [])

  useEffect(() => { loadChannels() }, [loadChannels])

  const handleAddChannel = (ch: DBChannel) => {
    setChannels(prev => [...prev, ch])
    addToast(`"${ch.channel_name}" 채널이 등록됐습니다 📡`, 'success')
  }

  const handleDeleteChannel = async (channelId: string, channelName: string) => {
    if (collectingIds[channelId]) return
    const res = await fetch(`/api/dashboard/channels?channel_id=${encodeURIComponent(channelId)}`, { method: 'DELETE' })
    if (!res.ok) { addToast('삭제 실패', 'warning'); return }
    setChannels(prev => prev.filter(c => c.channel_id !== channelId))
    addToast(`"${channelName}" 채널이 삭제됐습니다`, 'warning')
  }

  const handleCollect = async (ch: DBChannel) => {
    if (collectingIds[ch.channel_id]) return
    setCollectingIds(prev => ({ ...prev, [ch.channel_id]: true }))
    addToast(`"${ch.channel_name}" 데이터 수집 중...`, 'info')
    try {
      const res = await fetch('/api/dashboard/collect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channel_id: ch.channel_id, channel_name: ch.channel_name }),
      })
      const result = await res.json()
      if (!res.ok) {
        addToast(`수집 실패: ${result.error ?? '알 수 없는 오류'}`, 'warning')
      } else {
        addToast(`${result.message} ✅`, 'success')
        // 채널 목록 갱신 (통계 업데이트 반영)
        loadChannels()
      }
    } catch {
      addToast('수집 중 오류가 발생했습니다', 'warning')
    } finally {
      setCollectingIds(prev => ({ ...prev, [ch.channel_id]: false }))
    }
  }

  const byPlatform = PLATFORMS.map(p => ({
    ...p,
    channels: channels.filter(c => c.platform === p.value),
  })).filter(p => p.channels.length > 0)

  return (
    <>
      {showAddModal && (
        <AddChannelModal
          onAdd={handleAddChannel}
          onClose={() => setShowAddModal(false)}
        />
      )}

      <div className="space-y-4">
        {/* 헤더 */}
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-500">
            등록된 채널 목록입니다. <strong>데이터 수집</strong> 버튼을 클릭하면 YouTube에서 최신 데이터를 즉시 가져옵니다.
          </p>
          <button
            onClick={() => setShowAddModal(true)}
            className="shrink-0 px-4 py-2 text-sm bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition font-medium"
          >
            + 채널 등록
          </button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center h-40 text-gray-400 text-sm">
            <span className="animate-spin mr-2">⏳</span> 데이터 로딩 중...
          </div>
        ) : byPlatform.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-gray-400 bg-white dark:bg-gray-800 rounded-2xl border border-gray-100">
            <p className="text-3xl mb-3">📭</p>
            <p className="text-sm font-medium">등록된 채널이 없습니다</p>
            <button onClick={() => setShowAddModal(true)} className="mt-3 text-sm text-blue-600 hover:underline">
              + 첫 채널 등록하기
            </button>
          </div>
        ) : (
          <div className="space-y-5">
            {byPlatform.map(({ value, label, icon, channels: chList }) => (
              <div key={value} className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
                <div className="px-5 py-3 bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600 flex items-center gap-2">
                  <span className="text-base">{icon}</span>
                  <span className="font-bold text-sm text-gray-800 dark:text-white">{label}</span>
                  <span className="text-xs text-gray-400 ml-1">{chList.length}개 채널</span>
                </div>
                <div className="divide-y divide-gray-100 dark:divide-gray-700">
                  {chList.map(ch => {
                    const isCollecting = !!collectingIds[ch.channel_id]
                    return (
                      <div key={ch.id} className="px-5 py-4 flex items-center gap-4 group hover:bg-gray-50 dark:hover:bg-gray-700 transition">
                        {/* 채널 정보 */}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{ch.channel_name}</p>
                          <p className="text-xs text-gray-400 mt-0.5 font-mono">{ch.channel_id}</p>
                        </div>

                        {/* 통계 */}
                        <div className="flex items-center gap-5 text-xs text-gray-500 shrink-0">
                          {ch.subscribers != null ? (
                            <>
                              <div className="text-right">
                                <p className="font-medium text-gray-700 dark:text-gray-300">{formatNum(ch.subscribers)}</p>
                                <p>구독자</p>
                              </div>
                              <div className="text-right">
                                <p className="font-medium text-gray-700 dark:text-gray-300">{formatNum(ch.avg_views)}</p>
                                <p>평균 조회</p>
                              </div>
                              <div className="text-right">
                                <p className="font-medium text-gray-700 dark:text-gray-300">{ch.video_count ?? '-'}</p>
                                <p>영상 수</p>
                              </div>
                              <span className="text-gray-300 hidden group-hover:inline">
                                {ch.updated_at ? new Date(ch.updated_at).toLocaleDateString('ko-KR') : '-'}
                              </span>
                            </>
                          ) : (
                            <span className="text-xs text-amber-500 bg-amber-50 px-2 py-1 rounded-lg">수집 대기중</span>
                          )}
                        </div>

                        {/* 액션 버튼 */}
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            onClick={() => handleCollect(ch)}
                            disabled={isCollecting}
                            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg font-medium transition
                              ${isCollecting
                                ? 'bg-blue-100 text-blue-400 cursor-not-allowed'
                                : 'bg-blue-600 text-white hover:bg-blue-700'
                              }`}
                          >
                            {isCollecting ? (
                              <>
                                <svg className="animate-spin w-3 h-3" viewBox="0 0 24 24" fill="none">
                                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                                </svg>
                                수집 중...
                              </>
                            ) : (
                              <>▶ 데이터 수집</>
                            )}
                          </button>
                          <button
                            onClick={() => handleDeleteChannel(ch.channel_id, ch.channel_name)}
                            disabled={isCollecting}
                            className="opacity-0 group-hover:opacity-100 transition px-2 py-1.5 text-xs text-red-400 hover:text-red-600 disabled:opacity-30"
                          >
                            삭제
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  )
}

// ─── 벤치마킹 아이템 행 ──────────────────────────────────────
function BenchmarkItemRow({
  item, cat, onDelete,
}: {
  item: BenchmarkItem
  cat?: Category
  onDelete: (id: string) => void
}) {
  const handleDelete = async () => {
    await fetch(`/api/dashboard/benchmarks/${item.id}`, { method: 'DELETE' })
    onDelete(item.id)
  }

  return (
    <div className="p-5 flex items-start gap-4 hover:bg-gray-50 dark:hover:bg-gray-700 transition group">
      <span className="text-xl shrink-0 mt-0.5">{getPlatformIcon(item.platform)}</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap mb-1">
          <a
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-semibold text-gray-900 dark:text-white hover:text-blue-600 hover:underline"
          >
            {item.title}
          </a>
          {cat && <CategoryTag cat={cat} size="xs" />}
        </div>
        <a
          href={item.url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-blue-400 hover:underline truncate block mb-1"
        >
          {item.url}
        </a>
        {item.memo && (
          <div className="flex items-start gap-1.5 mt-1">
            <span className="text-xs text-yellow-500 shrink-0">📝</span>
            <p className="text-xs text-gray-500 dark:text-gray-400 italic">{item.memo}</p>
          </div>
        )}
      </div>
      <div className="flex flex-col items-end gap-1.5 shrink-0 text-xs text-gray-400">
        {item.vsAvg != null && <span className="text-green-600 font-bold text-sm">{item.vsAvg}x</span>}
        {item.views != null && <span>{formatNum(item.views)}</span>}
        <span>{item.addedAt}</span>
        <button
          onClick={handleDelete}
          className="opacity-0 group-hover:opacity-100 transition text-red-400 hover:text-red-600 mt-1"
        >
          삭제
        </button>
      </div>
    </div>
  )
}

// ─── 메인 뷰 ─────────────────────────────────────────────────
type TabType = 'benchmarks' | 'channels'

export default function BenchmarkView({ addToast }: { addToast: (m: string, t?: 'success' | 'info' | 'warning') => void }) {
  const [activeTab, setActiveTab] = useState<TabType>('channels')
  const [categories, setCategories] = useState<Category[]>([])
  const [items, setItems] = useState<BenchmarkItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('all')
  const [showCategoryManager, setShowCategoryManager] = useState(false)
  const [showAddModal, setShowAddModal] = useState(false)

  const fetchData = useCallback(async () => {
    setIsLoading(true)
    const [catRes, bmRes] = await Promise.all([
      fetch('/api/dashboard/benchmark-categories'),
      fetch('/api/dashboard/benchmarks'),
    ])
    if (catRes.ok) {
      const cats: DBCategory[] = await catRes.json()
      setCategories(cats.map(dbCatToCategory))
    }
    if (bmRes.ok) {
      const bms: DBBenchmark[] = await bmRes.json()
      setItems(bms.map(dbBenchmarkToItem))
    }
    setIsLoading(false)
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const handleSaveCategories = async (updated: Category[]) => {
    // 삭제된 카테고리 처리
    const deletedIds = categories.filter(c => !updated.find(u => u.id === c.id)).map(c => c.id)
    await Promise.all(deletedIds.map(id =>
      fetch(`/api/dashboard/benchmark-categories/${id}`, { method: 'DELETE' })
    ))
    // 추가/변경된 카테고리 upsert
    await Promise.all(updated.map(cat =>
      fetch('/api/dashboard/benchmark-categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: cat.id, name: cat.name, bg_color: cat.bgColor, text_color: cat.textColor }),
      })
    ))
    setCategories(updated)
    addToast('카테고리가 저장되었습니다 ✅', 'success')
  }

  const handleAddItem = (item: BenchmarkItem) => {
    setItems(prev => [item, ...prev])
    addToast(`"${item.title}" 레퍼런스 목록에 추가됐습니다 📌`, 'success')
  }

  const handleDelete = (id: string) => {
    setItems(prev => prev.filter(i => i.id !== id))
    addToast('콘텐츠 항목이 삭제됐습니다', 'warning')
  }

  const filtered = selectedCategoryId === 'all'
    ? items
    : items.filter(i => i.categoryId === selectedCategoryId)

  const unclassified = filtered.filter(i => !categories.find(c => c.id === i.categoryId))

  return (
    <>
      {showCategoryManager && (
        <CategoryManagerModal
          categories={categories}
          onSave={handleSaveCategories}
          onClose={() => setShowCategoryManager(false)}
        />
      )}
      {showAddModal && (
        <AddBenchmarkModal
          categories={categories}
          onAdd={handleAddItem}
          onClose={() => setShowAddModal(false)}
        />
      )}

      <div className="space-y-5">
        {/* 상단 탭 */}
        <div className="flex items-center justify-between">
          <div className="flex gap-1 bg-gray-100 dark:bg-gray-700 rounded-xl p-1">
            <button
              onClick={() => setActiveTab('channels')}
              className={`px-4 py-1.5 text-sm rounded-lg font-medium transition ${activeTab === 'channels' ? 'bg-white dark:bg-gray-800 shadow-sm text-gray-900 dark:text-white' : 'text-gray-500 hover:text-gray-700'}`}
            >
              📡 채널 등록
            </button>
            <button
              onClick={() => setActiveTab('benchmarks')}
              className={`px-4 py-1.5 text-sm rounded-lg font-medium transition ${activeTab === 'benchmarks' ? 'bg-white dark:bg-gray-800 shadow-sm text-gray-900 dark:text-white' : 'text-gray-500 hover:text-gray-700'}`}
            >
              🔖 콘텐츠 등록
            </button>
          </div>

          {activeTab === 'benchmarks' && (
            <div className="flex gap-2">
              <button
                onClick={() => setShowCategoryManager(true)}
                className="px-3 py-2 text-sm bg-white border border-gray-200 text-gray-600 rounded-xl hover:bg-gray-50 transition"
              >
                🏷️ 카테고리 관리
              </button>
              <button
                onClick={() => setShowAddModal(true)}
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition font-medium"
              >
                + 콘텐츠 추가
              </button>
            </div>
          )}
        </div>

        {/* 채널 등록 탭 (기본) */}
        {activeTab === 'channels' && <ChannelStatusTab addToast={addToast} />}

        {/* 콘텐츠(레퍼런스) 탭 */}
        {activeTab === 'benchmarks' && (
          <>
            {isLoading ? (
              <div className="flex items-center justify-center h-40 text-gray-400 text-sm">데이터 로딩 중...</div>
            ) : (
              <>
                {/* 카테고리 필터 */}
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    onClick={() => setSelectedCategoryId('all')}
                    className={`px-3 py-1.5 text-sm rounded-xl font-medium transition
                      ${selectedCategoryId === 'all' ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                  >
                    전체 ({items.length})
                  </button>
                  {categories.map(cat => {
                    const count = items.filter(i => i.categoryId === cat.id).length
                    const isActive = selectedCategoryId === cat.id
                    const style = getCategoryStyle(cat)
                    return (
                      <button
                        key={cat.id}
                        onClick={() => setSelectedCategoryId(cat.id)}
                        className="px-3 py-1.5 text-sm rounded-xl font-medium transition border"
                        style={isActive ? style : { background: 'white', color: '#4b5563', borderColor: '#e5e7eb' }}
                      >
                        {cat.name} ({count})
                      </button>
                    )
                  })}
                </div>

                {/* 목록 */}
                {selectedCategoryId === 'all' ? (
                  <div className="space-y-6">
                    {categories.length === 0 ? (
                      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 p-10 text-center">
                        <p className="text-2xl mb-2">🏷️</p>
                        <p className="text-sm text-gray-500 mb-3">등록된 카테고리가 없습니다</p>
                        <button onClick={() => setShowCategoryManager(true)} className="text-sm text-blue-600 hover:underline">카테고리 추가하기</button>
                      </div>
                    ) : (
                      categories.map(cat => {
                        const catItems = items.filter(i => i.categoryId === cat.id)
                        const style = getCategoryStyle(cat)
                        const avgVsAvg = catItems.length > 0
                          ? (catItems.reduce((s, i) => s + (i.vsAvg ?? 0), 0) / catItems.length).toFixed(1)
                          : null
                        return (
                          <div key={cat.id} className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm overflow-hidden border border-gray-100 dark:border-gray-700">
                            <div
                              className="px-5 py-4 flex items-center justify-between"
                              style={{ background: style.background, borderBottom: `1px solid ${style.border}` }}
                            >
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-sm" style={{ color: style.color }}>{cat.name}</span>
                                <span className="px-2 py-0.5 text-xs rounded-full font-medium" style={{ background: 'rgba(255,255,255,0.5)', color: style.color }}>
                                  {catItems.length}개
                                </span>
                              </div>
                              {avgVsAvg && (
                                <span className="text-xs font-semibold" style={{ color: style.color }}>평균 vs.Avg {avgVsAvg}x</span>
                              )}
                            </div>
                            {catItems.length === 0 ? (
                              <div className="p-6 text-center text-sm text-gray-400">
                                이 카테고리에 등록된 콘텐츠가 없습니다
                                <button onClick={() => setShowAddModal(true)} className="block mx-auto mt-2 text-xs text-blue-500 hover:underline">+ 추가하기</button>
                              </div>
                            ) : (
                              <div className="divide-y divide-gray-100 dark:divide-gray-700">
                                {catItems.map(item => (
                                  <BenchmarkItemRow key={item.id} item={item} cat={cat} onDelete={handleDelete} />
                                ))}
                              </div>
                            )}
                          </div>
                        )
                      })
                    )}

                    {unclassified.length > 0 && (
                      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm overflow-hidden">
                        <div className="px-5 py-4 bg-gray-50 border-b border-gray-200">
                          <h3 className="font-bold text-sm text-gray-500">미분류 ({unclassified.length}개)</h3>
                        </div>
                        <div className="divide-y divide-gray-100">
                          {unclassified.map(item => (
                            <BenchmarkItemRow key={item.id} item={item} onDelete={handleDelete} />
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm overflow-hidden">
                    {filtered.length === 0 ? (
                      <div className="p-12 text-center">
                        <p className="text-4xl mb-3">📭</p>
                        <p className="text-sm text-gray-500">이 카테고리에 저장된 항목이 없습니다</p>
                        <button onClick={() => setShowAddModal(true)} className="mt-3 text-sm text-blue-600 hover:underline">+ 콘텐츠 추가</button>
                      </div>
                    ) : (
                      <div className="divide-y divide-gray-100 dark:divide-gray-700">
                        {filtered.map(item => {
                          const cat = categories.find(c => c.id === item.categoryId)
                          return <BenchmarkItemRow key={item.id} item={item} cat={cat} onDelete={handleDelete} />
                        })}
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>
    </>
  )
}
