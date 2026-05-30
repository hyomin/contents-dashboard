export type CollectStatus = 'pending' | 'collected' | 'stale'

export interface ChannelWithCollectMeta {
  channel_id: string
  channel_name: string
  platform: string
  subscribers: number | null
  avg_views: number | null
  video_count: number | null
  updated_at: string
}

const STALE_DAYS = 7

export function getCollectStatus(ch: ChannelWithCollectMeta): CollectStatus {
  if (ch.subscribers == null && ch.video_count == null) return 'pending'
  if (!ch.updated_at) return 'collected'
  const updated = new Date(ch.updated_at).getTime()
  const staleBefore = Date.now() - STALE_DAYS * 86400000
  if (updated < staleBefore) return 'stale'
  return 'collected'
}

export function isPendingCollect(ch: ChannelWithCollectMeta): boolean {
  return getCollectStatus(ch) === 'pending'
}

export function formatCollectStatusLabel(status: CollectStatus): string {
  if (status === 'pending') return '수집 대기'
  if (status === 'stale') return '갱신 필요'
  return '수집 완료'
}

export function summarizeCollectStatus(channels: ChannelWithCollectMeta[]) {
  let pending = 0
  let stale = 0
  let collected = 0
  for (const ch of channels) {
    const s = getCollectStatus(ch)
    if (s === 'pending') pending++
    else if (s === 'stale') stale++
    else collected++
  }
  return { total: channels.length, pending, stale, collected }
}
