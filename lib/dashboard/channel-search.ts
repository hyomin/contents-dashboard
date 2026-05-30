import type { ChannelWithCategory } from '@/components/dashboard/ChannelTopicFilterBar'
import type { Video } from '@/lib/dashboard/dashboard-types'

export interface ChannelSearchMatch {
  channelId: string
  channelName: string
  matchedTerm: string
  videoCount: number
}

function normalizeForSearch(text: string): string {
  return text.toLowerCase().replace(/\s+/g, '')
}

/** 쉼표로 구분된 검색어 파싱 (빈 항목 제거) */
export function parseChannelSearchQuery(raw: string): string[] {
  return raw
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean)
}

/** 채널명·ID에 검색어(부분 일치)가 포함되는지 */
export function channelMatchesTerm(
  channel: Pick<ChannelWithCategory, 'channel_id' | 'channel_name'>,
  term: string,
): boolean {
  const q = normalizeForSearch(term)
  if (!q) return false
  const name = normalizeForSearch(channel.channel_name)
  const id = normalizeForSearch(channel.channel_id)
  return name.includes(q) || id.includes(q)
}

/** 검색어 목록에 매칭되는 채널 ID 집합 (OR) */
export function matchChannelsBySearchQuery(
  channels: ChannelWithCategory[],
  query: string,
): Set<string> {
  const terms = parseChannelSearchQuery(query)
  if (terms.length === 0) return new Set(channels.map((c) => c.channel_id))

  const matched = new Set<string>()
  for (const ch of channels) {
    if (terms.some((term) => channelMatchesTerm(ch, term))) {
      matched.add(ch.channel_id)
    }
  }
  return matched
}

/** 검색어·채널별 영상 수 통계 (매칭 채널당 1행, 검색어는 첫 매칭 term) */
export function buildChannelSearchStats(
  channels: ChannelWithCategory[],
  videos: Video[],
  query: string,
): ChannelSearchMatch[] {
  const terms = parseChannelSearchQuery(query)
  if (terms.length === 0) return []

  const stats: ChannelSearchMatch[] = []
  for (const ch of channels) {
    const matchedTerm = terms.find((term) => channelMatchesTerm(ch, term))
    if (!matchedTerm) continue
    const videoCount = videos.filter((v) => v.channelId === ch.channel_id).length
    if (videoCount === 0) continue
    stats.push({
      channelId: ch.channel_id,
      channelName: ch.channel_name,
      matchedTerm,
      videoCount,
    })
  }

  return stats.sort((a, b) => b.videoCount - a.videoCount || a.channelName.localeCompare(b.channelName, 'ko'))
}
