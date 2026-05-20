/**
 * n8n UI(로그인·편집기) 진입 URL.
 * Next가 `/n8n/` 으로 프록시할 때는 기본값 `/n8n/` 사용.
 * 다른 호스트를 쓰면 `.env`에 `NEXT_PUBLIC_N8N_EDITOR_URL` 설정 (예: http://localhost:3000/n8n/)
 */
export function getN8nLoginHref(): string {
  const raw = process.env.NEXT_PUBLIC_N8N_EDITOR_URL?.trim()
  if (raw) return raw.endsWith('/') ? raw : `${raw}/`
  return '/n8n/'
}
