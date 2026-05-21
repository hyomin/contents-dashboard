import { NextRequest, NextResponse } from 'next/server'
import { getAutomationService } from '@/lib/n8n-research-roadmap'

const DUMMY_RESPONSES: Record<
  string,
  (body: Record<string, unknown>) => Record<string, unknown>
> = {
  'outlier-tagging': (body) => ({
    mode: 'dummy',
    message:
      'n8n 시나리오 «아웃라이어 자동 태깅» Webhook 연동 전입니다. .env에 N8N_WEBHOOK_OUTLIER_TAG를 설정하거나 편집기에서 워크플로를 활성화하세요.',
    taggedPreview: [
      { videoId: 'preview-1', title: '[더미] vs avg 4.2x 샘플', vsAvg: 4.2, tag: 'outlier' },
      { videoId: 'preview-2', title: '[더미] vs avg 3.1x 샘플', vsAvg: 3.1, tag: 'outlier' },
    ],
    request: body,
  }),
  'rss-topic-collect': (body) => ({
    mode: 'dummy',
    message: 'n8n «RSS → 주제 후보 자동 수집» 연동 전 미리보기입니다.',
    topics: [
      { title: '2025 하반기 연금·재테크 체크리스트', source: 'RSS 더미' },
      { title: '시니어 건강검진 지원 제도 총정리', source: 'RSS 더미' },
      { title: '전세 사기 예방, 지금 확인할 3가지', source: 'RSS 더미' },
      { title: '국민연금 개편 쟁점 한눈에', source: 'RSS 더미' },
      { title: '은퇴 후 부업 vs 투자, 현실 가이드', source: 'RSS 더미' },
    ],
    request: body,
  }),
  'longform-script': (body) => ({
    mode: 'dummy',
    message: 'n8n «롱폼 스크립트 초안 자동 생성» 연동 전 미리보기입니다.',
    script: {
      hook: '첫 30초: 시청자가 느끼는 불안을 짚고, 오늘 영상에서 얻을 해결책을 약속합니다.',
      sections: [
        '본론 1: 배경·데이터 (2분)',
        '본론 2: 핵심 전략 3가지 (3분)',
        '본론 3: 실수 사례·주의점 (2분)',
      ],
      cta: '마지막 30초: 체크리스트 PDF·댓글 키워드 유도',
    },
    request: body,
  }),
}

function resolveWebhookUrl(service: NonNullable<ReturnType<typeof getAutomationService>>): string | null {
  const envKey = service.envWebhookKey
  if (!envKey) return null
  const fromEnv = process.env[envKey]?.trim()
  if (fromEnv) return fromEnv
  return `http://localhost:5678/webhook/${service.webhookPath}`
}

async function callN8nWebhook(url: string, data: unknown) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data ?? {}),
  })
  const text = await res.text()
  let body: unknown = text
  try {
    body = JSON.parse(text) as unknown
  } catch {
    /* raw */
  }
  return { ok: res.ok, status: res.status, body }
}

/**
 * Lv.1 n8n 시나리오 실행 — Webhook env 있으면 n8n, 없으면 더미.
 * (기존 collect 등은 화면에서 직접 API 호출)
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const service = getAutomationService(id)
  if (!service) {
    return NextResponse.json({ error: '알 수 없는 Lv.1 서비스 ID' }, { status: 404 })
  }

  let body: Record<string, unknown> = {}
  try {
    const raw = await req.json()
    if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
      body = raw as Record<string, unknown>
    }
  } catch {
    body = {}
  }

  const webhookUrl = resolveWebhookUrl(service)
  const envKey = service.envWebhookKey
  const hasExplicitEnv = envKey ? Boolean(process.env[envKey]?.trim()) : false

  if (webhookUrl && hasExplicitEnv) {
    try {
      const origin = req.nextUrl.origin
      const invokeRes = await fetch(`${origin}/api/n8n/invoke`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: webhookUrl, data: body }),
      })
      const invokeData = (await invokeRes.json()) as { ok?: boolean; body?: unknown; error?: string }
      if (invokeRes.ok && invokeData.ok) {
        return NextResponse.json({
          mode: 'n8n',
          serviceId: id,
          scenarioName: service.n8nScenarioName,
          body: invokeData.body,
        })
      }
    } catch (err) {
      console.error('[lv1-services] n8n invoke failed', err)
    }
  }

  if (id === 'rss-topic-collect') {
    try {
      const origin = req.nextUrl.origin
      const rssRes = await fetch(`${origin}/api/dashboard/rss-topics`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetAudience: body.targetAudience ?? service.samplePayload?.targetAudience ?? '시니어',
          maxTopics: body.maxTopics ?? service.samplePayload?.maxTopics ?? 5,
          persistCollected: body.persistCollected ?? service.samplePayload?.persistCollected ?? true,
          source: hasExplicitEnv ? 'n8n-via-dashboard' : 'dashboard',
          useAi: body.useAi !== false,
        }),
      })
      const rssData = await rssRes.json()
      if (rssRes.ok) {
        return NextResponse.json({
          mode: hasExplicitEnv ? 'n8n' : 'dashboard',
          serviceId: id,
          scenarioName: service.n8nScenarioName,
          ...rssData,
        })
      }
    } catch (err) {
      console.error('[lv1-services] rss-topic fallback failed', err)
    }
  }

  if (id === 'outlier-tagging') {
    try {
      const origin = req.nextUrl.origin
      const tagRes = await fetch(`${origin}/api/dashboard/outlier-tag`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          minVsAvg: body.minVsAvg ?? service.samplePayload?.minVsAvg ?? 3,
          persistTagged: body.persistTagged ?? service.samplePayload?.persistTagged ?? true,
          source: 'dashboard-fallback',
        }),
      })
      const tagData = await tagRes.json()
      if (tagRes.ok) {
        return NextResponse.json({
          mode: hasExplicitEnv ? 'dashboard-fallback' : 'dashboard',
          serviceId: id,
          scenarioName: service.n8nScenarioName,
          ...tagData,
        })
      }
    } catch (err) {
      console.error('[lv1-services] outlier-tag fallback failed', err)
    }
  }

  const dummyFn = DUMMY_RESPONSES[id]
  if (dummyFn) {
    return NextResponse.json({
      serviceId: id,
      scenarioName: service.n8nScenarioName,
      webhookPath: service.webhookPath,
      envHint: envKey ? `${envKey}=http://localhost:5678/webhook/${service.webhookPath}` : undefined,
      ...dummyFn(body),
    })
  }

  return NextResponse.json(
    {
      mode: 'dummy',
      message: `${service.n8nScenarioName} — n8n Webhook을 준비해 주세요.`,
      webhookPath: service.webhookPath,
    },
    { status: 200 },
  )
}
