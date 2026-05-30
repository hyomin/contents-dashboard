'use client'

import { useState } from 'react'
import { useSearchParams, useRouter, usePathname } from 'next/navigation'
import { useTheme } from '@/lib/theme'
import { NAV_TREE, getNavDataBadge, isNavExpandOnly, type DashboardNavItem } from '@/lib/dashboard/dashboard-nav'

// ────────────────────────────────────────────────────────────
// 대분류별 컬러 테마 정의
// ────────────────────────────────────────────────────────────
interface GroupStyle {
  /** 헤더 열림 상태 배경 */
  openBg: string
  /** 헤더 닫힘 hover 배경 */
  hoverBg: string
  /** 헤더 왼쪽 컬러 스트라이프 */
  stripe: string
  /** 자식 영역 왼쪽 구분선 */
  childBorder: string
  /** 하위 아이템 활성 배경 */
  activeBg: string
  /** 헤더 텍스트 색 (열림) */
  openText: string
  /** 아이콘 배경 */
  iconBg: string
}

const GROUP_STYLES: Record<string, GroupStyle> = {
  overview: {
    openBg: 'bg-slate-100 dark:bg-slate-700/40',
    hoverBg: 'hover:bg-slate-50 dark:hover:bg-slate-700/20',
    stripe: 'bg-slate-500',
    childBorder: 'border-slate-200 dark:border-slate-600',
    activeBg: 'bg-slate-600 text-white',
    openText: 'text-slate-800 dark:text-slate-100',
    iconBg: 'bg-slate-100 dark:bg-slate-700',
  },
  n8n: {
    openBg: 'bg-purple-50 dark:bg-purple-900/25',
    hoverBg: 'hover:bg-purple-50/60 dark:hover:bg-purple-900/15',
    stripe: 'bg-purple-500',
    childBorder: 'border-purple-200 dark:border-purple-700',
    activeBg: 'bg-purple-600 text-white',
    openText: 'text-purple-900 dark:text-purple-100',
    iconBg: 'bg-purple-100 dark:bg-purple-800/50',
  },
  create: {
    openBg: 'bg-emerald-50 dark:bg-emerald-900/25',
    hoverBg: 'hover:bg-emerald-50/60 dark:hover:bg-emerald-900/15',
    stripe: 'bg-emerald-500',
    childBorder: 'border-emerald-200 dark:border-emerald-700',
    activeBg: 'bg-emerald-600 text-white',
    openText: 'text-emerald-900 dark:text-emerald-100',
    iconBg: 'bg-emerald-100 dark:bg-emerald-800/50',
  },
  analysis: {
    openBg: 'bg-blue-50 dark:bg-blue-900/25',
    hoverBg: 'hover:bg-blue-50/60 dark:hover:bg-blue-900/15',
    stripe: 'bg-blue-500',
    childBorder: 'border-blue-200 dark:border-blue-700',
    activeBg: 'bg-blue-600 text-white',
    openText: 'text-blue-900 dark:text-blue-100',
    iconBg: 'bg-blue-100 dark:bg-blue-800/50',
  },
  insights: {
    openBg: 'bg-amber-50 dark:bg-amber-900/25',
    hoverBg: 'hover:bg-amber-50/60 dark:hover:bg-amber-900/15',
    stripe: 'bg-amber-500',
    childBorder: 'border-amber-200 dark:border-amber-700',
    activeBg: 'bg-amber-600 text-white',
    openText: 'text-amber-900 dark:text-amber-100',
    iconBg: 'bg-amber-100 dark:bg-amber-800/50',
  },
  'channel-register': {
    openBg: 'bg-teal-50 dark:bg-teal-900/25',
    hoverBg: 'hover:bg-teal-50/60 dark:hover:bg-teal-900/15',
    stripe: 'bg-teal-500',
    childBorder: 'border-teal-200 dark:border-teal-700',
    activeBg: 'bg-teal-600 text-white',
    openText: 'text-teal-900 dark:text-teal-100',
    iconBg: 'bg-teal-100 dark:bg-teal-800/50',
  },
  'my-channels': {
    openBg: 'bg-indigo-50 dark:bg-indigo-900/25',
    hoverBg: 'hover:bg-indigo-50/60 dark:hover:bg-indigo-900/15',
    stripe: 'bg-indigo-500',
    childBorder: 'border-indigo-200 dark:border-indigo-700',
    activeBg: 'bg-indigo-600 text-white',
    openText: 'text-indigo-900 dark:text-indigo-100',
    iconBg: 'bg-indigo-100 dark:bg-indigo-800/50',
  },
  pipeline: {
    openBg: 'bg-rose-50 dark:bg-rose-900/25',
    hoverBg: 'hover:bg-rose-50/60 dark:hover:bg-rose-900/15',
    stripe: 'bg-rose-500',
    childBorder: 'border-rose-200 dark:border-rose-700',
    activeBg: 'bg-rose-600 text-white',
    openText: 'text-rose-900 dark:text-rose-100',
    iconBg: 'bg-rose-100 dark:bg-rose-800/50',
  },
  revenue: {
    openBg: 'bg-yellow-50 dark:bg-yellow-900/25',
    hoverBg: 'hover:bg-yellow-50/60 dark:hover:bg-yellow-900/15',
    stripe: 'bg-yellow-500',
    childBorder: 'border-yellow-200 dark:border-yellow-700',
    activeBg: 'bg-yellow-600 text-white',
    openText: 'text-yellow-900 dark:text-yellow-100',
    iconBg: 'bg-yellow-100 dark:bg-yellow-800/50',
  },
}

