'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Category, BenchmarkItem,
  getCategoryStyle, resolveTextColor, autoTextColor,
} from '@/lib/dashboard/categories'

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

type ContentStyle = 'longform' | 'shortform' | 'text' | 'mixed'

interface DBChannel {
  id: number
  channel_id: string
  channel_name: string
  platform: string
  category_id: string | null
  content_style: ContentStyle | null
  subscribers: number | null
  avg_views: number | null
  video_count: number | null
  tracking_status: 'active' | 'inactive' | 'untrackable' | null
  last_upload_at: string | null
  status_checked_at: string | null
  updated_at: string
}

import {
  ChannelCategoryField,
  normalizeChannelCategories,
  type ChannelCategoryOption,
} from '@/components/dashboard/ChannelCategoryField'
import { BulkImportChannelsModal } from '@/components/dashboard/BulkImportChannelsModal'
import {
  formatCollectStatusLabel,
  getCollectStatus,
  summarizeCollectStatus,
  type CollectStatus,
} from '@/lib/dashboard/channel-collect-status'
import {
  formatTrackingStatusLabel,
  trackingStatusBadgeClass,
} from '@/lib/dashboard/channel-tracking-status'

// ─── 헬퍼 ─────────────────────────────────────────────────────
const PLATFORMS = [
  { value: 'youtube',    label: 'YouTube',      icon: '🔴' },
  { value: 'tiktok',     label: 'TikTok',       icon: '🎵' },
  { value: 'instagram',  label: 'Instagram',    icon: '💗' },
  { value: 'naver-blog', label: '네이버 블로그', icon: '🟢' },
  { value: 'tistory',    label: '티스토리',      icon: '🟠' },
  { value: 'other',      label: '기타',          icon: '🔗' },
]

function getPlatformIcon(p: string) {
  return PLATFORMS.find(pl => pl.value === p)?.icon ?? '🔗'
}

const CONTENT_STYLES: { value: ContentStyle; label: string; icon: string }[] = [
  { value: 'longform',  label: '롱폼',   icon: '🎬' },
  { value: 'shortform', label: '숏폼',   icon: '⚡' },
  { value: 'text',      label: '글',     icon: '✍️' },
  { value: 'mixed',     label: '혼합',   icon: '🔀' },
]

function getContentStyleInfo(style: ContentStyle | null | undefined) {
  return CONTENT_STYLES.find(s => s.value === style) ?? { value: null, label: '미지정', icon: '❔' }
}

// 스타일별 그룹핑용 — '미지정' 버킷 포함
const STYLE_GROUPS: { value: string; label: string; icon: string }[] = [
  ...CONTENT_STYLES,
  { value: 'unset', label: '미지정', icon: '❔' },
]

/** 플랫폼 특성상 콘텐츠 스타일이 거의 고정인 경우 자동 추천값 */
function suggestContentStyle(platform: string): ContentStyle | null {
  if (platform === 'naver-blog' || platform === 'tistory') return 'text'
  if (platform === 'tiktok' || platform === 'instagram') return 'shortform'
  return null
}

function ContentStylePicker({
  value,
  onChange,
}: {
  value: ContentStyle | null
  onChange: (v: ContentStyle | null) => void
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      <button
        type="button"
        onClick={() => onChange(null)}
        className={`px-3 py-1.5 text-xs rounded-lg border transition ${
          value === null
            ? 'bg-gray-800 text-white border-gray-800 dark:bg-gray-200 dark:text-gray-900'
            : 'bg-white dark:bg-gray-700 text-gray-500 border-gray-200 dark:border-gray-600 hover:border-gray-300'
        }`}
      >
        ❔ 미지정
      </button>
      {CONTENT_STYLES.map((s) => (
        <button
          key={s.value}
          type="button"
          onClick={() => onChange(s.value)}
          className={`px-3 py-1.5 text-xs rounded-lg border transition ${
            value === s.value
              ? 'bg-blue-600 text-white border-blue-600'
              : 'bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-600 hover:border-blue-300'
          }`}
        >
          {s.icon} {s.label}
        </button>
      ))}
    </div>
  )
}

const MODAL_BACKDROP =
  'fixed inset-0 z-50 flex items-start sm:items-center justify-center p-3 sm:p-6 bg-black/50 overflow-y-auto'
const MODAL_PANEL =
  'bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full min-w-0 max-w-2xl sm:max-w-3xl p-6 sm:p-7 max-h-[min(90vh,880px)] overflow-y-auto overflow-x-hidden my-4 sm:my-8'

function PlatformPicker({
  value,
  onChange,
  excludeOther = true,
}: {
  value: string
  onChange: (v: string) => void
  excludeOther?: boolean
}) {
  const items = excludeOther ? PLATFORMS.filter((p) => p.value !== 'other') : PLATFORMS
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 w-full">
      {items.map((p) => (
        <button
          key={p.value}
          type="button"
          onClick={() => onChange(p.value)}
          className={`flex flex-col items-center justify-center gap-1.5 min-h-[4.25rem] px-2 py-2.5 rounded-xl border text-xs sm:text-sm font-medium transition text-center leading-tight
            ${
              value === p.value
                ? 'bg-gray-900 text-white border-gray-900 dark:bg-gray-100 dark:text-gray-900 dark:border-gray-100'
                : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-600'
            }`}
        >
          <span className="text-lg leading-none">{p.icon}</span>
          <span className="whitespace-normal">{p.label}</span>
        </button>
      ))}
    </div>
  )
}

