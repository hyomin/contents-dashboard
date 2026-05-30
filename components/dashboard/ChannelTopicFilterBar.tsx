'use client'

import { useMemo } from 'react'
import { getCategoryStyle, type Category } from '@/lib/dashboard/categories'
import type { Video } from '@/lib/dashboard/dashboard-types'
import {
  buildChannelSearchStats,
  matchChannelsBySearchQuery,
  parseChannelSearchQuery,
} from '@/lib/dashboard/channel-search'

export interface ChannelCategoryDto {
  id: string
  name: string
  icon: string
  bg_color: string
  text_color: string
}

export interface ChannelWithCategory {
  channel_id: string
  channel_name: string
  category_id: string | null
}

function toCategoryStyle(cat: ChannelCategoryDto): Category {
  return {
    id: cat.id,
    name: cat.name,
    bgColor: cat.bg_color,
    textColor: cat.text_color as Category['textColor'],
    createdAt: '',
  }
}

interface ChannelTopicFilterBarProps {
  videos: Video[]
  categories: ChannelCategoryDto[]
  channels: ChannelWithCategory[]
  selectedTopicId: string
  channelSearchQuery: string
  onTopicChange: (topicId: string) => void
  onChannelSearchChange: (query: string) => void
}

export function ChannelTopicFilterBar({
  videos,
  categories,
  channels,
  selectedTopicId,
  channelSearchQuery,
  onTopicChange,
  onChannelSearchChange,
}: ChannelTopicFilterBarProps) {
  const topicCounts = useMemo(() => {
    const counts: Record<string, number> = { '': videos.length }
    for (const cat of categories) counts[cat.id] = 0
    counts['__uncategorized'] = 0
    for (const v of videos) {
      const ch = channels.find((c) => c.channel_id === v.channelId)
      const tid = ch?.category_id ?? '__uncategorized'
      counts[tid] = (counts[tid] ?? 0) + 1
    }
    return counts
  }, [videos, categories, channels])

  const channelsWithVideos = useMemo(
    () => channels.filter((c) => videos.some((v) => v.channelId === c.channel_id)),
    [channels, videos],
  )

  const topicScopedChannels = useMemo(() => {
    if (!selectedTopicId) return channelsWithVideos
    if (selectedTopicId === '__uncategorized') {
      return channelsWithVideos.filter((c) => !c.category_id)
    }
    return channelsWithVideos.filter((c) => c.category_id === selectedTopicId)
  }, [channelsWithVideos, selectedTopicId])

  const searchTerms = parseChannelSearchQuery(channelSearchQuery)
  const hasSearch = searchTerms.length > 0

  const matchedChannelIds = useMemo(
    () => matchChannelsBySearchQuery(topicScopedChannels, channelSearchQuery),
    [topicScopedChannels, channelSearchQuery],
  )

  const searchStats = useMemo(
    () => buildChannelSearchStats(topicScopedChannels, videos, channelSearchQuery),
    [topicScopedChannels, videos, channelSearchQuery],
  )

  const topicFilteredCount = selectedTopicId
    ? videos.filter((v) => {
        const ch = channels.find((c) => c.channel_id === v.channelId)
        if (selectedTopicId === '__uncategorized') return !ch?.category_id
        return ch?.category_id === selectedTopicId
      }).length
    : videos.length

  const filteredVideoCount = useMemo(() => {
    let list = videos
    if (selectedTopicId) {
      list = list.filter((v) => {
        const ch = channels.find((c) => c.channel_id === v.channelId)
        if (selectedTopicId === '__uncategorized') return !ch?.category_id
        return ch?.category_id === selectedTopicId
      })
    }
    if (hasSearch) {
      list = list.filter((v) => v.channelId && matchedChannelIds.has(v.channelId))
    }
    return list.length
  }, [videos, channels, selectedTopicId, hasSearch, matchedChannelIds])

  return (
    <div className="space-y-3">
      <div className="flex items-start gap-3 flex-wrap">
        <span className="text-sm text-gray-600 dark:text-gray-300 font-medium pt-1.5 shrink-0">카테고리:</span>
        <button
          type="button"
          onClick={() => onTopicChange('')}
          className={`px-3 py-1.5 text-sm rounded-xl font-medium transition border ${
            !selectedTopicId
              ? 'bg-gray-900 text-white border-gray-900 dark:bg-white dark:text-gray-900 dark:border-white'
              : 'bg-gray-100 text-gray-800 border-gray-200 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-100 dark:border-gray-600 dark:hover:bg-gray-600'
          }`}
        >
          전체 ({topicCounts[''] ?? 0})
        </button>
        {categories.map((cat) => {
          const count = topicCounts[cat.id] ?? 0
          const style = getCategoryStyle(toCategoryStyle(cat))
          const active = selectedTopicId === cat.id
          return (
            <button
              key={cat.id}
              type="button"
              onClick={() => onTopicChange(active ? '' : cat.id)}
              className={`px-3 py-1.5 text-sm rounded-xl font-medium transition border ${
                active
                  ? 'shadow-sm'
                  : 'text-gray-800 dark:text-gray-100 hover:opacity-90'
              }`}
              style={
                active
                  ? { background: style.background, color: style.color, borderColor: style.border }
                  : {
                      background: `${cat.bg_color}40`,
                      borderColor: `${cat.bg_color}99`,
                    }
              }
            >
              {cat.icon} {cat.name} ({count})
            </button>
          )
        })}
        {(topicCounts['__uncategorized'] ?? 0) > 0 && (
          <button
            type="button"
            onClick={() => onTopicChange(selectedTopicId === '__uncategorized' ? '' : '__uncategorized')}
            className={`px-3 py-1.5 text-sm rounded-xl font-medium border border-dashed transition ${
              selectedTopicId === '__uncategorized'
                ? 'bg-gray-700 text-white border-gray-600 dark:bg-gray-500 dark:border-gray-400'
                : 'bg-gray-50 text-gray-700 border-gray-300 dark:bg-gray-700 dark:text-gray-200 dark:border-gray-500'
            }`}
          >
            미분류 ({topicCounts['__uncategorized']})
          </button>
        )}
      </div>

      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/50 p-4 space-y-2">
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
          <label htmlFor="channel-search" className="text-sm text-gray-600 dark:text-gray-300 font-medium shrink-0">
            채널 검색:
          </label>
          <input
            id="channel-search"
            type="text"
            value={channelSearchQuery}
            onChange={(e) => onChannelSearchChange(e.target.value)}
            placeholder="예: 트레, 슈카 (쉼표로 여러 채널 검색 · 부분 일치)"
            className="flex-1 min-w-0 px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
          />
          {hasSearch && (
            <button
              type="button"
              onClick={() => onChannelSearchChange('')}
              className="text-xs px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-700 shrink-0"
            >
              초기화
            </button>
          )}
        </div>
        <p className="text-[11px] text-gray-500 dark:text-gray-400">
          DB 등록 채널 {topicScopedChannels.length}개 중 검색 · «트»만 입력해도 «트레블 튜브» 등 부분 일치 · «트레, 슈카»는 OR 검색
        </p>

        {hasSearch && (
          <div className="pt-2 border-t border-gray-100 dark:border-gray-700">
            {matchedChannelIds.size === 0 ? (
              <p className="text-xs text-amber-600 dark:text-amber-400">
                «{searchTerms.join('», «')}»에 맞는 채널이 없습니다.
              </p>
            ) : (
              <>
                <p className="text-xs text-gray-600 dark:text-gray-300 mb-2">
                  검색 결과 {filteredVideoCount}개 콘텐츠 · 매칭 채널 {matchedChannelIds.size}개
                  {selectedTopicId ? ` (카테고리 필터 적용 · 전체 ${topicFilteredCount}개)` : ''}
                </p>
                <div className="flex flex-wrap gap-2">
                  {searchStats.map((s) => (
                    <span
                      key={s.channelId}
                      className="inline-flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-full bg-blue-50 text-blue-800 dark:bg-blue-950/40 dark:text-blue-300 border border-blue-100 dark:border-blue-900"
                      title={`검색어: ${s.matchedTerm}`}
                    >
                      <span className="font-medium truncate max-w-[10rem]">{s.channelName}</span>
                      <span className="text-blue-600/80 dark:text-blue-400/80">{s.videoCount}개</span>
                    </span>
                  ))}
                  {searchStats.length === 0 && matchedChannelIds.size > 0 && (
                    <span className="text-xs text-gray-400">
                      매칭 채널은 있으나 현재 목록에 영상이 없습니다.
                    </span>
                  )}
                </div>
              </>
            )}
          </div>
        )}

        {!hasSearch && (
          <p className="text-xs text-gray-500 dark:text-gray-400">
            전체 {topicFilteredCount}개 콘텐츠 · 채널 {topicScopedChannels.length}개
          </p>
        )}
      </div>
    </div>
  )
}

export function filterVideosByTopicAndChannel(
  videos: Video[],
  channels: ChannelWithCategory[],
  selectedTopicId: string,
  channelSearchQuery: string,
): Video[] {
  const searchTerms = parseChannelSearchQuery(channelSearchQuery)
  const matchedIds =
    searchTerms.length > 0 ? matchChannelsBySearchQuery(channels, channelSearchQuery) : null

  return videos.filter((v) => {
    if (matchedIds && v.channelId && !matchedIds.has(v.channelId)) return false
    if (!selectedTopicId) return true
    const ch = channels.find((c) => c.channel_id === v.channelId)
    if (selectedTopicId === '__uncategorized') return !ch?.category_id
    return ch?.category_id === selectedTopicId
  })
}
