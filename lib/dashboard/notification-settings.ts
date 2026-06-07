/** 브라우저 알림·토스트 설정 (localStorage) */

export type ToastKind = 'collect' | 'ai' | 'error' | 'general'

export interface NotificationSettings {
  collectDone: boolean
  aiDone: boolean
  errorAlert: boolean
  toastDurationMs: number
}

export const LS_NOTIF_KEY = 'dashboard_notification_settings'

export const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
  collectDone: true,
  aiDone: true,
  errorAlert: true,
  toastDurationMs: 4500,
}

function toBool(v: unknown, fallback: boolean): boolean {
  if (typeof v === 'boolean') return v
  if (v === 'true') return true
  if (v === 'false') return false
  return fallback
}

export function loadNotificationSettings(): NotificationSettings {
  if (typeof window === 'undefined') return DEFAULT_NOTIFICATION_SETTINGS
  try {
    const stored = localStorage.getItem(LS_NOTIF_KEY)
    if (!stored) return DEFAULT_NOTIFICATION_SETTINGS
    const parsed = JSON.parse(stored) as Partial<NotificationSettings>
    const ms = Number(parsed.toastDurationMs)
    return {
      collectDone: toBool(parsed.collectDone, DEFAULT_NOTIFICATION_SETTINGS.collectDone),
      aiDone: toBool(parsed.aiDone, DEFAULT_NOTIFICATION_SETTINGS.aiDone),
      errorAlert: toBool(parsed.errorAlert, DEFAULT_NOTIFICATION_SETTINGS.errorAlert),
      toastDurationMs: Number.isFinite(ms) ? ms : DEFAULT_NOTIFICATION_SETTINGS.toastDurationMs,
    }
  } catch {
    return DEFAULT_NOTIFICATION_SETTINGS
  }
}

export function saveNotificationSettings(settings: NotificationSettings): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(LS_NOTIF_KEY, JSON.stringify(settings))
}

export function shouldShowToast(
  settings: NotificationSettings,
  type: 'success' | 'info' | 'warning' | 'error',
  kind: ToastKind = 'general',
): boolean {
  if (kind === 'collect' && !settings.collectDone) return false
  if (kind === 'ai' && !settings.aiDone) return false
  if ((kind === 'error' || type === 'warning' || type === 'error') && !settings.errorAlert) return false
  return true
}
