'use client'
import { useState } from 'react'
import type { AddToast } from '@/lib/dashboard-types'

const WORKFLOWS = [
  { name: 'YouTube 채널 데이터 수집', desc: '5개 채널 · 6시간 주기', status: 'active', file: 'N8N_YOUTUBE_COLLECT.json' },
  { name: '주제 선별 AI', desc: 'Webhook · OpenAI 연동', status: 'active', file: 'N8N_TOPIC_SUGGEST.json' },
]

export default function AutomationView({ addToast }: { addToast: AddToast }) {
  const [tab, setTab] = useState<'embed' | 'status'>('status')
  const [iframeKey, setIframeKey] = useState(0)

  return (
    <div className="space-y-4">
      {/* 탭 */}
      <div className="flex gap-2 bg-gray-100 dark:bg-gray-800 p-1 rounded-xl w-fit">
        {([['status', '📋 워크플로 현황'], ['embed', '🖥️ n8n 편집기']] as const).map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition ${tab === id ? 'bg-white dark:bg-gray-700 shadow-sm text-gray-900 dark:text-white' : 'text-gray-500 hover:text-gray-700'}`}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'status' && (
        <div className="space-y-4">
          {/* 상태 카드 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {WORKFLOWS.map(wf => (
              <div key={wf.name} className="bg-white dark:bg-gray-800 rounded-2xl p-5 shadow-sm border border-gray-100 dark:border-gray-700">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-white text-sm">{wf.name}</h3>
                    <p className="text-xs text-gray-400 mt-0.5">{wf.desc}</p>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded-full font-medium ${wf.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                    {wf.status === 'active' ? '● 활성' : '○ 비활성'}
                  </span>
                </div>
                <div className="flex gap-2 mt-3">
                  <button
                    onClick={() => { setTab('embed'); addToast(`${wf.name} 편집기 열기`, 'info') }}
                    className="flex-1 py-1.5 text-xs bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-lg font-medium transition">
                    편집기에서 열기
                  </button>
                  <button
                    onClick={() => addToast(`${wf.name} 실행 요청 완료`, 'success')}
                    className="flex-1 py-1.5 text-xs bg-green-50 text-green-600 hover:bg-green-100 rounded-lg font-medium transition">
                    ▶ 수동 실행
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* 안내 */}
          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-2xl p-5 border border-blue-100 dark:border-blue-800">
            <h3 className="font-semibold text-blue-800 dark:text-blue-300 mb-2 text-sm">💡 n8n 워크플로 추가 방법</h3>
            <ol className="text-sm text-blue-700 dark:text-blue-400 space-y-1 list-decimal list-inside">
              <li>"n8n 편집기" 탭으로 이동</li>
              <li>우측 상단 ⋮ 메뉴 → Import from JSON</li>
              <li><code className="bg-blue-100 dark:bg-blue-900 px-1 rounded">docs/n8n/</code> 폴더의 JSON 파일 선택</li>
              <li>Save → Activate</li>
            </ol>
          </div>
        </div>
      )}

      {tab === 'embed' && (
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm overflow-hidden border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-red-400" />
              <span className="w-3 h-3 rounded-full bg-yellow-400" />
              <span className="w-3 h-3 rounded-full bg-green-400" />
              <span className="text-xs text-gray-400 ml-2">localhost:5678  →  /n8n/</span>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setIframeKey(k => k + 1)}
                className="text-xs px-3 py-1 bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-lg hover:bg-gray-300 transition">
                ↺ 새로고침
              </button>
              <a href="http://localhost:5678" target="_blank" rel="noopener noreferrer"
                className="text-xs px-3 py-1 bg-blue-100 text-blue-600 rounded-lg hover:bg-blue-200 transition">
                ↗ 새 탭에서 열기
              </a>
            </div>
          </div>
          <iframe
            key={iframeKey}
            src="/n8n/"
            className="w-full border-0"
            style={{ height: 'calc(100vh - 280px)', minHeight: '600px' }}
            title="n8n 워크플로 편집기"
          />
        </div>
      )}
    </div>
  )
}
