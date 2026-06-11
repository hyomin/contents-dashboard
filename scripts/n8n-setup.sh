#!/usr/bin/env bash
# n8n 워크플로 임포트·활성화·웹훅 점검 (dashboard-app 루트에서 실행)
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

ENV_FILE="${ENV_FILE:-.env.local}"
COMPOSE="docker compose -f docker-compose.n8n.yml"
N8N_DOCS="$ROOT/docs/n8n/workflows"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "❌ $ENV_FILE 없음. .env.example 을 복사해 주세요."
  exit 1
fi

echo "▶ n8n 컨테이너 기동 (환경변수: $ENV_FILE)"
$COMPOSE --env-file "$ENV_FILE" up -d

echo "▶ n8n 준비 대기…"
for i in {1..30}; do
  if curl -sf http://localhost:5678/healthz >/dev/null 2>&1; then
    echo "   healthz OK"
    break
  fi
  sleep 1
  if [[ $i -eq 30 ]]; then
    echo "❌ n8n healthz 타임아웃"
    exit 1
  fi
done

prep_import() {
  local src="$1"
  local out="/tmp/n8n-import-$(basename "$src")"
  python3 - "$src" "$out" <<'PY'
import json, secrets, string, sys
from pathlib import Path

def rand_id():
    return "".join(secrets.choice(string.ascii_letters + string.digits) for _ in range(16))

src, out = Path(sys.argv[1]), Path(sys.argv[2])
data = json.loads(src.read_text())
data["id"] = rand_id()
data["active"] = False
out.write_text(json.dumps([data], ensure_ascii=False))
PY
  echo "$out"
}

import_one() {
  local file="$1"
  local prepared
  prepared=$(prep_import "$file")
  local id name existing
  id=$(python3 -c "import json; print(json.load(open('$prepared'))[0]['id'])")
  name=$(python3 -c "import json; print(json.load(open('$prepared'))[0].get('name',''))")
  docker cp "$prepared" "n8n:/tmp/import.json"
  existing=$(docker exec n8n n8n list:workflow 2>/dev/null | grep -F "|${name}" | head -1 | cut -d'|' -f1 || true)
  if [[ -n "$existing" ]]; then
    echo "   ↷ 갱신: $name ($existing) — 동일 이름 워크플로 덮어쓰기"
    python3 - "$prepared" "$existing" <<'PY'
import json, sys
path, wid = sys.argv[1], sys.argv[2]
data = json.load(open(path))[0]
data["id"] = wid
data["staticData"] = None
open(path, "w").write(json.dumps([data], ensure_ascii=False))
PY
    id="$existing"
  else
    echo "   ✓ 신규: $name"
  fi
  if ! docker exec n8n n8n import:workflow --input=/tmp/import.json; then
    echo "   ✗ 임포트 실패: $name"
    return 1
  fi
  docker exec n8n n8n publish:workflow --id="$id" || true
  echo "   ✓ 활성화(publish): $id"
}

echo "▶ 중복 워크플로 정리 (동일 이름·비활성본)"
"$ROOT/scripts/n8n-prune-duplicates.sh" || true

echo "▶ 워크플로 임포트·활성화"
# ── Lv.1 운영 워크플로 (스케줄: 12h · Webhook · 수동) ──
import_one "$N8N_DOCS/N8N_YOUTUBE_COLLECT.json"
import_one "$N8N_DOCS/N8N_OUTLIER_TAGGING.json"
import_one "$N8N_DOCS/N8N_RSS_TOPIC_COLLECT.json"
import_one "$N8N_DOCS/N8N_NAVER_BLOG_COLLECT.json"
import_one "$N8N_DOCS/N8N_NAVER_BLOG_VIEWS.json"
import_one "$N8N_DOCS/N8N_TISTORY_COLLECT.json"
# ── Phase A 신규 워크플로 ──
import_one "$N8N_DOCS/N8N_LONGFORM_SCRIPT.json"      # W08: 롱폼 스크립트 (Gemini)
import_one "$N8N_DOCS/N8N_TOPIC_SUGGEST_V2.json"     # W09: 주제 추천 AI (Gemini + RSS/Outlier)
import_one "$N8N_DOCS/N8N_AI_INSIGHTS.json"          # W10: AI 인사이트 (Gemini + 대시보드 데이터)
import_one "$N8N_DOCS/N8N_BGM_IDENTIFY.json"         # W11: BGM 정밀 식별 (yt-dlp 추출 + AudD 음향 지문 매칭)

echo "▶ n8n 재시작 (웹훅 등록 반영)"
docker restart n8n >/dev/null
sleep 6
curl -sf http://localhost:5678/healthz >/dev/null

echo "▶ 활성 워크플로"
docker exec n8n n8n list:workflow --active=true 2>/dev/null || docker exec n8n n8n list:workflow

echo "▶ Webhook 프로브"
for path in youtube-collect outlier-tagging rss-topic-collect naver-blog-collect naver-blog-views tistory-collect longform-script topic-suggest ai-insights bgm-identify; do
  code=$(curl -s -o /dev/null -w "%{http_code}" -X POST "http://localhost:5678/webhook/$path" \
    -H "Content-Type: application/json" -d '{}' || true)
  if [[ "$code" == "404" ]]; then
    echo "   ✗ POST /webhook/$path → $code (워크플로 미활성 또는 경로 불일치)"
  else
    echo "   ✓ POST /webhook/$path → HTTP $code"
  fi
done

echo ""
echo "▶ .env.local 환경변수 확인:"
echo "N8N_WEBHOOK_YOUTUBE_COLLECT=http://localhost:5678/webhook/youtube-collect"
echo "N8N_WEBHOOK_OUTLIER_TAG=http://localhost:5678/webhook/outlier-tagging"
echo "N8N_WEBHOOK_RSS_TOPICS=http://localhost:5678/webhook/rss-topic-collect"
echo "N8N_WEBHOOK_NAVER_BLOG_COLLECT=http://localhost:5678/webhook/naver-blog-collect"
echo "N8N_WEBHOOK_NAVER_BLOG_VIEWS=http://localhost:5678/webhook/naver-blog-views"
echo "N8N_WEBHOOK_TISTORY_COLLECT=http://localhost:5678/webhook/tistory-collect"
echo "N8N_WEBHOOK_LONGFORM_SCRIPT=http://localhost:5678/webhook/longform-script  # Phase A 신규"
echo "N8N_WEBHOOK_TOPIC_SUGGEST=http://localhost:5678/webhook/topic-suggest       # Phase A 신규"
echo "N8N_WEBHOOK_AI_INSIGHTS=http://localhost:5678/webhook/ai-insights           # W10 AI 인사이트"
echo "N8N_WEBHOOK_BGM_IDENTIFY=http://localhost:5678/webhook/bgm-identify         # W11 BGM 정밀 식별"
echo "DASHBOARD_API_URL=http://host.docker.internal:3000"
echo "GEMINI_API_KEY=<발급키>  # Gemini 워크플로에 필수"
echo "AUDD_API_TOKEN=<dashboard.audd.io 발급 토큰>  # W11 BGM 정밀 식별에 필수 (.env.local → docker-compose.n8n.yml로 전달)"
echo "완료."
