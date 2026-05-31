'use client'

import { GEMINI_MODEL_OPTIONS, getGeminiModelLabel } from '@/lib/dashboard/gemini-models'

interface GuideAiModelSelectProps {
  id: string
  label: string
  value: string
  onChange: (modelId: string) => void
  compact?: boolean
}

export function GuideAiModelSelect({ id, label, value, onChange, compact }: GuideAiModelSelectProps) {
  return (
    <div className={compact ? 'flex flex-wrap items-center gap-2' : 'space-y-1.5'}>
      <label htmlFor={id} className="text-[11px] font-semibold text-gray-600 dark:text-gray-400 shrink-0">
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
          compact ? 'text-[11px] px-2 py-1.5 min-w-[10rem]' : 'text-xs px-3 py-2 w-full sm:w-auto'
        }`}
      >
        {GEMINI_MODEL_OPTIONS.map((m) => (
          <option key={m.id} value={m.id}>
            {m.label} — {m.hint}
          </option>
        ))}
      </select>
      {!compact && (
        <p className="text-[10px] text-gray-400">선택: {getGeminiModelLabel(value)}</p>
      )}
    </div>
  )
}
