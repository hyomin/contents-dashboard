/** YouTube Shorts 최대 길이(초). 2024년 기준 최대 약 3분 */
export const SHORTS_MAX_DURATION_SEC = 180

export type VideoFormat = 'short' | 'long' | 'unknown'

export function classifyVideoFormat(
  durationSec: number | null | undefined,
  title?: string | null,
): VideoFormat {
  const duration = durationSec ?? 0
  if (duration > 0) {
    return duration <= SHORTS_MAX_DURATION_SEC ? 'short' : 'long'
  }
  if (title && /#shorts\b/i.test(title)) return 'short'
  return 'unknown'
}

export function formatDurationLabel(durationSec: number | null | undefined): string {
  if (!durationSec || durationSec <= 0) return '—'
  if (durationSec < 60) return `${durationSec}초`
  const m = Math.floor(durationSec / 60)
  const s = durationSec % 60
  return s > 0 ? `${m}분 ${s}초` : `${m}분`
}

export function formatLabelKo(f: VideoFormat): string {
  if (f === 'short') return 'Shorts'
  if (f === 'long') return '롱폼'
  return '미분류'
}
