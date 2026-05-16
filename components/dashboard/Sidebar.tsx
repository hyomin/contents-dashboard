'use client'

import { useState } from 'react'
import { useSearchParams, useRouter, usePathname } from 'next/navigation'

interface TreeItem {
  id: string
  label: string
  icon: string
  children?: TreeItem[]
  badge?: number | string
  badgeColor?: string
}

const NAV_TREE: TreeItem[] = [
  {
    id: 'overview',
    label: '전체 개요',
    icon: '🏠',
  },
  {
    id: 'analysis',
    label: '콘텐츠 분석',
    icon: '📊',
    children: [
      {
        id: 'youtube',
        label: 'YouTube',
        icon: '🔴',
        badge: 7,
        children: [
          { id: 'youtube-shorts', label: 'Shorts', icon: '⚡' },
          { id: 'youtube-longform', label: '롱폼', icon: '🎬' },
        ],
      },
      {
        id: 'instagram',
        label: 'Instagram',
        icon: '💗',
        badge: 1,
        children: [
          { id: 'instagram-reels', label: 'Reels', icon: '🎵' },
          { id: 'instagram-carousel', label: '캐러셀', icon: '🖼️' },
        ],
      },
      { id: 'naver-blog', label: '네이버 블로그', icon: '🟢', badge: 1 },
      { id: 'tistory',    label: '티스토리',     icon: '🟠', badge: 1 },
    ],
  },
  {
    id: 'insights',
    label: '기획 / 인사이트',
    icon: '💡',
    children: [
      { id: 'trending',      label: '트렌딩 키워드',  icon: '🔥' },
      { id: 'outlier',       label: 'Outlier 분석',   icon: '🚀' },
      { id: 'ai-insight',    label: 'AI 인사이트',    icon: '🤖' },
      { id: 'benchmark',     label: '벤치마킹 저장함', icon: '📌', badge: 5, badgeColor: 'bg-yellow-100 text-yellow-700' },
      { id: 'topic-suggest', label: '주제 선별 AI',   icon: '🎯', badge: 'NEW', badgeColor: 'bg-green-100 text-green-700' },
    ],
  },
  {
    id: 'channels',
    label: '채널 관리',
    icon: '📡',
    children: [
      { id: 'channels-competitor', label: '경쟁 채널 목록', icon: '🏢' },
      { id: 'channels-mine',       label: '내 채널',         icon: '📺' },
    ],
  },
  {
    id: 'calendar',
    label: '콘텐츠 캘린더',
    icon: '🗓️',
    badge: '3건',
    badgeColor: 'bg-blue-100 text-blue-700',
  },
  {
    id: 'pipeline',
    label: '파이프라인',
    icon: '⚙️',
    children: [
      { id: 'repurpose',     label: 'Repurposing',  icon: '🔄' },
      { id: 'deploy',        label: '배포 자동화',   icon: '📤' },
      { id: 'data-collect',  label: '데이터 수집',   icon: '🤖', badge: '●', badgeColor: 'bg-green-100 text-green-600' },
    ],
  },
  {
    id: 'revenue',
    label: '수익 추적',
    icon: '💰',
  },
]

function TreeNode({
  item, depth = 0, activeId, onSelect,
}: {
  item: TreeItem; depth?: number; activeId: string; onSelect: (id: string) => void
}) {
  const [isOpen, setIsOpen] = useState(
    depth === 0 || ['analysis', 'insights', 'pipeline'].includes(item.id)
  )
  const hasChildren = !!item.children?.length
  const isActive = activeId === item.id

  return (
    <div>
      <button
        onClick={() => {
          if (hasChildren) setIsOpen(p => !p)
          onSelect(item.id)
        }}
        style={{ paddingLeft: `${12 + depth * 16}px` }}
        className={`w-full flex items-center gap-2 pr-3 py-2 rounded-lg text-sm transition
          ${isActive
            ? 'bg-blue-600 text-white font-semibold shadow-sm'
            : depth === 0
              ? 'text-gray-700 dark:text-gray-200 font-semibold hover:bg-gray-100 dark:hover:bg-gray-700'
              : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
          }`}
      >
        <span className="text-base leading-none shrink-0">{item.icon}</span>
        <span className="flex-1 text-left truncate">{item.label}</span>
        {item.badge !== undefined && !isActive && (
          <span className={`text-xs px-1.5 py-0.5 rounded-full ${item.badgeColor ?? 'bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-300'}`}>
            {item.badge}
          </span>
        )}
        {hasChildren && (
          <span className={`text-xs transition-transform shrink-0 ${isOpen ? 'rotate-90' : ''} ${isActive ? 'text-white/70' : 'text-gray-300'}`}>▶</span>
        )}
      </button>
      {hasChildren && isOpen && (
        <div className="mt-0.5">
          {item.children!.map(child => (
            <TreeNode key={child.id} item={child} depth={depth + 1} activeId={activeId} onSelect={onSelect} />
          ))}
        </div>
      )}
    </div>
  )
}

export default function Sidebar() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
  const activeId = searchParams.get('view') ?? 'overview'

  const handleSelect = (id: string) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set('view', id)
    router.push(`${pathname}?${params.toString()}`)
  }

  return (
    <aside className="w-56 shrink-0 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col">
      <div className="px-5 py-5 border-b border-gray-100 dark:border-gray-700">
        <h1 className="text-base font-black text-gray-900 dark:text-white">📊 Contents</h1>
        <p className="text-xs text-gray-400 mt-0.5">Dashboard · 더미 데이터</p>
      </div>
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-0.5">
        {NAV_TREE.map(item => (
          <TreeNode key={item.id} item={item} activeId={activeId} onSelect={handleSelect} />
        ))}
      </nav>
      <div className="px-4 py-3 border-t border-gray-100 dark:border-gray-700">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
          <span className="text-xs text-gray-400">더미 데이터 모드</span>
        </div>
      </div>
    </aside>
  )
}
