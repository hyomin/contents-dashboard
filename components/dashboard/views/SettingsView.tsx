'use client'

import { useCallback, useEffect, useState } from 'react'
import { useTheme, type Theme, RESOLVED_THEME_LABELS } from '@/lib/theme'
import type { AddToast } from '@/lib/dashboard/dashboard-types'
import { TitleWithHint } from '@/components/dashboard/info-hint'
import type { ApiServiceStatus, SettingsApiResponse } from '@/app/api/dashboard/settings/route'
import {
  DEFAULT_NOTIFICATION_SETTINGS,
  loadNotificationSettings,
  saveNotificationSettings,
  type NotificationSettings,
} from '@/lib/dashboard/notification-settings'
import { WEBHOOK_BILLING, WEBHOOK_BILLING_NOTE } from '@/lib/dashboard/service-billing'

// ─── 상수 ────────────────────────────────────────────────────────────────────

type ThemeOption = { value: Theme; label: string; icon: string; desc: string }

const THEME_OPTIONS: ThemeOption[] = [
  { value: 'light',  label: 'Light',  icon: '☀️', desc: '밝은 흰색 배경' },
  { value: 'soft',   label: 'Soft',   icon: '🌤️', desc: '야간에 눈 편한 회색 톤' },
  { value: 'dark',   label: 'Dark',   icon: '🌙', desc: '진한 어두운 배경' },
  { value: 'system', label: 'System', icon: '💻', desc: '운영체제 설정 따라가기' },
]

function previewClass(value: Theme): string {
  if (value === 'dark') return 'bg-gray-900 border-gray-700'
  if (value === 'soft') return 'bg-[#424852] border-[#5d6470]'
  if (value === 'light') return 'bg-white border-gray-200'
  return 'bg-gradient-to-r from-white to-gray-900 border-gray-300'
}
function previewBarClass(value: Theme, wide: boolean): string {
  if (value === 'dark') return wide ? 'bg-gray-600' : 'bg-gray-700'
  if (value === 'soft') return wide ? 'bg-[#727983]' : 'bg-[#5d6470]'
  if (value === 'light') return wide ? 'bg-gray-200' : 'bg-gray-100'
  return wide ? 'bg-gray-400' : 'bg-gray-200'
}

// ─── 수집 주기 설정 ──────────────────────────────────────────────────────────

type Interval = 'manual' | '1h' | '6h' | '12h' | 'daily' | 'weekly'

interface WebhookSchedule {
  key: string
  label: string
  icon: string
  defaultInterval: Interval
  enabled: boolean
  interval: Interval
}

const INTERVAL_LABELS: Record<Interval, string> = {
  manual: '수동',
  '1h': '매 1시간',
  '6h': '매 6시간',
  '12h': '매 12시간',
  daily: '매일',
  weekly: '매주',
}

const DEFAULT_SCHEDULES: WebhookSchedule[] = [
  { key: 'N8N_WEBHOOK_YOUTUBE_COLLECT',      label: 'YouTube 영상 수집',       icon: '🔴', defaultInterval: 'daily',  enabled: true,  interval: 'daily'  },
  { key: 'N8N_WEBHOOK_OUTLIER_TAG',           label: 'Outlier 자동 태깅',       icon: '🚀', defaultInterval: 'daily',  enabled: true,  interval: 'daily'  },
  { key: 'N8N_WEBHOOK_RSS_TOPICS',            label: 'RSS 주제 수집',           icon: '📰', defaultInterval: '6h',     enabled: true,  interval: '6h'     },
  { key: 'N8N_WEBHOOK_NAVER_BLOG_VIEWS',      label: '네이버 조회수 업데이트',   icon: '🟢', defaultInterval: '12h',    enabled: true,  interval: '12h'    },
  { key: 'N8N_WEBHOOK_NAVER_BLOG_COLLECT',    label: '네이버 블로그 수집',       icon: '🟢', defaultInterval: 'daily',  enabled: true,  interval: 'daily'  },
  { key: 'N8N_WEBHOOK_TISTORY_COLLECT',       label: '티스토리 수집',           icon: '🟠', defaultInterval: 'daily',  enabled: true,  interval: 'daily'  },
  { key: 'N8N_WEBHOOK_LONGFORM_SCRIPT',       label: '롱폼 스크립트 생성',      icon: '🎬', defaultInterval: 'manual', enabled: false, interval: 'manual' },
  { key: 'N8N_WEBHOOK_TOPIC_SUGGEST',         label: '주제 선별 AI',            icon: '🎯', defaultInterval: 'manual', enabled: false, interval: 'manual' },
]

