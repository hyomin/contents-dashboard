import { Suspense } from 'react'
import { LoginForm } from '@/components/auth/login-form'
import { isDashboardAuthReady } from '@/lib/auth/credentials'
import { formatSessionIdleTimeoutLabel } from '@/lib/auth/constants'

function LoginFormFallback() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="h-12 rounded-xl bg-gray-200 dark:bg-gray-700" />
      <div className="h-12 rounded-xl bg-gray-200 dark:bg-gray-700" />
      <div className="h-12 rounded-xl bg-indigo-300/50 dark:bg-indigo-800/50" />
    </div>
  )
}

export default async function LoginPage() {
  const isAuthReady = await isDashboardAuthReady()
  const idleLabel = formatSessionIdleTimeoutLabel()

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-12 bg-gradient-to-br from-slate-50 via-indigo-50/40 to-slate-100 dark:from-gray-950 dark:via-indigo-950/20 dark:to-gray-900">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-lg">
            <svg
              className="h-7 w-7"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
              />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Contents Dashboard
          </h1>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            승인된 계정만 접근할 수 있습니다
          </p>
        </div>

        <div className="rounded-2xl border border-gray-200/80 bg-white/90 p-8 shadow-xl backdrop-blur dark:border-gray-700 dark:bg-gray-900/90">
          <Suspense fallback={<LoginFormFallback />}>
            <LoginForm isAuthReady={isAuthReady} />
          </Suspense>

          <p className="mt-6 text-center text-xs text-gray-500 dark:text-gray-400">
            {idleLabel}간 활동이 없으면 자동으로 로그아웃됩니다
          </p>
        </div>
      </div>
    </div>
  )
}
