'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { formatSessionIdleTimeoutLabel } from '@/lib/auth/constants'

interface LoginFormProps {
  isAuthReady: boolean
}

export function LoginForm({ isAuthReady }: LoginFormProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const reason = searchParams.get('reason')

  const [loginId, setLoginId] = useState('')
  const [password, setPassword] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError(null)
    setIsSubmitting(true)

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ loginId, password }),
      })
      const data = (await res.json()) as { error?: string }

      if (!res.ok) {
        setError(data.error ?? '로그인에 실패했습니다.')
        return
      }

      const from = searchParams.get('from')
      router.replace(from && from.startsWith('/') ? from : '/dashboard')
      router.refresh()
    } catch {
      setError('네트워크 오류가 발생했습니다. 다시 시도해 주세요.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {(reason === 'idle' || reason === 'expired') && (
        <div
          role="alert"
          className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-100"
        >
          {reason === 'idle'
            ? `${formatSessionIdleTimeoutLabel()}간 활동이 없어 자동 로그아웃되었습니다. 다시 로그인해 주세요.`
            : '세션이 만료되었습니다. 다시 로그인해 주세요.'}
        </div>
      )}

      {!isAuthReady && (
        <div
          role="status"
          className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-100"
        >
          로그인 DB 설정이 아직 적용되지 않았습니다. 관리자에게 문의하세요.
        </div>
      )}

      {error && (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200"
        >
          {error}
        </div>
      )}

      <div className="space-y-2">
        <label htmlFor="loginId" className="block text-sm font-medium text-gray-700 dark:text-gray-200">
          아이디
        </label>
        <input
          id="loginId"
          name="loginId"
          type="text"
          autoComplete="username"
          required
          disabled={!isAuthReady || isSubmitting}
          value={loginId}
          onChange={(e) => setLoginId(e.target.value)}
          className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-gray-900 shadow-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 disabled:cursor-not-allowed disabled:opacity-60 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
          placeholder="아이디 입력"
        />
      </div>

      <div className="space-y-2">
        <label
          htmlFor="password"
          className="block text-sm font-medium text-gray-700 dark:text-gray-200"
        >
          비밀번호
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          disabled={!isAuthReady || isSubmitting}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-gray-900 shadow-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 disabled:cursor-not-allowed disabled:opacity-60 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
          placeholder="비밀번호 입력"
        />
      </div>

      <button
        type="submit"
        disabled={!isAuthReady || isSubmitting}
        className="w-full rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white shadow-md transition hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 dark:focus:ring-offset-gray-900"
      >
        {isSubmitting ? '로그인 중…' : '로그인'}
      </button>
    </form>
  )
}
