/**
 * POST /api/dashboard/content-generate
 *
 * 통합 콘텐츠 파이프라인 API.
 * - source 없음  → 주제 기반 신규 생성
 * - source 있음  → 기존 콘텐츠를 다른 포맷으로 변환
 *
 * 지원 targetFormat:
 *   longform | shortform | carousel | blog | sns-caption
 *
 * YT 컨텍스트 자동 주입:
 *   클라이언트가 context를 전달하지 않거나 부족한 경우,
 *   서버에서 최신 Outlier 제목·트렌딩 키워드·RSS 주제를 자동으로 fetch해 merge한다.
*/
import { NextRequest, NextResponse } from 'next/server'

export type ContentFormat = 'longform' | 'shortform' | 'carousel' | 'blog' | 'sns-caption'

export interface ContentGenerateRequest {
  targetFormat: ContentFormat
  /** 처음부터 생성할 때 — 주제 키워드 */
  topic?: string
  /** 기존 콘텐츠 변환 시 — 원본 텍스트 */
  sourceContent?: string
  /** 원본 포맷 (변환 시 프롬프트 최적화용) */
  sourceFormat?: ContentFormat
  /** 추가 컨텍스트 */
  context?: {
    outlierTitles?: string[]
    rssTopics?: string[]
    trendingKeywords?: string[]
    platform?: string
    /** true면 서버 자동 트렌드/RSS 주입 생략 (사용자 지정 주제 전용) */
    suppressAutoContext?: boolean
  }
}

export interface LongformResult {
  format: 'longform'
  title: string
  hook: string
  chapters: { heading: string; bullets: string[]; durationSec: number }[]
  cta: string
  seoKeywords: string[]
  fullScript: string
}

export interface ShortformResult {
  format: 'shortform'
  title: string
  hook: string
  keyPoints: string[]
  cta: string
  onScreenText: string[]
  durationHint: string
  fullScript: string
}

export interface CarouselResult {
  format: 'carousel'
  title: string
  slides: { heading: string; body: string }[]
  cta: string
  hashtags: string[]
}

export interface BlogResult {
  format: 'blog'
  title: string
  metaDescription: string
  h2Sections: { heading: string; paragraphs: string[] }[]
  seoKeywords: string[]
  closingCta: string
  fullContent: string
}

export interface SnsCaptionResult {
  format: 'sns-caption'
  title: string
  captions: { instagram: string; naver: string; thread: string }
  hashtags: string[]
}

export type ContentGenerateResult =
  | LongformResult
  | ShortformResult
  | CarouselResult
  | BlogResult
  | SnsCaptionResult

// ─── 포맷별 프롬프트 빌더 ─────────────────────────────────────────────────────

function buildContextBlock(ctx?: ContentGenerateRequest['context']): string {
  if (!ctx) return ''
  const parts: string[] = []
  if (ctx.trendingKeywords?.length)
    parts.push(`[급상승 키워드]\n${ctx.trendingKeywords.slice(0, 6).join(', ')}`)
  if (ctx.rssTopics?.length)
    parts.push(`[RSS 주제 후보]\n${ctx.rssTopics.slice(0, 5).map((t, i) => `${i + 1}. ${t}`).join('\n')}`)
  if (ctx.outlierTitles?.length)
    parts.push(`[참고 레퍼런스 제목 — 제목·H2 구조·톤만 벤치마킹, 문장 복사·주제 변경 금지]\n${ctx.outlierTitles.slice(0, 5).map((t, i) => `${i + 1}. ${t}`).join('\n')}`)
  return parts.length ? `\n\n${parts.join('\n\n')}` : ''
}

function buildSourceBlock(sourceContent?: string, sourceFormat?: ContentFormat): string {
  if (!sourceContent?.trim()) return ''
  const label = sourceFormat
    ? { longform: '롱폼 대본', shortform: '숏폼 스크립트', carousel: '캐러셀 슬라이드', blog: '블로그 글', 'sns-caption': 'SNS 캡션' }[sourceFormat]
    : '원본 콘텐츠'
  return `\n\n[${label}]\n${sourceContent.trim().slice(0, 3000)}`
}

