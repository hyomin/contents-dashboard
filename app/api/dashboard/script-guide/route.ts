import { NextRequest, NextResponse } from 'next/server'
import type { AiScriptGuideRequestContext } from '@/lib/dashboard/content-creation-guide'
import type { ContentPolishResult } from '@/lib/dashboard/content-polish'
import {
  buildDirectPublishPrompt,
  parseDirectPublishResponse,
  resolveDirectPublishContext,
} from '@/lib/dashboard/direct-publish-generate'
import {
  callGeminiGenerateContent,
  formatGeminiApiError,
  resolveGeminiModel,
} from '@/lib/dashboard/gemini-models'
import { type ScriptGuideOutput } from '@/lib/dashboard/script-guide-output'

export type { ScriptGuideOutput }

export interface ScriptGuideResponse extends ScriptGuideOutput {
  /** 발행용 정재본 — 생성 시 항상 포함 */
  polished: ContentPolishResult
}

async function generateDirectPublish(
  ctx: AiScriptGuideRequestContext,
): Promise<{ output: ScriptGuideResponse | null; error?: string }> {
  const apiKey = process.env.GEMINI_API_KEY?.trim()
  if (!apiKey) {
    return {
      output: null,
      error: 'GEMINI_API_KEY가 .env.local에 없습니다. dev 서버 재시작 후 다시 시도하세요.',
    }
  }

  const { topic, targetFormat } = resolveDirectPublishContext(ctx)
  const model = resolveGeminiModel(ctx.aiModel)
  const { prompt, maxOutputTokens, imageGuideCount } = buildDirectPublishPrompt(ctx, topic, targetFormat)
  const shortform = targetFormat === 'shortform' || ctx.category === 'video'

  const result = await callGeminiGenerateContent(apiKey, model, prompt, {
    temperature: 0.55,
    maxOutputTokens,
    timeoutMs: 90_000,
  })

  if (!result.ok) {
    return {
      output: null,
      error: formatGeminiApiError(result.status, result.error),
    }
  }

  const parsed = parseDirectPublishResponse(result.text, ctx, topic, targetFormat, imageGuideCount)
  if (!parsed) {
    return { output: null, error: 'AI 응답 파싱에 실패했습니다. 다시 시도해 주세요.' }
  }

  if (
    shortform &&
    !parsed.polished.fullContent.includes('### 씬') &&
    !parsed.polished.fullContent.includes('장면')
  ) {
    console.warn('[script-guide] shortform output may lack scene / Flow paste blocks')
  }

  return {
    output: {
      ...parsed.script,
      polished: parsed.polished,
    },
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json() as { context?: AiScriptGuideRequestContext }
  const ctx = body.context

  if (!ctx?.category || !ctx?.intent) {
    return NextResponse.json({ error: 'context.category와 context.intent가 필요합니다' }, { status: 400 })
  }

  const { topic } = resolveDirectPublishContext(ctx)
  if (!topic || topic === '콘텐츠 주제') {
    return NextResponse.json({ error: '발행 주제(키워드)를 입력해 주세요' }, { status: 400 })
  }

  let output: ScriptGuideResponse | null = null
  let lastError: string | undefined

  try {
    const result = await generateDirectPublish(ctx)
    output = result.output
    if (result.error) lastError = result.error
  } catch (err) {
    console.error('[script-guide] direct publish failed', err)
    lastError = err instanceof Error ? err.message : '생성 오류'
  }

  if (!output) {
    const hasGemini = !!process.env.GEMINI_API_KEY?.trim()
    const hint = hasGemini
      ? `마지막 오류: ${lastError ?? '알 수 없음'}.`
      : 'GEMINI_API_KEY가 .env.local에 설정되어 있는지 확인하고 npm run dev를 재시작하세요.'
    return NextResponse.json({ error: `발행용 콘텐츠 생성에 실패했습니다. ${hint}` }, { status: 500 })
  }

  return NextResponse.json(output)
}
