/**
 * Notion 로그 테이블 생성 스크립트
 * 실행: node scripts/setup-notion-table.mjs
 */
import { readFileSync } from 'fs'
import { createClient } from '@supabase/supabase-js'

// .env.local 파싱
const envRaw = readFileSync('.env.local', 'utf8')
const env = Object.fromEntries(
  envRaw
    .split('\n')
    .filter((l) => l.trim() && !l.startsWith('#'))
    .map((l) => {
      const idx = l.indexOf('=')
      return [l.slice(0, idx).trim(), l.slice(idx + 1).trim()]
    }),
)

const supabase = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
)

const sql = `
create table if not exists notion_daily_logs (
  date        date primary key,
  notion_page_id text not null,
  created_at  timestamptz default now()
);
`

// Supabase SQL via rpc (pgmeta)
const res = await fetch(
  `${env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/rpc/notion_setup`,
  {
    method: 'POST',
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({}),
  },
)

// Supabase의 경우 직접 INSERT로 테스트
const { error: insertErr } = await supabase
  .from('notion_daily_logs')
  .select('date')
  .limit(1)

if (insertErr?.code === 'PGRST205') {
  console.log('❌ 테이블이 없습니다. Supabase SQL 에디터에서 아래 SQL을 실행하세요:')
  console.log(sql)
} else if (insertErr) {
  console.error('❌ 오류:', insertErr.message)
} else {
  console.log('✅ notion_daily_logs 테이블이 이미 존재합니다.')
}
