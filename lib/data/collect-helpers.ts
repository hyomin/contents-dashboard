import { collectNaverBlogChannelData } from '@/lib/data/naver-blog-collect'
import { collectTistoryChannelData } from '@/lib/data/tistory-collect'
import { collectBloggerChannelData } from '@/lib/data/blogger-collect'
import { collectYoutubeChannelData } from '@/lib/data/youtube-channel-collect'

export type CollectResult =
  | Awaited<ReturnType<typeof collectYoutubeChannelData>>
  | Awaited<ReturnType<typeof collectNaverBlogChannelData>>
  | Awaited<ReturnType<typeof collectTistoryChannelData>>
  | Awaited<ReturnType<typeof collectBloggerChannelData>>

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
  if (platform === 'blogger') {
    return collectBloggerChannelData({ channel_id: row.channel_id, channel_name: row.channel_name })
  }
  if (platform === 'tiktok' || platform === 'instagram') {
    return {
      ok: false,
      channel_id: row.channel_id,
      error: `${platform === 'tiktok' ? 'TikTok' : 'Instagram'} 채널 수집은 아직 지원되지 않습니다 (Apify 연동 예정 — 로드맵 "Apify 유튜브·인스타 크롤링" 참고)`,
    }
  }
  return collectYoutubeChannelData({ channel_id: row.channel_id, channel_name: row.channel_name ?? undefined })
}
