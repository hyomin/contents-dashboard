/**
 * .env.local 의 DASHBOARD_LOGIN_ID / DASHBOARD_LOGIN_PASSWORD 로 Supabase 계정 시드
 * (저장소 SQL·md 에 평문 계정을 넣지 않음)
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { createClient } from '@supabase/supabase-js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '..')

function loadEnvFile(filename) {
  const filePath = path.join(root, filename)
  if (!fs.existsSync(filePath)) return
  for (const line of fs.readFileSync(filePath, 'utf8').split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq <= 0) continue
    const key = trimmed.slice(0, eq).trim()
    let value = trimmed.slice(eq + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    if (!(key in process.env)) process.env[key] = value
  }
}

loadEnvFile('.env')
loadEnvFile('.env.local')

const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
const loginId = process.env.DASHBOARD_LOGIN_ID?.trim()
const password = process.env.DASHBOARD_LOGIN_PASSWORD ?? ''

if (!url || !serviceKey) {
  console.error('NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY 가 필요합니다.')
  process.exit(1)
}

if (!loginId || !password) {
  console.error(
    '.env.local 에 DASHBOARD_LOGIN_ID, DASHBOARD_LOGIN_PASSWORD 를 설정한 뒤 다시 실행하세요.',
  )
  process.exit(1)
}

const supabase = createClient(url, serviceKey)

const { error } = await supabase.rpc('seed_dashboard_user', {
  p_login_id: loginId,
  p_password: password,
})

if (error) {
  console.error('시드 실패:', error.message)
  console.error(
    'Supabase SQL Editor에서 docs/migrations/06-dashboard-auth.sql 을 먼저 실행했는지 확인하세요.',
  )
  process.exit(1)
}

console.log(`OK: dashboard login user seeded (${loginId.slice(0, 2)}***)`)
