import { NextRequest, NextResponse } from 'next/server'
import { API_BILLING_NOTE, API_SERVICE_BILLING, WEBHOOK_BILLING, WEBHOOK_BILLING_NOTE } from '@/lib/dashboard/service-billing'
import {
  auditEnvSecurity,
  probeGeminiApiKey,
  type EnvSecurityAudit,
  type GeminiKeyProbeResult,
} from '@/lib/dashboard/env-security'

export type BillingTier = 'free' | 'paid'

export interface ApiServiceStatus {
  key: string
  name: string
  configured: boolean
  /** 마스킹된 키 미리보기 (앞 6자 + ***) */
  preview?: string
  /** 이 API가 사용되는 화면/기능 */
  usedIn: string[]
  /** n8n 웹훅 URL (웹훅 서비스만) */
  webhookUrl?: string
  /** 서비스 종류 */
  category: 'database' | 'api' | 'webhook' | 'auth'
  /** 수집·호출 시 과금/할당량 발생 여부 */
  billing: BillingTier
  /** 과금 설명 (유료일 때) */
  billingNote?: string
}

function maskValue(v: string | undefined): string | undefined {
  if (!v) return undefined
  return v.length <= 8 ? '***' : `${v.slice(0, 6)}…***`
}

function getWebhookLabel(url: string | undefined): string {
  if (!url) return ''
  if (url.includes('localhost')) return url.replace(/^https?:\/\//, '')
  return url
}

function billingFor(key: string, category: ApiServiceStatus['category']): Pick<ApiServiceStatus, 'billing' | 'billingNote'> {
  const map = category === 'webhook' ? WEBHOOK_BILLING : API_SERVICE_BILLING
  const notes = category === 'webhook' ? WEBHOOK_BILLING_NOTE : API_BILLING_NOTE
  const billing = map[key] ?? 'free'
  return {
    billing,
    billingNote: billing === 'paid' ? notes[key] : undefined,
  }
}

export interface SettingsApiResponse {
  services: ApiServiceStatus[]
  security: EnvSecurityAudit
  geminiProbe?: GeminiKeyProbeResult
}

export async function GET(request: NextRequest) {
  const e = process.env
  const probeGemini = request.nextUrl.searchParams.get('probe') === 'gemini'

  const raw: Omit<ApiServiceStatus, 'billing' | 'billingNote'>[] = [
    {
      key: 'SUPABASE',
      name: 'Supabase (PostgreSQL)',
      configured: !!(e.NEXT_PUBLIC_SUPABASE_URL && e.SUPABASE_SERVICE_ROLE_KEY),
      preview: maskValue(e.NEXT_PUBLIC_SUPABASE_URL),
      usedIn: ['전체 데이터 저장', '채널·콘텐츠·캘린더·벤치마크 DB'],
      category: 'database',
    },
    {
      key: 'YOUTUBE_API_KEY',
      name: 'YouTube Data API v3',
      configured: !!e.YOUTUBE_API_KEY,
      preview: maskValue(e.YOUTUBE_API_KEY),
      usedIn: ['YouTube 채널·영상 수집', 'YouTube 검색 탭', 'Shorts/롱폼 분류'],
      category: 'api',
    },
    {
      key: 'NAVER_API',
      name: 'Naver Open API',
      configured: !!(e.NAVER_CLIENT_ID && e.NAVER_CLIENT_SECRET),
      preview: maskValue(e.NAVER_CLIENT_ID),
      usedIn: ['네이버 블로그 검색', '티스토리 검색 (site: 필터)', 'Naver 웹 검색'],
      category: 'api',
    },
    {
      key: 'GEMINI_API_KEY',
      name: 'Google Gemini AI',
      configured: !!e.GEMINI_API_KEY,
      preview: maskValue(e.GEMINI_API_KEY),
      usedIn: ['AI 인사이트', '주제 선별 AI', 'RSS 주제 정제', '콘텐츠 스튜디오 초안', 'AI 스크립트 가이드'],
      category: 'api',
    },
    {
      key: 'NOTION_API_KEY',
      name: 'Notion API',
      configured: !!(e.NOTION_API_KEY && e.NOTION_LOG_PARENT_PAGE_ID),
      preview: maskValue(e.NOTION_API_KEY),
      usedIn: ['n8n 실행 결과 자동 기록', '워크플로 로그'],
      category: 'api',
    },
    {
      key: 'N8N_WEBHOOK_YOUTUBE_COLLECT',
      name: 'n8n · YouTube 수집',
      configured: !!e.N8N_WEBHOOK_YOUTUBE_COLLECT,
      webhookUrl: getWebhookLabel(e.N8N_WEBHOOK_YOUTUBE_COLLECT),
      usedIn: ['YouTube 채널·영상 자동 수집', '데이터 수집 화면'],
      category: 'webhook',
    },
    {
      key: 'N8N_WEBHOOK_OUTLIER_TAG',
      name: 'n8n · Outlier 태깅',
      configured: !!e.N8N_WEBHOOK_OUTLIER_TAG,
      webhookUrl: getWebhookLabel(e.N8N_WEBHOOK_OUTLIER_TAG),
      usedIn: ['Outlier 분석 자동 태깅', 'vs.Avg 계산 후 DB 업데이트'],
      category: 'webhook',
    },
    {
      key: 'N8N_WEBHOOK_RSS_TOPICS',
      name: 'n8n · RSS 주제 수집',
      configured: !!e.N8N_WEBHOOK_RSS_TOPICS,
      webhookUrl: getWebhookLabel(e.N8N_WEBHOOK_RSS_TOPICS),
      usedIn: ['콘텐츠 가이드 RSS 주제', '트렌딩 키워드 수집'],
      category: 'webhook',
    },
    {
      key: 'N8N_WEBHOOK_NAVER_BLOG_VIEWS',
      name: 'n8n · 네이버 조회수 업데이트',
      configured: !!e.N8N_WEBHOOK_NAVER_BLOG_VIEWS,
      webhookUrl: getWebhookLabel(e.N8N_WEBHOOK_NAVER_BLOG_VIEWS),
      usedIn: ['네이버 블로그 조회수 주기 갱신'],
      category: 'webhook',
    },
    {
      key: 'N8N_WEBHOOK_NAVER_BLOG_COLLECT',
      name: 'n8n · 네이버 블로그 수집',
      configured: !!e.N8N_WEBHOOK_NAVER_BLOG_COLLECT,
      webhookUrl: getWebhookLabel(e.N8N_WEBHOOK_NAVER_BLOG_COLLECT),
      usedIn: ['네이버 블로그 신규 포스트 수집'],
      category: 'webhook',
    },
    {
      key: 'N8N_WEBHOOK_TISTORY_COLLECT',
      name: 'n8n · 티스토리 수집',
      configured: !!e.N8N_WEBHOOK_TISTORY_COLLECT,
      webhookUrl: getWebhookLabel(e.N8N_WEBHOOK_TISTORY_COLLECT),
      usedIn: ['티스토리 신규 포스트 수집'],
      category: 'webhook',
    },
    {
      key: 'N8N_WEBHOOK_LONGFORM_SCRIPT',
      name: 'n8n · 롱폼 스크립트',
      configured: !!e.N8N_WEBHOOK_LONGFORM_SCRIPT,
      webhookUrl: getWebhookLabel(e.N8N_WEBHOOK_LONGFORM_SCRIPT),
      usedIn: ['콘텐츠 가이드 «발행용 생성» (n8n Gemini)'],
      category: 'webhook',
    },
    {
      key: 'N8N_WEBHOOK_AI_INSIGHTS',
      name: 'n8n · AI 인사이트',
      configured: !!e.N8N_WEBHOOK_AI_INSIGHTS,
      webhookUrl: getWebhookLabel(e.N8N_WEBHOOK_AI_INSIGHTS),
      usedIn: ['AI 인사이트 · 개요 키워드 분석'],
      category: 'webhook',
    },
    {
      key: 'N8N_WEBHOOK_TOPIC_SUGGEST',
      name: 'n8n · 주제 선별 AI',
      configured: !!e.N8N_WEBHOOK_TOPIC_SUGGEST,
      webhookUrl: getWebhookLabel(e.N8N_WEBHOOK_TOPIC_SUGGEST),
      usedIn: ['주제 선별 AI (n8n 우선)'],
      category: 'webhook',
    },
    {
      key: 'DASHBOARD_AUTH',
      name: '대시보드 로그인',
      configured: !!(e.DASHBOARD_LOGIN_ID && e.DASHBOARD_LOGIN_PASSWORD),
      preview: maskValue(e.DASHBOARD_LOGIN_ID),
      usedIn: ['대시보드 접근 인증', '세션 관리'],
      category: 'auth',
    },
    {
      key: 'DASHBOARD_API_SECRET',
      name: '대시보드 API 시크릿',
      configured: !!e.DASHBOARD_API_SECRET?.trim(),
      preview: maskValue(e.DASHBOARD_API_SECRET),
      usedIn: ['n8n → 대시보드 API', 'cron 자동 수집', '수집·쓰기 뮤테이션 인증'],
      category: 'auth',
    },
  ]

  const services: ApiServiceStatus[] = raw.map((s) => ({
    ...s,
    ...billingFor(s.key, s.category),
  }))

  const security = auditEnvSecurity(e)
  let geminiProbe: GeminiKeyProbeResult | undefined
  if (probeGemini && e.GEMINI_API_KEY?.trim()) {
    geminiProbe = await probeGeminiApiKey(e.GEMINI_API_KEY)
  }

  return NextResponse.json({ services, security, geminiProbe } satisfies SettingsApiResponse)
}

/** n8n 웹훅 연결 테스트 (HEAD/POST probe) */
export async function POST(request: NextRequest) {
  const body = (await request.json()) as { key?: string }
  const envKey = body.key
  if (!envKey) return NextResponse.json({ error: 'key required' }, { status: 400 })

  const webhookUrl = process.env[envKey]?.trim()
  if (!webhookUrl) {
    return NextResponse.json({ ok: false, error: '웹훅 URL 미설정' }, { status: 400 })
  }

  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ping: true, testMode: true }),
      signal: AbortSignal.timeout(8000),
    })
    const registered = res.status !== 404
    return NextResponse.json({
      ok: registered && res.status < 500,
      httpStatus: res.status,
      registered,
    })
  } catch (err) {
    return NextResponse.json({
      ok: false,
      error: err instanceof Error ? err.message : '연결 실패',
    })
  }
}
