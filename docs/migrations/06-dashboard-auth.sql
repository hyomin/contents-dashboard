-- 대시보드 로그인 계정 (서버 전용 · RLS로 API 직접 접근 차단)
-- Supabase SQL Editor에서 실행
-- 계정 등록: scripts/seed-dashboard-auth.mjs (.env.local — 저장소에 아이디/비밀번호 넣지 않음)

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

CREATE TABLE IF NOT EXISTS dashboard_app_users (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  login_id        TEXT NOT NULL UNIQUE,
  password_hash   TEXT NOT NULL,
  is_active       BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE dashboard_app_users ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION seed_dashboard_user(p_login_id TEXT, p_password TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  INSERT INTO dashboard_app_users (login_id, password_hash)
  VALUES (p_login_id, extensions.crypt(p_password, extensions.gen_salt('bf')))
  ON CONFLICT (login_id) DO UPDATE
    SET password_hash = EXCLUDED.password_hash,
        is_active = true,
        updated_at = NOW();
END;
$$;

CREATE OR REPLACE FUNCTION verify_dashboard_login(p_login_id TEXT, p_password TEXT)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, extensions
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM dashboard_app_users
    WHERE login_id = p_login_id
      AND is_active = true
      AND password_hash = extensions.crypt(p_password, password_hash)
  );
$$;

REVOKE ALL ON FUNCTION seed_dashboard_user(TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION verify_dashboard_login(TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION seed_dashboard_user(TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION verify_dashboard_login(TEXT, TEXT) TO service_role;

NOTIFY pgrst, 'reload schema';
