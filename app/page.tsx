'use client'

import { useEffect, useState } from 'react'

interface TestResult {
  success: boolean
  message?: string
  error?: string
  configured: boolean
  needsTable?: boolean
}

export default function Home() {
  const [testResult, setTestResult] = useState<TestResult | null>(null)
  const [loading, setLoading] = useState(false)

  async function testSupabase() {
    setLoading(true)
    try {
      const res = await fetch('/api/test-supabase')
      const data = await res.json()
      setTestResult(data)
    } catch (error) {
      setTestResult({
        success: false,
        error: '테스트 실패',
        configured: false
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 p-8">
      <main className="text-center max-w-2xl">
        <h1 className="text-6xl font-bold text-gray-900 dark:text-white mb-4">
          Hello World!
        </h1>
        <p className="text-xl text-gray-600 dark:text-gray-300 mb-8">
          Next.js + Supabase Dashboard
        </p>

        <button
          onClick={testSupabase}
          disabled={loading}
          className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 transition-colors"
        >
          {loading ? '테스트 중...' : 'Supabase 연결 테스트'}
        </button>

        {testResult && (
          <div className={`mt-6 p-4 rounded-lg ${
            testResult.success 
              ? 'bg-green-100 dark:bg-green-900' 
              : 'bg-red-100 dark:bg-red-900'
          }`}>
            <p className={`font-semibold ${
              testResult.success 
                ? 'text-green-800 dark:text-green-200' 
                : 'text-red-800 dark:text-red-200'
            }`}>
              {testResult.success ? '✅ 성공' : '❌ 실패'}
            </p>
            <p className="mt-2 text-sm text-gray-700 dark:text-gray-300">
              {testResult.message || testResult.error}
            </p>
            {testResult.needsTable && (
              <div className="mt-4 text-left bg-white dark:bg-gray-800 p-3 rounded text-xs">
                <p className="font-semibold mb-2">다음 단계:</p>
                <ol className="list-decimal list-inside space-y-1">
                  <li>Supabase Dashboard → SQL Editor</li>
                  <li>SETUP_SUPABASE.md 파일의 SQL 실행</li>
                  <li>다시 테스트 버튼 클릭</li>
                </ol>
              </div>
            )}
          </div>
        )}

        <div className="mt-12 text-left bg-white dark:bg-gray-800 rounded-lg p-6 shadow-lg">
          <h2 className="text-xl font-bold mb-4 text-gray-900 dark:text-white">
            📝 설정 가이드
          </h2>
          <ol className="list-decimal list-inside space-y-2 text-sm text-gray-700 dark:text-gray-300">
            <li>
              <a 
                href="https://supabase.com" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline"
              >
                Supabase
              </a>
              에서 프로젝트 생성 (Seoul 리전)
            </li>
            <li>Settings → API에서 URL과 Key 복사</li>
            <li><code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">.env.local</code> 파일에 값 입력</li>
            <li>개발 서버 재시작: <code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">npm run dev</code></li>
            <li>위 버튼으로 연결 테스트</li>
          </ol>
          <p className="mt-4 text-xs text-gray-500">
            자세한 내용은 <code>SETUP_SUPABASE.md</code> 파일 참고
          </p>
        </div>
      </main>
    </div>
  );
}
