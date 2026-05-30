'use client'

import { useState } from 'react'

export interface ChannelCategoryOption {
  id: string
  name: string
  icon: string
  bg_color?: string
}

const FALLBACK_CATEGORIES: ChannelCategoryOption[] = [
  { id: 'cat-parenting', name: '육아', icon: '👶' },
  { id: 'cat-economy', name: '경제', icon: '💰' },
  { id: 'cat-game', name: '게임', icon: '🎮' },
  { id: 'cat-education', name: '교육', icon: '📚' },
  { id: 'cat-lifestyle', name: '라이프', icon: '🏠' },
  { id: 'cat-tech', name: 'IT·테크', icon: '💻' },
  { id: 'cat-entertainment', name: '엔터', icon: '🎭' },
  { id: 'cat-news', name: '뉴스·시사', icon: '📰' },
  { id: 'cat-other', name: '기타', icon: '📁' },
]

export function normalizeChannelCategories(data: unknown): ChannelCategoryOption[] {
  const byId = new Map<string, ChannelCategoryOption>()
  for (const def of FALLBACK_CATEGORIES) {
    byId.set(def.id, { ...def })
  }

  if (Array.isArray(data)) {
    for (const raw of data) {
      const c = raw as ChannelCategoryOption
      if (!c?.id || !c?.name) continue
      const canonical = FALLBACK_CATEGORIES.find((d) => d.name === c.name || d.id === c.id)
      const id = canonical?.id ?? c.id
      if (!byId.has(id)) {
        byId.set(id, {
          id,
          name: canonical?.name ?? c.name,
          icon: canonical?.icon ?? c.icon ?? '📁',
          bg_color: canonical?.bg_color ?? c.bg_color,
        })
      }
    }
  }

  return FALLBACK_CATEGORIES.map((def) => byId.get(def.id) ?? def)
}

function slugFromName(name: string): string {
  const base = name
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9가-힣-]/g, '')
  return `cat-${base || 'custom'}-${Date.now().toString(36).slice(-4)}`
}

interface ChannelCategoryFieldProps {
  value: string
  onChange: (categoryId: string) => void
  categories: ChannelCategoryOption[]
  onCategoriesChange: (categories: ChannelCategoryOption[]) => void
  onNotify?: (message: string, type?: 'success' | 'warning' | 'info') => void
  /** 목록 행용 작은 UI */
  compact?: boolean
  className?: string
}

export function ChannelCategoryField({
  value,
  onChange,
  categories,
  onCategoriesChange,
  onNotify,
  compact = false,
  className = '',
}: ChannelCategoryFieldProps) {
  const [showAdd, setShowAdd] = useState(false)
  const [newName, setNewName] = useState('')
  const [newIcon, setNewIcon] = useState('📁')
  const [adding, setAdding] = useState(false)

  const list = categories.length > 0 ? categories : FALLBACK_CATEGORIES

  const handleAddCategory = async () => {
    const name = newName.trim()
    if (!name) {
      onNotify?.('카테고리 이름을 입력해 주세요', 'warning')
      return
    }
    setAdding(true)
    try {
      const id = slugFromName(name)
      const res = await fetch('/api/dashboard/channel-categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, name, icon: newIcon || '📁' }),
      })
      const data = await res.json()
      if (!res.ok) {
        onNotify?.(data.error ?? '카테고리 추가 실패', 'warning')
        return
      }
      const row: ChannelCategoryOption = {
        id: data.id,
        name: data.name,
        icon: data.icon ?? '📁',
        bg_color: data.bg_color,
      }
      const next = [...list.filter((c) => c.id !== row.id), row].sort((a, b) =>
        a.name.localeCompare(b.name, 'ko'),
      )
      onCategoriesChange(next)
      onChange(row.id)
      setNewName('')
      setShowAdd(false)
      onNotify?.(`카테고리 "${name}" 추가됨`, 'success')
    } catch {
      onNotify?.('카테고리 추가 중 오류', 'warning')
    } finally {
      setAdding(false)
    }
  }

  if (compact) {
    return (
      <div className={`relative flex items-center gap-1 shrink-0 ${className}`}>
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onClick={(e) => e.stopPropagation()}
          className="text-xs px-2 py-1.5 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 max-w-[9rem]"
          title="카테고리"
        >
          <option value="">미분류</option>
          {list.map((c) => (
            <option key={c.id} value={c.id}>
              {c.icon} {c.name}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            setShowAdd((v) => !v)
          }}
          className="text-xs px-1.5 py-1 rounded border border-dashed border-gray-300 text-gray-500 hover:bg-gray-50"
          title="새 카테고리"
        >
          +
        </button>
        {showAdd && (
          <div
            className="absolute z-30 mt-1 right-0 top-full min-w-[12rem] p-2 rounded-xl border bg-white dark:bg-gray-800 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="새 카테고리명"
              className="w-full text-xs px-2 py-1.5 border rounded-lg mb-1 dark:bg-gray-700 dark:border-gray-600"
            />
            <button
              type="button"
              disabled={adding}
              onClick={handleAddCategory}
              className="w-full text-xs py-1 bg-blue-600 text-white rounded-lg"
            >
              추가
            </button>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className={`space-y-2 ${className}`}>
      <label className="text-xs font-semibold text-gray-500 block">카테고리 (육아·경제·게임 등)</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2.5 text-sm border border-gray-200 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
      >
        <option value="">미분류</option>
        {list.map((c) => (
          <option key={c.id} value={c.id}>
            {c.icon} {c.name}
          </option>
        ))}
      </select>

      {!showAdd ? (
        <button
          type="button"
          onClick={() => setShowAdd(true)}
          className="text-xs text-blue-600 hover:text-blue-700 font-medium"
        >
          + 새 카테고리 만들기
        </button>
      ) : (
        <div className="rounded-xl border border-dashed border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/20 p-3 space-y-2">
          <p className="text-xs font-semibold text-gray-600 dark:text-gray-300">새 카테고리</p>
          <div className="flex gap-2">
            <input
              value={newIcon}
              onChange={(e) => setNewIcon(e.target.value)}
              className="w-12 px-2 py-2 text-center text-sm border rounded-lg dark:bg-gray-700 dark:border-gray-600"
              maxLength={4}
              title="아이콘(이모지)"
            />
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="예: 뷰티, 투자, 요리"
              className="flex-1 px-3 py-2 text-sm border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            />
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={adding || !newName.trim()}
              onClick={handleAddCategory}
              className="flex-1 py-1.5 text-xs bg-blue-600 text-white rounded-lg disabled:opacity-40"
            >
              {adding ? '추가 중…' : '카테고리 추가'}
            </button>
            <button
              type="button"
              onClick={() => {
                setShowAdd(false)
                setNewName('')
              }}
              className="px-3 py-1.5 text-xs bg-gray-100 dark:bg-gray-700 rounded-lg"
            >
              취소
            </button>
          </div>
        </div>
      )}
      {list === FALLBACK_CATEGORIES && (
        <p className="text-[11px] text-amber-600 dark:text-amber-400">
          DB에 카테고리 테이블이 없으면 기본 목록만 표시됩니다. Supabase에서{' '}
          <code className="text-[10px]">docs/migrations/02-channel-categories.sql</code> 실행 후 새로고침하세요.
        </p>
      )}
    </div>
  )
}
