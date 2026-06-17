import { NextResponse } from 'next/server'
import type { AiScriptGuideRequestContext } from '@/lib/dashboard/content-creation-guide'
import type { ContentPolishResult } from '@/lib/dashboard/content-polish'
import { invokeN8nWebhook, resolveN8nWebhookUrl } from '@/lib/n8n/invoke-webhook'
import { resolveDirectPublishContext } from '@/lib/dashboard/direct-publish-generate'
import {
  buildScriptGuideOutput,
  normalizeN8nScriptBody,
  type ScriptGuideOutput,
} from '@/lib/dashboard/script-guide-output'
import type { InsightSection } from '@/app/api/dashboard/insights/route'

const PLATFORM_BY_CATEGORY = {
  writing: 'naver-blog',
  image: 'instagram',
  video: 'youtube',
} as const

export const N8N_AI_WEBHOOK_ENV_KEYS = [
  'N8N_WEBHOOK_LONGFORM_SCRIPT',
  'N8N_WEBHOOK_AI_INSIGHTS',
  'N8N_WEBHOOK_URL',
  'N8N_WEBHOOK_TOPIC_SUGGEST',
] as const

/** true면 대시보드가 GEMINI_API_KEY로 직접 호출 (기본: n8n 경유만) */
export function isDashboardGeminiDirectEnabled(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  const v = env.DASHBOARD_GEMINI_DIRECT?.trim().toLowerCase()
  return v === '1' || v === 'true' || v === 'yes'
}

export function hasN8nAiWebhookConfigured(env: NodeJS.ProcessEnv = process.env): boolean {
  return N8N_AI_WEBHOOK_ENV_KEYS.some((key) => Boolean(env[key]?.trim()))
}

export function getLongformScriptWebhookUrl(): string {
  return resolveN8nWebhookUrl('N8N_WEBHOOK_LONGFORM_SCRIPT', 'longform-script')
}

export function getAiInsightsWebhookUrl(): string {
  return resolveN8nWebhookUrl('N8N_WEBHOOK_AI_INSIGHTS', 'ai-insights')
}

export function isLongformScriptN8nConfigured(): boolean {
  return Boolean(process.env.N8N_WEBHOOK_LONGFORM_SCRIPT?.trim())
}

export function isAiInsightsN8nConfigured(): boolean {
  return Boolean(process.env.N8N_WEBHOOK_AI_INSIGHTS?.trim())
}

export function buildLongformScriptN8nPayload(ctx: AiScriptGuideRequestContext) {
  const { topic, intent, targetFormat } = resolveDirectPublishContext(ctx)
  return {
    topic,
    targetFormat,
    category: ctx.category,
    intent: ctx.intent ?? intent,
    platform: PLATFORM_BY_CATEGORY[ctx.category],
    durationMinutes: targetFormat === 'longform' ? 8 : targetFormat === 'shortform' ? 1 : 0,
    keywords: ctx.keywords ?? [],
    references: (ctx.references ?? []).map((r) => ({
      title: r.title,
      platform: r.platform,
      channel: r.channel,
      vsAvg: r.vsAvg,
      referenceMode: r.referenceMode,
    })),
    shortformCategoryId: ctx.shortformCategoryId,
    emotionTone: ctx.emotionTone && ctx.emotionTone !== 'none' ? ctx.emotionTone : undefined,
    aiModel: ctx.aiModel,
    source: 'dashboard-content-guide',
    requestedAt: new Date().toISOString(),
  }
}

function buildPolishedFromScript(script: ScriptGuideOutput): ContentPolishResult {
  return {
    title: script.title,
    fullContent: script.fullScript,
    summary: script.hook?.slice(0, 200) ?? script.title,
    imageGuideCount: 0,
    polishedAt: new Date().toISOString(),
  }
}

export interface LongformScriptN8nResult {
  script: ScriptGuideOutput
  polished: ContentPolishResult
  mode: 'n8n'
}

