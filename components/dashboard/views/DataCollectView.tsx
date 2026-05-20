'use client'

import { useState, useEffect, useCallback } from 'react'
import type { AddToast } from '@/lib/dashboard-types'
import { getPlatformIcon } from '@/lib/dashboard-helpers'
import { TitleWithHint } from '@/components/dashboard/info-hint'
import { N8nLv1ServicesSection } from '@/components/dashboard/n8n-lv1-services-section'

interface CollectChannelRow {
  channel_id: string
  channel_name: string
  subscribers: number | null
  avg_views: number | null
  updated_at: string | null
  videos_in_db: number
}

interface CollectLog {
  time: string
  type: 'success' | 'warning' | 'error'
  message: string
}

interface CollectStatusResponse {
  stats: { total: number; avgVsAvg: number }
  channels: CollectChannelRow[]
}

function formatRelativeTime(iso: string | null): string {
  if (!iso) return '—'
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return '방금 전'
  if (mins < 60) return `${mins}분 전`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}시간 전`
  return `${Math.floor(hours / 24)}일 전`
}

export default function DataCollectView({ addToast }: { addToast: AddToast }) {
  const [channels, setChannels] = useState<CollectChannelRow[]>([])
  const [stats, setStats] = useState<{ total: number; avgVsAvg: number } | null>(null)
  const [logs, setLogs] = useState<CollectLog[]>([])
  const [loading, setLoading] = useState(true)
  const [runningId, setRunningId] = useState<string | null>(null)
  const [collectingAll, setCollectingAll] = useState(false)

  const pushLog = useCallback((type: CollectLog['type'], message: string) => {
    const time = new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
    setLogs((prev) => [{ time, type, message }, ...prev].slice(0, 20))
  }, [])

  const loadStatus = useCallback(async () => {
    const res = await fetch('/api/dashboard/collect-status')
    if (!res.ok) throw new Error('수집 현황을 불러오지 못했습니다')
    const data = (await res.json()) as CollectStatusResponse
    setChannels(data.channels)
    setStats(data.stats)
  }, [])

  useEffect(() => {
    loadStatus()
      .catch(() => addToast('수집 현황 로드 실패', 'warning'))
      .finally(() => setLoading(false))
  }, [loadStatus, addToast])

  const runChannel = async (ch: CollectChannelRow) => {
    if (runningId || collectingAll) return
    setRunningId(ch.channel_id)
    addToast(`${ch.channel_name} 수집 중…`, 'info')
    try {
      const res = await fetch('/api/dashboard/collect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channel_id: ch.channel_id, channel_name: ch.channel_name }),
      })
      const data = await res.json()
      if (!res.ok || !data.ok) {
        pushLog('error', `${ch.channel_name}: ${data.error ?? res.status}`)
        addToast(data.error ?? '수집 실패', 'warning')
        return
      }
      pushLog('success', data.message ?? `${ch.channel_name} 수집 완료`)
      addToast(data.message ?? '수집 완료', 'success')
      await loadStatus()
    } catch {
      pushLog('error', `${ch.channel_name}: 네트워크 오류`)
      addToast('수집 중 오류', 'warning')
    } finally {
      setRunningId(null)
    }
  }

  const runAll = async () => {
    if (runningId || collectingAll || channels.length === 0) return
    setCollectingAll(true)
    addToast(`YouTube 채널 ${channels.length}개 전체 수집 시작`, 'info')
    try {
      const res = await fetch('/api/dashboard/collect-all', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) {
        pushLog('error', data.error ?? '전체 수집 실패')
        addToast(data.error ?? '전체 수집 실패', 'warning')
        return
      }
      pushLog(data.ok ? 'success' : 'warning', data.message ?? `성공 ${data.succeeded}/${data.total}`)
      addToast(data.message ?? '전체 수집 완료', data.ok ? 'success' : 'warning')
      if (Array.isArray(data.results)) {
        for (const r of data.results) {
          if (!r.ok && r.error) pushLog('error', `${r.channel_id}: ${r.error}`)
        }
      }
      await loadStatus()
    } catch {
      pushLog('error', '전체 수집: 네트워크 오류')
      addToast('전체 수집 중 오류', 'warning')
    } finally {
      setCollectingAll(false)
    }
  }

  const isBusy = runningId !== null || collectingAll

  return (
    <div className="space-y-4">
      <N8nLv1ServicesSection viewId="data-collect" addToast={addToast} />

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        {[
          { label: '등록 채널', value: loading ? '…' : `${channels.length}개`, sub: 'YouTube' },
          { label: 'DB 영상', value: loading ? '…' : `${stats?.total ?? 0}개`, sub: 'Supabase videos' },
          { label: '평균 vs.Avg', value: loading ? '…' : `${stats?.avgVsAvg?.toFixed(1) ?? '0'}x`, sub: '전체' },
        ].map((c) => (
          <div key={c.label} className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-gray-700">
            <p className="text-xs text-gray-500">{c.label}</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{c.value}</p>
            <p className="text-xs text-gray-400 mt-0.5">{c.sub}</p>
          </div>
        ))}
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm overflow-hidden border border-gray-100 dark:border-gray-700">
        <div className="p-5 border-b border-gray-100 dark:border-gray-700 flex flex-wrap justify-between items-center gap-3">
          <div>
            <TitleWithHint
              as="h3"
              className="font-bold text-gray-900 dark:text-white"
              hint="대시보드 API로 채널별·전체 수집을 실행합니다. n8n 스케줄은 «워크플로 관리»·docs/n8n/workflows JSON을 Import한 뒤 Webhook으로 연동하세요."
            >
              YouTube 수집
            </TitleWithHint>
          </div>
          <button
            type="button"
            onClick={runAll}
            disabled={isBusy || loading || channels.length === 0}
            className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {collectingAll ? '전체 수집 중…' : '▶ 전체 수집'}
          </button>
        </div>

        {loading ? (
          <p className="p-8 text-center text-sm text-gray-400">불러오는 중…</p>
        ) : channels.length === 0 ? (
          <p className="p-8 text-center text-sm text-gray-500">
            등록된 YouTube 채널이 없습니다. «채널·콘텐츠 등록»에서 채널을 추가하세요.
          </p>
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-gray-700">
            {channels.map((ch) => {
              const isRunning = runningId === ch.channel_id
              const stale = ch.updated_at && Date.now() - new Date(ch.updated_at).getTime() > 6 * 3600 * 1000
              return (
                <div key={ch.channel_id} className="p-5 flex items-center gap-4">
                  <span className="text-xl">{getPlatformIcon('youtube')}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-medium text-gray-900 dark:text-white">{ch.channel_name}</p>
                      <span
                        className={`px-2 py-0.5 text-xs rounded-full ${
                          isRunning
                            ? 'bg-blue-100 text-blue-700'
                            : stale
                              ? 'bg-yellow-100 text-yellow-700'
                              : 'bg-green-100 text-green-700'
                        }`}
                      >
                        {isRunning ? '수집 중' : stale ? '6h+ 경과' : '정상'}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-3 text-xs text-gray-400 mt-1">
                      <span>마지막: {formatRelativeTime(ch.updated_at)}</span>
                      <span>DB 영상: {ch.videos_in_db}개</span>
                      <span>채널 avg: {ch.avg_views?.toLocaleString() ?? '—'}</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => runChannel(ch)}
                    disabled={isBusy}
                    className={`px-4 py-2 text-sm rounded-lg font-medium transition shrink-0 ${
                      isRunning
                        ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                        : 'bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50'
                    }`}
                  >
                    {isRunning ? '수집 중…' : '▶ 실행'}
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm p-5 border border-gray-100 dark:border-gray-700">
        <h3 className="font-bold text-gray-900 dark:text-white mb-4">최근 수집 로그</h3>
        {logs.length === 0 ? (
          <p className="text-sm text-gray-400">이 세션에서 실행한 수집 기록이 여기 표시됩니다.</p>
        ) : (
          <div className="space-y-2">
            {logs.map((log, i) => (
              <div key={i} className="flex items-start gap-3 text-sm">
                <span className="text-xs text-gray-400 shrink-0 w-12">{log.time}</span>
                <span className="shrink-0">{log.type === 'success' ? '✅' : log.type === 'warning' ? '⚠️' : '❌'}</span>
                <span className="text-gray-600 dark:text-gray-300">{log.message}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
