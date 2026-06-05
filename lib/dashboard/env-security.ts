export type EnvSecuritySeverity = 'critical' | 'warning' | 'info'

export interface EnvSecurityFinding {
  id: string
  severity: EnvSecuritySeverity
  title: string
  detail: string
  action?: string
}

export interface EnvRotationItem {
  envKey: string
  label: string
  priority: 'high' | 'medium'
  reason: string
}

export interface EnvSecurityAudit {
  ok: boolean
  environment: string
  checkedAt: string
  findings: EnvSecurityFinding[]
  rotation: EnvRotationItem[]
}

const WEAK_SECRET_PATTERNS = [
  'change-me',
  'changeme',
  'your-',
  'example',
  'placeholder',
  'password',
  'test-secret',
  'long-random-string',
]

const PLACEHOLDER_ENV_PATTERNS = [
  'your-',
  'changeme',
  'change-me',
  'example',
  'placeholder',
  'api-key-here',
  'insert-',
  'xxx',
  'test-key',
]

const N8N_WEBHOOK_ENV_KEYS = [
  'N8N_WEBHOOK_URL',
  'N8N_WEBHOOK_YOUTUBE_COLLECT',
  'N8N_WEBHOOK_OUTLIER_TAG',
  'N8N_WEBHOOK_NAVER_BLOG_VIEWS',
  'N8N_WEBHOOK_LONGFORM_SCRIPT',
  'N8N_WEBHOOK_AI_INSIGHTS',
  'N8N_WEBHOOK_TOPIC_SUGGEST',
] as const

const N8N_AI_WEBHOOK_ENV_KEYS = [
  'N8N_WEBHOOK_LONGFORM_SCRIPT',
  'N8N_WEBHOOK_AI_INSIGHTS',
  'N8N_WEBHOOK_URL',
  'N8N_WEBHOOK_TOPIC_SUGGEST',
] as const

function hasN8nAiWebhookConfigured(env: NodeJS.ProcessEnv): boolean {
  return N8N_AI_WEBHOOK_ENV_KEYS.some((key) => Boolean(env[key]?.trim()))
}

const MIN_DASHBOARD_SECRET_LENGTH = 32

export const ENV_ROTATION_CHECKLIST: EnvRotationItem[] = [
  {
    envKey: 'DASHBOARD_API_SECRET',
    label: '대시보드 API 시크릿',
    priority: 'high',
    reason: 'n8n·cron이 Bearer로 호출. 유출 시 수집·DB 쓰기까지 우회 가능.',
  },
  {
    envKey: 'SUPABASE_SERVICE_ROLE_KEY',
    label: 'Supabase service_role',
    priority: 'high',
    reason: 'RLS 우회 전체 DB 접근.',
  },
  {
    envKey: 'GEMINI_API_KEY',
    label: 'Google Gemini',
    priority: 'medium',
    reason: 'AI 생성·인사이트. 유출 시 과금·차단.',
  },
  {
    envKey: 'YOUTUBE_API_KEY',
    label: 'YouTube Data API',
    priority: 'medium',
    reason: '채널·영상 수집 할당량.',
  },
  {
    envKey: 'NAVER_CLIENT_SECRET',
    label: 'Naver Open API',
    priority: 'medium',
    reason: '블로그 검색·조회수 수집.',
  },
  {
    envKey: 'NOTION_API_KEY',
    label: 'Notion',
    priority: 'medium',
    reason: '워크플로 로그·페이지 쓰기.',
  },
]

export function isWeakDashboardSecret(value: string): boolean {
  const v = value.trim()
  if (v.length < MIN_DASHBOARD_SECRET_LENGTH) return true
  const lower = v.toLowerCase()
  return WEAK_SECRET_PATTERNS.some((p) => lower.includes(p))
}

export function isPlaceholderEnvValue(value: string): boolean {
  const v = value.trim().toLowerCase()
  if (!v) return true
  return PLACEHOLDER_ENV_PATTERNS.some((p) => v.includes(p))
}

function push(
  findings: EnvSecurityFinding[],
  finding: EnvSecurityFinding,
): void {
  findings.push(finding)
}

