import { collectNaverBlogChannelData } from '@/lib/data/naver-blog-collect'
import { collectTistoryChannelData } from '@/lib/data/tistory-collect'
import { collectYoutubeChannelData } from '@/lib/data/youtube-channel-collect'

export type CollectResult =
  | Awaited<ReturnType<typeof collectYoutubeChannelData>>
  | Awaited<ReturnType<typeof collectNaverBlogChannelData>>
  | Awaited<ReturnType<typeof collectTistoryChannelData>>

/**
 * 플랫폼에 따라 적절한 수집 함수를 호출합니다.
 * collect, collect-platform 라우트에서 공통으로 사용됩니다.
 */
export async function collectChannelByPlatform(
  platform: string,
  row: { channel_id: string; channel_name?: string | null },
): Promise<CollectResult> {
  if (platform === 'naver-blog') {
    return collectNaverBlogChannelData({ channel_id: row.channel_id, channel_name: row.channel_name })
  }
  if (platform === 'tistory') {
    return collectTistoryChannelData({ channel_id: row.channel_id, channel_name: row.channel_name })
  }
  return collectYoutubeChannelData({ channel_id: row.channel_id, channel_name: row.channel_name ?? undefined })
}
