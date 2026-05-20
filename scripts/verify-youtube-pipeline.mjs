#!/usr/bin/env node
/**
 * YouTube 수집 파이프라인 E2E 검증 (대시보드 API 경로).
 * 사용: npm run dev 실행 후 → node scripts/verify-youtube-pipeline.mjs
 * 환경: BASE_URL (기본 http://localhost:3000)
 */

const BASE = process.env.BASE_URL?.replace(/\/$/, '') || 'http://localhost:3000'

async function getJson(path) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { Origin: BASE.replace(/^http/, 'http') },
  })
  const text = await res.text()
  let data
  try {
    data = JSON.parse(text)
  } catch {
    data = text
  }
  return { ok: res.ok, status: res.status, data }
}

async function postJson(path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Origin: new URL(BASE).origin,
    },
    body: JSON.stringify(body),
  })
  const data = await res.json().catch(() => ({}))
  return { ok: res.ok, status: res.status, data }
}

function fail(msg) {
  console.error(`\n❌ ${msg}`)
  process.exit(1)
}

console.log(`\n🔍 YouTube 파이프라인 검증 (${BASE})\n`)

const health = await getJson('/api/dashboard/channels')
if (!health.ok) fail(`서버 응답 없음 (${health.status}). npm run dev 를 실행하세요.`)

const channels = health.data
if (!Array.isArray(channels) || channels.length === 0) {
  fail('등록된 YouTube 채널이 없습니다. 대시보드 > 채널·콘텐츠 등록에서 채널을 추가하세요.')
}
console.log(`✓ 채널 ${channels.length}개 조회`)

const before = await getJson('/api/dashboard/videos?type=stats')
if (!before.ok) fail('영상 통계 조회 실패')
console.log(`✓ 수집 전 영상 ${before.data.total}개 (평균 vs.Avg ${before.data.avgVsAvg}x)`)

const target = channels.find((c) => c.platform === 'youtube') ?? channels[0]
console.log(`\n▶ 단일 채널 수집: ${target.channel_name} (${target.channel_id})`)

const collect = await postJson('/api/dashboard/collect', {
  channel_id: target.channel_id,
  channel_name: target.channel_name,
})
if (!collect.ok || !collect.data.ok) {
  fail(`수집 실패: ${JSON.stringify(collect.data)}`)
}
console.log(`✓ ${collect.data.message}`)
console.log(`  영상 ${collect.data.videoCount}개, avgViews ${collect.data.avgViews}`)

const after = await getJson('/api/dashboard/videos?type=stats')
console.log(`\n✓ 수집 후 영상 ${after.data.total}개 (평균 vs.Avg ${after.data.avgVsAvg}x)`)
console.log('\n✅ 대시보드 API 수집 경로 E2E 통과\n')
console.log('n8n 워크플로: docs/n8n/workflows/N8N_YOUTUBE_COLLECT.json 재임포트 후')
console.log('  SUPABASE_URL, SUPABASE_SERVICE_KEY, YOUTUBE_API_KEY 환경변수 설정 → 수동/Webhook 실행\n')
