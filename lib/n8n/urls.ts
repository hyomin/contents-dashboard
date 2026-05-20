/** 로컬 개발 시 접속 URL (대시보드·n8n) */

export const LOCAL_URLS = {
  dashboard: 'http://localhost:3000/dashboard',
  /** Next 프록시 — 끝 슬래시 없이 (슬래시 있으면 308) */
  n8nViaDashboard: 'http://localhost:3000/n8n',
  /** Docker n8n 직접 (N8N_PATH 미설정 권장) */
  n8nDirect: 'http://localhost:5678',
  n8nHealth: 'http://localhost:5678/healthz',
  webhookBase: 'http://localhost:5678/webhook',
} as const

export function webhookUrl(path: string): string {
  return `${LOCAL_URLS.webhookBase}/${path}`
}