const DEFAULT_STYLE: GroupStyle = GROUP_STYLES.overview

// ────────────────────────────────────────────────────────────
// 하위 메뉴 아이템 (depth ≥ 1)
// ────────────────────────────────────────────────────────────
function ChildNode({
  item,
  depth,
  activeId,
  groupStyle,
  onSelect,
}: {
  item: DashboardNavItem
  depth: number
  activeId: string
  groupStyle: GroupStyle
  onSelect: (id: string) => void
}) {
  const [isOpen, setIsOpen] = useState(true)
  const hasChildren = !!item.children?.length
  const isActive = activeId === item.id
  const dataBadge = getNavDataBadge(item.id)

  return (
    <div>
      <button
        onClick={() => {
          if (hasChildren) setIsOpen((p) => !p)
          if (!isNavExpandOnly(item.id)) onSelect(item.id)
        }}
        style={{ paddingLeft: `${8 + depth * 14}px` }}
        className={`w-full flex items-center gap-2 pr-2 py-1.5 rounded-md text-sm transition-all
          ${isActive
            ? `${groupStyle.activeBg} font-semibold shadow-sm`
            : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700/60'
          }`}
      >
        <span className="text-sm leading-none shrink-0">{item.icon}</span>
        <span className="flex-1 text-left min-w-0 flex items-center gap-1 flex-wrap">
          <span className="truncate">{item.label}</span>
          {dataBadge === 'dummy' && (
            <span className={`text-[9px] font-semibold ${isActive ? 'text-amber-100' : 'text-amber-600 dark:text-amber-400'}`}>
              (더미)
            </span>
          )}
          {dataBadge === 'partial' && (
            <span className={`text-[9px] ${isActive ? 'text-white/70' : 'text-slate-400'}`}>
              (일부)
            </span>
          )}
        </span>
        {item.badge !== undefined && !isActive && (
          <span className={`text-[10px] px-1.5 py-0.5 rounded-full shrink-0 ${item.badgeColor ?? 'bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-300'}`}>
            {item.badge}
          </span>
        )}
        {hasChildren && (
          <span className={`text-[10px] transition-transform shrink-0 ${isOpen ? 'rotate-90' : ''} ${isActive ? 'text-white/60' : 'text-gray-300'}`}>
            ▶
          </span>
        )}
      </button>

      {hasChildren && isOpen && (
        <div className={`mt-0.5 ml-3 pl-2 border-l-2 ${groupStyle.childBorder}`}>
          {item.children!.map((child) => (
            <ChildNode
              key={child.id}
              item={child}
              depth={0}
              activeId={activeId}
              groupStyle={groupStyle}
              onSelect={onSelect}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ────────────────────────────────────────────────────────────
// 대분류 아이템 (depth 0)
// ────────────────────────────────────────────────────────────
function TopLevelNode({
  item,
  activeId,
  onSelect,
}: {
  item: DashboardNavItem
  activeId: string
  onSelect: (id: string) => void
}) {
  const hasChildren = !!item.children?.length
  const isActive = activeId === item.id
  const gs = GROUP_STYLES[item.id] ?? DEFAULT_STYLE

  // 자식 중 하나가 활성인지 확인 (재귀)
  const isChildActive = (children?: DashboardNavItem[]): boolean => {
    if (!children) return false
    return children.some((c) => c.id === activeId || isChildActive(c.children))
  }
  const childActive = isChildActive(item.children)

  const [isOpen, setIsOpen] = useState(
    ['n8n', 'create', 'analysis', 'insights', 'channel-register', 'pipeline', 'my-channels'].includes(item.id)
  )

  if (!hasChildren) {
    // 단독 아이템 (overview, revenue 등)
    return (
      <button
        onClick={() => onSelect(item.id)}
        className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-semibold transition-all mb-0.5
          ${isActive
            ? `${gs.activeBg} shadow-sm`
            : `text-gray-700 dark:text-gray-200 ${gs.hoverBg}`
          }`}
      >
        <span className={`w-6 h-6 flex items-center justify-center rounded-md text-sm ${isActive ? 'bg-white/20' : gs.iconBg}`}>
          {item.icon}
        </span>
        <span className="flex-1 text-left">{item.label}</span>
        {item.badge !== undefined && !isActive && (
          <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${item.badgeColor ?? 'bg-gray-200 text-gray-600'}`}>
            {item.badge}
          </span>
        )}
      </button>
    )
  }

  return (
    <div className={`rounded-lg overflow-hidden mb-1 transition-all ${isOpen ? `ring-1 ring-inset ring-gray-200 dark:ring-gray-700` : ''}`}>
      {/* 대분류 헤더 */}
      <button
        onClick={() => {
          setIsOpen((p) => !p)
          if (!isNavExpandOnly(item.id)) onSelect(item.id)
        }}
        className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-sm font-bold transition-all relative
          ${isOpen
            ? `${gs.openBg} ${gs.openText}`
            : `text-gray-700 dark:text-gray-200 ${gs.hoverBg}`
          }`}
      >
        {/* 왼쪽 컬러 스트라이프 */}
        <span className={`absolute left-0 top-0 bottom-0 w-1 rounded-l-lg transition-all ${isOpen || childActive ? gs.stripe : 'bg-transparent'}`} />

        <span className={`w-6 h-6 flex items-center justify-center rounded-md text-sm shrink-0 transition-all ${isOpen ? gs.iconBg : 'bg-gray-100 dark:bg-gray-700'}`}>
          {item.icon}
        </span>
        <span className="flex-1 text-left truncate">{item.label}</span>
        {item.badge !== undefined && (
          <span className={`text-[10px] px-1.5 py-0.5 rounded-full shrink-0 ${item.badgeColor ?? 'bg-gray-200 text-gray-600'}`}>
            {item.badge}
          </span>
        )}
        <span className={`text-xs transition-transform duration-200 shrink-0 ${isOpen ? 'rotate-90' : ''} text-gray-400`}>
          ▶
        </span>
      </button>

      {/* 자식 영역 */}
      {isOpen && (
        <div className={`px-2 pb-2 pt-1 space-y-0.5 ${gs.openBg}`}>
          <div className={`pl-2 border-l-2 ${gs.childBorder} space-y-0.5`}>
            {item.children!.map((child) => (
              <ChildNode
                key={child.id}
                item={child}
                depth={0}
                activeId={activeId}
                groupStyle={gs}
                onSelect={onSelect}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ────────────────────────────────────────────────────────────
// 메인 Sidebar
// ────────────────────────────────────────────────────────────
export default function Sidebar({ onClose }: { onClose?: () => void }) {
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
  const activeId = searchParams.get('view') ?? 'overview'

  const handleSelect = (id: string) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set('view', id)
    router.push(`${pathname}?${params.toString()}`)
    onClose?.()
  }

  return (
    <aside className="w-60 h-full bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col">
      {/* 로고 영역 */}
      <div className="px-4 py-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-base font-black text-gray-900 dark:text-white tracking-tight">📊 Contents</h1>
          <p className="text-[11px] text-gray-400 mt-0.5">Dashboard</p>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="lg:hidden p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition"
            aria-label="사이드바 닫기"
          >
            ✕
          </button>
        )}
      </div>

      {/* 네비게이션 — 스크롤 영역 */}
      <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-0.5">
        {NAV_TREE.map((item) => (
          <TopLevelNode key={item.id} item={item} activeId={activeId} onSelect={handleSelect} />
        ))}
      </nav>

      {/* 하단 푸터 */}
      <div className="px-3 py-3 border-t border-gray-100 dark:border-gray-700 shrink-0">
        <ThemeToggle onSelect={handleSelect} activeId={activeId} />
      </div>
    </aside>
  )
}

// ────────────────────────────────────────────────────────────
// 테마 토글
// ────────────────────────────────────────────────────────────
function ThemeToggle({ onSelect, activeId }: { onSelect: (id: string) => void; activeId: string }) {
  const { theme, setTheme } = useTheme()

  const cycle = () => {
    const order = ['light', 'soft', 'dark', 'system'] as const
    const idx = order.indexOf(theme as (typeof order)[number])
    setTheme(order[(idx + 1) % order.length])
  }

  const icons: Record<string, string> = { light: '☀️', soft: '🌤️', dark: '🌙', system: '💻' }
  const labels: Record<string, string> = { light: 'Light', soft: 'Soft', dark: 'Dark', system: 'System' }

  return (
    <div className="flex items-center gap-1">
      <button
        onClick={cycle}
        title="테마 변경"
        className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 transition"
      >
        <span>{icons[theme]}</span>
        <span>{labels[theme]}</span>
      </button>
      <button
        onClick={() => onSelect('settings')}
        title="설정"
        className={`ml-auto p-1.5 rounded-lg text-xs transition
          ${activeId === 'settings'
            ? 'bg-blue-600 text-white'
            : 'text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
          }`}
      >
        ⚙️
      </button>
    </div>
  )
}
