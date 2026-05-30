'use client'

import { useEffect, useState, useCallback } from 'react'
import type { AddToast } from '@/lib/dashboard/dashboard-types'
import { getPlatformIcon, getPlatformColor, getPlatformName } from '@/lib/dashboard/dashboard-helpers'
import {
  fetchCalendarItems,
  saveCalendarItems,
  type CalendarItemStored,
} from '@/lib/dashboard/dashboard-storage'
import { useWorkspaceSeed } from '@/components/dashboard/hooks/use-workspace-seed'
import { N8nLv1ServicesSection } from '@/components/dashboard/n8n-lv1-services-section'

// ─── 상수 ────────────────────────────────────────────────────────────────────

const DAYS_KO = ['일', '월', '화', '수', '목', '금', '토']

const STATUS_CFG = {
  scheduled: { label: '예약됨', dot: 'bg-blue-500',   pill: 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' },
  draft:     { label: '초안',   dot: 'bg-yellow-400', pill: 'bg-yellow-50 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300' },
  idea:      { label: '아이디어', dot: 'bg-gray-400', pill: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400' },
  done:      { label: '완료',   dot: 'bg-green-500',  pill: 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-300' },
} as const

const PLATFORMS = [
  { value: 'youtube',    label: 'YouTube' },
  { value: 'naver-blog', label: '네이버 블로그' },
  { value: 'tistory',   label: '티스토리' },
  { value: 'tiktok',    label: 'TikTok' },
] as const

// ─── 날짜 유틸 ───────────────────────────────────────────────────────────────

function toISODate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** 구형 한글 레이블을 ISO 날짜로 정규화 */
function normalizeDay(day: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(day)) return day
  const base = new Date()
  const shift = (n: number) => {
    const d = new Date(base)
    d.setDate(d.getDate() + n)
    return toISODate(d)
  }
  const map: Record<string, string> = {
    '오늘': shift(0), '내일': shift(1), '모레': shift(2),
    '3일 후': shift(3), '4일 후': shift(4), '신규': shift(0),
  }
  return map[day] ?? shift(0)
}

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate()
}

function getFirstDayOfMonth(year: number, month: number) {
  return new Date(year, month, 1).getDay()
}

/** 해당 date가 속한 주의 일~토 날짜 배열 */
function getWeekDates(date: Date): Date[] {
  const d = new Date(date)
  d.setDate(d.getDate() - d.getDay()) // 일요일로 이동
  return Array.from({ length: 7 }, (_, i) => {
    const nd = new Date(d)
    nd.setDate(d.getDate() + i)
    return nd
  })
}

function makeEmptyForm(date = toISODate(new Date())): FormState {
  return { title: '', date, platform: 'youtube', status: 'idea', time: '' }
}

// ─── 타입 ─────────────────────────────────────────────────────────────────────

interface FormState {
  title: string
  date: string
  platform: string
  status: CalendarItemStored['status']
  time: string
}

interface ModalState {
  mode: 'add' | 'edit'
  editId?: string
}

type ViewMode = 'month' | 'week'

// ─── 일정 칩 ─────────────────────────────────────────────────────────────────

function ItemChip({ item, onClick }: { item: CalendarItemStored; onClick: () => void }) {
  const s = STATUS_CFG[item.status]
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); onClick() }}
      className="w-full text-left flex items-center gap-1 px-1.5 py-0.5 rounded text-xs hover:opacity-80 transition group"
    >
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${s.dot}`} />
      <span className="truncate text-gray-700 dark:text-gray-300 group-hover:text-blue-600 dark:group-hover:text-blue-400">
        {getPlatformIcon(item.platform)} {item.title}
      </span>
    </button>
  )
}

function ItemCard({ item, onClick }: { item: CalendarItemStored; onClick: () => void }) {
  const s = STATUS_CFG[item.status]
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); onClick() }}
      className={`w-full text-left px-2 py-1.5 rounded-lg text-xs hover:opacity-80 transition border border-transparent hover:border-current ${s.pill}`}
    >
      <div className="flex items-center gap-1 truncate">
        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${s.dot}`} />
        <span className="font-medium truncate">{item.title}</span>
      </div>
      <div className="flex items-center gap-1.5 mt-0.5 opacity-70">
        <span>{getPlatformIcon(item.platform)}</span>
        {item.time && item.time !== '미정' && <span>{item.time}</span>}
        <span className="ml-auto">{s.label}</span>
      </div>
    </button>
  )
}

