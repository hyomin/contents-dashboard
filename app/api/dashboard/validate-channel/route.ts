import { NextRequest, NextResponse } from 'next/server'

export interface ValidateChannelResult {
  valid: boolean
  channelId?: string
  title?: string
  handle?: string
  description?: string
  subscribers?: number
  videoCount?: number
  thumbnail?: string
  reason?: 'not_found' | 'api_error' | 'invalid_platform'
}

/**
 * 채널 ID / 핸들 / URL을 YouTube Data API로 실시간 검증합니다.
 * GET /api/dashboard/validate-channel?input=UC...&platform=youtube
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const raw = searchParams.get('input')?.trim() ?? ''
  const platform = searchParams.get('platform') ?? 'youtube'

  // YouTube 이외 플랫폼은 형식 검사만 (API 없음)
  if (platform !== 'youtube') {
    if (!raw) {
      return NextResponse.json<ValidateChannelResult>({ valid: false, reason: 'not_found' })
    }
    return NextResponse.json<ValidateChannelResult>({
      valid: true,
      channelId: raw,
      title: null as unknown as string,
      reason: 'invalid_platform',
    })
  }

  if (!raw) {
    return NextResponse.json<ValidateChannelResult>({ valid: false, reason: 'not_found' })
  }

  const apiKey = process.env.YOUTUBE_API_KEY
  if (!apiKey) {
    return NextResponse.json<ValidateChannelResult>({ valid: false, reason: 'api_error' }, { status: 500 })
  }

  // 입력 파싱: URL → ID/핸들 추출
  const parsed = parseYouTubeInput(raw)

  try {
    const result = await fetchYouTubeChannel(parsed, apiKey)
    return NextResponse.json<ValidateChannelResult>(result)
  } catch {
    return NextResponse.json<ValidateChannelResult>({ valid: false, reason: 'api_error' }, { status: 500 })
  }
}

// ─── 입력 파싱 ───────────────────────────────────────────────

interface ParsedInput {
  type: 'id' | 'handle' | 'username'
  value: string
}

function parseYouTubeInput(raw: string): ParsedInput {
  const s = raw.trim()

  // URL 케이스
  // https://youtube.com/channel/UCxxx
  const channelMatch = s.match(/youtube\.com\/channel\/(UC[\w-]{22})/i)
  if (channelMatch) return { type: 'id', value: channelMatch[1] }

  // https://youtube.com/@handle
  const handleUrlMatch = s.match(/youtube\.com\/@([\w.-]+)/i)
  if (handleUrlMatch) return { type: 'handle', value: handleUrlMatch[1] }

  // https://youtube.com/user/username (레거시)
  const userMatch = s.match(/youtube\.com\/user\/([\w-]+)/i)
  if (userMatch) return { type: 'username', value: userMatch[1] }

  // @handle 직접 입력
  if (s.startsWith('@')) return { type: 'handle', value: s.slice(1) }

  // UC... 직접 입력 (24자 channel ID)
  if (/^UC[\w-]{22}$/.test(s)) return { type: 'id', value: s }

  // 그 외 → handle로 시도
  return { type: 'handle', value: s }
}

// ─── YouTube API 호출 ────────────────────────────────────────

async function fetchYouTubeChannel(parsed: ParsedInput, apiKey: string): Promise<ValidateChannelResult> {
  const base = 'https://www.googleapis.com/youtube/v3/channels'
  const parts = 'part=id,snippet,statistics'

  let url: string
  if (parsed.type === 'id') {
    url = `${base}?${parts}&id=${encodeURIComponent(parsed.value)}&key=${apiKey}`
  } else if (parsed.type === 'handle') {
    url = `${base}?${parts}&forHandle=${encodeURIComponent('@' + parsed.value)}&key=${apiKey}`
  } else {
    url = `${base}?${parts}&forUsername=${encodeURIComponent(parsed.value)}&key=${apiKey}`
  }

  const res = await fetch(url, { next: { revalidate: 0 } })
  if (!res.ok) return { valid: false, reason: 'api_error' }

  const data = await res.json()

  if (!data.items || data.items.length === 0) {
    // handle로 시도했는데 없으면 → id로 재시도
    if (parsed.type === 'handle') {
      const retryUrl = `${base}?${parts}&id=${encodeURIComponent(parsed.value)}&key=${apiKey}`
      const retryRes = await fetch(retryUrl, { next: { revalidate: 0 } })
      if (retryRes.ok) {
        const retryData = await retryRes.json()
        if (retryData.items?.length) {
          return buildResult(retryData.items[0])
        }
      }
    }
    return { valid: false, reason: 'not_found' }
  }

  return buildResult(data.items[0])
}

function buildResult(item: {
  id: string
  snippet: { title: string; customUrl?: string; description?: string; thumbnails?: { default?: { url: string }; medium?: { url: string } } }
  statistics?: { subscriberCount?: string; videoCount?: string; hiddenSubscriberCount?: boolean }
}): ValidateChannelResult {
  const subs = item.statistics?.hiddenSubscriberCount
    ? undefined
    : item.statistics?.subscriberCount
      ? parseInt(item.statistics.subscriberCount)
      : undefined

  const thumbnail =
    item.snippet.thumbnails?.medium?.url ??
    item.snippet.thumbnails?.default?.url ??
    undefined

  return {
    valid: true,
    channelId: item.id,
    title: item.snippet.title,
    handle: item.snippet.customUrl ?? undefined,
    description: item.snippet.description?.slice(0, 100) ?? undefined,
    subscribers: subs,
    videoCount: item.statistics?.videoCount ? parseInt(item.statistics.videoCount) : undefined,
    thumbnail,
  }
}
