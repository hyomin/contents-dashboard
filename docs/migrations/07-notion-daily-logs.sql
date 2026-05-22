-- notion-sync: 날짜별 Notion 페이지 ID 캐시
create table if not exists notion_daily_logs (
  date        date primary key,
  notion_page_id text not null,
  created_at  timestamptz default now()
);
