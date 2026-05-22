import { NextResponse } from 'next/server'
import { REPO_N8N_WORKFLOW_FILES } from '@/lib/n8n/deploy-status'
import {
  N8N_ARCHIVED_WORKFLOW_FILES,
  N8N_LIVE_WORKFLOWS,
  getLiveWebhookPaths,
} from '@/lib/n8n/live-workflows'
import { LOCAL_URLS, webhookUrl } from '@/lib/n8n/urls'

const N8N_BASE = process.env.N8N_BASE_URL?.trim() || LOCAL_URLS.n8nDirect

interface WebhookProbe {
  path: string
  label: string
  envKey?: string
  registered: boolean
  httpStatus: number | null
  error?: string
}

async function probeWebhook(path: string): Promise<{ registered: boolean; httpStatus: number | null; error?: string }> {
  try {
    const res = await fetch(`${N8N_BASE}/webhook/${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
      signal: AbortSignal.timeout(8000),
    })
    const text = await res.text()
    let message = text.slice(0, 200)
    try {
      const j = JSON.parse(text) as { message?: string }
      if (j.message) message = j.message
    } catch {
      /* raw */
    }
    const registered = res.status !== 404
    return {
      registered,
      httpStatus: res.status,
      error: registered ? undefined : message,
    }
  } catch (err) {
    return {
      registered: false,
      httpStatus: null,
      error: err instanceof Error ? err.message : '연결 실패',
    }
  }
}

/** 로컬 n8n Docker 헬스·웹훅 등록 여부 (대시보드 워크플로 관리 화면용) */
export async function GET() {
  let n8nHealthy = false
  try {
    const h = await fetch(`${N8N_BASE}/healthz`, { signal: AbortSignal.timeout(3000) })
    n8nHealthy = h.ok
  } catch {
    n8nHealthy = false
  }

  const webhookConfigs = [
    ...N8N_LIVE_WORKFLOWS.map((w) => ({
      path: w.webhookPath,
      label: w.name,
      envKey: w.envWebhookKey,
      live: true as const,
    })),
    ...N8N_ARCHIVED_WORKFLOW_FILES.map((a) => ({
      path: a.webhookPath,
      label: a.name,
      envKey: undefined,
      live: false as const,
    })),
  ]

  const probes: WebhookProbe[] = await Promise.all(
    webhookConfigs.map(async (w) => {
      const r = await probeWebhook(w.path)
      return { path: w.path, label: w.label, envKey: w.envKey, ...r }
    }),
  )

  const liveProbes = probes.filter((p) =>
    N8N_LIVE_WORKFLOWS.some((w) => w.webhookPath === p.path),
  )
  const activeCount = liveProbes.filter((p) => p.registered).length
  const activePaths = liveProbes.filter((p) => p.registered).map((p) => p.path)
  const expectedLive = N8N_LIVE_WORKFLOWS.length

  const liveNames = N8N_LIVE_WORKFLOWS.filter((w) => activePaths.includes(w.webhookPath))
    .map((w) => w.name)
    .join(', ')

  let summary: string
  if (!n8nHealthy) {
    summary = 'n8n에 연결할 수 없습니다. docker compose -f docker-compose.n8n.yml up -d 를 확인하세요.'
  } else if (activeCount === 0) {
    summary = 'n8n에 활성 Webhook이 없습니다. ./scripts/n8n-setup.sh 를 실행하세요.'
  } else if (activeCount === expectedLive) {
    summary = `n8n 연동 ${activeCount}개 정상 — ${liveNames}`
  } else {
    summary = `n8n Webhook ${activeCount}/${expectedLive}개 활성 — ${liveNames || '일부 미등록'}`
  }

  return NextResponse.json({
    n8nBaseUrl: N8N_BASE,
    n8nHealthy,
    urls: LOCAL_URLS,
    liveWorkflows: N8N_LIVE_WORKFLOWS,
    archivedWorkflows: N8N_ARCHIVED_WORKFLOW_FILES,
    repoWorkflowFiles: [...REPO_N8N_WORKFLOW_FILES],
    repoWorkflowCount: REPO_N8N_WORKFLOW_FILES.length,
    webhooks: probes.map((p) => ({ ...p, url: webhookUrl(p.path) })),
    activeWebhookPaths: activePaths,
    activeWebhookCount: activeCount,
    expectedLiveWebhookCount: expectedLive,
    liveWebhookPaths: getLiveWebhookPaths(),
    summary,
  })
}