export function auditEnvSecurity(
  env: NodeJS.ProcessEnv = process.env,
): EnvSecurityAudit {
  const isProduction = env.NODE_ENV === 'production'
  const findings: EnvSecurityFinding[] = []

  const apiSecret = env.DASHBOARD_API_SECRET?.trim() ?? ''
  const sessionSecret = env.DASHBOARD_SESSION_SECRET?.trim() ?? ''

  if (!apiSecret) {
    push(findings, {
      id: 'dashboard-secret-missing',
      severity: isProduction ? 'critical' : 'warning',
      title: 'DASHBOARD_API_SECRET 미설정',
      detail: isProduction
        ? '프로덕션에서는 n8n·외부 호출 인증이 차단됩니다.'
        : '로컬은 동일 출처 요청만 통과합니다. n8n Docker 연동 시 필수입니다.',
      action: 'openssl rand -base64 32 로 생성 후 .env.local·n8n 환경에 동일 값 설정',
    })
  } else if (isWeakDashboardSecret(apiSecret)) {
    push(findings, {
      id: 'dashboard-secret-weak',
      severity: 'critical',
      title: 'DASHBOARD_API_SECRET이 너무 약함',
      detail: '예시 문구·짧은 문자열은 유출·추측에 취약합니다.',
      action: 'npm run env:secret 으로 새 값 생성 후 .env.local·n8n 동시 교체',
    })
  } else if (!sessionSecret) {
    push(findings, {
      id: 'session-secret-fallback',
      severity: 'info',
      title: 'DASHBOARD_SESSION_SECRET 미설정',
      detail: '세션 서명에 DASHBOARD_API_SECRET을 사용 중입니다.',
      action: '선택: 세션 전용으로 DASHBOARD_SESSION_SECRET 별도 설정',
    })
  }

  const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? ''
  const serviceRole = env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? ''

  if (!supabaseUrl || !serviceRole) {
    push(findings, {
      id: 'supabase-missing',
      severity: 'critical',
      title: 'Supabase 환경 변수 누락',
      detail: 'NEXT_PUBLIC_SUPABASE_URL 또는 SUPABASE_SERVICE_ROLE_KEY가 없습니다.',
      action: 'Supabase 대시보드 → Settings → API에서 복사',
    })
  } else if (isPlaceholderEnvValue(serviceRole) || isPlaceholderEnvValue(supabaseUrl)) {
    push(findings, {
      id: 'supabase-placeholder',
      severity: 'critical',
      title: 'Supabase 키가 예시 placeholder',
      detail: 'service_role·URL이 .env.example 기본값 그대로입니다. 수집·로그인이 동작하지 않습니다.',
      action: 'Supabase 대시보드 → Settings → API에서 실제 값으로 교체',
    })
  }

  const youtubeKey = env.YOUTUBE_API_KEY?.trim() ?? ''
  if (youtubeKey && isPlaceholderEnvValue(youtubeKey)) {
    push(findings, {
      id: 'youtube-placeholder',
      severity: 'warning',
      title: 'YOUTUBE_API_KEY가 예시 값',
      detail: 'YouTube 수집 API가 실패합니다.',
      action: 'Google Cloud Console에서 Data API v3 키 발급',
    })
  }

  const gemini = env.GEMINI_API_KEY?.trim() ?? ''
  const n8nAi = hasN8nAiWebhookConfigured(env)
  const geminiDirect =
    env.DASHBOARD_GEMINI_DIRECT?.trim().toLowerCase() === '1' ||
    env.DASHBOARD_GEMINI_DIRECT?.trim().toLowerCase() === 'true'

  if (!gemini && !n8nAi) {
    push(findings, {
      id: 'ai-provider-missing',
      severity: 'warning',
      title: 'AI 제공자 미설정',
      detail:
        '콘텐츠 가이드·인사이트·주제 선별 AI가 동작하지 않습니다. n8n Webhook(N8N_WEBHOOK_LONGFORM_SCRIPT 등)을 설정하세요.',
      action: 'n8n Docker GEMINI_API_KEY + N8N_WEBHOOK_LONGFORM_SCRIPT=http://localhost:5678/webhook/longform-script',
    })
  } else if (!gemini && n8nAi) {
    push(findings, {
      id: 'gemini-n8n-mode',
      severity: 'info',
      title: 'AI는 n8n 경유 운영 중',
      detail:
        '대시보드 GEMINI_API_KEY 없이 n8n Webhook으로 Gemini를 호출합니다. Gemini 키는 n8n Docker 환경에만 두면 됩니다.',
    })
  } else if (gemini && !geminiDirect && n8nAi) {
    push(findings, {
      id: 'gemini-direct-disabled',
      severity: 'info',
      title: 'GEMINI_API_KEY 있으나 대시보드 직접 호출 비활성',
      detail: 'DASHBOARD_GEMINI_DIRECT 미설정 — AI는 n8n Webhook 우선입니다.',
    })
  } else if (gemini && geminiDirect && !gemini.startsWith('AIza') && !gemini.startsWith('AQ.')) {
    push(findings, {
      id: 'gemini-format',
      severity: 'warning',
      title: 'GEMINI_API_KEY 형식 이상',
      detail: 'Google AI Studio 키(AIza…) 또는 신규 형식(AQ.…)이 아닙니다.',
      action: 'https://aistudio.google.com/apikey 에서 키 재발급',
    })
  }

  const loginId = env.DASHBOARD_LOGIN_ID?.trim() ?? ''
  const loginPassword = env.DASHBOARD_LOGIN_PASSWORD ?? ''
  if (!loginId && !isProduction) {
    push(findings, {
      id: 'login-seed-missing',
      severity: 'info',
      title: '로그인 시드 계정 미설정',
      detail: 'DASHBOARD_LOGIN_ID/PASSWORD 없음 — node scripts/seed-dashboard-auth.mjs 실행 전 설정 필요.',
      action: '.env.local에 계정 추가 후 node scripts/seed-dashboard-auth.mjs',
    })
  } else if (loginPassword && loginPassword.length < 8) {
    push(findings, {
      id: 'login-password-weak',
      severity: 'warning',
      title: 'DASHBOARD_LOGIN_PASSWORD가 짧음',
      detail: '시드용 비밀번호는 8자 이상 권장합니다.',
      action: '강한 비밀번호로 변경 후 seed-dashboard-auth.mjs 재실행',
    })
  }

  const cronSecret = env.CRON_SECRET?.trim() ?? ''
  if (cronSecret && cronSecret.length < 24) {
    push(findings, {
      id: 'cron-secret-weak',
      severity: 'warning',
      title: 'CRON_SECRET이 짧음',
      detail: '자동 수집 cron 엔드포인트 보호가 약합니다.',
      action: 'openssl rand -base64 32',
    })
  } else if (cronSecret && isWeakDashboardSecret(cronSecret)) {
    push(findings, {
      id: 'cron-secret-weak-pattern',
      severity: 'warning',
      title: 'CRON_SECRET이 예시 문구',
      detail: 'cron 호출이 추측 가능합니다.',
      action: 'npm run env:secret 으로 별도 CRON_SECRET 생성',
    })
  } else if (isProduction && !cronSecret && !apiSecret) {
    push(findings, {
      id: 'cron-auth-missing',
      severity: 'critical',
      title: 'cron·API 인증 시크릿 없음',
      detail: '프로덕션에서 /api/cron/auto-collect 호출이 차단됩니다.',
      action: 'DASHBOARD_API_SECRET 또는 CRON_SECRET 설정 (Vercel cron은 CRON_SECRET 권장)',
    })
  } else if (isProduction && env.VERCEL === '1' && !cronSecret) {
    push(findings, {
      id: 'cron-vercel-no-secret',
      severity: 'warning',
      title: 'Vercel cron: CRON_SECRET 미설정',
      detail: 'x-vercel-cron 헤더만으로 동작합니다. CRON_SECRET 설정 시 Bearer로 더 안전합니다.',
      action: 'Vercel 환경 변수에 CRON_SECRET 추가 (자동 Authorization Bearer 전송)',
    })
  }

  if (isProduction) {
    for (const key of N8N_WEBHOOK_ENV_KEYS) {
      const val = env[key]?.trim()
      if (val && /localhost|127\.0\.0\.1|host\.docker\.internal/i.test(val)) {
        push(findings, {
          id: `n8n-localhost-${key}`,
          severity: 'warning',
          title: `${key}가 로컬 주소`,
          detail: '프로덕션 배포에서 n8n webhook이 localhost를 가리킵니다.',
          action: 'n8n Cloud·Railway URL로 변경',
        })
      }
    }
  }

  const criticalCount = findings.filter((f) => f.severity === 'critical').length

  return {
    ok: criticalCount === 0,
    environment: env.NODE_ENV ?? 'development',
    checkedAt: new Date().toISOString(),
    findings,
    rotation: ENV_ROTATION_CHECKLIST,
  }
}

export interface GeminiKeyProbeResult {
  ok: boolean
  httpStatus?: number
  message: string
}

export async function probeGeminiApiKey(apiKey: string): Promise<GeminiKeyProbeResult> {
  const key = apiKey.trim()
  if (!key) {
    return { ok: false, message: 'GEMINI_API_KEY가 비어 있습니다.' }
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${key}`
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: 'ping' }] }],
        generationConfig: { maxOutputTokens: 8, thinkingConfig: { thinkingBudget: 0 } },
      }),
      signal: AbortSignal.timeout(12_000),
    })

    if (res.ok) {
      return { ok: true, httpStatus: res.status, message: 'Gemini API 키가 정상 응답합니다.' }
    }

    let message = `HTTP ${res.status}`
    try {
      const body = (await res.json()) as { error?: { message?: string } }
      const m = body.error?.message?.trim()
      if (m?.toLowerCase().includes('leaked')) {
        message = '키가 유출로 차단됨 — Google AI Studio에서 새 키 발급 필요'
      } else if (m) {
        message = m
      }
    } catch {
      // ignore parse
    }

    return { ok: false, httpStatus: res.status, message }
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : 'Gemini 연결 실패',
    }
  }
}
