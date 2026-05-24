/**
 * POST /api/cron/auto-collect
 * 12시간마다 대시보드 내부에서 모든 운영 워크플로를 순차 실행합니다.
 *
 * 호출 방법:
 *   - Vercel Cron: vercel.json의 crons 설정 (0 slash12 * * *)
 *   - 서버 crontab: 0 slash12 * * * curl -X POST http://localhost:3000/api/cron/auto-collect -H "Authorization: Bearer $DASHBOARD_API_SECRET"
 *   - n8n Schedule 노드: 각 워크플로 JSON의 hoursInterval: 12
 */

import { NextRequest, NextResponse } from 'next/server'
import { N8N_LIVE_WORKFLOWS, N8N_SCHEDULE_INTERVAL_HOURS } from '@/lib/n8n/live-workflows'
import { hasValidDashboardApiSecret } from '@/lib/dashboard/api-auth'
import { invokeN8nWebhook } from '@/lib/n8n/invoke-webhook'

const CRON_SECRET = process.env.DASHBOARD_API_SECRET

function authOk(req: NextRequest): boolean {
  if (hasValidDashboardApiSecret(req)) return true
  // Vercel Cron은 Authorization 헤더 없이 내부에서 호출
  return req.headers.get('x-vercel-cron') === '1'
}

interface RunResult {
  no: string
  key: string
  name: string
  ok: boolean
  mode: string
  message: string
  durationMs: number
}

export async function POST(req: NextRequest) {
  if (!authOk(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const origin = new URL(req.url).origin
  const results: RunResult[] = []
  const startedAt = new Date().toISOString()

  // 운영 워크플로를 순차 실행 (rate limit 방지)
  for (const wf of N8N_LIVE_WORKFLOWS) {
    if (wf.key === 'notion-log') continue // notion-log는 다른 워크플로 완료 후 호출

    const t0 = Date.now()
    try {
      // n8n Webhook 우선, fallback으로 대시보드 API
      const webhookEnvKey = wf.envWebhookKey
      const webhookUrl = process.env[webhookEnvKey]

      let ok = false
      let mode = 'skipped'
      let message = ''

      if (webhookUrl) {
        // n8n Webhook 직접 호출
        const res = await invokeN8nWebhook(
          webhookUrl,
          { source: 'cron', interval: `${N8N_SCHEDULE_INTERVAL_HOURS}h` },
          60_000,
        )
        ok = res.ok
        mode = 'n8n-webhook'
        message = res.ok ? `HTTP ${res.status}` : `HTTP ${res.status} error`
      } else {
        // Fallback: 대시보드 API 직접 호출
        const api = wf.dashboardApis.find((a) => a.method === 'POST')
        if (api) {
          const res = await fetch(`${origin}${api.path}`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${CRON_SECRET}`,
            },
            body: JSON.stringify({ source: 'cron' }),
            signal: AbortSignal.timeout(60000),
          })
          ok = res.ok
          mode = 'dashboard-api'
          message = res.ok ? api.label : `API 오류 ${res.status}`
        } else {
          ok = false
          mode = 'no-endpoint'
          message = 'Webhook·API 없음'
        }
      }

      results.push({ no: wf.no, key: wf.key, name: wf.name, ok, mode, message, durationMs: Date.now() - t0 })
    } catch (err) {
      results.push({
        no: wf.no, key: wf.key, name: wf.name,
        ok: false, mode: 'error', message: String(err),
        durationMs: Date.now() - t0,
      })
    }

    // 워크플로 간 250ms 대기 (rate limit 방지)
    await new Promise((r) => setTimeout(r, 250))
  }

  const successCount = results.filter((r) => r.ok).length

  // 수집 완료 후 AI 인사이트 캐시 자동 갱신 (bust=1)
  let insightsBusted = false
  try {
    const insightsRes = await fetch(`${origin}/api/dashboard/insights?bust=1`, {
      headers: { Authorization: `Bearer ${CRON_SECRET}` },
      signal: AbortSignal.timeout(30000),
    })
    insightsBusted = insightsRes.ok
  } catch {
    insightsBusted = false
  }

  return NextResponse.json({
    ok: true,
    startedAt,
    intervalHours: N8N_SCHEDULE_INTERVAL_HOURS,
    total: results.length,
    success: successCount,
    failed: results.length - successCount,
    insightsBusted,
    results,
  })
}

/** GET: 스케줄 정보 조회 (인증 불필요) */
export async function GET() {
  return NextResponse.json({
    description: '12시간마다 모든 운영 워크플로를 자동 실행하는 cron 엔드포인트',
    intervalHours: N8N_SCHEDULE_INTERVAL_HOURS,
    cronExpression: `0 */${N8N_SCHEDULE_INTERVAL_HOURS} * * *`,
    workflows: N8N_LIVE_WORKFLOWS
      .filter((w) => w.key !== 'notion-log')
      .map((w) => ({ no: w.no, key: w.key, name: w.name, scheduleHint: w.scheduleHint })),
    usage: {
      vercel: `vercel.json > crons: [{ path: "/api/cron/auto-collect", schedule: "0 */${N8N_SCHEDULE_INTERVAL_HOURS} * * *" }]`,
      crontab: `0 */${N8N_SCHEDULE_INTERVAL_HOURS} * * * curl -X POST http://localhost:3000/api/cron/auto-collect -H "Authorization: Bearer YOUR_SECRET"`,
    },
  })
}
