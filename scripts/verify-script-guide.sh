#!/usr/bin/env bash
# 콘텐츠 가이드 스크립트 생성(n8n + 대시보드) 동작 확인
# dashboard-app 루트에서: ./scripts/verify-script-guide.sh
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
ENV_FILE="${ENV_FILE:-.env.local}"

RED=$'\033[31m'; GRN=$'\033[32m'; YLW=$'\033[33m'; NC=$'\033[0m'
ok()   { echo "${GRN}✓${NC} $*"; }
warn() { echo "${YLW}!${NC} $*"; }
fail() { echo "${RED}✗${NC} $*"; exit 1; }

echo "▶ 콘텐츠 가이드 스크립트 생성 검증"
echo ""

# ── 1. n8n ────────────────────────────────────────────────────────────────
echo "── n8n ──"
if ! curl -sf http://localhost:5678/healthz >/dev/null 2>&1; then
  fail "n8n이 실행 중이 아닙니다. docker compose -f docker-compose.n8n.yml --env-file .env.local up -d"
fi
ok "n8n healthz OK"

GEMINI_IN_N8N=$(docker exec n8n printenv GEMINI_API_KEY 2>/dev/null | tr -d '\r' || true)
if [[ -z "$GEMINI_IN_N8N" ]]; then
  warn "n8n 컨테이너에 GEMINI_API_KEY 없음 → docker compose 재기동 필요"
else
  ok "n8n GEMINI_API_KEY 설정됨 (${GEMINI_IN_N8N:0:8}...)"
fi

if ! docker exec n8n n8n list:workflow 2>/dev/null | grep -qE 'W08|longform|롱폼'; then
  warn "longform 워크플로 없음 → ./scripts/n8n-setup.sh 실행"
else
  ok "longform 워크플로 등록됨"
fi

N8N_RESP=$(curl -s --max-time 120 -X POST http://localhost:5678/webhook/longform-script \
  -H 'Content-Type: application/json' \
  -d '{"topic":"금리 재테크","targetFormat":"blog","references":[{"title":"금리 인상 대응","platform":"topic"}],"keywords":["금리","재테크"]}' || true)

N8N_TMP=$(mktemp)
echo "$N8N_RESP" > "$N8N_TMP"
N8N_LEN=$(python3 - <<PY
import json
from pathlib import Path
try:
  d = json.loads(Path("$N8N_TMP").read_text())
  s = (d.get('script') or {}).get('fullScript') or ''
  print(len(s))
except Exception:
  print(0)
PY
)
rm -f "$N8N_TMP"

if [[ "$N8N_LEN" -lt 200 ]]; then
  warn "n8n Webhook 응답 짧음 (${N8N_LEN}자). GEMINI 오류 또는 DB 문제일 수 있습니다."
  echo "   응답 미리보기: $(echo "$N8N_RESP" | head -c 200)"
else
  ok "n8n Webhook → fullScript ${N8N_LEN}자"
fi

# ── 2. Next.js + GEMINI ───────────────────────────────────────────────────
echo ""
echo "── 대시보드 API ──"
if [[ ! -f "$ENV_FILE" ]]; then
  fail "$ENV_FILE 없음"
fi

# shellcheck disable=SC1090
set -a; source "$ENV_FILE"; set +a

if [[ -z "${GEMINI_API_KEY:-}" ]]; then
  fail ".env.local에 GEMINI_API_KEY 없음"
fi
ok ".env.local GEMINI_API_KEY 설정됨 (${GEMINI_API_KEY:0:8}...)"

if ! curl -sf http://localhost:3000/login >/dev/null 2>&1; then
  warn "Next.js dev 서버(3000) 미실행 → npm run dev 후 다시 확인"
else
  ok "Next.js dev 서버 실행 중"

  LOGIN_ID="${DASHBOARD_LOGIN_ID:-}"
  LOGIN_PW="${DASHBOARD_LOGIN_PASSWORD:-}"
  if [[ -z "$LOGIN_ID" || -z "$LOGIN_PW" ]]; then
    warn "DASHBOARD_LOGIN_ID/PASSWORD 없어 API 테스트 생략"
  else
    COOKIE_JAR=$(mktemp)
    LOGIN_CODE=$(curl -s -o /dev/null -w '%{http_code}' -c "$COOKIE_JAR" -X POST http://localhost:3000/api/auth/login \
      -H 'Content-Type: application/json' \
      -d "{\"loginId\":\"$LOGIN_ID\",\"password\":\"$LOGIN_PW\"}")
    if [[ "$LOGIN_CODE" != "200" ]]; then
      warn "로그인 실패 HTTP $LOGIN_CODE — API 테스트 생략"
    else
      API_RESP=$(curl -s --max-time 120 -b "$COOKIE_JAR" -X POST http://localhost:3000/api/dashboard/script-guide \
        -H 'Content-Type: application/json' \
        -d '{"context":{"category":"writing","intent":"blog","keywords":["금리","재테크"],"referenceTitles":["금리 인상"],"references":[{"title":"금리 인상","platform":"topic"}]}}')
      API_TMP=$(mktemp)
      echo "$API_RESP" > "$API_TMP"
      python3 - <<PY
import json
from pathlib import Path
d = json.loads(Path("$API_TMP").read_text())
if d.get('error'):
  print('${RED}✗${NC} script-guide API:', d['error'][:120])
  raise SystemExit(1)
length = len(d.get('fullScript') or '')
mode = d.get('mode')
title = (d.get('title') or '')[:50]
if length < 200:
  print('${YLW}!${NC} script-guide 응답 짧음 (%d자, mode=%s)' % (length, mode))
else:
  print('${GRN}✓${NC} script-guide API → %d자 (mode=%s) · %s' % (length, mode, title))
PY
      rm -f "$API_TMP"
    fi
    rm -f "$COOKIE_JAR"
  fi
fi

echo ""
echo "완료. 화면에서도 «스크립트 가이드 생성»을 다시 시도해 보세요."
