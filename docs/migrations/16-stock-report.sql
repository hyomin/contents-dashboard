-- 주식 일일 리포트 (워치리스트·시세 스냅샷·자동생성 설정)
-- Supabase SQL Editor에서 실행

CREATE TABLE IF NOT EXISTS stock_watchlist (
  id          TEXT PRIMARY KEY,            -- `${market}:${ticker}`
  ticker      TEXT NOT NULL,
  market      TEXT NOT NULL,               -- 'KR' | 'US'
  asset_type  TEXT NOT NULL DEFAULT 'stock', -- 'stock' | 'index'
  name        TEXT NOT NULL,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS stock_daily_snapshots (
  id          BIGSERIAL PRIMARY KEY,
  ticker      TEXT NOT NULL,
  market      TEXT NOT NULL,
  trade_date  DATE NOT NULL,
  open        NUMERIC,
  high        NUMERIC,
  low         NUMERIC,
  close       NUMERIC,
  volume      BIGINT,
  change_pct  NUMERIC,
  raw         JSONB NOT NULL DEFAULT '{}'::jsonb,
  collected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (ticker, trade_date)
);

CREATE INDEX IF NOT EXISTS idx_stock_daily_snapshots_ticker_date
  ON stock_daily_snapshots (ticker, trade_date DESC);

-- 자동 생성 컨트롤 (싱글톤 행)
CREATE TABLE IF NOT EXISTS stock_report_settings (
  id          TEXT PRIMARY KEY DEFAULT 'default',
  auto_generate_enabled BOOLEAN NOT NULL DEFAULT true,
  skip_until  DATE,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO stock_report_settings (id) VALUES ('default')
  ON CONFLICT (id) DO NOTHING;

NOTIFY pgrst, 'reload schema';
