#!/usr/bin/env node
import { randomBytes } from 'node:crypto'

const secret = randomBytes(32).toString('base64url')

console.log('\n새 DASHBOARD_API_SECRET (아래 한 줄을 .env.local·n8n에 동일하게 넣으세요):\n')
console.log(`DASHBOARD_API_SECRET=${secret}\n`)
console.log('선택 — 세션 전용 분리:')
console.log(`DASHBOARD_SESSION_SECRET=${randomBytes(32).toString('base64url')}\n`)
console.log('적용 후: npm run dev 재시작, n8n docker compose --env-file .env.local 재기동\n')