function extractChannelIdFromInput(rawId: string, platform: string): string {
  const trimmed = rawId.trim()
  if (platform === 'naver-blog') {
    const m = trimmed.match(/blog\.naver\.com\/([^/?#]+)/i)
    if (m?.[1]) return m[1]
    return trimmed.replace(/^@/, '').split('/')[0]?.trim() ?? trimmed
  }
  const idMatch = trimmed.match(/(?:channel\/|@)([\w-]+)/)
  return idMatch ? idMatch[1] : trimmed
}

function channelIdPlaceholder(platform: string): string {
  if (platform === 'naver-blog') {
    return 'blogId 또는 https://blog.naver.com/blogId'
  }
  return 'UC... 또는 https://youtube.com/channel/UC...'
}

function channelIdHint(platform: string): string {
  if (platform === 'naver-blog') {
    return '예: ohmoneymate 또는 https://blog.naver.com/ohmoneymate'
  }
  return '예: UCsJ6RuBiTVWRX156FVbeaGg 또는 https://youtube.com/channel/UC…'
}

function getChannelPageUrl(platform: string, channelId: string): string | null {
  if (platform === 'youtube') return `https://www.youtube.com/channel/${channelId}`
  if (platform === 'instagram') return `https://www.instagram.com/${channelId}`
  if (platform === 'naver-blog') return `https://blog.naver.com/${channelId}`
  if (platform === 'tiktok') return `https://www.tiktok.com/@${channelId.replace(/^@/, '')}`
  if (platform === 'tistory') return channelId.startsWith('http') ? channelId : `https://${channelId}.tistory.com`
  return null
}

function detectPlatform(url: string): BenchmarkItem['platform'] {
  if (url.includes('youtube.com') || url.includes('youtu.be')) return 'youtube'
  if (url.includes('tiktok.com')) return 'tiktok'
  if (url.includes('instagram.com')) return 'instagram'
  if (url.includes('blog.naver.com')) return 'naver-blog'
  if (url.includes('tistory.com')) return 'tistory'
  return 'other'
}

function formatNum(v?: number | null) {
  if (v == null) return '-'
  return v >= 10000 ? `${(v / 10000).toFixed(1)}만` : v.toLocaleString()
}

function collectStatusBadgeClass(status: CollectStatus): string {
  if (status === 'pending') return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
  if (status === 'stale') return 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'
  return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
}

type CollectFilter = 'all' | CollectStatus

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
    <div className={MODAL_BACKDROP} onClick={onClose}>
      <div className={`${MODAL_PANEL} max-w-xl sm:max-w-2xl`} onClick={e => e.stopPropagation()}>
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
interface AddBenchmarkModalProps {
  categories: Category[]
  onAdd: (item: BenchmarkItem) => void
  onClose: () => void
  initialUrl?: string
  initialTitle?: string
  initialViews?: number | null
  initialCategoryId?: string
}

function AddBenchmarkModal({
  categories,
  onAdd,
  onClose,
  initialUrl = '',
  initialTitle = '',
  initialViews,
  initialCategoryId,
}: AddBenchmarkModalProps) {
  const [url, setUrl] = useState(initialUrl)
  const [title, setTitle] = useState(initialTitle)
  const [memo, setMemo] = useState('')
  const [categoryId, setCategoryId] = useState(initialCategoryId ?? categories[0]?.id ?? '')
  const [views, setViews] = useState(initialViews != null ? String(initialViews) : '')
  const [vsAvg, setVsAvg] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')

  const platform = detectPlatform(url)
  const platformInfo = PLATFORMS.find(p => p.value === platform)
  const selectedCat = categories.find(c => c.id === categoryId)

  const handleAdd = async () => {
    if (!url.trim() || !title.trim()) return
    setSaving(true)
    setSaveError('')
    const id = `bm-${Date.now()}`
    const payload = {
      id,
      url: url.trim(),
      title: title.trim(),
      memo: memo.trim(),
      category_id: categoryId || null,
      platform,
      views: views ? parseInt(views.replace(/,/g, '')) : null,
      vs_avg: vsAvg ? parseFloat(vsAvg) : null,
    }
    try {
      const res = await fetch('/api/dashboard/benchmarks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const errData = await res.json().catch(() => ({ error: '저장에 실패했습니다' }))
        setSaveError((errData as { error?: string }).error ?? '저장에 실패했습니다')
        setSaving(false)
        return
      }
      setSaving(false)
      onAdd({
        id,
        url: payload.url,
        title: payload.title,
        memo: payload.memo,
        categoryId: payload.category_id ?? '',
        platform: payload.platform as BenchmarkItem['platform'],
        addedAt: '방금',
        views: payload.views ?? undefined,
        vsAvg: payload.vs_avg ?? undefined,
      })
      onClose()
    } catch {
      setSaveError('네트워크 오류가 발생했습니다')
      setSaving(false)
    }
  }

  return (
    <div className={MODAL_BACKDROP} onClick={onClose}>
      <div className={MODAL_PANEL} onClick={e => e.stopPropagation()}>
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
            <label className="text-xs font-semibold text-gray-500 mb-1 block">
              주제 카테고리
              {categories.length === 0 && (
                <span className="ml-1 font-normal text-amber-500">(카테고리가 없으면 미분류로 저장)</span>
              )}
            </label>
            <div className="flex items-center gap-2">
              <select
                value={categoryId}
                onChange={e => setCategoryId(e.target.value)}
                disabled={categories.length === 0}
                className="flex-1 px-3 py-2.5 text-sm border border-gray-200 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
              >
                <option value="">카테고리 선택 (선택사항)</option>
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
        {saveError && (
          <div className="mt-4 px-3 py-2 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 text-xs text-red-600 dark:text-red-400">
            ❌ {saveError}
          </div>
        )}
        <div className="flex gap-3 mt-4">
          <button
            onClick={handleAdd}
            disabled={!url.trim() || !title.trim() || saving}
            className="flex-1 py-2.5 bg-blue-600 text-white text-sm rounded-xl hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition font-medium"
          >
            {saving ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
                </svg>
                저장 중...
              </span>
            ) : '저장'}
          </button>
          <button onClick={onClose} className="flex-1 py-2.5 bg-gray-100 text-gray-700 text-sm rounded-xl hover:bg-gray-200 transition">
            취소
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── 채널 검증 상태 타입 ────────────────────────────────────
type VerifyStatus = 'idle' | 'loading' | 'valid' | 'invalid'

interface VerifiedInfo {
  channelId: string
  title: string
  handle?: string
  subscribers?: number
  videoCount?: number
  thumbnail?: string
}

function formatSubCount(n?: number): string {
  if (n == null) return '비공개'
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 10_000) return `${Math.round(n / 10_000)}만`
  return n.toLocaleString()
}

// ─── 채널 추가 모달 ───────────────────────────────────────────
function AddChannelModal({
  onAdd,
  onClose,
  categories,
  onCategoriesChange,
  onNotify,
}: {
  onAdd: (ch: DBChannel) => void
  onClose: () => void
  categories: ChannelCategoryOption[]
  onCategoriesChange: (cats: ChannelCategoryOption[]) => void
  onNotify: (m: string, t?: 'success' | 'info' | 'warning') => void
}) {
  const [channelId, setChannelId] = useState('')
  const [channelName, setChannelName] = useState('')
  const [platform, setPlatform] = useState('youtube')
  const [categoryId, setCategoryId] = useState('')
  const [contentStyle, setContentStyle] = useState<ContentStyle | null>(suggestContentStyle('youtube'))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // 검증 상태
  const [verifyStatus, setVerifyStatus] = useState<VerifyStatus>('idle')
  const [verifiedInfo, setVerifiedInfo] = useState<VerifiedInfo | null>(null)
  const [verifyError, setVerifyError] = useState('')

  const isYoutube = platform === 'youtube'
  // YouTube는 검증 통과 필수, 나머지 플랫폼은 자유 등록
  const canRegister = isYoutube
    ? verifyStatus === 'valid' && !!channelName.trim()
    : !!channelId.trim() && !!channelName.trim()

  // 플랫폼·채널ID 바뀌면 검증 상태 초기화
  const handleChannelIdChange = (v: string) => {
    setChannelId(v)
    setVerifyStatus('idle')
    setVerifiedInfo(null)
    setVerifyError('')
  }
  const handlePlatformChange = (v: string) => {
    setPlatform(v)
    setVerifyStatus('idle')
    setVerifiedInfo(null)
    setVerifyError('')
    setChannelId('')
    setChannelName('')
    setContentStyle(suggestContentStyle(v))
  }

  // 채널 검증 API 호출
  const handleVerify = async () => {
    const input = channelId.trim()
    if (!input) return
    setVerifyStatus('loading')
    setVerifyError('')
    setVerifiedInfo(null)

    try {
      const res = await fetch(
        `/api/dashboard/validate-channel?input=${encodeURIComponent(input)}&platform=${platform}`
      )
      const data = await res.json()

      if (data.valid && data.channelId) {
        setVerifyStatus('valid')
        setVerifiedInfo({
          channelId: data.channelId,
          title: data.title ?? '',
          handle: data.handle,
          subscribers: data.subscribers,
          videoCount: data.videoCount,
          thumbnail: data.thumbnail,
        })
        // 채널명이 비어있으면 API에서 가져온 채널명 자동 입력
        if (!channelName.trim() && data.title) {
          setChannelName(data.title)
        }
        // 실제 channel ID로 갱신 (URL 입력 등 파싱 결과)
        setChannelId(data.channelId)
      } else {
        setVerifyStatus('invalid')
        setVerifyError(
          data.reason === 'api_error'
            ? 'YouTube API 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.'
            : '채널을 찾을 수 없습니다. Channel ID 또는 @핸들을 확인해 주세요.'
        )
      }
    } catch {
      setVerifyStatus('invalid')
      setVerifyError('검증 중 오류가 발생했습니다.')
    }
  }

  const handleAdd = async () => {
    const rawId = channelId.trim()
    const name = channelName.trim()
    if (!rawId || !name) return
    setSaving(true)
    setError('')

    const finalId = isYoutube
      ? (verifiedInfo?.channelId ?? rawId)
      : extractChannelIdFromInput(rawId, platform)

    const res = await fetch('/api/dashboard/channels', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        channel_id: finalId,
        channel_name: name,
        platform,
        category_id: categoryId || null,
        content_style: contentStyle,
      }),
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
    <div className={MODAL_BACKDROP} onClick={onClose}>
      <div className={MODAL_PANEL} onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white">📡 채널 등록</h3>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl shrink-0">✕</button>
        </div>

        <div className="space-y-4 min-w-0">
          <div>
            <label className="text-xs font-semibold text-gray-500 mb-2 block">플랫폼</label>
            <PlatformPicker value={platform} onChange={handlePlatformChange} />
          </div>

          {/* 채널 ID + 검증 버튼 */}
          <div>
            <label className="text-xs font-semibold text-gray-500 mb-1 block">
              채널 ID {isYoutube && <span className="text-red-400 ml-0.5">* (검증 필수)</span>}
            </label>
            <p className="text-[11px] text-gray-400 mb-1.5 break-words">
              {channelIdHint(platform)}
            </p>
            <div className="flex gap-2">
              <input
                value={channelId}
                onChange={e => handleChannelIdChange(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && isYoutube && handleVerify()}
                placeholder={channelIdPlaceholder(platform)}
                className={`flex-1 min-w-0 px-3 py-2.5 text-sm border rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 transition
                  ${verifyStatus === 'valid'
                    ? 'border-green-400 focus:ring-green-400'
                    : verifyStatus === 'invalid'
                      ? 'border-red-400 focus:ring-red-400'
                      : 'border-gray-200 dark:border-gray-600 focus:ring-blue-500'
                  }`}
              />
              {isYoutube && (
                <button
                  type="button"
                  onClick={handleVerify}
                  disabled={!channelId.trim() || verifyStatus === 'loading'}
                  className={`shrink-0 px-4 py-2.5 text-sm rounded-xl font-medium transition
                    ${verifyStatus === 'valid'
                      ? 'bg-green-600 text-white hover:bg-green-700'
                      : verifyStatus === 'invalid'
                        ? 'bg-red-100 text-red-600 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-400'
                        : 'bg-gray-900 text-white hover:bg-gray-700 dark:bg-gray-200 dark:text-gray-900'
                    } disabled:opacity-40 disabled:cursor-not-allowed`}
                >
                  {verifyStatus === 'loading' ? (
                    <span className="flex items-center gap-1.5">
                      <svg className="animate-spin w-3.5 h-3.5" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                      </svg>
                      확인 중
                    </span>
                  ) : verifyStatus === 'valid' ? '✓ 확인됨' : verifyStatus === 'invalid' ? '✗ 재검증' : '검증'}
                </button>
              )}
            </div>

            {/* 검증 결과 카드 */}
            {isYoutube && verifyStatus === 'valid' && verifiedInfo && (
              <div className="mt-3 flex items-center gap-3 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded-xl">
                {verifiedInfo.thumbnail && (
                  <img
                    src={verifiedInfo.thumbnail}
                    alt={verifiedInfo.title}
                    className="w-11 h-11 rounded-full object-cover border-2 border-green-300 shrink-0"
                  />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-green-800 dark:text-green-200 truncate">
                    ✅ {verifiedInfo.title}
                  </p>
                  <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5">
                    {verifiedInfo.handle && (
                      <span className="text-[11px] text-green-600 dark:text-green-400">{verifiedInfo.handle}</span>
                    )}
                    <span className="text-[11px] text-green-600 dark:text-green-400">
                      구독자 {formatSubCount(verifiedInfo.subscribers)}
                    </span>
                    {verifiedInfo.videoCount != null && (
                      <span className="text-[11px] text-green-600 dark:text-green-400">
                        영상 {verifiedInfo.videoCount.toLocaleString()}개
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] font-mono text-green-500 dark:text-green-500 mt-0.5 truncate">
                    {verifiedInfo.channelId}
                  </p>
                </div>
              </div>
            )}

            {/* 검증 실패 */}
            {isYoutube && verifyStatus === 'invalid' && (
              <div className="mt-2 flex items-start gap-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-xl">
                <span className="text-red-500 shrink-0 text-base">❌</span>
                <p className="text-xs text-red-600 dark:text-red-400">{verifyError}</p>
              </div>
            )}

            {/* YouTube 안내 */}
            {isYoutube && verifyStatus === 'idle' && channelId.trim() && (
              <p className="mt-1.5 text-[11px] text-gray-400">
                Enter 또는 검증 버튼을 눌러 채널을 확인하세요.
              </p>
            )}
          </div>

          {/* 채널명 */}
          <div>
            <label className="text-xs font-semibold text-gray-500 mb-1 block">채널명 *</label>
            <input
              value={channelName}
              onChange={e => setChannelName(e.target.value)}
              placeholder={isYoutube && verifyStatus === 'valid' ? '검증 후 자동 입력됩니다' : '예: 슈카월드'}
              className="w-full px-3 py-2.5 text-sm border border-gray-200 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {isYoutube && verifyStatus === 'valid' && verifiedInfo?.title && channelName !== verifiedInfo.title && (
              <button
                type="button"
                onClick={() => setChannelName(verifiedInfo.title)}
                className="mt-1 text-[11px] text-blue-500 hover:underline"
              >
                API 채널명으로 되돌리기: {verifiedInfo.title}
              </button>
            )}
          </div>

          <ChannelCategoryField
            value={categoryId}
            onChange={setCategoryId}
            categories={categories}
            onCategoriesChange={onCategoriesChange}
            onNotify={onNotify}
          />

          <div>
            <label className="text-xs font-semibold text-gray-500 mb-2 block">
              콘텐츠 스타일 <span className="font-normal text-gray-400">(이 채널의 주력 포맷 — «스타일별 보기» 그룹핑에 사용)</span>
            </label>
            <ContentStylePicker value={contentStyle} onChange={setContentStyle} />
          </div>

          {error && <p className="text-xs text-red-500">{error}</p>}

          {/* 안내 박스 */}
          <div className={`rounded-xl p-3 ${isYoutube ? 'bg-teal-50 dark:bg-teal-900/20' : 'bg-blue-50 dark:bg-blue-900/20'}`}>
            <p className={`text-xs ${isYoutube ? 'text-teal-700 dark:text-teal-400' : 'text-blue-600 dark:text-blue-400'}`}>
              {isYoutube
                ? '🔍 YouTube 채널은 검증 후에만 등록 가능합니다. 채널 ID(UCxxx), @핸들, 채널 URL 모두 지원합니다.'
                : '💡 채널을 등록한 뒤 목록의 데이터 수집을 누르면 구독자 수·조회수 등이 갱신됩니다.'}
            </p>
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button
            onClick={handleAdd}
            disabled={!canRegister || saving}
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

interface ChannelFlagSnapshot {
  is_tracked: boolean
  is_mine: boolean
}

function EditChannelModal({
  channel,
  categories,
  onCategoriesChange,
  onNotify,
  initialFlags,
  onSave,
  onClose,
}: {
  channel: DBChannel
  categories: ChannelCategoryOption[]
  onCategoriesChange: (cats: ChannelCategoryOption[]) => void
  onNotify: (m: string, t?: 'success' | 'info' | 'warning') => void
  initialFlags: ChannelFlagSnapshot
  onSave: (ch: DBChannel, flags: ChannelFlagSnapshot) => void
  onClose: () => void
}) {
  const [channelName, setChannelName] = useState(channel.channel_name)
  const [platform, setPlatform] = useState(channel.platform)
  const [categoryId, setCategoryId] = useState(channel.category_id ?? '')
  const [contentStyle, setContentStyle] = useState<ContentStyle | null>(channel.content_style ?? null)
  const [isTracked, setIsTracked] = useState(initialFlags.is_tracked)
  const [isMine, setIsMine] = useState(initialFlags.is_mine)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const channelUrl =
    platform === 'youtube'
      ? `https://www.youtube.com/channel/${channel.channel_id}`
      : platform === 'instagram'
        ? `https://www.instagram.com/${channel.channel_id}`
        : platform === 'naver-blog'
          ? `https://blog.naver.com/${channel.channel_id}`
          : null

  const handleSave = async () => {
    const name = channelName.trim()
    if (!name) {
      setError('채널명을 입력해 주세요')
      return
    }
    setSaving(true)
    setError('')

    try {
      const chRes = await fetch('/api/dashboard/channels', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channel_id: channel.channel_id,
          channel_name: name,
          platform,
          category_id: categoryId || null,
          content_style: contentStyle,
        }),
      })
      if (!chRes.ok) {
        const { error: msg } = await chRes.json()
        setError(msg ?? '채널 저장 실패')
        return
      }
      const updated = (await chRes.json()) as DBChannel

      const flagRes = await fetch('/api/dashboard/channel-flags', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channel_id: channel.channel_id,
          is_tracked: isTracked,
          is_mine: isMine,
        }),
      })
      if (!flagRes.ok) {
        setError('채널 정보는 저장됐으나 추적/내 채널 설정 저장에 실패했습니다')
        onSave(updated, { is_tracked: isTracked, is_mine: isMine })
        return
      }

      onSave(updated, { is_tracked: isTracked, is_mine: isMine })
      onClose()
    } catch {
      setError('저장 중 오류가 발생했습니다')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className={MODAL_BACKDROP} onClick={onClose}>
      <div className={MODAL_PANEL} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white">✏️ 채널 수정</h3>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl shrink-0">
            ✕
          </button>
        </div>

        <div className="space-y-4 min-w-0">
          <div>
            <label className="text-xs font-semibold text-gray-500 mb-2 block">플랫폼</label>
            <PlatformPicker value={platform} onChange={setPlatform} />
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-500 mb-1 block">채널 ID (변경 불가)</label>
            <div className="flex items-center gap-2">
              <code className="flex-1 px-3 py-2 text-xs bg-gray-100 dark:bg-gray-900 rounded-xl text-gray-600 dark:text-gray-300 break-all">
                {channel.channel_id}
              </code>
              {channelUrl && (
                <a
                  href={channelUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="shrink-0 text-xs px-2 py-2 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200"
                >
                  열기 ↗
                </a>
              )}
            </div>
            <p className="text-[11px] text-gray-400 mt-1">ID를 바꾸려면 삭제 후 다시 등록하세요.</p>
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-500 mb-1 block">표시 이름 (채널명) *</label>
            <input
              value={channelName}
              onChange={(e) => setChannelName(e.target.value)}
              className="w-full px-3 py-2.5 text-sm border border-gray-200 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-[11px] text-gray-400 mt-1">수집된 영상의 채널명 표시도 함께 갱신됩니다.</p>
          </div>

          <ChannelCategoryField
            value={categoryId}
            onChange={setCategoryId}
            categories={categories}
            onCategoriesChange={onCategoriesChange}
            onNotify={onNotify}
          />

          <div>
            <label className="text-xs font-semibold text-gray-500 mb-2 block">
              콘텐츠 스타일 <span className="font-normal text-gray-400">(이 채널의 주력 포맷 — «스타일별 보기» 그룹핑에 사용)</span>
            </label>
            <ContentStylePicker value={contentStyle} onChange={setContentStyle} />
          </div>

          <div className="rounded-xl border border-gray-200 dark:border-gray-600 p-4 space-y-3">
            <p className="text-xs font-semibold text-gray-500">채널 관리 옵션</p>
            <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-200 cursor-pointer">
              <input
                type="checkbox"
                checked={isTracked}
                onChange={(e) => setIsTracked(e.target.checked)}
                className="rounded"
              />
              분석·수집 대상으로 포함 (YouTube 전체 수집 등)
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-200 cursor-pointer">
              <input
                type="checkbox"
                checked={isMine}
                onChange={(e) => setIsMine(e.target.checked)}
                className="rounded"
              />
              내 채널로 표시 (내 채널 화면)
            </label>
          </div>

          {(channel.subscribers != null || channel.avg_views != null) && (
            <div className="rounded-xl bg-gray-50 dark:bg-gray-900/50 p-4">
              <p className="text-xs font-semibold text-gray-500 mb-2">수집 통계 (읽기 전용 · 수집으로 갱신)</p>
              <div className="grid grid-cols-3 gap-3 text-center text-xs">
                <div>
                  <p className="font-bold text-gray-800 dark:text-white">{formatNum(channel.subscribers)}</p>
                  <p className="text-gray-400 mt-0.5">구독자</p>
                </div>
                <div>
                  <p className="font-bold text-gray-800 dark:text-white">{formatNum(channel.avg_views)}</p>
                  <p className="text-gray-400 mt-0.5">평균 조회</p>
                </div>
                <div>
                  <p className="font-bold text-gray-800 dark:text-white">{channel.video_count ?? '—'}</p>
                  <p className="text-gray-400 mt-0.5">영상 수</p>
                </div>
              </div>
              {channel.updated_at && (
                <p className="text-[11px] text-gray-400 mt-2 text-center">
                  마지막 갱신: {new Date(channel.updated_at).toLocaleString('ko-KR')}
                </p>
              )}
            </div>
          )}

          {error && <p className="text-xs text-red-500">{error}</p>}
        </div>

        <div className="flex gap-3 mt-6">
          <button
            type="button"
            onClick={handleSave}
            disabled={!channelName.trim() || saving}
            className="flex-1 py-2.5 bg-blue-600 text-white text-sm rounded-xl hover:bg-blue-700 disabled:opacity-40 transition font-medium"
          >
            {saving ? '저장 중…' : '저장'}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 bg-gray-100 text-gray-700 text-sm rounded-xl hover:bg-gray-200 transition"
          >
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
  const [channelCategories, setChannelCategories] = useState<ChannelCategoryOption[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showAddModal, setShowAddModal] = useState(false)
  const [showBulkImportModal, setShowBulkImportModal] = useState(false)
  const [editingChannel, setEditingChannel] = useState<DBChannel | null>(null)
  const [channelFlagsMap, setChannelFlagsMap] = useState<Record<string, ChannelFlagSnapshot>>({})
  const [collectingIds, setCollectingIds] = useState<Record<string, boolean>>({})
  const [collectAllLoading, setCollectAllLoading] = useState(false)
  const [collectPendingLoading, setCollectPendingLoading] = useState(false)
  const [collectFilter, setCollectFilter] = useState<CollectFilter>('all')
  // 그룹핑 기준: 플랫폼별 ↔ 콘텐츠 스타일별
  const [groupBy, setGroupBy] = useState<'platform' | 'style'>('platform')
  // 아코디언: youtube/롱폼 기본 열림, 나머지 접힘
  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set(['youtube']))

  const toggleGroup = (groupId: string) => {
    setOpenGroups(prev => {
      const next = new Set(prev)
      if (next.has(groupId)) next.delete(groupId)
      else next.add(groupId)
      return next
    })
  }

  const loadChannels = useCallback(() => {
    setIsLoading(true)
    fetch('/api/dashboard/channels/sync-categories', { method: 'POST' })
      .catch(() => {})
      .finally(() => {
        Promise.all([
          fetch('/api/dashboard/channels').then((r) => r.json()),
          fetch('/api/dashboard/channel-categories').then((r) => r.json()),
          fetch('/api/dashboard/channel-flags').then((r) => r.json()),
        ])
          .then(([data, cats, flags]) => {
            setChannels(data as DBChannel[])
            setChannelCategories(normalizeChannelCategories(cats))
            const map: Record<string, ChannelFlagSnapshot> = {}
            if (Array.isArray(flags)) {
              for (const f of flags as { channel_id: string; is_tracked: boolean; is_mine: boolean }[]) {
                map[f.channel_id] = { is_tracked: f.is_tracked, is_mine: f.is_mine }
              }
            }
            setChannelFlagsMap(map)
            setIsLoading(false)
          })
          .catch(() => setIsLoading(false))
      })
  }, [])

  const getFlagsForChannel = (channelId: string): ChannelFlagSnapshot => ({
    is_tracked: channelFlagsMap[channelId]?.is_tracked ?? true,
    is_mine: channelFlagsMap[channelId]?.is_mine ?? false,
  })

  const handleEditSave = (updated: DBChannel, flags: ChannelFlagSnapshot) => {
    setChannels((prev) => prev.map((c) => (c.channel_id === updated.channel_id ? { ...c, ...updated } : c)))
    setChannelFlagsMap((prev) => ({ ...prev, [updated.channel_id]: flags }))
    addToast(`"${updated.channel_name}" 채널이 수정됐습니다`, 'success')
  }

  const handleQuickCategoryChange = async (channelId: string, category_id: string) => {
    const res = await fetch('/api/dashboard/channels', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ channel_id: channelId, category_id: category_id || null }),
    })
    if (!res.ok) {
      addToast('카테고리 저장 실패', 'warning')
      return
    }
    const updated = (await res.json()) as DBChannel
    setChannels((prev) => prev.map((c) => (c.channel_id === channelId ? { ...c, ...updated } : c)))
    addToast('카테고리가 저장됐습니다', 'success')
  }

  useEffect(() => { loadChannels() }, [loadChannels])

  const handleAddChannel = (ch: DBChannel) => {
    setChannels(prev => [...prev, ch])
    addToast(`"${ch.channel_name}" 채널이 등록됐습니다 📡`, 'success')
  }

  const handleDeleteChannel = async (channelId: string, channelName: string) => {
    if (collectingIds[channelId] || isCollectBusy) return
    const res = await fetch(`/api/dashboard/channels?channel_id=${encodeURIComponent(channelId)}`, { method: 'DELETE' })
    if (!res.ok) { addToast('삭제 실패', 'warning'); return }
    setChannels(prev => prev.filter(c => c.channel_id !== channelId))
    addToast(`"${channelName}" 채널이 삭제됐습니다`, 'warning')
  }

  const handleCollect = async (ch: DBChannel) => {
    if (collectingIds[ch.channel_id] || isCollectBusy) return
    setCollectingIds(prev => ({ ...prev, [ch.channel_id]: true }))
    addToast(`"${ch.channel_name}" 데이터 수집 중...`, 'info')
    try {
      const res = await fetch('/api/dashboard/collect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channel_id: ch.channel_id,
          channel_name: ch.channel_name,
          platform: ch.platform,
        }),
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

  const youtubeChannels = channels.filter(c => c.platform === 'youtube')

  const collectSummary = summarizeCollectStatus(
    youtubeChannels.map((c) => ({
      channel_id: c.channel_id,
      channel_name: c.channel_name,
      platform: c.platform,
      subscribers: c.subscribers,
      avg_views: c.avg_views,
      video_count: c.video_count,
      updated_at: c.updated_at,
    }))
  )

  const getChannelCollectStatus = (ch: DBChannel): CollectStatus =>
    getCollectStatus({
      channel_id: ch.channel_id,
      channel_name: ch.channel_name,
      platform: ch.platform,
      subscribers: ch.subscribers,
      avg_views: ch.avg_views,
      video_count: ch.video_count,
      updated_at: ch.updated_at,
    })

  const matchesCollectFilter = (ch: DBChannel) =>
    collectFilter === 'all' || getChannelCollectStatus(ch) === collectFilter

  const handleCollectAllYoutube = async () => {
    if (youtubeChannels.length === 0 || collectAllLoading || collectPendingLoading) return
    setCollectAllLoading(true)
    addToast(`YouTube 채널 ${youtubeChannels.length}개 전체 수집을 시작합니다…`, 'info')
    try {
      const res = await fetch('/api/dashboard/collect-all', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) {
        addToast(data.error ?? '전체 수집 실패', 'warning')
      } else {
        addToast(data.message ?? '전체 수집 완료', data.failed > 0 ? 'warning' : 'success')
        loadChannels()
      }
    } catch {
      addToast('전체 수집 중 오류가 발생했습니다', 'warning')
    } finally {
      setCollectAllLoading(false)
    }
  }

  const handleCollectPending = async () => {
    if (collectSummary.pending === 0 || collectAllLoading || collectPendingLoading) return
    setCollectPendingLoading(true)
    addToast(`미수집 YouTube 채널 ${collectSummary.pending}개 수집을 시작합니다…`, 'info')
    try {
      const res = await fetch('/api/dashboard/collect-pending', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) {
        addToast(data.error ?? '미수집 수집 실패', 'warning')
      } else {
        addToast(data.message ?? '미수집 수집 완료', data.failed > 0 ? 'warning' : 'success')
        loadChannels()
      }
    } catch {
      addToast('미수집 수집 중 오류가 발생했습니다', 'warning')
    } finally {
      setCollectPendingLoading(false)
    }
  }

  const byPlatform = PLATFORMS.map(p => ({
    ...p,
    channels: channels.filter(c => c.platform === p.value && matchesCollectFilter(c)),
  })).filter(p => p.channels.length > 0)

  const byStyle = STYLE_GROUPS.map(s => ({
    ...s,
    channels: channels.filter(c => (c.content_style ?? 'unset') === s.value && matchesCollectFilter(c)),
  })).filter(s => s.channels.length > 0)

  const groups = groupBy === 'style' ? byStyle : byPlatform

  const expandAll = () => setOpenGroups(new Set(groups.map(g => g.value)))
  const collapseAll = () => setOpenGroups(new Set())

  const isCollectBusy = collectAllLoading || collectPendingLoading
  const collectProgressPct = collectSummary.total
    ? Math.round((collectSummary.collected / collectSummary.total) * 100)
    : 0

  const COLLECT_FILTER_CARDS: {
    key: CollectFilter
    label: string
    count: number
    hint: string
    activeRing: string
    countClass: string
    labelClass: string
    bgClass: string
  }[] = [
    {
      key: 'all',
      label: '전체',
      count: collectSummary.total,
      hint: '등록된 YouTube 채널',
      activeRing: 'ring-gray-400 dark:ring-gray-500',
      countClass: 'text-gray-900 dark:text-white',
      labelClass: 'text-gray-500 dark:text-gray-400',
      bgClass: 'bg-gray-50 dark:bg-gray-900/40 border-gray-200 dark:border-gray-700',
    },
    {
      key: 'pending',
      label: '수집 대기',
      count: collectSummary.pending,
      hint: '아직 한 번도 수집 안 됨',
      activeRing: 'ring-amber-400',
      countClass: 'text-amber-600 dark:text-amber-400',
      labelClass: 'text-amber-700/80 dark:text-amber-300/80',
      bgClass: 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800/50',
    },
    {
      key: 'stale',
      label: '갱신 필요',
      count: collectSummary.stale,
      hint: '7일 이상 미갱신',
      activeRing: 'ring-orange-400',
      countClass: 'text-orange-600 dark:text-orange-400',
      labelClass: 'text-orange-700/80 dark:text-orange-300/80',
      bgClass: 'bg-orange-50 dark:bg-orange-950/30 border-orange-200 dark:border-orange-800/50',
    },
    {
      key: 'collected',
      label: '수집 완료',
      count: collectSummary.collected,
      hint: '최근 수집 완료',
      activeRing: 'ring-emerald-400',
      countClass: 'text-emerald-600 dark:text-emerald-400',
      labelClass: 'text-emerald-700/80 dark:text-emerald-300/80',
      bgClass: 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800/50',
    },
  ]

  return (
    <>
      {showAddModal && (
        <AddChannelModal
          onAdd={handleAddChannel}
          onClose={() => setShowAddModal(false)}
          categories={channelCategories}
          onCategoriesChange={setChannelCategories}
          onNotify={addToast}
        />
      )}

      {showBulkImportModal && (
        <BulkImportChannelsModal
          onClose={() => setShowBulkImportModal(false)}
          onImported={loadChannels}
          onNotify={addToast}
        />
      )}

      {editingChannel && (
        <EditChannelModal
          channel={editingChannel}
          categories={channelCategories}
          onCategoriesChange={setChannelCategories}
          onNotify={addToast}
          initialFlags={getFlagsForChannel(editingChannel.channel_id)}
          onSave={handleEditSave}
          onClose={() => setEditingChannel(null)}
        />
      )}

      <div className="space-y-4">
        {/* 수집 상태 보드 */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 overflow-hidden shadow-sm">
          <div className="bg-gradient-to-r from-red-600 to-rose-700 px-4 sm:px-5 py-4">
            <div className="flex flex-col xl:flex-row xl:items-start xl:justify-between gap-4">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-base font-bold text-white tracking-tight">YouTube 수집 상태</h3>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-white/15 text-white/90 border border-white/20">
                    YouTube 전용
                  </span>
                </div>
                <p className="text-xs text-white/75 mt-1.5">
                  {collectSummary.collected}/{collectSummary.total} 채널 수집 완료
                  {collectSummary.pending > 0 && ` · 미수집 ${collectSummary.pending}개`}
                  {collectSummary.stale > 0 && ` · 갱신 필요 ${collectSummary.stale}개`}
                </p>
                <div className="mt-3 flex items-center gap-2">
                  <div className="flex-1 h-1.5 rounded-full bg-white/20 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-white transition-all duration-500"
                      style={{ width: `${collectProgressPct}%` }}
                    />
                  </div>
                  <span className="text-[11px] font-semibold text-white/90 tabular-nums shrink-0">{collectProgressPct}%</span>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-2 shrink-0">
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-white/50 px-1">등록</span>
                  <div className="inline-flex rounded-xl overflow-hidden border border-white/20 bg-white/10 backdrop-blur-sm">
                    <button
                      type="button"
                      onClick={() => setShowBulkImportModal(true)}
                      className="px-3 py-2 text-xs sm:text-sm text-white hover:bg-white/15 transition font-medium border-r border-white/15"
                    >
                      검증 채널 일괄 등록
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowAddModal(true)}
                      className="px-3 py-2 text-xs sm:text-sm text-white hover:bg-white/15 transition font-medium"
                    >
                      + 채널 등록
                    </button>
                  </div>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-white/50 px-1">수집</span>
                  <div className="inline-flex rounded-xl overflow-hidden border border-white/20">
                    <button
                      type="button"
                      onClick={handleCollectPending}
                      disabled={collectSummary.pending === 0 || isCollectBusy}
                      className="px-3 py-2 text-xs sm:text-sm bg-white/90 text-rose-700 hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed transition font-medium border-r border-rose-100"
                    >
                      {collectPendingLoading ? '수집 중…' : `미수집 ${collectSummary.pending}개`}
                    </button>
                    <button
                      type="button"
                      onClick={handleCollectAllYoutube}
                      disabled={youtubeChannels.length === 0 || isCollectBusy}
                      className="px-3 py-2 text-xs sm:text-sm bg-white text-rose-700 hover:bg-rose-50 disabled:opacity-40 disabled:cursor-not-allowed transition font-semibold"
                    >
                      {collectAllLoading ? '전체 수집 중…' : `전체 ${youtubeChannels.length}개`}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <details className="group border-b border-gray-100 dark:border-gray-700">
            <summary className="px-4 sm:px-5 py-2.5 text-[11px] text-gray-400 cursor-pointer hover:text-gray-600 dark:hover:text-gray-300 transition list-none flex items-center gap-1.5">
              <span className="group-open:rotate-90 transition-transform inline-block text-[10px]">▶</span>
              다른 플랫폼 수집 안내
            </summary>
            <p className="px-4 sm:px-5 pb-3 text-[11px] leading-relaxed text-gray-500 dark:text-gray-400">
              네이버 블로그·티스토리는 n8n으로 자동 수집됩니다. «플랫폼별 콘텐츠» 화면에서 수동 새로고침할 수 있으며, 틱톡·인스타그램은 아직 지원하지 않습니다.
            </p>
          </details>

          <div className="p-4 sm:p-5">
            <div className="flex items-center justify-between gap-2 mb-3">
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400">상태별 필터</p>
              {collectFilter !== 'all' && (
                <button
                  type="button"
                  onClick={() => setCollectFilter('all')}
                  className="text-[11px] text-blue-600 dark:text-blue-400 hover:underline"
                >
                  필터 해제
                </button>
              )}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {COLLECT_FILTER_CARDS.map(({ key, label, count, hint, activeRing, countClass, labelClass, bgClass }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setCollectFilter(key)}
                  aria-pressed={collectFilter === key}
                  className={`rounded-xl border p-3.5 text-left transition shadow-sm hover:shadow-md ${bgClass} ring-2 ${
                    collectFilter === key ? activeRing : 'ring-transparent'
                  }`}
                >
                  <p className={`text-2xl font-black tabular-nums leading-none ${countClass}`}>{count}</p>
                  <p className={`text-xs font-semibold mt-2 ${labelClass}`}>{label}</p>
                  <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">{hint}</p>
                </button>
              ))}
            </div>
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center h-40 text-gray-400 text-sm">
            <span className="animate-spin mr-2">⏳</span> 데이터 로딩 중...
          </div>
        ) : groups.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-gray-400 bg-white dark:bg-gray-800 rounded-2xl border border-gray-100">
            <p className="text-3xl mb-3">📭</p>
            <p className="text-sm font-medium">
              {channels.length === 0 ? '등록된 채널이 없습니다' : '선택한 필터에 해당하는 채널이 없습니다'}
            </p>
            {channels.length === 0 ? (
              <div className="flex gap-3 mt-3">
                <button onClick={() => setShowBulkImportModal(true)} className="text-sm text-teal-600 hover:underline">
                  검증 채널 일괄 등록
                </button>
                <button onClick={() => setShowAddModal(true)} className="text-sm text-blue-600 hover:underline">
                  + 첫 채널 등록
                </button>
              </div>
            ) : (
              <button type="button" onClick={() => setCollectFilter('all')} className="mt-3 text-sm text-blue-600 hover:underline">
                필터 초기화
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {/* 그룹핑 기준 토글 + 전체 펼치기/접기 */}
            <div className="flex items-center justify-between gap-2 px-1">
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] text-gray-400">그룹 기준</span>
                <div className="inline-flex rounded-lg border border-gray-200 dark:border-gray-600 overflow-hidden">
                  <button
                    type="button"
                    onClick={() => { setGroupBy('platform'); setOpenGroups(new Set(['youtube'])) }}
                    className={`px-2.5 py-1 text-xs font-medium transition ${groupBy === 'platform' ? 'bg-gray-800 text-white dark:bg-gray-200 dark:text-gray-900' : 'bg-white dark:bg-gray-800 text-gray-500 hover:text-gray-700'}`}
                  >
                    플랫폼별
                  </button>
                  <button
                    type="button"
                    onClick={() => { setGroupBy('style'); setOpenGroups(new Set(['longform', 'shortform'])) }}
                    className={`px-2.5 py-1 text-xs font-medium transition border-l border-gray-200 dark:border-gray-600 ${groupBy === 'style' ? 'bg-gray-800 text-white dark:bg-gray-200 dark:text-gray-900' : 'bg-white dark:bg-gray-800 text-gray-500 hover:text-gray-700'}`}
                  >
                    콘텐츠 스타일별
                  </button>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={expandAll}
                  className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition"
                >
                  모두 펼치기
                </button>
                <span className="text-gray-300 text-xs">|</span>
                <button
                  type="button"
                  onClick={collapseAll}
                  className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition"
                >
                  모두 접기
                </button>
              </div>
            </div>

            {groups.map(({ value, label, icon, channels: chList }) => {
              const isOpen = openGroups.has(value)
              return (
                <div key={value} className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
                  {/* 아코디언 헤더 */}
                  <button
                    type="button"
                    onClick={() => toggleGroup(value)}
                    className="w-full px-5 py-3.5 flex items-center gap-3 hover:bg-gray-50 dark:hover:bg-gray-700/60 transition text-left"
                  >
                    <span className="text-lg leading-none">{icon}</span>
                    <span className="font-bold text-sm text-gray-800 dark:text-white flex-1">{label}</span>
                    <span className="text-xs text-gray-400 bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded-full font-medium">
                      {chList.length}개
                    </span>
                    {/* 수집 상태 미니 뱃지 (YouTube 그룹에서만 — 플랫폼별 보기 한정) */}
                    {groupBy === 'platform' && value === 'youtube' && (() => {
                      const pendingCount = chList.filter(ch => getChannelCollectStatus(ch) === 'pending').length
                      const staleCount = chList.filter(ch => getChannelCollectStatus(ch) === 'stale').length
                      return (
                        <div className="flex gap-1 ml-1">
                          {pendingCount > 0 && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium">
                              대기 {pendingCount}
                            </span>
                          )}
                          {staleCount > 0 && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-orange-100 text-orange-700 font-medium">
                              갱신 {staleCount}
                            </span>
                          )}
                        </div>
                      )
                    })()}
                    <span className={`text-gray-400 transition-transform duration-200 text-sm ml-1 ${isOpen ? 'rotate-180' : ''}`}>
                      ▾
                    </span>
                  </button>

                  {/* 아코디언 콘텐츠 */}
                  {isOpen && (
                    <div className="border-t border-gray-100 dark:border-gray-700 divide-y divide-gray-100 dark:divide-gray-700">
                      {chList.map(ch => {
                        const isCollecting = !!collectingIds[ch.channel_id]
                        const status = getChannelCollectStatus(ch)
                        return (
                          <div
                            key={ch.id}
                            className="px-4 sm:px-5 py-4 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 group hover:bg-gray-50 dark:hover:bg-gray-700 transition min-w-0"
                          >
                            {/* 채널 정보 */}
                            <div className="flex-1 min-w-0 w-full sm:w-auto">
                              <div className="flex items-center gap-2 flex-wrap">
                                <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{ch.channel_name}</p>
                                {(() => {
                                  const pageUrl = getChannelPageUrl(ch.platform, ch.channel_id)
                                  if (!pageUrl) return null
                                  return (
                                    <a
                                      href={pageUrl}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      onClick={(e) => e.stopPropagation()}
                                      className="inline-flex items-center justify-center w-6 h-6 rounded-md border border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-300 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200 dark:hover:bg-blue-950/40 dark:hover:text-blue-400 shrink-0"
                                      title="채널 페이지 열기"
                                      aria-label={`${ch.channel_name} 채널 페이지 열기`}
                                    >
                                      ↗
                                    </a>
                                  )
                                })()}
                                {groupBy === 'style' && (
                                  <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-medium bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-300">
                                    {getPlatformIcon(ch.platform)} {ch.platform}
                                  </span>
                                )}
                                {ch.platform === 'youtube' && (
                                  <>
                                    {ch.tracking_status && (
                                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${trackingStatusBadgeClass(ch.tracking_status)}`}>
                                        {formatTrackingStatusLabel(ch.tracking_status)}
                                      </span>
                                    )}
                                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${collectStatusBadgeClass(status)}`}>
                                      {formatCollectStatusLabel(status)}
                                    </span>
                                  </>
                                )}
                              </div>
                              <p className="text-xs text-gray-400 mt-0.5 font-mono">{ch.channel_id}</p>
                              {ch.platform === 'youtube' && ch.last_upload_at && (
                                <p className="text-[10px] text-gray-400 mt-0.5">
                                  최근 업로드: {new Date(ch.last_upload_at).toLocaleDateString('ko-KR')}
                                </p>
                              )}
                              {ch.updated_at && status !== 'pending' && (
                                <p className="text-[10px] text-gray-400 mt-0.5">
                                  마지막 수집: {new Date(ch.updated_at).toLocaleString('ko-KR')}
                                </p>
                              )}
                            </div>

                            <ChannelCategoryField
                              compact
                              value={ch.category_id ?? ''}
                              onChange={(id) => handleQuickCategoryChange(ch.channel_id, id)}
                              categories={channelCategories}
                              onCategoriesChange={setChannelCategories}
                              onNotify={addToast}
                            />

                            {/* 통계 */}
                            <div className="flex flex-wrap items-center gap-3 sm:gap-5 text-xs text-gray-500 w-full sm:w-auto sm:shrink-0">
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
                                <span className="text-xs text-amber-600 bg-amber-50 dark:bg-amber-900/20 px-2 py-1 rounded-lg">통계 없음</span>
                              )}
                            </div>

                            {/* 액션 버튼 */}
                            <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto sm:shrink-0">
                              <button
                                onClick={() => handleCollect(ch)}
                                disabled={isCollecting || isCollectBusy}
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
                                type="button"
                                onClick={() => setEditingChannel(ch)}
                                disabled={isCollecting || isCollectBusy}
                                className="opacity-0 group-hover:opacity-100 transition px-2 py-1.5 text-xs text-gray-600 hover:text-blue-600 dark:text-gray-400 disabled:opacity-30"
                              >
                                수정
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteChannel(ch.channel_id, ch.channel_name)}
                                disabled={isCollecting || isCollectBusy}
                                className="opacity-0 group-hover:opacity-100 transition px-2 py-1.5 text-xs text-red-400 hover:text-red-600 disabled:opacity-30"
                              >
                                삭제
                              </button>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
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

// ─── 네이버 블로그 검색 탭 ────────────────────────────────────
interface NaverBlogItem {
  title: string
  link: string
  description: string
  bloggername: string
  bloggerlink: string
  postdate: string
}

interface CategorySearchState {
  status: 'idle' | 'loading' | 'done' | 'error'
  items: NaverBlogItem[]
  total: number
  error?: string
  isOpen: boolean
}

function NaverBlogSearchTab() {
  const [categories, setCategories] = useState<ChannelCategoryOption[]>([])
  const [isCatsLoading, setIsCatsLoading] = useState(true)

  // 검색 상태
  const [inputKeyword, setInputKeyword] = useState('')
  const [activeKeyword, setActiveKeyword] = useState('')
  const [sort, setSort] = useState<'sim' | 'date'>('sim')
  const [status, setStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle')
  const [results, setResults] = useState<NaverBlogItem[]>([])
  const [total, setTotal] = useState(0)
  const [searchError, setSearchError] = useState('')

  const isSearchMode = activeKeyword !== ''

  useEffect(() => {
    fetch('/api/dashboard/channel-categories')
      .then(r => r.json())
      .then((data: ChannelCategoryOption[]) => setCategories(data))
      .catch(() => {})
      .finally(() => setIsCatsLoading(false))
  }, [])

  const doSearch = async (q: string, sortOrder: 'sim' | 'date') => {
    if (!q.trim()) return
    setStatus('loading')
    setSearchError('')
    setResults([])
    setTotal(0)
    try {
      const res = await fetch(
        `/api/dashboard/naver-blog-search?keyword=${encodeURIComponent(q)}&display=10&sort=${sortOrder}`
      )
      const data = await res.json()
      if (!res.ok) {
        setStatus('error')
        setSearchError(data.error ?? '검색 중 오류가 발생했습니다')
        return
      }
      setResults(data.items ?? [])
      setTotal(data.total ?? 0)
      setStatus('done')
    } catch {
      setStatus('error')
      setSearchError('네트워크 오류가 발생했습니다')
    }
  }

  const handleSearch = (q: string) => {
    if (!q.trim()) return
    setActiveKeyword(q.trim())
    void doSearch(q.trim(), sort)
  }

  const handleSortChange = (newSort: 'sim' | 'date') => {
    setSort(newSort)
    if (isSearchMode) void doSearch(activeKeyword, newSort)
  }

  const clearSearch = () => {
    setActiveKeyword('')
    setInputKeyword('')
    setResults([])
    setTotal(0)
    setStatus('idle')
    setSearchError('')
  }

  if (isCatsLoading) {
    return (
      <div className="flex items-center justify-center h-40 text-gray-400 text-sm">
        <span className="animate-spin mr-2">⏳</span> 카테고리 로딩 중...
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* 검색 바 + 정렬 */}
      <div className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-950/30 border border-green-100 dark:border-green-800 rounded-2xl p-4 sm:p-5 space-y-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div>
            <h3 className="text-sm font-bold text-gray-900 dark:text-white">🔍 네이버 블로그 검색</h3>
            <p className="text-xs text-gray-500 mt-0.5">카테고리를 클릭하거나 키워드를 입력해 블로그 글을 검색합니다.</p>
          </div>
          {/* 정렬 토글 */}
          <div className="flex items-center gap-1 bg-white dark:bg-gray-700 rounded-lg p-1 border border-gray-200 dark:border-gray-600">
            <button
              type="button"
              onClick={() => handleSortChange('sim')}
              className={`px-3 py-1 text-xs rounded-md font-medium transition ${sort === 'sim' ? 'bg-green-600 text-white' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
            >
              🔗 관련도순
            </button>
            <button
              type="button"
              onClick={() => handleSortChange('date')}
              className={`px-3 py-1 text-xs rounded-md font-medium transition ${sort === 'date' ? 'bg-green-600 text-white' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
            >
              🕐 최신순
            </button>
          </div>
        </div>

        {/* 키워드 검색 입력 */}
        <form
          onSubmit={e => { e.preventDefault(); handleSearch(inputKeyword) }}
          className="flex gap-2"
        >
          <input
            value={inputKeyword}
            onChange={e => setInputKeyword(e.target.value)}
            placeholder="직접 키워드 검색 (예: 부동산 투자 방법)"
            className="flex-1 px-3 py-2 text-sm border border-green-200 dark:border-green-700 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-green-500"
          />
          <button
            type="submit"
            disabled={!inputKeyword.trim() || status === 'loading'}
            className="px-4 py-2 text-sm bg-gray-900 text-white rounded-xl hover:bg-gray-700 disabled:opacity-40 transition font-medium"
          >
            검색
          </button>
          {isSearchMode && (
            <button
              type="button"
              onClick={clearSearch}
              className="px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-600 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-600 transition"
            >
              ✕
            </button>
          )}
        </form>
      </div>

      {/* ── 일반 모드: 카테고리 그리드 ── */}
      {!isSearchMode && (
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-5">
          <p className="text-xs text-gray-400 mb-3">카테고리를 클릭하면 해당 주제의 블로그 글을 검색합니다</p>
          {categories.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-4">
              채널 등록 탭에서 채널에 카테고리를 지정하면 여기서 검색할 수 있습니다.
            </p>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
              {categories.map(cat => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => handleSearch(cat.name)}
                  className="flex flex-col items-center gap-1.5 px-2 py-3 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/60 hover:border-green-300 hover:bg-green-50 dark:hover:border-green-700 dark:hover:bg-green-900/20 transition text-center group"
                >
                  <span className="text-xl leading-none">{cat.icon}</span>
                  <span className="text-xs font-medium text-gray-700 dark:text-gray-200 group-hover:text-green-700 dark:group-hover:text-green-400 leading-tight">
                    {cat.name}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── 검색 모드: 결과 패널 ── */}
      {isSearchMode && (
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 overflow-hidden">
          {/* 결과 헤더 */}
          <div className="px-5 py-3.5 flex items-center justify-between border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-bold text-gray-900 dark:text-white">
                「{activeKeyword}」 블로그
              </span>
              <span className="text-xs text-gray-400 bg-white dark:bg-gray-800 px-2 py-0.5 rounded-full border border-gray-200 dark:border-gray-600">
                {sort === 'sim' ? '🔗 관련도순' : '🕐 최신순'}
              </span>
              {status === 'done' && total > 0 && (
                <span className="text-xs text-gray-400">총 {total.toLocaleString()}건 중 상위 {results.length}개</span>
              )}
            </div>
            <button
              type="button"
              onClick={clearSearch}
              className="text-xs text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 flex items-center gap-1 transition"
            >
              ✕ 초기화
            </button>
          </div>

          {/* 카테고리 빠른 전환 */}
          <div className="px-5 py-2.5 flex gap-1.5 flex-wrap border-b border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800">
            {categories.map(cat => (
              <button
                key={cat.id}
                type="button"
                onClick={() => handleSearch(cat.name)}
                disabled={status === 'loading'}
                className={`px-2.5 py-1 text-xs rounded-full font-medium transition border
                  ${activeKeyword === cat.name
                    ? 'bg-green-600 text-white border-green-600'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 border-transparent hover:border-green-300 hover:bg-green-50 dark:hover:bg-green-900/20'
                  } disabled:opacity-50`}
              >
                {cat.icon} {cat.name}
              </button>
            ))}
          </div>

          {/* 검색 결과 */}
          {status === 'loading' && (
            <div className="py-12 text-center text-sm text-gray-400">
              <svg className="animate-spin w-6 h-6 mx-auto mb-2 text-green-400" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
              </svg>
              네이버 블로그 검색 중…
            </div>
          )}
          {status === 'error' && (
            <div className="py-10 text-center text-sm text-red-500">❌ {searchError}</div>
          )}
          {status === 'done' && results.length === 0 && (
            <div className="py-10 text-center text-sm text-gray-400">검색 결과가 없습니다.</div>
          )}
          {status === 'done' && results.length > 0 && (
            <div className="divide-y divide-gray-50 dark:divide-gray-700/60">
              {results.map((item, idx) => (
                <div key={idx} className="px-5 py-4 flex gap-3 hover:bg-gray-50 dark:hover:bg-gray-700/60 transition">
                  {/* 순위 */}
                  <span className="shrink-0 w-5 h-5 rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-[11px] font-bold flex items-center justify-center mt-0.5">
                    {idx + 1}
                  </span>

                  {/* 본문 */}
                  <div className="flex-1 min-w-0">
                    <a
                      href={item.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm font-semibold text-gray-900 dark:text-white hover:text-green-600 hover:underline line-clamp-1"
                    >
                      {item.title}
                    </a>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-2">{item.description}</p>

                    {/* 메타 + 채널 액션 */}
                    <div className="flex items-center flex-wrap gap-x-3 gap-y-1 mt-2 text-[11px]">
                      {/* 블로거명 → 채널 링크 */}
                      {item.bloggerlink ? (
                        <a
                          href={item.bloggerlink.startsWith('http') ? item.bloggerlink : `https://${item.bloggerlink}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-medium text-green-700 dark:text-green-400 hover:underline"
                        >
                          ✍️ {item.bloggername}
                        </a>
                      ) : (
                        <span className="font-medium text-green-700 dark:text-green-400">✍️ {item.bloggername}</span>
                      )}
                      <span className="text-gray-400">{item.postdate}</span>
                      <a
                        href={item.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-400 hover:underline"
                      >
                        글 보기 ↗
                      </a>
                      {item.bloggerlink && (
                        <>
                          <a
                            href={item.bloggerlink.startsWith('http') ? item.bloggerlink : `https://${item.bloggerlink}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-2 py-0.5 rounded-md border border-green-200 dark:border-green-700 text-green-700 dark:text-green-400 hover:bg-green-600 hover:text-white hover:border-green-600 transition"
                          >
                            채널 방문
                          </a>
                          <a
                            href={item.bloggerlink.startsWith('http') ? item.bloggerlink : `https://${item.bloggerlink}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-2 py-0.5 rounded-md bg-green-600 text-white hover:bg-green-700 dark:hover:bg-green-500 transition"
                          >
                            + 구독
                          </a>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              <div className="px-5 py-2 bg-gray-50 dark:bg-gray-700/40 text-[11px] text-gray-400 text-right">
                네이버 블로그 · {sort === 'sim' ? '관련도 높은 순' : '최신 등록 순'} · 상위 {results.length}개
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/** 채널 카테고리 → AddBenchmarkModal용 Category 변환 */
function channelCatToCategory(c: ChannelCategoryOption): Category {
  return {
    id: c.id,
    name: `${c.icon} ${c.name}`,
    bgColor: c.bg_color ?? '#6B7280',
    textColor: 'auto',
    createdAt: '',
  }
}

// ─── YouTube 숏폼 검색 탭 ────────────────────────────────────
interface YoutubeItem {
  videoId: string
  title: string
  channelTitle: string
  publishedAt: string
  thumbnailUrl: string
  viewCount: number | null
  likeCount: number | null
  duration: string
  url: string
  /** 채널 평균 조회수 대비 배율 (정보 없으면 null) */
  vsAvg: number | null
}

type YoutubeSortMode = 'viewCount' | 'date' | 'vsAvgRecent'

interface YtCategorySearchState {
  status: 'idle' | 'loading' | 'done' | 'error'
  items: YoutubeItem[]
  error?: string
  isOpen: boolean
}

function fmtViews(n: number | null): string {
  if (n == null) return '-'
  if (n >= 100_000_000) return `${(n / 100_000_000).toFixed(1)}억`
  if (n >= 10_000) return `${Math.floor(n / 10_000)}만`
  return n.toLocaleString()
}

function YoutubeSearchTab({ addToast }: { addToast: (m: string, t?: 'success' | 'info' | 'warning') => void }) {
  const [categories, setCategories] = useState<ChannelCategoryOption[]>([])
  const [isCatsLoading, setIsCatsLoading] = useState(true)
  const [registerTarget, setRegisterTarget] = useState<YoutubeItem | null>(null)

  // 검색 상태
  const [inputKeyword, setInputKeyword] = useState('')
  const [activeKeyword, setActiveKeyword] = useState('') // 비어있으면 일반모드
  const [sort, setSort] = useState<YoutubeSortMode>('viewCount')
  const [status, setStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle')
  const [results, setResults] = useState<YoutubeItem[]>([])
  const [searchError, setSearchError] = useState('')

  const isSearchMode = activeKeyword !== ''

  // 채널 카테고리 → 모달용 Category[] (검색에 쓴 카테고리와 동일하게 표시)
  const modalCategories = categories.map(channelCatToCategory)

  // 현재 검색 키워드와 이름이 일치하는 카테고리 ID (모달 초기 선택)
  const matchedCategoryId = categories.find(c => c.name === activeKeyword)?.id ?? ''

  useEffect(() => {
    fetch('/api/dashboard/channel-categories')
      .then(r => r.json())
      .then((data: ChannelCategoryOption[]) => setCategories(data))
      .catch(() => {})
      .finally(() => setIsCatsLoading(false))
  }, [])

  const doSearch = async (q: string, sortMode: YoutubeSortMode) => {
    if (!q.trim()) return
    setStatus('loading')
    setSearchError('')
    setResults([])
    try {
      // '최신 중 vs avg 높은 순'은 «최신 영상들 중에서» 골라야 하므로 검색 자체는 최신순으로 받아온다
      const apiOrder = sortMode === 'viewCount' ? 'viewCount' : 'date'
      const res = await fetch(
        `/api/dashboard/youtube-search?keyword=${encodeURIComponent(q)}&type=shorts&display=10&order=${apiOrder}`
      )
      const data = await res.json()
      if (!res.ok) {
        setStatus('error')
        setSearchError(data.error ?? '검색 중 오류가 발생했습니다')
        return
      }
      const items: YoutubeItem[] = data.items ?? []
      // 받아온 최신 영상들을 vsAvg(채널 평균 대비 배율) 높은 순으로 재정렬
      setResults(
        sortMode === 'vsAvgRecent'
          ? [...items].sort((a, b) => (b.vsAvg ?? 0) - (a.vsAvg ?? 0))
          : items
      )
      setStatus('done')
    } catch {
      setStatus('error')
      setSearchError('네트워크 오류가 발생했습니다')
    }
  }

  const handleSearch = (q: string) => {
    if (!q.trim()) return
    setActiveKeyword(q.trim())
    void doSearch(q.trim(), sort)
  }

  const handleSortChange = (newSort: YoutubeSortMode) => {
    setSort(newSort)
    if (isSearchMode) void doSearch(activeKeyword, newSort)
  }

  const clearSearch = () => {
    setActiveKeyword('')
    setInputKeyword('')
    setResults([])
    setStatus('idle')
    setSearchError('')
  }

  if (isCatsLoading) {
    return (
      <div className="flex items-center justify-center h-40 text-gray-400 text-sm">
        <span className="animate-spin mr-2">⏳</span> 카테고리 로딩 중...
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* 콘텐츠 등록 모달 */}
      {registerTarget && (
        <AddBenchmarkModal
          categories={modalCategories}
          initialUrl={registerTarget.url}
          initialTitle={registerTarget.title}
          initialViews={registerTarget.viewCount}
          initialCategoryId={matchedCategoryId}
          onAdd={(bm) => {
            addToast(`"${bm.title}" 콘텐츠가 등록됐습니다 📌`, 'success')
            setRegisterTarget(null)
          }}
          onClose={() => setRegisterTarget(null)}
        />
      )}

      {/* 검색 바 + 정렬 */}
      <div className="bg-gradient-to-r from-red-50 to-orange-50 dark:from-red-950/30 dark:to-orange-950/30 border border-red-100 dark:border-red-800 rounded-2xl p-4 sm:p-5 space-y-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div>
            <h3 className="text-sm font-bold text-gray-900 dark:text-white">📺 YouTube Shorts 검색</h3>
            <p className="text-xs text-gray-500 mt-0.5">카테고리를 클릭하거나 키워드를 입력해 Shorts를 검색합니다.</p>
          </div>
          {/* 정렬 토글 */}
          <div className="flex items-center gap-1 bg-white dark:bg-gray-700 rounded-lg p-1 border border-gray-200 dark:border-gray-600">
            <button
              type="button"
              onClick={() => handleSortChange('viewCount')}
              className={`px-3 py-1 text-xs rounded-md font-medium transition ${sort === 'viewCount' ? 'bg-red-600 text-white' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
            >
              👁 조회수순
            </button>
            <button
              type="button"
              onClick={() => handleSortChange('date')}
              className={`px-3 py-1 text-xs rounded-md font-medium transition ${sort === 'date' ? 'bg-red-600 text-white' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
            >
              🕐 최신순
            </button>
            <button
              type="button"
              onClick={() => handleSortChange('vsAvgRecent')}
              title="최근 등록된 영상들 중 채널 평균 조회수 대비 배율(vs.Avg)이 높은 순"
              className={`px-3 py-1 text-xs rounded-md font-medium transition ${sort === 'vsAvgRecent' ? 'bg-red-600 text-white' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
            >
              🚀 최신·vs.Avg순
            </button>
          </div>
        </div>

        {/* 키워드 검색 입력 */}
        <form
          onSubmit={e => { e.preventDefault(); handleSearch(inputKeyword) }}
          className="flex gap-2"
        >
          <input
            value={inputKeyword}
            onChange={e => setInputKeyword(e.target.value)}
            placeholder="직접 키워드 검색 (예: 주식 투자 방법)"
            className="flex-1 px-3 py-2 text-sm border border-red-200 dark:border-red-700 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500"
          />
          <button
            type="submit"
            disabled={!inputKeyword.trim() || status === 'loading'}
            className="px-4 py-2 text-sm bg-gray-900 text-white rounded-xl hover:bg-gray-700 disabled:opacity-40 transition font-medium"
          >
            검색
          </button>
          {isSearchMode && (
            <button
              type="button"
              onClick={clearSearch}
              className="px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-600 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-600 transition"
            >
              ✕
            </button>
          )}
        </form>
      </div>

      {/* ── 일반 모드: 카테고리 그리드 ── */}
      {!isSearchMode && (
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-5">
          <p className="text-xs text-gray-400 mb-3">카테고리를 클릭하면 해당 주제의 YouTube Shorts를 검색합니다</p>
          {categories.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-4">
              채널 등록 탭에서 채널에 카테고리를 지정하면 여기서 검색할 수 있습니다.
            </p>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
              {categories.map(cat => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => handleSearch(cat.name)}
                  className="flex flex-col items-center gap-1.5 px-2 py-3 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/60 hover:border-red-300 hover:bg-red-50 dark:hover:border-red-700 dark:hover:bg-red-900/20 transition text-center group"
                >
                  <span className="text-xl leading-none">{cat.icon}</span>
                  <span className="text-xs font-medium text-gray-700 dark:text-gray-200 group-hover:text-red-700 dark:group-hover:text-red-400 leading-tight">
                    {cat.name}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── 검색 모드: 결과 패널 ── */}
      {isSearchMode && (
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 overflow-hidden">
          {/* 결과 헤더 */}
          <div className="px-5 py-3.5 flex items-center justify-between border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-bold text-gray-900 dark:text-white">
                「{activeKeyword}」 Shorts
              </span>
              <span className="text-xs text-gray-400 bg-white dark:bg-gray-800 px-2 py-0.5 rounded-full border border-gray-200 dark:border-gray-600">
                {sort === 'viewCount' ? '👁 조회수순' : sort === 'date' ? '🕐 최신순' : '🚀 최신·vs.Avg순'}
              </span>
              {status === 'done' && results.length > 0 && (
                <span className="text-xs text-gray-400">{results.length}개</span>
              )}
            </div>
            <button
              type="button"
              onClick={clearSearch}
              className="text-xs text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 flex items-center gap-1 transition"
            >
              ✕ 초기화
            </button>
          </div>

          {/* 카테고리 빠른 전환 */}
          <div className="px-5 py-2.5 flex gap-1.5 flex-wrap border-b border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800">
            {categories.map(cat => (
              <button
                key={cat.id}
                type="button"
                onClick={() => handleSearch(cat.name)}
                disabled={status === 'loading'}
                className={`px-2.5 py-1 text-xs rounded-full font-medium transition border
                  ${activeKeyword === cat.name
                    ? 'bg-red-600 text-white border-red-600'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 border-transparent hover:border-red-300 hover:bg-red-50 dark:hover:bg-red-900/20'
                  } disabled:opacity-50`}
              >
                {cat.icon} {cat.name}
              </button>
            ))}
          </div>

          {/* 검색 결과 */}
          {status === 'loading' && (
            <div className="py-12 text-center text-sm text-gray-400">
              <svg className="animate-spin w-6 h-6 mx-auto mb-2 text-red-400" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
              </svg>
              YouTube Shorts 검색 중…
            </div>
          )}
          {status === 'error' && (
            <div className="py-10 text-center text-sm text-red-500">❌ {searchError}</div>
          )}
          {status === 'done' && results.length === 0 && (
            <div className="py-10 text-center text-sm text-gray-400">검색 결과가 없습니다.</div>
          )}
          {status === 'done' && results.length > 0 && (
            <div className="divide-y divide-gray-50 dark:divide-gray-700/60">
              {results.map((item, idx) => (
                <div key={item.videoId} className="px-4 sm:px-5 py-3.5 flex items-center gap-3 sm:gap-4 hover:bg-gray-50 dark:hover:bg-gray-700/60 transition">
                  {/* 순위 */}
                  <span className="shrink-0 w-6 h-6 rounded-full bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 text-xs font-bold flex items-center justify-center">
                    {idx + 1}
                  </span>

                  {/* 썸네일 */}
                  {item.thumbnailUrl && (
                    <a href={item.url} target="_blank" rel="noopener noreferrer" className="shrink-0">
                      <div className="relative w-[72px] h-[40px] rounded-lg overflow-hidden bg-gray-200 dark:bg-gray-700">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={item.thumbnailUrl} alt={item.title} className="w-full h-full object-cover" />
                        {item.duration && (
                          <span className="absolute bottom-0.5 right-0.5 px-1 py-0.5 text-[9px] bg-black/80 text-white rounded font-mono leading-none">
                            {item.duration}
                          </span>
                        )}
                      </div>
                    </a>
                  )}

                  {/* 정보 */}
                  <div className="flex-1 min-w-0">
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm font-semibold text-gray-900 dark:text-white hover:text-red-600 hover:underline line-clamp-2 leading-snug"
                    >
                      {item.title}
                    </a>
                    <div className="flex items-center flex-wrap gap-x-3 gap-y-0.5 mt-1 text-[11px] text-gray-400">
                      <span className="font-medium text-red-700 dark:text-red-400">🔴 {item.channelTitle}</span>
                      <span>👁 {fmtViews(item.viewCount)}</span>
                      {item.vsAvg != null && (
                        <span className="font-bold text-green-600 dark:text-green-400">🚀 {item.vsAvg}x</span>
                      )}
                      {item.likeCount != null && <span>👍 {fmtViews(item.likeCount)}</span>}
                      <span>{item.publishedAt}</span>
                      <a href={item.url} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">
                        Shorts ↗
                      </a>
                    </div>
                  </div>

                  {/* 콘텐츠 등록 버튼 */}
                  <button
                    type="button"
                    onClick={() => setRegisterTarget(item)}
                    className="shrink-0 px-2.5 py-1.5 text-xs font-medium rounded-lg border border-blue-200 text-blue-600 bg-blue-50 hover:bg-blue-600 hover:text-white hover:border-blue-600 dark:border-blue-700 dark:text-blue-400 dark:bg-blue-900/20 dark:hover:bg-blue-600 dark:hover:text-white transition whitespace-nowrap"
                  >
                    + 등록
                  </button>
                </div>
              ))}
              <div className="px-5 py-2 bg-gray-50 dark:bg-gray-700/40 text-[11px] text-gray-400 text-right">
                YouTube Shorts · {sort === 'viewCount' ? '조회수 높은 순' : sort === 'date' ? '최신 등록 순' : '최신 영상 중 vs.Avg 높은 순'} · 상위 10개
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── 티스토리 검색 탭 ────────────────────────────────────────
interface TistoryItem {
  title: string
  link: string
  description: string
  blogId: string
  blogHome: string
}

function TistorySearchTab() {
  const [categories, setCategories] = useState<ChannelCategoryOption[]>([])
  const [isCatsLoading, setIsCatsLoading] = useState(true)

  const [inputKeyword, setInputKeyword] = useState('')
  const [activeKeyword, setActiveKeyword] = useState('')
  const [status, setStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle')
  const [results, setResults] = useState<TistoryItem[]>([])
  const [total, setTotal] = useState(0)
  const [searchError, setSearchError] = useState('')

  const isSearchMode = activeKeyword !== ''

  useEffect(() => {
    fetch('/api/dashboard/channel-categories')
      .then(r => r.json())
      .then((data: ChannelCategoryOption[]) => setCategories(data))
      .catch(() => {})
      .finally(() => setIsCatsLoading(false))
  }, [])

  const doSearch = async (q: string) => {
    if (!q.trim()) return
    setStatus('loading')
    setSearchError('')
    setResults([])
    setTotal(0)
    try {
      const res = await fetch(
        `/api/dashboard/tistory-search?keyword=${encodeURIComponent(q)}&display=10`
      )
      const data = await res.json()
      if (!res.ok) {
        setStatus('error')
        setSearchError(data.error ?? '검색 중 오류가 발생했습니다')
        return
      }
      setResults(data.items ?? [])
      setTotal(data.total ?? 0)
      setStatus('done')
    } catch {
      setStatus('error')
      setSearchError('네트워크 오류가 발생했습니다')
    }
  }

  const handleSearch = (q: string) => {
    if (!q.trim()) return
    setActiveKeyword(q.trim())
    void doSearch(q.trim())
  }

  const clearSearch = () => {
    setActiveKeyword('')
    setInputKeyword('')
    setResults([])
    setTotal(0)
    setStatus('idle')
    setSearchError('')
  }

  if (isCatsLoading) {
    return (
      <div className="flex items-center justify-center h-40 text-gray-400 text-sm">
        <span className="animate-spin mr-2">⏳</span> 카테고리 로딩 중...
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* 검색 바 */}
      <div className="bg-gradient-to-r from-orange-50 to-amber-50 dark:from-orange-950/30 dark:to-amber-950/30 border border-orange-100 dark:border-orange-800 rounded-2xl p-4 sm:p-5 space-y-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div>
            <h3 className="text-sm font-bold text-gray-900 dark:text-white">🟠 티스토리 검색</h3>
            <p className="text-xs text-gray-500 mt-0.5">카테고리를 클릭하거나 키워드를 입력해 티스토리 글을 검색합니다.</p>
          </div>
          {isSearchMode && total > 0 && (
            <span className="text-xs text-gray-400 bg-white dark:bg-gray-700 px-2 py-1 rounded-full border border-orange-100 dark:border-orange-800">
              총 {total.toLocaleString()}건 중 상위 {results.length}개
            </span>
          )}
        </div>

        {/* 키워드 입력 */}
        <form
          onSubmit={e => { e.preventDefault(); handleSearch(inputKeyword) }}
          className="flex gap-2"
        >
          <input
            value={inputKeyword}
            onChange={e => setInputKeyword(e.target.value)}
            placeholder="직접 키워드 검색 (예: 주식 투자 전략)"
            className="flex-1 px-3 py-2 text-sm border border-orange-200 dark:border-orange-700 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
          />
          <button
            type="submit"
            disabled={!inputKeyword.trim() || status === 'loading'}
            className="px-4 py-2 text-sm bg-gray-900 text-white rounded-xl hover:bg-gray-700 disabled:opacity-40 transition font-medium"
          >
            검색
          </button>
          {isSearchMode && (
            <button
              type="button"
              onClick={clearSearch}
              className="px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-600 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-600 transition"
            >
              ✕
            </button>
          )}
        </form>
      </div>

      {/* ── 일반 모드: 카테고리 그리드 ── */}
      {!isSearchMode && (
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-5">
          <p className="text-xs text-gray-400 mb-3">카테고리를 클릭하면 해당 주제의 티스토리 글을 검색합니다</p>
          {categories.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-4">
              채널 등록 탭에서 채널에 카테고리를 지정하면 여기서 검색할 수 있습니다.
            </p>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
              {categories.map(cat => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => handleSearch(cat.name)}
                  className="flex flex-col items-center gap-1.5 px-2 py-3 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/60 hover:border-orange-300 hover:bg-orange-50 dark:hover:border-orange-700 dark:hover:bg-orange-900/20 transition text-center group"
                >
                  <span className="text-xl leading-none">{cat.icon}</span>
                  <span className="text-xs font-medium text-gray-700 dark:text-gray-200 group-hover:text-orange-700 dark:group-hover:text-orange-400 leading-tight">
                    {cat.name}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── 검색 모드: 결과 패널 ── */}
      {isSearchMode && (
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 overflow-hidden">
          {/* 결과 헤더 */}
          <div className="px-5 py-3.5 flex items-center justify-between border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50">
            <span className="text-sm font-bold text-gray-900 dark:text-white">
              「{activeKeyword}」 티스토리
            </span>
            <button
              type="button"
              onClick={clearSearch}
              className="text-xs text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 flex items-center gap-1 transition"
            >
              ✕ 초기화
            </button>
          </div>

          {/* 카테고리 빠른 전환 */}
          <div className="px-5 py-2.5 flex gap-1.5 flex-wrap border-b border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800">
            {categories.map(cat => (
              <button
                key={cat.id}
                type="button"
                onClick={() => handleSearch(cat.name)}
                disabled={status === 'loading'}
                className={`px-2.5 py-1 text-xs rounded-full font-medium transition border
                  ${activeKeyword === cat.name
                    ? 'bg-orange-600 text-white border-orange-600'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 border-transparent hover:border-orange-300 hover:bg-orange-50 dark:hover:bg-orange-900/20'
                  } disabled:opacity-50`}
              >
                {cat.icon} {cat.name}
              </button>
            ))}
          </div>

          {/* 검색 결과 */}
          {status === 'loading' && (
            <div className="py-12 text-center text-sm text-gray-400">
              <svg className="animate-spin w-6 h-6 mx-auto mb-2 text-orange-400" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
              </svg>
              티스토리 검색 중…
            </div>
          )}
          {status === 'error' && (
            <div className="py-10 text-center text-sm text-red-500">❌ {searchError}</div>
          )}
          {status === 'done' && results.length === 0 && (
            <div className="py-10 text-center text-sm text-gray-400">검색 결과가 없습니다.</div>
          )}
          {status === 'done' && results.length > 0 && (
            <div className="divide-y divide-gray-50 dark:divide-gray-700/60">
              {results.map((item, idx) => (
                <div key={idx} className="px-5 py-4 flex gap-3 hover:bg-gray-50 dark:hover:bg-gray-700/60 transition">
                  {/* 순위 */}
                  <span className="shrink-0 w-5 h-5 rounded-full bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 text-[11px] font-bold flex items-center justify-center mt-0.5">
                    {idx + 1}
                  </span>

                  {/* 본문 */}
                  <div className="flex-1 min-w-0">
                    <a
                      href={item.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm font-semibold text-gray-900 dark:text-white hover:text-orange-600 hover:underline line-clamp-1"
                    >
                      {item.title}
                    </a>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-2">{item.description}</p>

                    {/* 메타 + 채널 액션 */}
                    <div className="flex items-center flex-wrap gap-x-3 gap-y-1 mt-2 text-[11px]">
                      {/* 블로그 ID → 홈 링크 */}
                      <a
                        href={item.blogHome}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-medium text-orange-700 dark:text-orange-400 hover:underline"
                      >
                        ✍️ {item.blogId}.tistory.com
                      </a>
                      <a
                        href={item.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-400 hover:underline"
                      >
                        글 보기 ↗
                      </a>
                      <a
                        href={item.blogHome}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-2 py-0.5 rounded-md border border-orange-200 dark:border-orange-700 text-orange-700 dark:text-orange-400 hover:bg-orange-600 hover:text-white hover:border-orange-600 transition"
                      >
                        채널 방문
                      </a>
                      <a
                        href={`${item.blogHome}/guestbook`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-2 py-0.5 rounded-md bg-orange-600 text-white hover:bg-orange-700 dark:hover:bg-orange-500 transition"
                      >
                        + 구독
                      </a>
                    </div>
                  </div>
                </div>
              ))}
              <div className="px-5 py-2 bg-gray-50 dark:bg-gray-700/40 text-[11px] text-gray-400 text-right">
                티스토리 · 관련도 높은 순 · 상위 {results.length}개
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── 메인 뷰 ─────────────────────────────────────────────────
type TabType = 'benchmarks' | 'channels' | 'blog-search' | 'youtube-search' | 'tistory-search'

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
        <div className="flex items-center justify-between flex-wrap gap-2">
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
            <button
              onClick={() => setActiveTab('blog-search')}
              className={`px-4 py-1.5 text-sm rounded-lg font-medium transition ${activeTab === 'blog-search' ? 'bg-white dark:bg-gray-800 shadow-sm text-gray-900 dark:text-white' : 'text-gray-500 hover:text-gray-700'}`}
            >
              🟢 네이버 블로그
            </button>
            <button
              onClick={() => setActiveTab('youtube-search')}
              className={`px-4 py-1.5 text-sm rounded-lg font-medium transition ${activeTab === 'youtube-search' ? 'bg-white dark:bg-gray-800 shadow-sm text-gray-900 dark:text-white' : 'text-gray-500 hover:text-gray-700'}`}
            >
              🔴 유튜브 Shorts
            </button>
            <button
              onClick={() => setActiveTab('tistory-search')}
              className={`px-4 py-1.5 text-sm rounded-lg font-medium transition ${activeTab === 'tistory-search' ? 'bg-white dark:bg-gray-800 shadow-sm text-gray-900 dark:text-white' : 'text-gray-500 hover:text-gray-700'}`}
            >
              🟠 티스토리
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

        {/* 블로그 검색 탭 */}
        {activeTab === 'blog-search' && <NaverBlogSearchTab />}

        {/* YouTube 숏폼 검색 탭 */}
        {activeTab === 'youtube-search' && <YoutubeSearchTab addToast={addToast} />}

        {/* 티스토리 검색 탭 */}
        {activeTab === 'tistory-search' && <TistorySearchTab />}

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
