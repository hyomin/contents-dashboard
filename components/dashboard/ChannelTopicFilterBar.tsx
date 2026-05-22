'use client'

import { useMemo } from 'react'
import { getCategoryStyle, type Category } from '@/lib/dashboard/categories'
import type { Video } from '@/lib/dashboard/dashboard-types'

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
  selectedChannelId: string
  onTopicChange: (topicId: string) => void
  onChannelChange: (channelId: string) => void
}

export function ChannelTopicFilterBar({
  videos,
  categories,
  channels,
  selectedTopicId,
  selectedChannelId,
  onTopicChange,
  onChannelChange,
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

  const visibleChannels = useMemo(() => {
    let list = channels.filter((c) => videos.some((v) => v.channelId === c.channel_id))
    if (selectedTopicId) {
      if (selectedTopicId === '__uncategorized') {
        list = list.filter((c) => !c.category_id)
      } else {
        list = list.filter((c) => c.category_id === selectedTopicId)
      }
    }
    return list.sort((a, b) => a.channel_name.localeCompare(b.channel_name, 'ko'))
  }, [channels, videos, selectedTopicId])

  const channelVideoCount = (channelId: string) =>
    videos.filter((v) => v.channelId === channelId).length

  const topicFilteredCount = selectedTopicId
    ? videos.filter((v) => {
        const ch = channels.find((c) => c.channel_id === v.channelId)
        if (selectedTopicId === '__uncategorized') return !ch?.category_id
        return ch?.category_id === selectedTopicId
      }).length
    : videos.length

  return (
    <div className="space-y-3">
      <div className="flex items-start gap-3 flex-wrap">
        <span className="text-sm text-gray-500 font-medium pt-1.5 shrink-0">카테고리:</span>
        <button
          type="button"
          onClick={() => {
            onTopicChange('')
            onChannelChange('')
          }}
          className={`px-3 py-1.5 text-sm rounded-xl font-medium transition ${
            !selectedTopicId ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          전체 ({topicCounts[''] ?? 0})
        </button>
        {categories.map((cat) => {
          const count = topicCounts[cat.id] ?? 0
          if (count === 0 && selectedTopicId !== cat.id) return null
          const style = getCategoryStyle(toCategoryStyle(cat))
          const active = selectedTopicId === cat.id
          return (
            <button
              key={cat.id}
              type="button"
              onClick={() => {
                onTopicChange(active ? '' : cat.id)
                onChannelChange('')
              }}
              className="px-3 py-1.5 text-sm rounded-xl font-medium transition border"
              style={
                active
                  ? { background: style.background, color: style.color, borderColor: style.border }
                  : { background: `${cat.bg_color}22`, color: '#374151', borderColor: `${cat.bg_color}55` }
              }
            >
              {cat.icon} {cat.name} ({count})
            </button>
          )
        })}
        {(topicCounts['__uncategorized'] ?? 0) > 0 && (
          <button
            type="button"
            onClick={() => {
              onTopicChange(selectedTopicId === '__uncategorized' ? '' : '__uncategorized')
              onChannelChange('')
            }}
            className={`px-3 py-1.5 text-sm rounded-xl font-medium border border-dashed transition ${
              selectedTopicId === '__uncategorized'
                ? 'bg-gray-700 text-white border-gray-700'
                : 'bg-white text-gray-500 border-gray-300'
            }`}
          >
            미분류 ({topicCounts['__uncategorized']})
          </button>
        )}
      </div>

      <div className="flex items-start gap-3 flex-wrap">
        <span className="text-sm text-gray-500 font-medium pt-1.5 shrink-0">채널 필터:</span>
        <button
          type="button"
          onClick={() => onChannelChange('')}
          className={`px-3 py-1.5 text-sm rounded-xl font-medium transition ${
            !selectedChannelId ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          전체 ({topicFilteredCount})
        </button>
        {visibleChannels.map((ch) => {
          const count = channelVideoCount(ch.channel_id)
          if (count === 0) return null
          const active = selectedChannelId === ch.channel_id
          return (
            <button
              key={ch.channel_id}
              type="button"
              onClick={() => onChannelChange(active ? '' : ch.channel_id)}
              className={`px-3 py-1.5 text-sm rounded-xl font-medium transition border max-w-[12rem] truncate ${
                active
                  ? 'bg-gray-900 text-white border-gray-900'
                  : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
              }`}
              title={ch.channel_name}
            >
              {ch.channel_name} ({count})
            </button>
          )
        })}
      </div>
    </div>
  )
}

export function filterVideosByTopicAndChannel(
  videos: Video[],
  channels: ChannelWithCategory[],
  selectedTopicId: string,
  selectedChannelId: string,
): Video[] {
  return videos.filter((v) => {
    if (selectedChannelId && v.channelId !== selectedChannelId) return false
    if (!selectedTopicId) return true
    const ch = channels.find((c) => c.channel_id === v.channelId)
    if (selectedTopicId === '__uncategorized') return !ch?.category_id
    return ch?.category_id === selectedTopicId
  })
}
