'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import type { AddToast } from '@/lib/dashboard/dashboard-types'
import type { DBChannel, DBVideo } from '@/lib/data/supabase'
import { formatViews, getPlatformName, getTierColor, getVsAvgColor } from '@/lib/dashboard/dashboard-helpers'
import {
  dbVideoToGuideReference,
  GUIDE_PLATFORMS,
  type GuidePlatformId,
  type GuideReference,
} from '@/lib/dashboard/guide-references'
import { Spinner } from '@/components/dashboard/ui/loading'
import {
  matchChannelsBySearchQuery,
  parseChannelSearchQuery,
} from '@/lib/dashboard/channel-search'
import type { ChannelCategoryRow } from '@/lib/data/channel-category-queries'

type Step = 'platform' | 'channel' | 'content'

interface GuideReferencePickerModalProps {
  open: boolean
  onClose: () => void
  onSelect: (ref: GuideReference) => void
  addToast: AddToast
}

const UNCategorized = '__uncategorized'

export function GuideReferencePickerModal({
  open,
  onClose,
  onSelect,
  addToast,
}: GuideReferencePickerModalProps) {
  const [step, setStep] = useState<Step>('platform')
  const [platform, setPlatform] = useState<GuidePlatformId | null>(null)
  const [channel, setChannel] = useState<DBChannel | null>(null)
  const [channels, setChannels] = useState<DBChannel[]>([])
  const [categories, setCategories] = useState<ChannelCategoryRow[]>([])
  const [videos, setVideos] = useState<DBVideo[]>([])
  const [channelSearch, setChannelSearch] = useState('')
  const [selectedCategoryId, setSelectedCategoryId] = useState('')
  const [contentSearch, setContentSearch] = useState('')
  const [loadingChannels, setLoadingChannels] = useState(false)
  const [loadingVideos, setLoadingVideos] = useState(false)

  const reset = useCallback(() => {
    setStep('platform')
    setPlatform(null)
    setChannel(null)
    setChannels([])
    setVideos([])
    setChannelSearch('')
    setSelectedCategoryId('')
    setContentSearch('')
  }, [])

  useEffect(() => {
    if (!open) reset()
  }, [open, reset])

  useEffect(() => {
    if (!open) return
    fetch('/api/dashboard/channel-categories')
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data: ChannelCategoryRow[]) => setCategories(Array.isArray(data) ? data : []))
      .catch(() => setCategories([]))
  }, [open])

  useEffect(() => {
    if (!open || step !== 'channel' || !platform) return
    setLoadingChannels(true)
    fetch(`/api/dashboard/channels?platform=${encodeURIComponent(platform)}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data: DBChannel[]) => setChannels(Array.isArray(data) ? data : []))
      .catch(() => {
        setChannels([])
        addToast('채널 목록을 불러오지 못했습니다', 'warning')
      })
      .finally(() => setLoadingChannels(false))
  }, [open, step, platform, addToast])

  useEffect(() => {
    if (!open || step !== 'content' || !platform || !channel) return
    setLoadingVideos(true)
    const params = new URLSearchParams({
      platform,
      channels: channel.channel_id,
      limit: '80',
    })
    fetch(`/api/dashboard/videos?${params}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data: DBVideo[]) => {
        const list = Array.isArray(data) ? data : []
        list.sort((a, b) => Number(b.vs_avg ?? 0) - Number(a.vs_avg ?? 0))
        setVideos(list)
      })
      .catch(() => {
        setVideos([])
        addToast('콘텐츠 목록을 불러오지 못했습니다', 'warning')
      })
      .finally(() => setLoadingVideos(false))
  }, [open, step, platform, channel, addToast])

  const categoryById = useMemo(
    () => new Map(categories.map((c) => [c.id, c])),
    [categories],
  )

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { '': channels.length, [UNCategorized]: 0 }
    for (const cat of categories) counts[cat.id] = 0
    for (const ch of channels) {
      const tid = ch.category_id ?? UNCategorized
      counts[tid] = (counts[tid] ?? 0) + 1
    }
    return counts
  }, [channels, categories])

  const categoryScopedChannels = useMemo(() => {
    if (!selectedCategoryId) return channels
    if (selectedCategoryId === UNCategorized) {
      return channels.filter((c) => !c.category_id)
    }
    return channels.filter((c) => c.category_id === selectedCategoryId)
  }, [channels, selectedCategoryId])

  const filteredChannels = useMemo(() => {
    const searchTerms = parseChannelSearchQuery(channelSearch)
    if (searchTerms.length === 0) return categoryScopedChannels

    const matchedIds = matchChannelsBySearchQuery(
      categoryScopedChannels.map((c) => ({
        channel_id: c.channel_id,
        channel_name: c.channel_name,
        category_id: c.category_id,
      })),
      channelSearch,
    )
    return categoryScopedChannels.filter((c) => matchedIds.has(c.channel_id))
  }, [categoryScopedChannels, channelSearch])

  const filteredVideos = useMemo(() => {
    const q = contentSearch.trim().toLowerCase()
    if (!q) return videos
    return videos.filter((v) => v.title.toLowerCase().includes(q))
  }, [videos, contentSearch])

  function pickPlatform(id: GuidePlatformId) {
    setPlatform(id)
    setSelectedCategoryId('')
    setChannelSearch('')
    setStep('channel')
  }

  function pickChannel(ch: DBChannel) {
    setChannel(ch)
    setStep('content')
  }

  function pickVideo(v: DBVideo, index: number) {
    onSelect(dbVideoToGuideReference(v, index))
    onClose()
  }

  if (!open) return null

  const stepLabels: Record<Step, string> = {
    platform: '플랫폼 선택',
    channel: '채널 선택',
    content: '콘텐츠 선택',
  }

  const hasChannelSearch = parseChannelSearchQuery(channelSearch).length > 0

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col border border-gray-100 dark:border-gray-700"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700 shrink-0">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-base font-bold text-gray-900 dark:text-white">레퍼런스 추가</h3>
              <p className="text-xs text-gray-500 mt-0.5">{stepLabels[step]}</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-xl leading-none"
            >
              ×
            </button>
          </div>

          {/* 스텝 인디케이터 */}
          <div className="flex items-center gap-1 mt-3">
            {(['platform', 'channel', 'content'] as Step[]).map((s, i) => {
              const active = step === s
              const done =
                (s === 'platform' && platform) ||
                (s === 'channel' && channel) ||
                (s === 'content' && false)
              return (
                <div key={s} className="flex items-center gap-1 flex-1">
                  <div
                    className={`h-1 flex-1 rounded-full transition ${
                      active ? 'bg-violet-500' : done ? 'bg-violet-300 dark:bg-violet-700' : 'bg-gray-200 dark:bg-gray-700'
                    }`}
                  />
                  {i < 2 && <span className="text-gray-300 dark:text-gray-600 text-[10px]">›</span>}
                </div>
              )
            })}
          </div>
        </div>

        {/* 본문 */}
        <div className="flex-1 overflow-y-auto p-5 min-h-0">
          {/* Step 1: 플랫폼 */}
          {step === 'platform' && (
            <div className="grid gap-2">
              {GUIDE_PLATFORMS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => pickPlatform(p.id)}
                  className="flex items-center gap-3 w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-600 hover:border-violet-400 hover:bg-violet-50 dark:hover:bg-violet-950/30 transition text-left"
                >
                  <span className="text-2xl">{p.icon}</span>
                  <span className="text-sm font-semibold text-gray-900 dark:text-white">{p.label}</span>
                </button>
              ))}
            </div>
          )}

          {/* Step 2: 채널 */}
          {step === 'channel' && platform && (
            <div className="space-y-3">
              {/* 카테고리 필터 */}
              {!loadingChannels && channels.length > 0 && (
                <div className="space-y-2">
                  <p className="text-[11px] font-semibold text-gray-500 dark:text-gray-400">카테고리</p>
                  <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                    <button
                      type="button"
                      onClick={() => setSelectedCategoryId('')}
                      className={`shrink-0 px-2.5 py-1 rounded-lg text-[11px] font-semibold transition ${
                        !selectedCategoryId
                          ? 'bg-violet-600 text-white'
                          : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-600 hover:border-violet-300'
                      }`}
                    >
                      전체 ({categoryCounts[''] ?? 0})
                    </button>
                    {categories.map((cat) => {
                      const count = categoryCounts[cat.id] ?? 0
                      if (count === 0) return null
                      const active = selectedCategoryId === cat.id
                      return (
                        <button
                          key={cat.id}
                          type="button"
                          onClick={() => setSelectedCategoryId(active ? '' : cat.id)}
                          className={`shrink-0 px-2.5 py-1 rounded-lg text-[11px] font-semibold transition whitespace-nowrap ${
                            active
                              ? 'text-white shadow-sm'
                              : 'text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-gray-600 hover:border-violet-300'
                          }`}
                          style={
                            active
                              ? { backgroundColor: cat.bg_color, borderColor: cat.bg_color }
                              : { backgroundColor: `${cat.bg_color}30`, borderColor: `${cat.bg_color}80` }
                          }
                        >
                          {cat.icon} {cat.name} ({count})
                        </button>
                      )
                    })}
                    {(categoryCounts[UNCategorized] ?? 0) > 0 && (
                      <button
                        type="button"
                        onClick={() =>
                          setSelectedCategoryId(selectedCategoryId === UNCategorized ? '' : UNCategorized)
                        }
                        className={`shrink-0 px-2.5 py-1 rounded-lg text-[11px] font-semibold border border-dashed transition whitespace-nowrap ${
                          selectedCategoryId === UNCategorized
                            ? 'bg-gray-700 text-white border-gray-600 dark:bg-gray-500'
                            : 'bg-gray-50 text-gray-600 border-gray-300 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-600'
                        }`}
                      >
                        미분류 ({categoryCounts[UNCategorized]})
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* 채널 검색 */}
              <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50/80 dark:bg-gray-800/50 p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <label htmlFor="guide-ref-channel-search" className="text-[11px] font-semibold text-gray-600 dark:text-gray-300 shrink-0">
                    채널 검색
                  </label>
                  {(hasChannelSearch || selectedCategoryId) && (
                    <button
                      type="button"
                      onClick={() => {
                        setChannelSearch('')
                        setSelectedCategoryId('')
                      }}
                      className="ml-auto text-[10px] px-2 py-0.5 rounded-md border border-gray-200 dark:border-gray-600 text-gray-500 hover:bg-white dark:hover:bg-gray-700"
                    >
                      필터 초기화
                    </button>
                  )}
                </div>
                <input
                  id="guide-ref-channel-search"
                  type="text"
                  value={channelSearch}
                  onChange={(e) => setChannelSearch(e.target.value)}
                  placeholder="채널명·ID 검색 (쉼표로 OR, 예: 김작가, stronger)"
                  className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-400"
                />
                {!loadingChannels && (
                  <p className="text-[10px] text-gray-400">
                    {filteredChannels.length}개 표시
                    {selectedCategoryId && categoryById.get(selectedCategoryId)
                      ? ` · ${categoryById.get(selectedCategoryId)!.icon} ${categoryById.get(selectedCategoryId)!.name}`
                      : selectedCategoryId === UNCategorized
                        ? ' · 미분류'
                        : ''}
                    {hasChannelSearch ? ` · 검색: ${parseChannelSearchQuery(channelSearch).join(', ')}` : ''}
                  </p>
                )}
              </div>

              {loadingChannels ? (
                <div className="py-12 flex justify-center">
                  <Spinner size="md" />
                </div>
              ) : filteredChannels.length === 0 ? (
                <div className="py-10 text-center text-sm text-gray-500">
                  {channels.length === 0
                    ? `${getPlatformName(platform)} 채널이 없습니다. «채널·콘텐츠 등록»에서 먼저 등록하세요.`
                    : '카테고리·검색 조건에 맞는 채널이 없습니다.'}
                </div>
              ) : (
                <ul className="space-y-1.5 max-h-[300px] overflow-y-auto">
                  {filteredChannels.map((ch) => {
                    const cat = ch.category_id ? categoryById.get(ch.category_id) : null
                    return (
                      <li key={ch.channel_id}>
                        <button
                          type="button"
                          onClick={() => pickChannel(ch)}
                          className="w-full text-left px-3 py-2.5 rounded-xl border border-gray-100 dark:border-gray-700 hover:border-violet-300 hover:bg-violet-50/50 dark:hover:bg-violet-950/20 transition"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-sm font-medium text-gray-900 dark:text-white truncate flex-1">
                              {ch.channel_name}
                            </p>
                            {cat ? (
                              <span
                                className="shrink-0 text-[10px] px-1.5 py-0.5 rounded font-semibold text-white"
                                style={{ backgroundColor: cat.bg_color }}
                              >
                                {cat.icon} {cat.name}
                              </span>
                            ) : (
                              <span className="shrink-0 text-[10px] px-1.5 py-0.5 rounded border border-dashed border-gray-300 text-gray-400">
                                미분류
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-gray-400 mt-0.5 truncate">{ch.channel_id}</p>
                          {(ch.subscribers != null || ch.video_count != null) && (
                            <p className="text-[10px] text-gray-400 mt-1">
                              {ch.subscribers != null && `구독 ${formatViews(ch.subscribers)}`}
                              {ch.subscribers != null && ch.video_count != null && ' · '}
                              {ch.video_count != null && `영상 ${ch.video_count}개`}
                            </p>
                          )}
                        </button>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          )}

          {/* Step 3: 콘텐츠 */}
          {step === 'content' && channel && (
            <div className="space-y-3">
              <div className="rounded-lg bg-gray-50 dark:bg-gray-800 px-3 py-2 text-xs text-gray-600 dark:text-gray-400">
                <span className="font-medium text-gray-800 dark:text-gray-200">{channel.channel_name}</span>
                <span className="mx-1">·</span>
                {getPlatformName(platform!)}
              </div>
              <input
                type="text"
                value={contentSearch}
                onChange={(e) => setContentSearch(e.target.value)}
                placeholder="제목 검색…"
                className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-400"
              />
              {loadingVideos ? (
                <div className="py-12 flex justify-center">
                  <Spinner size="md" />
                </div>
              ) : filteredVideos.length === 0 ? (
                <div className="py-10 text-center text-sm text-gray-500">
                  {videos.length === 0
                    ? '수집된 콘텐츠가 없습니다. 데이터 수집을 먼저 실행하세요.'
                    : '검색 결과가 없습니다.'}
                </div>
              ) : (
                <ul className="space-y-1.5 max-h-[320px] overflow-y-auto">
                  {filteredVideos.map((v, i) => (
                      <li key={v.video_id}>
                        <button
                          type="button"
                          onClick={() => pickVideo(v, i)}
                          className="w-full text-left px-3 py-2.5 rounded-xl border border-gray-100 dark:border-gray-700 hover:border-violet-300 hover:bg-violet-50/50 dark:hover:bg-violet-950/20 transition"
                        >
                          <div className="flex items-start gap-2">
                            {v.tier && (
                              <span className={`shrink-0 px-1.5 py-0.5 text-[10px] font-bold rounded ${getTierColor(v.tier)}`}>
                                {v.tier}
                              </span>
                            )}
                            <p className="text-sm font-medium text-gray-900 dark:text-white line-clamp-2 flex-1">{v.title}</p>
                          </div>
                          <div className="flex flex-wrap gap-2 mt-1.5 text-[11px] text-gray-500">
                            <span>{formatViews(v.views ?? 0)} 조회</span>
                            {v.vs_avg != null && (
                              <span className={`font-semibold ${getVsAvgColor(Number(v.vs_avg))}`}>
                                vs.Avg {Number(v.vs_avg).toFixed(1)}x
                              </span>
                            )}
                            {v.published_at && <span>{v.published_at.split('T')[0]}</span>}
                          </div>
                        </button>
                      </li>
                    ))}
                </ul>
              )}
            </div>
          )}
        </div>

        {/* 푸터 */}
        <div className="px-5 py-3 border-t border-gray-100 dark:border-gray-700 flex gap-2 shrink-0">
          {step !== 'platform' && (
            <button
              type="button"
              onClick={() => {
                if (step === 'content') setStep('channel')
                else if (step === 'channel') {
                  setStep('platform')
                  setPlatform(null)
                  setChannel(null)
                  setVideos([])
                  setSelectedCategoryId('')
                  setChannelSearch('')
                }
              }}
              className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition"
            >
              ← 이전
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="ml-auto px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition"
          >
            취소
          </button>
        </div>
      </div>
    </div>
  )
}
