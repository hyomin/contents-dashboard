import { NextRequest, NextResponse } from 'next/server'
import { denyUnlessDashboardMutationAuth } from '@/lib/dashboard/api-auth'
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
import {
  getLongformScriptWebhookUrl,
  invokeLongformScriptN8n,
  isDashboardGeminiDirectEnabled,
} from '@/lib/dashboard/n8n-ai'
import { isStubScript, type ScriptGuideOutput } from '@/lib/dashboard/script-guide-output'

export type { ScriptGuideOutput }

export interface ScriptGuideResponse extends ScriptGuideOutput {
  /** 발행용 정재본 — 생성 시 항상 포함 */
  polished: ContentPolishResult
  /** 생성 완료됐지만 사용자에게 알려야 할 품질 경고 */
  warning?: string
}

async function generateDirectPublish(
  ctx: AiScriptGuideRequestContext,
): Promise<{ output: ScriptGuideResponse | null; error?: string }> {
  const apiKey = process.env.GEMINI_API_KEY?.trim()
  if (!apiKey) {
    return {
      output: null,
      error: 'GEMINI_API_KEY가 없습니다. n8n Webhook(N8N_WEBHOOK_LONGFORM_SCRIPT)을 설정하세요.',
    }
  }

  const { topic, targetFormat } = resolveDirectPublishContext(ctx)
  const model = resolveGeminiModel(ctx.aiModel)
  const { prompt, maxOutputTokens, imageGuideCount } = buildDirectPublishPrompt(ctx, topic, targetFormat)
  const shortform = targetFormat === 'shortform'

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

  if (result.blockReason) {
    return {
      output: null,
      error:
        'AI가 안전 정책상 이 주제의 표현을 거부했습니다 (예: 다툼·체벌·자극적 묘사 등). 주제 문장에서 해당 표현을 순화해 다시 시도해 주세요.',
    }
  }

  const parsed = parseDirectPublishResponse(result.text, ctx, topic, targetFormat, imageGuideCount)
  if (!parsed) {
    if (result.truncated) {
      return {
        output: null,
        error: 'AI 응답이 토큰 한도에 걸려 중간에 잘렸습니다 (출력이 길어지는 주제일 때 발생할 수 있어요). 주제를 조금 더 구체적·짧게 입력하거나 다시 시도해 주세요.',
      }
    }
    return { output: null, error: 'AI 응답 파싱에 실패했습니다. 다시 시도해 주세요.' }
  }

  let warning: string | undefined
  if (shortform && !/\[\d+~\d+초\]/.test(parsed.polished.fullContent)) {
    warning = '숏폼 장면([0~N초] 씬 구조)이 누락됐을 수 있습니다. 내용을 확인 후 필요하면 재생성하세요.'
  }

  return {
    output: {
      ...parsed.script,
      mode: 'direct',
      polished: parsed.polished,
      warning,
    },
  }
}

export async function POST(req: NextRequest) {
  const denied = await denyUnlessDashboardMutationAuth(req)
  if (denied) return denied

  const body = await req.json() as { context?: AiScriptGuideRequestContext }
  const ctx = body.context

  if (!ctx?.category || !ctx?.intent) {
    return NextResponse.json({ error: 'context.category와 context.intent가 필요합니다' }, { status: 400 })
  }

  const { topic } = resolveDirectPublishContext(ctx)
  if (!topic || topic === '콘텐츠 주제') {
    return NextResponse.json({ error: '발행 주제(키워드)를 입력해 주세요' }, { status: 400 })
  }

  // 1순위: n8n longform-script (Gemini는 n8n Docker 환경에서 호출)
  let n8nReturnedStub = false
  try {
    const n8nResult = await invokeLongformScriptN8n(ctx)
    if (n8nResult) {
      if (isStubScript(n8nResult.script.fullScript)) {
        // n8n Docker 환경에 GEMINI_API_KEY가 없어 자리표시자 대본만 돌아온 경우 — 그대로 보여주지 않고 2순위로 폴백
        n8nReturnedStub = true
        console.error('[script-guide] n8n returned a stub script (n8n GEMINI_API_KEY likely missing) — falling back')
      } else {
        return NextResponse.json({
          ...n8nResult.script,
          polished: n8nResult.polished,
        })
      }
    }
  } catch (err) {
    console.error('[script-guide] n8n longform-script failed', err)
  }

  // 2순위: 대시보드 직접 Gemini (DASHBOARD_GEMINI_DIRECT=1 일 때만)
  if (isDashboardGeminiDirectEnabled()) {
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

    if (output) return NextResponse.json(output)

    return NextResponse.json(
      {
        error: `발행용 콘텐츠 생성에 실패했습니다. ${lastError ?? '알 수 없음'}`,
        mode: 'gemini-direct',
      },
      { status: 500 },
    )
  }

  if (n8nReturnedStub) {
    return NextResponse.json(
      {
        error:
          'n8n Webhook은 연결되었지만, n8n Docker 환경에 GEMINI_API_KEY가 설정되어 있지 않아 빈 자리표시자 대본만 돌아왔습니다. n8n의 환경변수에 GEMINI_API_KEY를 등록하거나, .env.local에 DASHBOARD_GEMINI_DIRECT=1을 설정해 대시보드가 직접 생성하도록 해주세요.',
        mode: 'n8n-stub',
        webhookHint: getLongformScriptWebhookUrl(),
      },
      { status: 503 },
    )
  }

  return NextResponse.json(
    {
      error:
        'n8n 콘텐츠 생성 Webhook에 연결되지 않았습니다. .env.local에 N8N_WEBHOOK_LONGFORM_SCRIPT를 설정하고 n8n에서 [W08] 워크플로를 활성화하세요. (Gemini API 키는 n8n Docker 환경에만 두면 됩니다)',
      mode: 'n8n-required',
      webhookHint: getLongformScriptWebhookUrl(),
    },
    { status: 503 },
  )
}
