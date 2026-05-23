import { supabaseAdmin } from '@/lib/data/supabase-admin'

export interface LoginVerifyResult {
  ok: boolean
  error?: string
}

export async function isDashboardAuthReady(): Promise<boolean> {
  const { count, error } = await supabaseAdmin
    .from('dashboard_app_users')
    .select('id', { count: 'exact', head: true })

  if (error) return false
  return (count ?? 0) > 0
}

export async function verifyLoginCredentials(
  loginId: string,
  password: string,
): Promise<LoginVerifyResult> {
  const trimmedId = loginId.trim()
  if (!trimmedId || !password) {
    return { ok: false, error: '아이디와 비밀번호를 입력해 주세요.' }
  }

  const ready = await isDashboardAuthReady()
  if (!ready) {
    return {
      ok: false,
      error: '로그인 설정이 완료되지 않았습니다. Supabase에서 인증 테이블 마이그레이션을 실행해 주세요.',
    }
  }

  const { data, error } = await supabaseAdmin.rpc('verify_dashboard_login', {
    p_login_id: trimmedId,
    p_password: password,
  })

  if (error) {
    console.error('[dashboard-auth] verify_dashboard_login', error.message)
    return { ok: false, error: '로그인 처리 중 오류가 발생했습니다.' }
  }

  if (!data) {
    return { ok: false, error: '아이디 또는 비밀번호가 올바르지 않습니다.' }
  }

  return { ok: true }
}