// ─── 추가/편집 모달 ───────────────────────────────────────────────────────────

interface ModalProps {
  mode: 'add' | 'edit'
  form: FormState
  onFormChange: (f: FormState) => void
  onSave: () => void
  onDelete?: () => void
  onClose: () => void
}

function CalendarModal({ mode, form, onFormChange, onSave, onDelete, onClose }: ModalProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl p-6 w-full max-w-md mx-4 border border-gray-100 dark:border-gray-700"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-base font-bold text-gray-900 dark:text-white mb-5">
          {mode === 'add' ? '새 일정 추가' : '일정 편집'}
        </h3>
        <div className="space-y-4">
          {/* 제목 */}
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">제목</label>
            <input
              type="text"
              value={form.title}
              onChange={(e) => onFormChange({ ...form, title: e.target.value })}
              placeholder="콘텐츠 제목 또는 아이디어를 입력하세요"
              className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              autoFocus
            />
          </div>
          {/* 날짜 · 시간 */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">날짜</label>
              <input
                type="date"
                value={form.date}
                onChange={(e) => onFormChange({ ...form, date: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">업로드 시간</label>
              <input
                type="text"
                value={form.time}
                onChange={(e) => onFormChange({ ...form, time: e.target.value })}
                placeholder="예: 오후 6시"
                className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>
          {/* 플랫폼 · 상태 */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">플랫폼</label>
              <select
                value={form.platform}
                onChange={(e) => onFormChange({ ...form, platform: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                {PLATFORMS.map((p) => (
                  <option key={p.value} value={p.value}>{p.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">상태</label>
              <select
                value={form.status}
                onChange={(e) => onFormChange({ ...form, status: e.target.value as CalendarItemStored['status'] })}
                className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                {(Object.entries(STATUS_CFG) as [CalendarItemStored['status'], typeof STATUS_CFG[keyof typeof STATUS_CFG]][]).map(([k, v]) => (
                  <option key={k} value={k}>{v.label}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
        {/* 버튼 */}
        <div className="flex gap-2 mt-6">
          <button
            type="button"
            onClick={onSave}
            disabled={!form.title.trim() || !form.date}
            className="flex-1 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition"
          >
            저장
          </button>
          {onDelete && (
            <button
              type="button"
              onClick={onDelete}
              className="px-4 py-2 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm rounded-lg hover:bg-red-100 dark:hover:bg-red-900/40 transition"
            >
              삭제
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-sm rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition"
          >
            취소
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── 월간 그리드 ──────────────────────────────────────────────────────────────

interface MonthGridProps {
  year: number
  month: number
  items: CalendarItemStored[]
  onDayClick: (date: string) => void
  onItemClick: (item: CalendarItemStored) => void
}

function MonthGrid({ year, month, items, onDayClick, onItemClick }: MonthGridProps) {
  const today = toISODate(new Date())
  const firstDayOfWeek = getFirstDayOfMonth(year, month)
  const daysInMonth = getDaysInMonth(year, month)
  const daysInPrevMonth = getDaysInMonth(year, month - 1)

  // 6주 × 7일 = 42셀
  const cells: { date: string; current: boolean }[] = []

  for (let i = firstDayOfWeek - 1; i >= 0; i--) {
    cells.push({ date: toISODate(new Date(year, month - 1, daysInPrevMonth - i)), current: false })
  }
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ date: toISODate(new Date(year, month, d)), current: true })
  }
  let next = 1
  while (cells.length < 42) {
    cells.push({ date: toISODate(new Date(year, month + 1, next++)), current: false })
  }

  const byDate: Record<string, CalendarItemStored[]> = {}
  for (const item of items) {
    const d = normalizeDay(item.day)
    if (!byDate[d]) byDate[d] = []
    byDate[d].push(item)
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 overflow-hidden">
      {/* 요일 헤더 */}
      <div className="grid grid-cols-7 border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/80">
        {DAYS_KO.map((d, i) => (
          <div
            key={d}
            className={`py-2.5 text-center text-xs font-semibold ${
              i === 0 ? 'text-red-500' : i === 6 ? 'text-blue-500' : 'text-gray-500 dark:text-gray-400'
            }`}
          >
            {d}
          </div>
        ))}
      </div>
      {/* 날짜 셀 */}
      <div className="grid grid-cols-7">
        {cells.map((cell, idx) => {
          const dayItems = byDate[cell.date] ?? []
          const isToday = cell.date === today
          const dayNum = parseInt(cell.date.split('-')[2], 10)
          const dow = idx % 7
          const isLastRow = idx >= 35
          const isLastCol = dow === 6

          return (
            <div
              key={cell.date}
              onClick={() => cell.current && onDayClick(cell.date)}
              className={[
                'min-h-[90px] p-1.5 transition',
                !isLastRow ? 'border-b border-gray-100 dark:border-gray-700' : '',
                !isLastCol ? 'border-r border-gray-100 dark:border-gray-700' : '',
                cell.current
                  ? 'hover:bg-blue-50 dark:hover:bg-blue-900/10 cursor-pointer'
                  : 'opacity-30 cursor-default bg-gray-50/50 dark:bg-gray-900/20',
              ].join(' ')}
            >
              <div className="mb-1">
                <span
                  className={[
                    'inline-flex items-center justify-center w-6 h-6 text-xs font-semibold rounded-full',
                    isToday
                      ? 'bg-blue-600 text-white'
                      : dow === 0
                        ? 'text-red-500'
                        : dow === 6
                          ? 'text-blue-500'
                          : 'text-gray-700 dark:text-gray-300',
                  ].join(' ')}
                >
                  {dayNum}
                </span>
              </div>
              <div className="space-y-0.5">
                {dayItems.slice(0, 3).map((item) => (
                  <ItemChip key={item.id} item={item} onClick={() => onItemClick(item)} />
                ))}
                {dayItems.length > 3 && (
                  <p className="text-xs text-gray-400 px-1.5">+{dayItems.length - 3}개 더</p>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── 주간 뷰 ─────────────────────────────────────────────────────────────────

interface WeekViewProps {
  baseDate: Date
  items: CalendarItemStored[]
  onDayClick: (date: string) => void
  onItemClick: (item: CalendarItemStored) => void
}

function WeekView({ baseDate, items, onDayClick, onItemClick }: WeekViewProps) {
  const today = toISODate(new Date())
  const weekDates = getWeekDates(baseDate)

  const byDate: Record<string, CalendarItemStored[]> = {}
  for (const item of items) {
    const d = normalizeDay(item.day)
    if (!byDate[d]) byDate[d] = []
    byDate[d].push(item)
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 overflow-hidden">
      <div className="grid grid-cols-7 divide-x divide-gray-100 dark:divide-gray-700">
        {weekDates.map((date, i) => {
          const dateStr = toISODate(date)
          const dayItems = byDate[dateStr] ?? []
          const isToday = dateStr === today

          return (
            <div key={dateStr} className="flex flex-col">
              {/* 요일/날짜 헤더 */}
              <button
                type="button"
                onClick={() => onDayClick(dateStr)}
                className={[
                  'w-full py-3 text-center border-b border-gray-100 dark:border-gray-700',
                  'hover:bg-blue-50 dark:hover:bg-blue-900/10 transition',
                  isToday ? 'bg-blue-50/80 dark:bg-blue-900/20' : '',
                ].join(' ')}
              >
                <p className={`text-xs font-semibold mb-1 ${
                  i === 0 ? 'text-red-500' : i === 6 ? 'text-blue-500' : 'text-gray-500 dark:text-gray-400'
                }`}>
                  {DAYS_KO[i]}
                </p>
                <span className={[
                  'inline-flex items-center justify-center w-7 h-7 text-sm font-bold rounded-full mx-auto',
                  isToday
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-800 dark:text-gray-200',
                ].join(' ')}>
                  {date.getDate()}
                </span>
              </button>
              {/* 일정 목록 */}
              <div className="flex-1 p-2 space-y-1.5 min-h-[220px]">
                {dayItems.length === 0 ? (
                  <p className="text-xs text-gray-300 dark:text-gray-600 text-center pt-6">—</p>
                ) : (
                  dayItems.map((item) => (
                    <ItemCard key={item.id} item={item} onClick={() => onItemClick(item)} />
                  ))
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── 메인 컴포넌트 ────────────────────────────────────────────────────────────

export default function CalendarView({ addToast }: { addToast: AddToast }) {
  const seeded = useWorkspaceSeed()
  const [items, setItems] = useState<CalendarItemStored[]>([])
  const [viewMode, setViewMode] = useState<ViewMode>('month')
  const [currentDate, setCurrentDate] = useState(() => new Date())
  const [modal, setModal] = useState<ModalState | null>(null)
  const [form, setForm] = useState<FormState>(() => makeEmptyForm())

  useEffect(() => {
    if (!seeded) return
    fetchCalendarItems()
      .then((raw) => setItems(raw.map((i) => ({ ...i, day: normalizeDay(i.day) }))))
      .catch(() => addToast('캘린더 로드 실패', 'warning'))
  }, [seeded, addToast])

  const persist = useCallback(
    (next: CalendarItemStored[]) => {
      setItems(next)
      saveCalendarItems(next).catch(() => addToast('저장 실패', 'warning'))
    },
    [addToast],
  )

  const openAdd = (date: string) => {
    setForm(makeEmptyForm(date))
    setModal({ mode: 'add' })
  }

  const openEdit = (item: CalendarItemStored) => {
    setForm({
      title: item.title,
      date: normalizeDay(item.day),
      platform: item.platform,
      status: item.status,
      time: item.time ?? '',
    })
    setModal({ mode: 'edit', editId: item.id })
  }

  const handleSave = () => {
    if (!form.title.trim() || !form.date) return
    if (modal?.mode === 'add') {
      persist([
        {
          id: `cal-${Date.now()}`,
          day: form.date,
          title: form.title.trim(),
          platform: form.platform,
          status: form.status,
          time: form.time || '미정',
        },
        ...items,
      ])
      addToast('일정이 추가되었습니다', 'success')
    } else if (modal?.mode === 'edit' && modal.editId) {
      persist(
        items.map((i) =>
          i.id === modal.editId
            ? { ...i, day: form.date, title: form.title.trim(), platform: form.platform, status: form.status, time: form.time || '미정' }
            : i,
        ),
      )
      addToast('일정이 수정되었습니다', 'success')
    }
    setModal(null)
  }

  const handleDelete = () => {
    if (modal?.mode !== 'edit' || !modal.editId) return
    persist(items.filter((i) => i.id !== modal.editId))
    addToast('일정이 삭제되었습니다', 'info')
    setModal(null)
  }

  const navigate = (dir: -1 | 1) => {
    setCurrentDate((prev) => {
      const d = new Date(prev)
      if (viewMode === 'month') d.setMonth(d.getMonth() + dir)
      else d.setDate(d.getDate() + dir * 7)
      return d
    })
  }

  // 현재 기간 레이블
  const periodLabel = (() => {
    if (viewMode === 'month') {
      return `${currentDate.getFullYear()}년 ${currentDate.getMonth() + 1}월`
    }
    const week = getWeekDates(currentDate)
    const s = week[0]
    const e = week[6]
    if (s.getMonth() === e.getMonth()) {
      return `${s.getFullYear()}년 ${s.getMonth() + 1}월 ${s.getDate()}일 – ${e.getDate()}일`
    }
    return `${s.getMonth() + 1}/${s.getDate()} – ${e.getMonth() + 1}/${e.getDate()}`
  })()

  // 이번 달 항목 수
  const currentMonthStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`
  const thisMonthItems = items.filter((i) => normalizeDay(i.day).startsWith(currentMonthStr))

  const stats = {
    scheduled: thisMonthItems.filter((i) => i.status === 'scheduled').length,
    draft: thisMonthItems.filter((i) => i.status === 'draft').length,
    idea: thisMonthItems.filter((i) => i.status === 'idea').length,
    done: thisMonthItems.filter((i) => i.status === 'done').length,
    total: thisMonthItems.length,
  }

  return (
    <div className="space-y-4">
      <N8nLv1ServicesSection viewId="calendar" addToast={addToast} />

      {/* 설명 */}
      <p className="text-sm text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3">
        <strong className="font-medium text-gray-800 dark:text-gray-200">콘텐츠 캘린더</strong>
        &nbsp;— 날짜 셀을 클릭해 일정을 추가하고, 일정 항목을 클릭하면 편집합니다.
        월간·주간 뷰를 전환하며 전체 일정을 관리하세요.
      </p>

      {/* 통계 요약 */}
      <div className="grid grid-cols-4 gap-3">
        {([
          { key: 'scheduled', label: '예약됨',   colorClass: 'bg-blue-50   dark:bg-blue-900/20   text-blue-600'  },
          { key: 'draft',     label: '초안 작성', colorClass: 'bg-yellow-50 dark:bg-yellow-900/20 text-yellow-600' },
          { key: 'idea',      label: '아이디어', colorClass: 'bg-gray-50   dark:bg-gray-700       text-gray-600 dark:text-gray-300'  },
          { key: 'done',      label: '완료',     colorClass: 'bg-green-50  dark:bg-green-900/20  text-green-600' },
        ] as const).map((s) => (
          <div key={s.key} className={`${s.colorClass} rounded-xl px-4 py-3`}>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">{s.label}</p>
            <p className="text-2xl font-bold">{stats[s.key]}건</p>
          </div>
        ))}
      </div>

      {/* 헤더 툴바 */}
      <div className="flex items-center gap-2 flex-wrap">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition text-gray-500 dark:text-gray-400 text-lg leading-none"
        >
          ‹
        </button>
        <h2 className="text-sm font-bold text-gray-900 dark:text-white min-w-[180px] text-center">
          {periodLabel}
        </h2>
        <button
          type="button"
          onClick={() => navigate(1)}
          className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition text-gray-500 dark:text-gray-400 text-lg leading-none"
        >
          ›
        </button>
        <button
          type="button"
          onClick={() => setCurrentDate(new Date())}
          className="px-3 py-1.5 text-xs font-medium border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400 transition"
        >
          오늘
        </button>

        <div className="ml-auto flex items-center gap-2">
          {/* 월간 / 주간 토글 */}
          <div className="flex bg-gray-100 dark:bg-gray-700 rounded-lg p-0.5">
            {(['month', 'week'] as ViewMode[]).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setViewMode(m)}
                className={[
                  'px-3 py-1 text-xs font-medium rounded-md transition',
                  viewMode === m
                    ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow-sm'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200',
                ].join(' ')}
              >
                {m === 'month' ? '월간' : '주간'}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => openAdd(toISODate(new Date()))}
            className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition"
          >
            + 일정 추가
          </button>
        </div>
      </div>

      {/* 캘린더 본문 */}
      {!seeded ? (
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-12 text-center">
          <p className="text-sm text-gray-400">불러오는 중…</p>
        </div>
      ) : viewMode === 'month' ? (
        <MonthGrid
          year={currentDate.getFullYear()}
          month={currentDate.getMonth()}
          items={items}
          onDayClick={openAdd}
          onItemClick={openEdit}
        />
      ) : (
        <WeekView
          baseDate={currentDate}
          items={items}
          onDayClick={openAdd}
          onItemClick={openEdit}
        />
      )}

      <p className="text-xs text-gray-400 text-center">
        일정은 Supabase에 저장됩니다 · 이번 달 총 {stats.total}건
      </p>

      {/* 모달 */}
      {modal && (
        <CalendarModal
          mode={modal.mode}
          form={form}
          onFormChange={setForm}
          onSave={handleSave}
          onDelete={modal.mode === 'edit' ? handleDelete : undefined}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  )
}
