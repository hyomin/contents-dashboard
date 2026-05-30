import { NextRequest, NextResponse } from 'next/server'
import type { AiScriptGuideRequestContext } from '@/lib/dashboard/content-creation-guide'
import type { ContentGenerateResult } from '@/app/api/dashboard/content-generate/route'
import { invokeN8nWebhook, resolveN8nWebhookUrl } from '@/lib/n8n/invoke-webhook'
import {
  buildScriptGuideOutput,
  categoryToTargetFormat,
  contentResultToMarkdown,
  deriveTopic,
  normalizeN8nScriptBody,
  isStubScript,
  type ScriptGuideOutput,
} from '@/lib/dashboard/script-guide-output'

export type { ScriptGuideOutput }

const PLATFORM_BY_CATEGORY = {
  writing: 'naver-blog',
  image: 'instagram',
  video: 'youtube',
} as const

async function generateViaN8n(ctx: AiScriptGuideRequestContext): Promise<ScriptGuideOutput | null> {
  const url = resolveN8nWebhookUrl('N8N_WEBHOOK_LONGFORM_SCRIPT', 'longform-script')
  const topic = deriveTopic(ctx.keywords, ctx.references ?? [], ctx.userTopic)
  const targetFormat = categoryToTargetFormat(ctx.category)
  const references = (ctx.references ?? []).slice(0, 10).map((r) => ({
    title: r.title,
    platform: r.platform,
    channel: r.channel,
    vsAvg: r.vsAvg,
  }))

  const result = await invokeN8nWebhook(
    url,
    {
      topic,
      userTopic: ctx.userTopic ?? topic,
      targetFormat,
      category: ctx.category,
      intent: ctx.intent,
      platform: PLATFORM_BY_CATEGORY[ctx.category],
      keywords: ctx.keywords.slice(0, 8),
      references,
      referenceTitles: ctx.referenceTitles.slice(0, 10),
      targetAudience: '한국 성인 독자',
      durationMinutes: ctx.category === 'video' ? 8 : 0,
      source: 'content-guide',
    },
    90_000,
  )

  if (!result.ok) {
    console.warn('[script-guide] n8n webhook failed', result.status, result.body)
    return null
  }

  const normalized = normalizeN8nScriptBody(result.body)
  if (!normalized?.fullScript && !normalized?.title) {
    console.warn('[script-guide] n8n response not parseable', result.body)
    return null
  }

  const fullScript = normalized.fullScript ?? normalized.title ?? ''
  if (isStubScript(fullScript)) {
    console.warn('[script-guide] n8n returned stub script, trying dashboard fallback')
    return null
  }

  return buildScriptGuideOutput({
    ...normalized,
    mode: normalized.mode ?? 'n8n',
    category: ctx.category,
    intent: ctx.intent,
    targetFormat,
    platform: PLATFORM_BY_CATEGORY[ctx.category],
    topic,
    title: normalized.title ?? topic,
    fullScript,
  })
}

async function generateViaContentGenerate(
  ctx: AiScriptGuideRequestContext,
  origin: string,
): Promise<{ output: ScriptGuideOutput | null; error?: string }> {
  const apiKey = process.env.GEMINI_API_KEY?.trim()
  if (!apiKey) {
    return { output: null, error: 'GEMINI_API_KEY가 .env.local에 없습니다. dev 서버 재시작 후 다시 시도하세요.' }
  }

  const topic = deriveTopic(ctx.keywords, ctx.references ?? [], ctx.userTopic)
  const targetFormat = categoryToTargetFormat(ctx.category)
  const refTitles = (ctx.references ?? []).map((r) => r.title).filter(Boolean)
  const hasUserTopic = !!ctx.userTopic?.trim()

  const res = await fetch(`${origin}/api/dashboard/content-generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      targetFormat,
      topic,
      context: {
        trendingKeywords: [],
        rssTopics: [],
        outlierTitles: refTitles.length ? refTitles : ctx.referenceTitles,
        platform: PLATFORM_BY_CATEGORY[ctx.category],
        suppressAutoContext: hasUserTopic,
      },
    }),
    signal: AbortSignal.timeout(90_000),
  })

  const data = (await res.json()) as ContentGenerateResult & { error?: string }
  if (!res.ok || data.error || !data.format) {
    return {
      output: null,
      error: data.error ?? `content-generate HTTP ${res.status}`,
    }
  }

  const { title, body } = contentResultToMarkdown(data)
  const hook = 'hook' in data ? String(data.hook) : undefined
  const cta = 'cta' in data ? String(data.cta) : undefined
  const seoKeywords = 'seoKeywords' in data && Array.isArray(data.seoKeywords) ? data.seoKeywords : undefined
  const chapterSummary =
    data.format === 'longform'
      ? data.chapters.map((c) => c.heading)
      : data.format === 'blog'
        ? data.h2Sections.map((s) => s.heading)
        : data.format === 'carousel'
          ? data.slides.map((s) => s.heading)
          : undefined

  return {
    output: buildScriptGuideOutput({
      mode: 'dashboard',
      category: ctx.category,
      intent: ctx.intent,
      targetFormat,
      platform: PLATFORM_BY_CATEGORY[ctx.category],
      topic,
      title,
      fullScript: body,
      hook,
      cta,
      seoKeywords,
      chapterSummary,
      message: '대시보드 AI(content-generate)로 생성됨',
    }),
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json() as { context?: AiScriptGuideRequestContext }
  const ctx = body.context

  if (!ctx?.category || !ctx?.intent) {
    return NextResponse.json({ error: 'context.category와 context.intent가 필요합니다' }, { status: 400 })
  }

  const topic = deriveTopic(ctx.keywords ?? [], ctx.references ?? [], ctx.userTopic)
  if (!topic || topic === '콘텐츠 주제') {
    return NextResponse.json({ error: '발행 주제(키워드)를 입력해 주세요' }, { status: 400 })
  }

  const origin = req.nextUrl.origin
  let output: ScriptGuideOutput | null = null
  let lastError: string | undefined

  try {
    output = await generateViaN8n(ctx)
  } catch (err) {
    console.error('[script-guide] n8n failed', err)
    lastError = err instanceof Error ? err.message : 'n8n 호출 오류'
  }

  if (!output) {
    try {
      const fallback = await generateViaContentGenerate(ctx, origin)
      output = fallback.output
      if (fallback.error) lastError = fallback.error
    } catch (err) {
      console.error('[script-guide] content-generate failed', err)
      lastError = err instanceof Error ? err.message : 'content-generate 오류'
    }
  }

  if (!output) {
    const hasGemini = !!process.env.GEMINI_API_KEY?.trim()
    const hint = hasGemini
      ? `마지막 오류: ${lastError ?? '알 수 없음'}. n8n 워크플로 미배포 시 ./scripts/n8n-setup.sh 실행 후 dev 서버를 재시작하세요.`
      : 'GEMINI_API_KEY가 .env.local에 설정되어 있는지 확인하고 npm run dev를 재시작하세요.'
    return NextResponse.json({ error: `스크립트 생성에 실패했습니다. ${hint}` }, { status: 500 })
  }

  return NextResponse.json(output)
}
