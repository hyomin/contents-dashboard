'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  BUILTIN_SHORTFORM_CATEGORIES,
  findShortformCategory,
  getAllShortformCategories,
  loadCustomShortformCategories,
  loadSelectedShortformCategoryId,
  saveCustomShortformCategories,
  saveSelectedShortformCategoryId,
  slugifyCustomCategoryId,
  type ShortformCategory,
} from '@/lib/dashboard/shortform-categories'

interface ShortformCategorySelectProps {
  value: string
  onChange: (id: string) => void
  disabled?: boolean
}

export function ShortformCategorySelect({
  value,
  onChange,
  disabled = false,
}: ShortformCategorySelectProps) {
  const [customList, setCustomList] = useState<ShortformCategory[]>([])
  const [adding, setAdding] = useState(false)
  const [newLabel, setNewLabel] = useState('')

  const refreshCustom = useCallback(() => {
    setCustomList(loadCustomShortformCategories())
  }, [])

  useEffect(() => {
    refreshCustom()
  }, [refreshCustom])

  const allCategories = useMemo(
    () => [...BUILTIN_SHORTFORM_CATEGORIES, ...customList],
    [customList],
  )

  const selected = findShortformCategory(value) ?? allCategories[0]

  const handleChange = (id: string) => {
    onChange(id)
    saveSelectedShortformCategoryId(id)
  }

  const addCustomCategory = () => {
    const label = newLabel.trim()
    if (label.length < 2) return
    const item: ShortformCategory = {
      id: slugifyCustomCategoryId(label),
      label,
      description: `${label} — 사용자 정의 숏폼 유형`,
      source: 'custom',
    }
    const next = [...loadCustomShortformCategories(), item]
    saveCustomShortformCategories(next)
    refreshCustom()
    handleChange(item.id)
    setNewLabel('')
    setAdding(false)
  }

  const removeCustom = (id: string) => {
    const next = loadCustomShortformCategories().filter((c) => c.id !== id)
    saveCustomShortformCategories(next)
    refreshCustom()
    if (value === id) {
      handleChange(BUILTIN_SHORTFORM_CATEGORIES[0].id)
    }
  }

  return (
    <div className="space-y-2">
      <label
        htmlFor="shortform-category-select"
        className="block text-xs font-bold text-violet-800 dark:text-violet-200"
      >
        🎬 숏폼 카테고리
      </label>
      <select
        id="shortform-category-select"
        value={value}
        disabled={disabled}
        onChange={(e) => handleChange(e.target.value)}
        className="w-full rounded-xl border border-violet-200 dark:border-violet-700 bg-white dark:bg-gray-900 px-3 py-2.5 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500 disabled:opacity-50"
      >
        <optgroup label="기본 카테고리">
          {BUILTIN_SHORTFORM_CATEGORIES.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
        </optgroup>
        {customList.length > 0 && (
          <optgroup label="추가한 카테고리">
            {customList.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </optgroup>
        )}
      </select>

      {selected && (
        <p className="text-[11px] text-gray-500 dark:text-gray-400 leading-relaxed">
          {selected.description}
        </p>
      )}

      {!adding ? (
        <button
          type="button"
          disabled={disabled}
          onClick={() => setAdding(true)}
          className="text-xs font-medium text-violet-600 dark:text-violet-400 hover:underline disabled:opacity-50"
        >
          + 카테고리 직접 추가
        </button>
      ) : (
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            type="text"
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            placeholder="예: 먹방 숏츠 · ASMR 먹방형"
            className="flex-1 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
            onKeyDown={(e) => e.key === 'Enter' && addCustomCategory()}
          />
          <button
            type="button"
            onClick={addCustomCategory}
            className="px-3 py-2 rounded-lg text-xs font-bold bg-violet-600 text-white hover:bg-violet-700"
          >
            추가
          </button>
          <button
            type="button"
            onClick={() => {
              setAdding(false)
              setNewLabel('')
            }}
            className="px-3 py-2 rounded-lg text-xs text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            취소
          </button>
        </div>
      )}

      {selected?.source === 'custom' && (
        <button
          type="button"
          onClick={() => removeCustom(selected.id)}
          className="text-[10px] text-red-500 hover:underline"
        >
          이 사용자 카테고리 삭제
        </button>
      )}
    </div>
  )
}