const LS_KEY = 'dashboard_n8n_schedules'

function notifySettingsChanged() {
  window.dispatchEvent(new CustomEvent('dashboard-settings-changed'))
}

function PaidBadge({ note }: { note?: string }) {
  return (
    <span
      title={note}
      className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300 font-semibold shrink-0"
    >
      유료
    </span>
  )
}

function ToggleSwitch({
  checked,
  onChange,
  label,
  size = 'md',
}: {
  checked: boolean
  onChange: (next: boolean) => void
  label: string
  size?: 'sm' | 'md'
}) {
  const isSm = size === 'sm'
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex shrink-0 items-center rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-900
        ${isSm ? 'h-5 w-9' : 'h-6 w-11'}
        ${checked ? 'bg-blue-500' : 'bg-gray-300 dark:bg-gray-600'}`}
    >
      <span
        className={`inline-block rounded-full bg-white shadow transition-transform
          ${isSm ? 'h-4 w-4' : 'h-5 w-5'}
          ${checked ? (isSm ? 'translate-x-[18px]' : 'translate-x-[22px]') : 'translate-x-0.5'}`}
      />
    </button>
  )
}

function loadSchedules(): WebhookSchedule[] {
  if (typeof window === 'undefined') return DEFAULT_SCHEDULES
  try {
    const stored = localStorage.getItem(LS_KEY)
    if (!stored) return DEFAULT_SCHEDULES
    const parsed = JSON.parse(stored) as Partial<WebhookSchedule>[]
    return DEFAULT_SCHEDULES.map((def) => {
      const match = parsed.find((p) => p.key === def.key)
      if (!match) return def
      return {
        ...def,
        enabled: match.enabled ?? def.enabled,
        interval: (match.interval as Interval) ?? def.interval,
      }
    })
  } catch {
    return DEFAULT_SCHEDULES
  }
}

// ─── 서브 컴포넌트 ────────────────────────────────────────────────────────────

const CATEGORY_LABELS: Record<ApiServiceStatus['category'], string> = {
  database: '데이터베이스',
  api: '외부 API',
  webhook: 'n8n 웹훅',
  auth: '인증',
}
const CATEGORY_ICONS: Record<ApiServiceStatus['category'], string> = {
  database: '🗄️',
  api: '🌐',
  webhook: '⚡',
  auth: '🔐',
}

function ApiServiceRow({ svc }: { svc: ApiServiceStatus }) {
  const [pinging, setPinging] = useState(false)
  const [pingResult, setPingResult] = useState<'ok' | 'fail' | null>(null)

  const ping = async () => {
    if (pinging) return
    setPinging(true)
    setPingResult(null)
    try {
      const res = await fetch('/api/dashboard/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: svc.key }),
      })
      const data = await res.json() as { ok?: boolean }
      setPingResult(data.ok ? 'ok' : 'fail')
    } catch {
      setPingResult('fail')
    } finally {
      setPinging(false)
    }
  }

  return (
    <div className="flex items-start gap-3 py-3 border-b border-gray-100 dark:border-gray-700 last:border-0">
      {/* 상태 표시 */}
      <div className="mt-0.5 shrink-0">
        {svc.configured ? (
          <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 text-xs font-bold">✓</span>
        ) : (
          <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-red-100 dark:bg-red-900/30 text-red-500 dark:text-red-400 text-xs font-bold">✕</span>
        )}
      </div>

      {/* 서비스 정보 */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-semibold text-gray-900 dark:text-white">{svc.name}</p>
          {svc.configured ? (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 font-medium">연결됨</span>
          ) : (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 font-medium">미설정</span>
          )}
          {svc.billing === 'paid' && <PaidBadge note={svc.billingNote} />}
          {svc.preview && (
            <span className="text-[10px] text-gray-400 font-mono">{svc.preview}</span>
          )}
        </div>

        {svc.billingNote && svc.billing === 'paid' && (
          <p className="text-[10px] text-amber-600 dark:text-amber-400 mt-0.5">{svc.billingNote}</p>
        )}

        {svc.webhookUrl && (
          <p className="text-[11px] text-gray-400 font-mono mt-0.5 truncate">{svc.webhookUrl}</p>
        )}

        {/* 사용처 태그 */}
        <div className="flex flex-wrap gap-1 mt-1.5">
          {svc.usedIn.map((u) => (
            <span key={u} className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400">
              {u}
            </span>
          ))}
        </div>
      </div>

      {/* 웹훅 핑 버튼 */}
      {svc.category === 'webhook' && svc.configured && (
        <button
          type="button"
          onClick={ping}
          disabled={pinging}
          className={`shrink-0 px-2 py-1 text-[10px] font-medium rounded-lg border transition ${
            pingResult === 'ok'
              ? 'border-green-300 bg-green-50 text-green-600 dark:bg-green-900/20 dark:border-green-700 dark:text-green-400'
              : pingResult === 'fail'
                ? 'border-red-300 bg-red-50 text-red-500 dark:bg-red-900/20 dark:border-red-700 dark:text-red-400'
                : 'border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:border-blue-300 hover:text-blue-500'
          }`}
        >
          {pinging ? '확인 중…' : pingResult === 'ok' ? '✓ 응답' : pingResult === 'fail' ? '✕ 오류' : '핑 테스트'}
        </button>
      )}
    </div>
  )
}

// ─── 메인 컴포넌트 ────────────────────────────────────────────────────────────

export default function SettingsView({ addToast }: { addToast: AddToast }) {
  const { theme, resolvedTheme, setTheme } = useTheme()

  // ── API 연동 현황 ─────────────────────────────────────────────────
  const [services, setServices] = useState<ApiServiceStatus[]>([])
  const [apiLoading, setApiLoading] = useState(true)
  const [apiCategory, setApiCategory] = useState<'all' | ApiServiceStatus['category']>('all')

  useEffect(() => {
    fetch('/api/dashboard/settings')
      .then((r) => r.json())
      .then((d: SettingsApiResponse) => setServices(d.services ?? []))
      .catch(() => {})
      .finally(() => setApiLoading(false))
  }, [])

  const categories = ['all', 'database', 'api', 'webhook', 'auth'] as const
  const filteredServices = apiCategory === 'all'
    ? services
    : services.filter((s) => s.category === apiCategory)

  const connectedCount = services.filter((s) => s.configured).length

  // ── n8n 수집 주기 ─────────────────────────────────────────────────
  const [schedules, setSchedules] = useState<WebhookSchedule[]>([])
  const [batchInterval, setBatchInterval] = useState<Interval | ''>('')
  const [schedulesDirty, setSchedulesDirty] = useState(false)

  useEffect(() => {
    setSchedules(loadSchedules())
  }, [])

  const updateSchedule = (key: string, patch: Partial<WebhookSchedule>) => {
    setSchedules((prev) => prev.map((s) => s.key === key ? { ...s, ...patch } : s))
    setSchedulesDirty(true)
  }

  const applyBatch = () => {
    if (!batchInterval) return
    setSchedules((prev) => prev.map((s) => ({ ...s, interval: batchInterval as Interval })))
    setSchedulesDirty(true)
    addToast(`모든 웹훅을 "${INTERVAL_LABELS[batchInterval as Interval]}"으로 설정했습니다`, 'success')
  }

  const saveSchedules = useCallback(() => {
    localStorage.setItem(LS_KEY, JSON.stringify(schedules))
    setSchedulesDirty(false)
    addToast('수집 주기 설정이 저장되었습니다', 'success')
  }, [schedules, addToast])

  const resetSchedules = () => {
    setSchedules(DEFAULT_SCHEDULES)
    setSchedulesDirty(true)
  }

  // ── 알림 설정 ──────────────────────────────────────────────────────
  const [notif, setNotif] = useState<NotificationSettings>(DEFAULT_NOTIFICATION_SETTINGS)

  useEffect(() => {
    setNotif(loadNotificationSettings())
  }, [])

  const persistNotif = (patch: Partial<NotificationSettings>, showToast = false) => {
    setNotif((prev) => {
      const next = { ...prev, ...patch }
      saveNotificationSettings(next)
      notifySettingsChanged()
      return next
    })
    if (showToast) addToast('알림 설정이 저장되었습니다', 'success')
  }

  return (
    <div className="max-w-3xl space-y-6">

      {/* ═══════════════════════════════════════════
          🎨 테마
      ═══════════════════════════════════════════ */}
      <section className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-6">
        <div className="mb-5">
          <TitleWithHint
            as="h3"
            className="text-base font-bold text-gray-900 dark:text-white"
            hint="Light·Soft·Dark·System 중 선택합니다. Soft는 야간에 눈의 피로를 줄이는 밝은 회색 톤입니다."
          >
            🎨 테마
          </TitleWithHint>
          <p className="text-sm text-gray-500 mt-1">
            현재 적용 중:{' '}
            <span className="font-semibold text-gray-700 dark:text-gray-300">
              {RESOLVED_THEME_LABELS[resolvedTheme]}
            </span>
          </p>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {THEME_OPTIONS.map((opt) => {
            const isActive = theme === opt.value
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => {
                  setTheme(opt.value)
                  addToast(`테마가 ${opt.label}으로 변경됐습니다`, 'success')
                }}
                className={`relative flex flex-col items-center gap-3 p-4 rounded-xl border-2 transition
                  ${isActive
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                    : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500 hover:bg-gray-50 dark:hover:bg-gray-700'
                  }`}
              >
                <div className={`w-full h-12 rounded-lg border overflow-hidden flex ${previewClass(opt.value)}`}>
                  <div className={`w-1/3 h-full ${opt.value === 'soft' ? 'bg-[#4e545e]' : opt.value === 'dark' ? 'bg-gray-800' : 'bg-gray-100'}`} />
                  <div className="flex-1 p-2 space-y-1">
                    <div className={`h-1.5 rounded w-3/4 ${previewBarClass(opt.value, true)}`} />
                    <div className={`h-1.5 rounded w-1/2 ${previewBarClass(opt.value, false)}`} />
                  </div>
                </div>
                <div className="text-center">
                  <span className="text-lg">{opt.icon}</span>
                  <p className={`text-sm font-semibold mt-0.5 ${isActive ? 'text-blue-600 dark:text-blue-400' : 'text-gray-700 dark:text-gray-300'}`}>
                    {opt.label}
                  </p>
                  <p className="text-[10px] text-gray-400 mt-0.5 leading-snug">{opt.desc}</p>
                </div>
                {isActive && (
                  <span className="absolute top-2 right-2 w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center text-white text-xs font-bold">✓</span>
                )}
              </button>
            )
          })}
        </div>
      </section>

      {/* ═══════════════════════════════════════════
          🔌 API 연동 현황
      ═══════════════════════════════════════════ */}
      <section className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-6">
        <div className="flex items-start justify-between mb-4 gap-3">
          <div>
            <TitleWithHint
              as="h3"
              className="text-base font-bold text-gray-900 dark:text-white"
              hint="각 서비스의 환경 변수(ENV) 설정 여부와 대시보드 내 사용처를 확인합니다. 키 값은 마스킹됩니다."
            >
              🔌 API 연동 현황
            </TitleWithHint>
            {!apiLoading && (
              <p className="text-sm text-gray-500 mt-1">
                {connectedCount}/{services.length}개 서비스 연결됨
                {services.filter((s) => s.billing === 'paid').length > 0 && (
                  <span className="ml-2 text-amber-600 dark:text-amber-400 font-medium">
                    · 유료 {services.filter((s) => s.billing === 'paid').length}개
                  </span>
                )}
                {connectedCount === services.length && (
                  <span className="ml-2 text-green-600 dark:text-green-400 font-medium">● 모두 정상</span>
                )}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={() => {
              setApiLoading(true)
              fetch('/api/dashboard/settings')
                .then((r) => r.json())
                .then((d: SettingsApiResponse) => setServices(d.services ?? []))
                .catch(() => {})
                .finally(() => setApiLoading(false))
            }}
            className="shrink-0 text-xs px-3 py-1.5 border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400 transition"
          >
            ↻ 새로고침
          </button>
        </div>

        {/* 카테고리 필터 */}
        <div className="flex gap-1.5 flex-wrap mb-4">
          {categories.map((cat) => {
            const count = cat === 'all' ? services.length : services.filter((s) => s.category === cat).length
            return (
              <button
                key={cat}
                type="button"
                onClick={() => setApiCategory(cat)}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium transition ${
                  apiCategory === cat
                    ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                {cat === 'all' ? '전체' : `${CATEGORY_ICONS[cat]} ${CATEGORY_LABELS[cat]}`}
                <span className="opacity-60">({count})</span>
              </button>
            )
          })}
        </div>

        {apiLoading ? (
          <div className="space-y-3 py-2">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-10 bg-gray-100 dark:bg-gray-700 rounded-lg animate-pulse" />
            ))}
          </div>
        ) : (
          <div>
            {filteredServices.map((svc) => (
              <ApiServiceRow key={svc.key} svc={svc} />
            ))}
          </div>
        )}
      </section>

      {/* ═══════════════════════════════════════════
          ⏱️ n8n 수집 주기 설정
      ═══════════════════════════════════════════ */}
      <section className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-6">
        <div className="flex items-start justify-between mb-2 gap-3">
          <TitleWithHint
            as="h3"
            className="text-base font-bold text-gray-900 dark:text-white"
            hint="여기서 저장한 주기는 대시보드 참고용입니다. 실제 n8n 워크플로 스케줄은 n8n 편집기(localhost:5678)에서 동일하게 설정하세요."
          >
            ⏱️ n8n 수집 주기 설정
          </TitleWithHint>
          <div className="flex gap-2 shrink-0">
            {schedulesDirty && (
              <button
                type="button"
                onClick={saveSchedules}
                className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition"
              >
                저장
              </button>
            )}
            <button
              type="button"
              onClick={resetSchedules}
              className="px-3 py-1.5 text-xs border border-gray-200 dark:border-gray-600 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 transition"
            >
              기본값
            </button>
          </div>
        </div>
        <p className="text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/50 rounded-lg px-3 py-2 mb-4">
          💡 실제 자동 실행은 n8n 워크플로의 Schedule Trigger에서 설정합니다. 여기서 설정한 값은 대시보드 참고용입니다.
          <span className="ml-1 inline-flex items-center gap-1">
            <PaidBadge note="수집 1회마다 API·AI 할당량이 차감될 수 있습니다" />
            표시 항목은 호출 시 유료 API가 사용됩니다.
          </span>
          <a href="http://localhost:5678" target="_blank" rel="noopener noreferrer" className="ml-1 underline hover:text-amber-700">n8n 열기 ↗</a>
        </p>

        {/* 일괄 설정 */}
        <div className="flex items-center gap-2 mb-4 p-3 rounded-xl bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300 shrink-0">일괄 설정</span>
          <select
            value={batchInterval}
            onChange={(e) => setBatchInterval(e.target.value as Interval | '')}
            className="flex-1 px-3 py-1.5 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">주기 선택…</option>
            {(Object.entries(INTERVAL_LABELS) as [Interval, string][]).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
          <button
            type="button"
            onClick={applyBatch}
            disabled={!batchInterval}
            className="shrink-0 px-3 py-1.5 text-xs font-semibold rounded-lg bg-gray-900 dark:bg-white text-white dark:text-gray-900 hover:opacity-90 disabled:opacity-40 transition"
          >
            전체 적용
          </button>
        </div>

        {/* 개별 설정 */}
        <div className="space-y-2">
          {schedules.map((s) => (
            <div
              key={s.key}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border transition ${
                s.enabled
                  ? 'border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800'
                  : 'border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 opacity-60'
              }`}
            >
              {/* 활성 토글 */}
              <ToggleSwitch
                checked={s.enabled}
                onChange={(next) => updateSchedule(s.key, { enabled: next })}
                label={`${s.label} 활성화`}
                size="sm"
              />

              {/* 아이콘 + 이름 */}
              <span className="text-base shrink-0">{s.icon}</span>
              <div className="flex-1 min-w-0 flex items-center gap-1.5">
                <span className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">
                  {s.label}
                </span>
                {WEBHOOK_BILLING[s.key] === 'paid' && (
                  <PaidBadge note={WEBHOOK_BILLING_NOTE[s.key]} />
                )}
              </div>

              {/* 주기 선택 */}
              <select
                value={s.interval}
                onChange={(e) => updateSchedule(s.key, { interval: e.target.value as Interval })}
                disabled={!s.enabled}
                className="text-xs px-2 py-1 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-1 focus:ring-blue-400 disabled:opacity-50"
              >
                {(Object.entries(INTERVAL_LABELS) as [Interval, string][]).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
          ))}
        </div>

        {schedulesDirty && (
          <p className="text-xs text-blue-600 dark:text-blue-400 mt-3 text-right">
            변경 사항이 있습니다. 저장 버튼을 눌러 적용하세요.
          </p>
        )}
      </section>

      {/* ═══════════════════════════════════════════
          🔔 알림 설정
      ═══════════════════════════════════════════ */}
      <section className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-6">
        <div className="flex items-center justify-between mb-4">
          <TitleWithHint
            as="h3"
            className="text-base font-bold text-gray-900 dark:text-white"
            hint="토스트 알림 표시 여부와 지속 시간을 설정합니다. 변경 시 즉시 저장됩니다."
          >
            🔔 알림 설정
          </TitleWithHint>
        </div>

        <div className="space-y-4">
          {/* 토스트 지속 시간 */}
          <div className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-700">
            <div>
              <p className="text-sm font-medium text-gray-800 dark:text-gray-200">알림 표시 시간</p>
              <p className="text-xs text-gray-500 mt-0.5">토스트 메시지가 자동으로 사라지는 시간</p>
            </div>
            <select
              value={notif.toastDurationMs}
              onChange={(e) => persistNotif({ toastDurationMs: Number(e.target.value) }, true)}
              className="text-sm px-3 py-1.5 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value={2000}>2초</option>
              <option value={3000}>3초</option>
              <option value={4500}>4.5초 (기본)</option>
              <option value={7000}>7초</option>
              <option value={0}>수동 닫기</option>
            </select>
          </div>

          {/* 알림 토글 항목들 */}
          {([
            { key: 'collectDone' as const, label: '데이터 수집 완료 알림', desc: 'n8n 수집 완료 시 토스트 표시' },
            { key: 'aiDone' as const,      label: 'AI 분석 완료 알림',    desc: 'AI 인사이트·주제선별 완료 시 표시' },
            { key: 'errorAlert' as const,  label: '오류 알림',            desc: 'API 실패·저장 오류 시 경고 표시' },
          ]).map(({ key, label, desc }) => (
            <div key={key} className="flex items-center justify-between gap-4 py-2 border-b border-gray-100 dark:border-gray-700 last:border-0">
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{label}</p>
                <p className="text-xs text-gray-500 mt-0.5">{desc}</p>
              </div>
              <ToggleSwitch
                checked={notif[key]}
                onChange={(next) => persistNotif({ [key]: next })}
                label={label}
              />
            </div>
          ))}
        </div>
      </section>

      {/* ═══════════════════════════════════════════
          ℹ️ 시스템 정보
      ═══════════════════════════════════════════ */}
      <section className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-6">
        <h3 className="text-base font-bold text-gray-900 dark:text-white mb-4">ℹ️ 시스템 정보</h3>
        <div className="space-y-0 text-sm divide-y divide-gray-100 dark:divide-gray-700">
          {[
            { label: '대시보드 버전', value: 'v0.2.0' },
            { label: '데이터베이스', value: 'Supabase (PostgreSQL)' },
            { label: '자동화 엔진', value: 'n8n (localhost:5678)' },
            { label: 'AI 모델', value: 'Google Gemini 2.5 Flash (무료 1,500회/일)' },
            { label: '프레임워크', value: 'Next.js 15 (App Router)' },
            { label: 'API 연동', value: `${connectedCount}/${services.length}개 활성` },
          ].map(({ label, value }) => (
            <div key={label} className="flex items-center justify-between py-2.5">
              <span className="text-gray-500">{label}</span>
              <span className="font-medium text-gray-800 dark:text-gray-200 text-right">{value}</span>
            </div>
          ))}
        </div>
      </section>

    </div>
  )
}
