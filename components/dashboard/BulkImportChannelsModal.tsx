'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { SECTION_CATEGORY_MAP } from '@/lib/dashboard/verified-channels-shared'

interface VerifiedChannelRow {
  channelId: string
  title: string
  handle: string
  section: string
  subscribers: string
  videoCount: string
  categoryId: string
  registered: boolean
}

interface VerifiedSection {
  name: string
  categoryId: string
  channels: VerifiedChannelRow[]
}

interface VerifiedPayload {
  total: number
  registeredCount: number
  notRegisteredCount: number
  sections: VerifiedSection[]
}

const MODAL_BACKDROP =
  'fixed inset-0 z-50 flex items-start sm:items-center justify-center p-3 sm:p-6 bg-black/50 overflow-y-auto'
const MODAL_PANEL =
  'bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full min-w-0 max-w-3xl p-6 sm:p-7 max-h-[min(90vh,880px)] overflow-y-auto overflow-x-hidden my-4 sm:my-8'

export function BulkImportChannelsModal({
  onClose,
  onImported,
  onNotify,
}: {
  onClose: () => void
  onImported: () => void
  onNotify: (m: string, t?: 'success' | 'info' | 'warning') => void
}) {
  const [loading, setLoading] = useState(true)
  const [importing, setImporting] = useState(false)
  const [payload, setPayload] = useState<VerifiedPayload | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/dashboard/verified-channels')
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? '목록 로드 실패')
      setPayload(data)
      const defaults = new Set<string>()
      for (const sec of data.sections as VerifiedSection[]) {
        for (const ch of sec.channels) {
          if (!ch.registered) defaults.add(ch.channelId)
        }
      }
      setSelected(defaults)
    } catch (e) {
      setError(e instanceof Error ? e.message : '목록 로드 실패')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const notRegisteredIds = useMemo(() => {
    if (!payload) return new Set<string>()
    const ids = new Set<string>()
    for (const sec of payload.sections) {
      for (const ch of sec.channels) {
        if (!ch.registered) ids.add(ch.channelId)
      }
    }
    return ids
  }, [payload])

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleSection = (sec: VerifiedSection, on: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev)
      for (const ch of sec.channels) {
        if (on) next.add(ch.channelId)
        else next.delete(ch.channelId)
      }
      return next
    })
  }

  const handleImport = async () => {
    if (selected.size === 0) {
      onNotify('등록할 채널을 선택해 주세요', 'warning')
      return
    }
    setImporting(true)
    try {
      const res = await fetch('/api/dashboard/channels/bulk-import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channel_ids: Array.from(selected), skip_existing: true }),
      })
      const data = await res.json()
      if (!res.ok) {
        onNotify(data.error ?? '일괄 등록 실패', 'warning')
        return
      }
      onNotify(data.message ?? '일괄 등록 완료', 'success')
      onImported()
      onClose()
    } catch {
      onNotify('일괄 등록 중 오류가 발생했습니다', 'warning')
    } finally {
      setImporting(false)
    }
  }

  const categoryLabel = (id: string) =>
    Object.entries(SECTION_CATEGORY_MAP).find(([, v]) => v === id)?.[0]?.split(' ')[0] ?? id

  return (
    <div className={MODAL_BACKDROP} onClick={onClose}>
      <div className={MODAL_PANEL} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">📥 검증 채널 일괄 등록</h3>
            <p className="text-xs text-gray-400 mt-0.5">
              YOUTUBE_CHANNELS_VERIFIED_20260525.md · API 검증 완료 채널
            </p>
          </div>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
        </div>

        {loading ? (
          <div className="py-16 text-center text-sm text-gray-400">목록 불러오는 중…</div>
        ) : error ? (
          <div className="py-8 text-center">
            <p className="text-sm text-red-500 mb-3">{error}</p>
            <button type="button" onClick={load} className="text-sm text-blue-600 hover:underline">다시 시도</button>
          </div>
        ) : payload ? (
          <>
            <div className="grid grid-cols-3 gap-2 mb-4">
              <div className="rounded-xl bg-teal-50 dark:bg-teal-900/20 p-3 text-center">
                <p className="text-lg font-bold text-teal-700 dark:text-teal-300">{payload.total}</p>
                <p className="text-[11px] text-teal-600">검증 채널</p>
              </div>
              <div className="rounded-xl bg-blue-50 dark:bg-blue-900/20 p-3 text-center">
                <p className="text-lg font-bold text-blue-700 dark:text-blue-300">{payload.registeredCount}</p>
                <p className="text-[11px] text-blue-600">이미 등록</p>
              </div>
              <div className="rounded-xl bg-amber-50 dark:bg-amber-900/20 p-3 text-center">
                <p className="text-lg font-bold text-amber-700 dark:text-amber-300">{payload.notRegisteredCount}</p>
                <p className="text-[11px] text-amber-600">미등록</p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 mb-4">
              <button
                type="button"
                onClick={() => setSelected(new Set(notRegisteredIds))}
                className="px-3 py-1.5 text-xs rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200"
              >
                미등록 {notRegisteredIds.size}개 전체 선택
              </button>
              <button
                type="button"
                onClick={() => setSelected(new Set())}
                className="px-3 py-1.5 text-xs rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-600 hover:bg-gray-200"
              >
                선택 해제
              </button>
              <span className="text-xs text-gray-400 self-center ml-auto">
                선택 {selected.size}개
              </span>
            </div>

            <div className="space-y-4 max-h-[min(50vh,420px)] overflow-y-auto pr-1">
              {payload.sections.map((sec) => {
                const secSelected = sec.channels.filter((c) => selected.has(c.channelId)).length
                const allOn = secSelected === sec.channels.length
                return (
                  <div key={sec.name} className="rounded-xl border border-gray-200 dark:border-gray-600 overflow-hidden">
                    <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 dark:bg-gray-700/60">
                      <input
                        type="checkbox"
                        checked={allOn}
                        onChange={(e) => toggleSection(sec, e.target.checked)}
                        className="rounded"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-800 dark:text-white truncate">{sec.name}</p>
                        <p className="text-[10px] text-gray-400">
                          카테고리: {categoryLabel(sec.categoryId)} · {sec.channels.length}개
                        </p>
                      </div>
                      <span className="text-[10px] text-gray-400">{secSelected}/{sec.channels.length}</span>
                    </div>
                    <div className="divide-y divide-gray-100 dark:divide-gray-700">
                      {sec.channels.map((ch) => (
                        <label
                          key={ch.channelId}
                          className={`flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/40 ${ch.registered ? 'opacity-60' : ''}`}
                        >
                          <input
                            type="checkbox"
                            checked={selected.has(ch.channelId)}
                            onChange={() => toggle(ch.channelId)}
                            className="rounded shrink-0"
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-gray-800 dark:text-gray-200 truncate">{ch.title}</p>
                            <p className="text-[10px] font-mono text-gray-400 truncate">@{ch.handle} · {ch.channelId}</p>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-[10px] text-gray-500">{ch.subscribers}</p>
                            {ch.registered && (
                              <span className="text-[10px] text-blue-500">등록됨</span>
                            )}
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>

            <div className="flex gap-3 mt-6">
              <button
                type="button"
                onClick={handleImport}
                disabled={selected.size === 0 || importing}
                className="flex-1 py-2.5 bg-teal-600 text-white text-sm rounded-xl hover:bg-teal-700 disabled:opacity-40 font-medium"
              >
                {importing ? '등록 중…' : `${selected.size}개 일괄 등록`}
              </button>
              <button type="button" onClick={onClose} className="flex-1 py-2.5 bg-gray-100 text-gray-700 text-sm rounded-xl hover:bg-gray-200">
                취소
              </button>
            </div>
          </>
        ) : null}
      </div>
    </div>
  )
}
