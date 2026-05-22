#!/usr/bin/env bash
# n8n DB에서 동일 이름 워크플로 중 비활성(미발행) 중복본 삭제 — 운영 1개만 유지
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if ! docker ps --format '{{.Names}}' | grep -qx 'n8n'; then
  echo "❌ n8n 컨테이너가 실행 중이 아닙니다."
  exit 1
fi

DB_HOST="/tmp/n8n-prune-database.sqlite"
docker cp n8n:/home/node/.n8n/database.sqlite "$DB_HOST"

python3 <<'PY'
import sqlite3
from collections import defaultdict

db = "/tmp/n8n-prune-database.sqlite"
conn = sqlite3.connect(db)
conn.execute("PRAGMA foreign_keys=OFF")
cur = conn.cursor()

cur.execute("SELECT id, name, active FROM workflow_entity ORDER BY name, createdAt")
rows = cur.fetchall()
by_name: dict[str, list[tuple]] = defaultdict(list)
for r in rows:
    by_name[r[1]].append(r)

to_delete: list[str] = []
for name, items in by_name.items():
    if len(items) <= 1:
        continue
    active = [i for i in items if i[2]]
    inactive = [i for i in items if not i[2]]
    if len(active) >= 1:
        keep_id = active[-1][0]
        for i in items:
            if i[0] != keep_id:
                to_delete.append(i[0])
    else:
        keep_id = items[-1][0]
        for i in items[:-1]:
            to_delete.append(i[0])
    print(f"중복 '{name}': 유지 {keep_id}, 삭제 {[i[0] for i in items if i[0] != keep_id]}")

if not to_delete:
    print("삭제할 중복 워크플로 없음.")
    conn.close()
    raise SystemExit(0)

tables = [
    "workflows_tags", "webhook_entity", "shared_workflow", "processed_data",
    "insights_metadata", "test_run", "workflow_history", "chat_hub_messages",
    "workflow_statistics", "workflow_dependency", "workflow_published_version",
    "chat_hub_sessions", "workflow_builder_session", "workflow_publish_history",
    "ai_builder_temporary_workflow", "execution_entity",
]

for wid in to_delete:
    for t in tables:
        cur.execute(f'DELETE FROM "{t}" WHERE workflowId = ?', (wid,))
    cur.execute("DELETE FROM workflow_entity WHERE id = ?", (wid,))

conn.commit()
cur.execute("SELECT COUNT(*) FROM workflow_entity")
print(f"정리 후 워크플로 수: {cur.fetchone()[0]}")
conn.close()
PY

docker stop n8n >/dev/null
docker cp "$DB_HOST" n8n:/home/node/.n8n/database.sqlite
docker run --rm -v n8n_data:/data alpine sh -c "chown -R 1000:1000 /data && chmod u+rw /data/database.sqlite" >/dev/null
docker start n8n >/dev/null
sleep 8
echo "▶ 정리 후 목록"
docker exec n8n n8n list:workflow 2>/dev/null
