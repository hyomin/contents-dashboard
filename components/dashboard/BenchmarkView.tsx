'use client'

import { useState } from 'react'
import {
  Category, BenchmarkItem,
  DEFAULT_CATEGORIES, DEFAULT_BENCHMARKS,
  getCategoryStyle, resolveTextColor, autoTextColor,
} from '@/lib/categories'

// ─── 플랫폼 헬퍼 ────────────────────────────────────────────
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

function formatViews(v?: number) {
  if (!v) return '-'
  return v >= 10000 ? `${(v / 10000).toFixed(1)}만` : v.toLocaleString()
}

// ─── 카테고리 태그 컴포넌트 ──────────────────────────────────
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
            {/* 색상 피커 */}
            <div className="flex items-center gap-2">
              <label className="text-xs text-gray-500 whitespace-nowrap">배경색</label>
              <div className="relative">
                <input
                  type="color"
                  value={newBgColor}
                  onChange={e => setNewBgColor(e.target.value)}
                  className="w-10 h-10 rounded-lg border border-gray-200 cursor-pointer p-0.5 bg-white"
                  title="색상 선택"
                />
              </div>
              <span className="text-xs font-mono text-gray-500 uppercase">{newBgColor}</span>
            </div>
          </div>

          {/* 글씨 색상 */}
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

          {/* 미리보기 */}
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xs text-gray-500">미리보기:</span>
            <span
              className="px-3 py-1 text-sm rounded-full border font-medium"
              style={previewStyle(newBgColor, newTextColor)}
            >
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
                  /* 편집 모드 */
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
                      <span
                        className="px-3 py-1 text-sm rounded-full border font-medium"
                        style={previewStyle(editBgColor, editTextColor)}
                      >
                        {editName || '카테고리명'}
                      </span>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => saveEdit(cat.id)} className="flex-1 py-1.5 bg-blue-600 text-white text-xs rounded-lg hover:bg-blue-700 transition">저장</button>
                      <button onClick={() => setEditingId(null)} className="flex-1 py-1.5 bg-gray-200 text-gray-700 text-xs rounded-lg hover:bg-gray-300 transition">취소</button>
                    </div>
                  </div>
                ) : (
                  /* 기본 표시 */
                  <div className="p-3 flex items-center gap-3">
                    <span
                      className="px-3 py-1 text-sm rounded-full border font-medium"
                      style={{ background: style.background, color: style.color, borderColor: style.border }}
                    >
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

// ─── 벤치마킹 추가 폼 ────────────────────────────────────────
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

  const platform = detectPlatform(url)
  const platformInfo = PLATFORMS.find(p => p.value === platform)
  const selectedCat = categories.find(c => c.id === categoryId)

  const handleAdd = () => {
    if (!url.trim() || !title.trim() || !categoryId) return
    const item: BenchmarkItem = {
      id: `bm-${Date.now()}`,
      url: url.trim(),
      title: title.trim(),
      memo: memo.trim(),
      categoryId,
      platform,
      addedAt: '방금',
      views: views ? parseInt(views.replace(/,/g, '')) : undefined,
      vsAvg: vsAvg ? parseFloat(vsAvg) : undefined,
    }
    onAdd(item)
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-lg p-6" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white">🔖 벤치마킹 추가</h3>
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
              placeholder="참고할 점, 벤치마킹 이유 등..."
              rows={2}
              className="w-full px-3 py-2.5 text-sm border border-gray-200 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button
            onClick={handleAdd}
            disabled={!url.trim() || !title.trim() || !categoryId}
            className="flex-1 py-2.5 bg-blue-600 text-white text-sm rounded-xl hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition font-medium"
          >
            저장
          </button>
          <button onClick={onClose} className="flex-1 py-2.5 bg-gray-100 text-gray-700 text-sm rounded-xl hover:bg-gray-200 transition">
            취소
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── 메인 벤치마킹 뷰 ────────────────────────────────────────
export default function BenchmarkView({ addToast }: { addToast: (m: string, t?: 'success' | 'info' | 'warning') => void }) {
  const [categories, setCategories] = useState<Category[]>(DEFAULT_CATEGORIES)
  const [items, setItems] = useState<BenchmarkItem[]>(DEFAULT_BENCHMARKS)
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('all')
  const [showCategoryManager, setShowCategoryManager] = useState(false)
  const [showAddModal, setShowAddModal] = useState(false)

  const handleSaveCategories = (updated: Category[]) => {
    setCategories(updated)
    addToast('카테고리가 저장되었습니다 ✅', 'success')
  }

  const handleAddItem = (item: BenchmarkItem) => {
    setItems(prev => [item, ...prev])
    addToast(`"${item.title}" 벤치마킹에 추가됐습니다 📌`, 'success')
  }

  const handleDelete = (id: string) => {
    setItems(prev => prev.filter(i => i.id !== id))
    addToast('벤치마킹 항목이 삭제됐습니다', 'warning')
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
        {/* 상단 컨트롤 */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 flex-1 flex-wrap">
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

          <div className="flex gap-2 shrink-0">
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
              + 벤치마킹 추가
            </button>
          </div>
        </div>

        {/* 카테고리별 그룹 뷰 */}
        {selectedCategoryId === 'all' ? (
          <div className="space-y-6">
            {categories.map(cat => {
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
                      <span
                        className="px-2 py-0.5 text-xs rounded-full font-medium"
                        style={{ background: 'rgba(255,255,255,0.5)', color: style.color }}
                      >
                        {catItems.length}개
                      </span>
                    </div>
                    {avgVsAvg && (
                      <span className="text-xs font-semibold" style={{ color: style.color }}>
                        평균 vs.Avg {avgVsAvg}x
                      </span>
                    )}
                  </div>

                  {catItems.length === 0 ? (
                    <div className="p-6 text-center text-sm text-gray-400">
                      이 카테고리에 저장된 벤치마킹이 없습니다
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
            })}

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
                <button onClick={() => setShowAddModal(true)} className="mt-3 text-sm text-blue-600 hover:underline">+ 벤치마킹 추가</button>
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
        {item.vsAvg && <span className="text-green-600 font-bold text-sm">{item.vsAvg}x</span>}
        {item.views && <span>{formatViews(item.views)}</span>}
        <span>{item.addedAt}</span>
        <button
          onClick={() => onDelete(item.id)}
          className="opacity-0 group-hover:opacity-100 transition text-red-400 hover:text-red-600 mt-1"
        >
          삭제
        </button>
      </div>
    </div>
  )
}