export async function invokeLongformScriptN8n(
  ctx: AiScriptGuideRequestContext,
): Promise<LongformScriptN8nResult | null> {
  const webhookUrl = getLongformScriptWebhookUrl()
  const { topic, intent, targetFormat } = resolveDirectPublishContext(ctx)
  const payload = buildLongformScriptN8nPayload(ctx)

  const result = await invokeN8nWebhook(webhookUrl, payload, 120_000)
  if (!result.ok) {
    console.error('[n8n-ai] longform-script HTTP', result.status, result.body)
    return null
  }

  const body = unwrapN8nResponseBody(result.body)
  const partial = normalizeN8nScriptBody(body)
  if (!partial) return null

  const script = buildScriptGuideOutput({
    ...partial,
    mode: 'n8n',
    category: ctx.category,
    intent: ctx.intent ?? intent,
    targetFormat,
    platform: PLATFORM_BY_CATEGORY[ctx.category],
    topic: partial.topic ?? topic,
  })

  return {
    script,
    polished: buildPolishedFromScript(script),
    mode: 'n8n',
  }
}

function unwrapN8nResponseBody(body: unknown): unknown {
  if (!body || typeof body !== 'object') return body
  const b = body as Record<string, unknown>
  if (b.body && typeof b.body === 'object') return b.body
  return body
}

export function parseN8nInsightSections(body: unknown): InsightSection[] | null {
  const raw = unwrapN8nResponseBody(body)
  if (!raw || typeof raw !== 'object') return null
  const b = raw as Record<string, unknown>

  const sections = b.sections
  if (!Array.isArray(sections) || sections.length === 0) return null

  const parsed: InsightSection[] = []
  for (const s of sections) {
    if (!s || typeof s !== 'object') continue
    const sec = s as Record<string, unknown>
    const items = Array.isArray(sec.items) ? sec.items : []
    const mappedItems = items
      .filter((x): x is { icon?: string; text: string; action?: string } =>
        Boolean(x && typeof x === 'object' && typeof (x as { text?: string }).text === 'string'),
      )
      .map((x) => ({
        icon: typeof x.icon === 'string' && x.icon ? x.icon : '💡',
        text: String(x.text).trim(),
        action: x.action ? String(x.action) : undefined,
      }))

    if (mappedItems.length === 0) continue

    const typeRaw = String(sec.type ?? 'personal')
    const type: InsightSection['type'] =
      typeRaw === 'korea' || typeRaw === 'global' || typeRaw === 'personal' ? typeRaw : 'personal'

    parsed.push({
      type,
      title: String(sec.title ?? 'AI 인사이트'),
      subtitle: String(sec.subtitle ?? 'n8n · Gemini 분석'),
      items: mappedItems,
      sources: Array.isArray(sec.sources)
        ? (sec.sources as { title?: string; url?: string }[])
            .filter((src) => src?.title && src?.url)
            .map((src) => ({ title: String(src.title), url: String(src.url) }))
        : undefined,
      isAi: sec.isAi !== false,
    })
  }

  return parsed.length > 0 ? parsed : null
}

export async function invokeAiInsightsN8n(payload: Record<string, unknown>): Promise<InsightSection[] | null> {
  const webhookUrl = getAiInsightsWebhookUrl()
  const result = await invokeN8nWebhook(webhookUrl, payload, 90_000)
  if (!result.ok) {
    console.error('[n8n-ai] ai-insights HTTP', result.status, result.body)
    return null
  }
  return parseN8nInsightSections(result.body)
}

export function geminiDirectDisabledResponse(feature: string, reason: 'no-key' | 'flag-off'): NextResponse {
  const error =
    reason === 'no-key'
      ? `${feature} 기능은 Gemini를 직접 호출합니다 (n8n 미경유). .env.local에 GEMINI_API_KEY와 DASHBOARD_GEMINI_DIRECT=1을 설정하면 사용할 수 있습니다. (AI Studio API 크레딧 별도 소모)`
      : `${feature} 기능은 Gemini 직접 호출이 꺼져 있습니다. .env.local에 DASHBOARD_GEMINI_DIRECT=1을 추가하면 바로 사용할 수 있습니다 (GEMINI_API_KEY는 이미 설정됨). (AI Studio API 크레딧 별도 소모)`

  return NextResponse.json(
    { error, mode: 'gemini-direct-required' },
    { status: 503 },
  )
}

export function requireGeminiDirectOrRespond(feature: string): NextResponse | null {
  const apiKey = process.env.GEMINI_API_KEY?.trim()
  if (!apiKey) return geminiDirectDisabledResponse(feature, 'no-key')
  if (!isDashboardGeminiDirectEnabled()) {
    return geminiDirectDisabledResponse(feature, 'flag-off')
  }
  return null
}