function promptFor(req: ContentGenerateRequest): { prompt: string; maxOutputTokens: number } {
  const ctx = buildContextBlock(req.context)
  const src = buildSourceBlock(req.sourceContent, req.sourceFormat)
  const isTransform = !!req.sourceContent?.trim()
  const topicLine = req.topic
    ? `주제(필수 — 반드시 이 주제만 다룸): ${req.topic}`
    : ''

  const base = isTransform
    ? `당신은 멀티포맷 콘텐츠 전략가입니다. 아래 ${req.sourceFormat ?? '원본'} 콘텐츠를`
    : `당신은 유튜브·블로그 콘텐츠 기획자입니다.`

  switch (req.targetFormat) {
    case 'longform':
      return {
        maxOutputTokens: 4096,
        prompt: `${base} ${isTransform ? '롱폼 YouTube 영상 대본 구조로 변환' : '롱폼 YouTube 영상 (8~12분) 대본 구조를 생성'}해주세요.
${topicLine}${ctx}${src}

반드시 JSON만 응답:
{
  "title": "영상 제목 (40자 이내, 클릭하고 싶은 제목)",
  "hook": "오프닝 훅 (첫 15초, 시청자를 붙잡는 반전·질문·놀라운 수치)",
  "chapters": [
    {"heading": "챕터명", "bullets": ["핵심 포인트1", "포인트2"], "durationSec": 120}
  ],
  "cta": "엔딩 CTA 한 문장",
  "seoKeywords": ["키워드1", "키워드2", "키워드3"],
  "fullScript": "전체 대본 흐름 (챕터별 1~2문단 요약, 실제 말할 문장 형태)"
}`,
      }

    case 'shortform':
      return {
        maxOutputTokens: 2048,
        prompt: `${base} ${isTransform ? '숏폼(YouTube Shorts / Reels, 60초 이내) 스크립트로 변환' : '숏폼(60초) 스크립트를 생성'}해주세요.
${topicLine}${ctx}${src}

반드시 JSON만 응답:
{
  "title": "숏폼 제목 (20자 이내)",
  "hook": "첫 1~2초 훅 문장 (루프 가능하게 끝냄)",
  "keyPoints": ["핵심 포인트1 (10초)", "포인트2 (15초)", "포인트3 (10초)"],
  "cta": "CTA (구독/링크/댓글 유도, 5초)",
  "onScreenText": ["자막 오버레이1", "자막2", "자막3", "자막4"],
  "durationHint": "예상 길이 (예: 45초~55초)",
  "fullScript": "전체 말할 대본 (자연스러운 구어체)"
}`,
      }

    case 'carousel':
      return {
        maxOutputTokens: 2048,
        prompt: `${base} ${isTransform ? '인스타그램 캐러셀 (슬라이드 카드뉴스) 형식으로 변환' : '인스타그램 캐러셀 (5~7장) 카드뉴스를 생성'}해주세요.
${topicLine}${ctx}${src}

반드시 JSON만 응답:
{
  "title": "1번 슬라이드 헤드라인 (한 줄 강렬한 문구)",
  "slides": [
    {"heading": "슬라이드 제목", "body": "본문 2~3줄 (짧고 임팩트 있게)"}
  ],
  "cta": "마지막 슬라이드 CTA",
  "hashtags": ["해시태그1", "해시태그2", "해시태그3", "해시태그4", "해시태그5"]
}`,
      }

    case 'blog':
      return {
        maxOutputTokens: 4096,
        prompt: `${base} ${isTransform ? 'SEO 최적화 블로그 포스팅으로 변환 (네이버·티스토리 적합)' : 'SEO 블로그 포스팅을 생성'}해주세요.
${topicLine}${ctx}${src}

반드시 JSON만 응답:
{
  "title": "블로그 제목 (검색 키워드 포함, 35자 이내)",
  "metaDescription": "메타 설명 (80자 이내, 클릭 유도)",
  "h2Sections": [
    {"heading": "H2 소제목", "paragraphs": ["문단1", "문단2"]}
  ],
  "seoKeywords": ["메인키워드", "관련키워드1", "관련키워드2"],
  "closingCta": "마지막 CTA 문장 (구독·댓글·다음글 유도)",
  "fullContent": "전체 마크다운 본문 (H2 구조, 자연스러운 흐름)"
}`,
      }

    case 'sns-caption':
      return {
        maxOutputTokens: 1536,
        prompt: `${base} ${isTransform ? '플랫폼별 SNS 캡션으로 변환' : 'SNS 캡션을 생성'}해주세요.
${topicLine}${ctx}${src}

반드시 JSON만 응답:
{
  "title": "썸네일/표지 텍스트 한 줄",
  "captions": {
    "instagram": "인스타 캡션 (이모지 포함, 200자 이내 + 줄바꿈)",
    "naver": "네이버 블로그 도입 문장 (친근한 어체, 100자)",
    "thread": "Thread 스레드형 3~4문장 (짧고 강렬하게)"
  },
  "hashtags": ["해시태그1", "해시태그2", "해시태그3", "해시태그4", "해시태그5"]
}`,
      }
  }
}

