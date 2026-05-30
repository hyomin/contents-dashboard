export type TrackingStatus = 'active' | 'inactive' | 'untrackable'

/** 3개월(90일) 이상 미업로드 시 비활성 */
export const INACTIVE_DAYS = 90

export function resolveTrackingStatus(params: {
  channelFound: boolean
  lastUploadAt: string | null | undefined
  now?: Date
}): TrackingStatus {
  if (!params.channelFound) return 'untrackable'
  if (!params.lastUploadAt) return 'inactive'

  const nowMs = (params.now ?? new Date()).getTime()
  const cutoffMs = nowMs - INACTIVE_DAYS * 86400000
  return new Date(params.lastUploadAt).getTime() >= cutoffMs ? 'active' : 'inactive'
}

export function pickLatestUploadAt(dates: Array<string | null | undefined>): string | null {
  let latest: string | null = null
  for (const raw of dates) {
    if (!raw) continue
    const t = new Date(raw).getTime()
    if (Number.isNaN(t)) continue
    if (!latest || t > new Date(latest).getTime()) latest = raw
  }
  return latest
}

export function formatTrackingStatusLabel(status: TrackingStatus | null | undefined): string {
  if (status === 'active') return '활성'
  if (status === 'inactive') return '비활성'
  if (status === 'untrackable') return '추적불가'
  return '미확인'
}

export function trackingStatusBadgeClass(status: TrackingStatus | null | undefined): string {
  if (status === 'active') {
    return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
  }
  if (status === 'inactive') {
    return 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
  }
  if (status === 'untrackable') {
    return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
  }
  return 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
}
