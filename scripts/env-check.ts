/**
 * 로컬 .env.local 보안 점검 (저장소에 커밋하지 않음)
 * 사용: npm run env:check
 *       npm run env:check -- --probe   # Gemini 키 실제 호출 테스트
 */
import { readFileSync, existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  auditEnvSecurity,
  probeGeminiApiKey,
} from '../lib/dashboard/env-security'

function loadEnvLocal(root: string): Record<string, string> {
  const path = resolve(root, '.env.local')
  if (!existsSync(path)) {
    console.error('❌ .env.local 없음 — dashboard-app/.env.example 참고해 생성하세요.')
    process.exit(1)
  }

  const env: Record<string, string> = { NODE_ENV: 'development' }
  const text = readFileSync(path, 'utf8')
  for (const line of text.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq <= 0) continue
    const key = trimmed.slice(0, eq).trim()
    let val = trimmed.slice(eq + 1).trim()
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1)
    }
    env[key] = val
  }
  return env
}

function icon(severity: string): string {
  if (severity === 'critical') return '🔴'
  if (severity === 'warning') return '🟡'
  return '🔵'
}

async function main() {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
  const env = loadEnvLocal(root)
  const probe = process.argv.includes('--probe')

  const audit = auditEnvSecurity(env as NodeJS.ProcessEnv)

  const shellGemini = process.env.GEMINI_API_KEY?.trim()
  const fileGemini = env.GEMINI_API_KEY?.trim()
  if (shellGemini && fileGemini && shellGemini !== fileGemini) {
    audit.findings.push({
      id: 'gemini-shell-override',
      severity: 'warning',
      title: '터미널에 예전 GEMINI_API_KEY가 남아 있음',
      detail:
        'docker compose는 셸 환경 변수가 .env.local보다 우선합니다. n8n이 구 키(AIza…)로 올라갈 수 있습니다.',
      action: 'unset GEMINI_API_KEY 후 docker compose --env-file .env.local up -d --force-recreate',
    })
    audit.ok = audit.findings.every((f) => f.severity !== 'critical')
  }

  console.log('\n=== 대시보드 환경 보안 점검 ===\n')
  console.log(`환경: ${audit.environment}`)
  console.log(`결과: ${audit.ok ? '✅ critical 없음' : '❌ 조치 필요'}\n`)

  if (audit.findings.length === 0) {
    console.log('발견된 항목 없음.\n')
  } else {
    for (const f of audit.findings) {
      console.log(`${icon(f.severity)} [${f.severity}] ${f.title}`)
      console.log(`   ${f.detail}`)
      if (f.action) console.log(`   → ${f.action}`)
      console.log()
    }
  }

  console.log('--- 로테이션 우선순위 ---')
  for (const r of audit.rotation) {
    const configured = Boolean(env[r.envKey]?.trim())
    console.log(
      `${r.priority === 'high' ? '🔴' : '🟠'} ${r.label} (${r.envKey}) ${configured ? '✓ 설정됨' : '— 미설정'}`,
    )
    console.log(`   ${r.reason}`)
  }

  if (probe) {
    console.log('\n--- Gemini 키 실제 호출 (--probe) ---')
    const result = await probeGeminiApiKey(env.GEMINI_API_KEY ?? '')
    console.log(result.ok ? `✅ ${result.message}` : `❌ ${result.message}`)
  } else if (env.GEMINI_API_KEY) {
    console.log('\n💡 Gemini 키 유효성은 npm run env:check -- --probe 로 확인')
  }

  console.log('\n새 DASHBOARD_API_SECRET: npm run env:secret\n')

  process.exit(audit.ok ? 0 : 1)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