// ─── YT 컨텍스트 자동 fetch ───────────────────────────────────────────────────

interface AutoContext {
  outlierTitles: string[]
  trendingKeywords: string[]
  rssTopics: string[]
}

let autoCtxCache: { data: AutoContext; cachedAt: number } | null = null
const AUTO_CTX_TTL = 15 * 60 * 1000

async function fetchAutoContext(): Promise<AutoContext> {
  if (autoCtxCache && Date.now() - autoCtxCache.cachedAt < AUTO_CTX_TTL) {
    return autoCtxCache.data
  }

  try {
    const { getOutlierVideos, getVideosForAnalytics } = await import('@/lib/data/queries')
    const { getRssTopicCandidates } = await import('@/lib/data/rss-topic-collect')
    const { extractTrendingKeywords } = await import('@/lib/data/analytics-from-videos')

    const [outliers, videos, rssTopics] = await Promise.all([
      getOutlierVideos(1.5, 10),
      getVideosForAnalytics(300),
      getRssTopicCandidates(8),
    ])

    const data: AutoContext = {
      outlierTitles: outliers.map((v) => v.title).filter(Boolean),
      trendingKeywords: extractTrendingKeywords(videos, 10).map((k) => k.keyword),
      rssTopics: rssTopics.map((t) => t.ai_title ?? t.title).filter(Boolean),
    }

    autoCtxCache = { data, cachedAt: Date.now() }
    return data
  } catch (err) {
    console.warn('[content-generate] auto-context fetch failed, skipping:', err)
    return { outlierTitles: [], trendingKeywords: [], rssTopics: [] }
  }
}

/** 클라이언트 context의 누락된 필드를 자동 fetch된 값으로 채워 merge */
function mergeContext(
  client: ContentGenerateRequest['context'],
  auto: AutoContext,
): ContentGenerateRequest['context'] {
  return {
    platform: client?.platform,
    outlierTitles:
      client?.outlierTitles?.length ? client.outlierTitles : auto.outlierTitles,
    trendingKeywords:
      client?.trendingKeywords?.length ? client.trendingKeywords : auto.trendingKeywords,
    rssTopics:
      client?.rssTopics?.length ? client.rssTopics : auto.rssTopics,
  }
}

// ─── 메인 핸들러 ──────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const apiKey = process.env.GEMINI_API_KEY?.trim()
  if (!apiKey)
    return NextResponse.json({ error: 'GEMINI_API_KEY가 설정되지 않았습니다.' }, { status: 503 })

  const body = (await req.json()) as ContentGenerateRequest

  if (!body.targetFormat)
    return NextResponse.json({ error: 'targetFormat이 필요합니다.' }, { status: 400 })

  if (!body.topic?.trim() && !body.sourceContent?.trim())
    return NextResponse.json({ error: 'topic 또는 sourceContent 중 하나가 필요합니다.' }, { status: 400 })

  // YT 컨텍스트 자동 주입: 클라이언트 context가 없거나 비어있으면 서버에서 자동 fetch
  const needsAutoCtx =
    !body.context?.suppressAutoContext &&
    (!body.context ||
      (!body.context.outlierTitles?.length &&
        !body.context.trendingKeywords?.length &&
        !body.context.rssTopics?.length))

  if (needsAutoCtx) {
    const auto = await fetchAutoContext()
    body.context = mergeContext(body.context, auto)
  }

  const { prompt, maxOutputTokens } = promptFor(body)

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.6, maxOutputTokens },
        }),
        signal: AbortSignal.timeout(40000),
      },
    )

    if (!res.ok) {
      const errText = await res.text()
      console.error('[content-generate] gemini error', res.status, errText)
      return NextResponse.json({ error: `Gemini API 오류 (${res.status})` }, { status: 500 })
    }

    const data = (await res.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[]
    }
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch)
      return NextResponse.json({ error: 'AI 응답 파싱 실패. 다시 시도해주세요.' }, { status: 500 })

    const parsed = JSON.parse(jsonMatch[0]) as Record<string, unknown>
    return NextResponse.json({ ...parsed, format: body.targetFormat } as ContentGenerateResult)
  } catch (err) {
    console.error('[content-generate] failed', err)
    return NextResponse.json({ error: '생성 중 오류가 발생했습니다.' }, { status: 500 })
  }
}
