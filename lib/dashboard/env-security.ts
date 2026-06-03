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

  if (!env.NEXT_PUBLIC_SUPABASE_URL?.trim() || !env.SUPABASE_SERVICE_ROLE_KEY?.trim()) {
    push(findings, {
      id: 'supabase-missing',
      severity: 'critical',
      title: 'Supabase 환경 변수 누락',
      detail: 'NEXT_PUBLIC_SUPABASE_URL 또는 SUPABASE_SERVICE_ROLE_KEY가 없습니다.',
      action: 'Supabase 대시보드 → Settings → API에서 복사',
    })
  }

  const gemini = env.GEMINI_API_KEY?.trim() ?? ''
  if (!gemini) {
    push(findings, {
      id: 'gemini-missing',
      severity: 'warning',
      title: 'GEMINI_API_KEY 미설정',
      detail: 'AI 인사이트·주제 가이드·콘텐츠 생성이 동작하지 않습니다.',
      action: 'https://aistudio.google.com/apikey 에서 새 키 발급',
    })
  } else if (!gemini.startsWith('AIza') && !gemini.startsWith('AQ.')) {
    push(findings, {
      id: 'gemini-format',
      severity: 'warning',
      title: 'GEMINI_API_KEY 형식 이상',
      detail: 'Google AI Studio 키(AIza…) 또는 신규 형식(AQ.…)이 아닙니다.',
      action: 'https://aistudio.google.com/apikey 에서 키 재발급',
    })
  }

  if (isProduction && !env.DASHBOARD_LOGIN_ID?.trim()) {
    push(findings, {
      id: 'login-missing',
      severity: 'warning',
      title: '대시보드 로그인 계정 미설정',
      detail: 'DASHBOARD_LOGIN_ID / DASHBOARD_LOGIN_PASSWORD가 없습니다.',
    })
  }

  if (env.CRON_SECRET && env.CRON_SECRET.trim().length < 24) {
    push(findings, {
      id: 'cron-secret-weak',
      severity: 'warning',
      title: 'CRON_SECRET이 짧음',
      detail: '자동 수집 cron 엔드포인트 보호가 약합니다.',
      action: 'openssl rand -base64 32',
    })
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
