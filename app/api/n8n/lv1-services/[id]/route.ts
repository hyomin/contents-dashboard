import { NextRequest, NextResponse } from 'next/server'
import { getAutomationService } from '@/lib/n8n/research-roadmap'
import { parseJsonBody } from '@/lib/utils/request'

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
  // longform-script는 실제 API 폴백으로 처리 (아래 if 블록 참고)
}

function resolveWebhookUrl(service: NonNullable<ReturnType<typeof getAutomationService>>): string | null {
  const envKey = service.envWebhookKey
  if (!envKey) return null
  const fromEnv = process.env[envKey]?.trim()
  if (fromEnv) return fromEnv
  return `http://localhost:5678/webhook/${service.webhookPath}`
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

  const body = await parseJsonBody(req)

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

  if (id === 'topic-recommend-agent') {
    try {
      const origin = req.nextUrl.origin
      const suggestRes = await fetch(`${origin}/api/topic-suggest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          count: body.count ?? 5,
          targetAudience: body.targetAudience ?? '시니어',
          keywords: body.keywords ?? '',
          source: hasExplicitEnv ? 'n8n-via-dashboard' : 'dashboard',
        }),
      })
      const suggestData = await suggestRes.json()
      if (suggestRes.ok) {
        return NextResponse.json({
          mode: hasExplicitEnv ? 'n8n' : 'dashboard',
          serviceId: id,
          scenarioName: service.n8nScenarioName,
          ...suggestData,
        })
      }
    } catch (err) {
      console.error('[lv1-services] topic-suggest fallback failed', err)
    }
  }

  if (id === 'naver-blog-collect') {
    try {
      const origin = req.nextUrl.origin
      const collectRes = await fetch(`${origin}/api/dashboard/collect-platform`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          platform: 'naver-blog',
          mineOnly: body.mineOnly === true,
        }),
      })
      const collectData = await collectRes.json()
      let viewsData: Record<string, unknown> = {}
      if (collectRes.ok && collectData.ok !== false) {
        const viewsRes = await fetch(`${origin}/api/dashboard/naver-blog-views`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            onlyMissingViews: true,
            maxPosts: 80,
            source: hasExplicitEnv ? 'n8n-via-dashboard' : 'dashboard',
          }),
        })
        viewsData = (await viewsRes.json()) as Record<string, unknown>
      }
      if (collectRes.ok) {
        return NextResponse.json({
          mode: hasExplicitEnv ? 'n8n' : 'dashboard',
          serviceId: id,
          scenarioName: service.n8nScenarioName,
          collect: collectData,
          views: viewsData,
        })
      }
    } catch (err) {
      console.error('[lv1-services] naver-blog-collect fallback failed', err)
    }
  }

  if (id === 'naver-blog-views') {
    try {
      const origin = req.nextUrl.origin
      const viewsRes = await fetch(`${origin}/api/dashboard/naver-blog-views`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channelId: body.channelId,
          onlyMissingViews: body.onlyMissingViews ?? true,
          maxPosts: body.maxPosts ?? 80,
          useEngagementFallback: body.useEngagementFallback !== false,
          source: hasExplicitEnv ? 'n8n-via-dashboard' : 'dashboard',
        }),
      })
      const viewsData = await viewsRes.json()
      if (viewsRes.ok) {
        return NextResponse.json({
          mode: hasExplicitEnv ? 'n8n' : 'dashboard',
          serviceId: id,
          scenarioName: service.n8nScenarioName,
          ...viewsData,
        })
      }
    } catch (err) {
      console.error('[lv1-services] naver-blog-views fallback failed', err)
    }
  }

  if (id === 'longform-script') {
    try {
      const origin = req.nextUrl.origin
      const topic = String(body.topic ?? service.samplePayload?.topic ?? '금리 동결 이후 재테크')
      const durationMinutes = Number(body.durationMinutes ?? service.samplePayload?.durationMinutes ?? 8)
      const targetFormat = String(body.targetFormat ?? 'longform')
      const references = Array.isArray(body.references) ? body.references : []
      const keywords = Array.isArray(body.keywords) ? body.keywords : []
      const genRes = await fetch(`${origin}/api/dashboard/content-generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetFormat,
          topic,
          context: {
            trendingKeywords: keywords,
            rssTopics: keywords,
            outlierTitles: references.map((r: { title?: string }) => r.title).filter(Boolean),
          },
        }),
      })
      const genData = await genRes.json()
      if (genRes.ok && !genData.error) {
        return NextResponse.json({
          mode: hasExplicitEnv ? 'n8n' : 'dashboard',
          serviceId: id,
          scenarioName: service.n8nScenarioName,
          topic,
          durationMinutes,
          script: genData,
          message: `"${topic}" 롱폼 스크립트 초안 생성 완료 ✨`,
        })
      }
    } catch (err) {
      console.error('[lv1-services] longform-script fallback failed', err)
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
