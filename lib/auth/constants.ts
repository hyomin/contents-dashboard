/** 비활성 시 강제 로그아웃 (12시간) */
export const SESSION_IDLE_MS = 12 * 60 * 60 * 1000

export const SESSION_COOKIE_NAME = 'dashboard_session'

/** 클라이언트 하트비트 최소 간격 */
export const HEARTBEAT_MIN_INTERVAL_MS = 45 * 1000

/** 로그인 안내 등 UI용 (예: "12시간", "45분") */
export function formatSessionIdleTimeoutLabel(): string {
  const hours = Math.floor(SESSION_IDLE_MS / (60 * 60 * 1000))
  const minutes = Math.floor((SESSION_IDLE_MS % (60 * 60 * 1000)) / 60_000)
  if (hours > 0 && minutes === 0) return `${hours}시간`
  if (hours > 0) return `${hours}시간 ${minutes}분`
  return `${minutes}분`
}
