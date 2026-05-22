'use client'

import { useState } from 'react'
import { useSearchParams, useRouter, usePathname } from 'next/navigation'
import { useTheme } from '@/lib/theme'
import { NAV_TREE, getNavDataBadge, isNavExpandOnly, type DashboardNavItem } from '@/lib/dashboard-nav'

function TreeNode({
  item, depth = 0, activeId, onSelect,
}: {
  item: DashboardNavItem; depth?: number; activeId: string; onSelect: (id: string) => void
}) {
  const [isOpen, setIsOpen] = useState(
    depth === 0 || ['n8n', 'create', 'analysis', 'insights', 'pipeline', 'my-channels'].includes(item.id)
  )
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
        <span className="flex-1 text-left min-w-0">
          <span className="flex flex-wrap items-baseline gap-x-1 gap-y-0">
            <span className="truncate">{item.label}</span>
            {dataBadge === 'dummy' && (
              <span
                className={`shrink-0 text-[10px] font-semibold tracking-tight ${
                  isActive
                    ? 'text-amber-100'
                    : 'text-amber-700 dark:text-amber-400'
                }`}
              >
                (더미)
              </span>
            )}
            {dataBadge === 'partial' && (
              <span
                className={`shrink-0 text-[10px] font-medium tracking-tight ${
                  isActive ? 'text-white/75' : 'text-slate-500 dark:text-slate-400'
                }`}
              >
                (일부 더미)
              </span>
            )}
          </span>
        </span>
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
    <aside className="w-56 h-full bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col">
      <div className="px-5 py-5 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
        <div>
          <h1 className="text-base font-black text-gray-900 dark:text-white">📊 Contents</h1>
          <p className="text-xs text-gray-400 mt-0.5">Dashboard · 더미 데이터</p>
        </div>
        {onClose && (
          <button onClick={onClose} className="lg:hidden p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition" aria-label="사이드바 닫기">
            ✕
          </button>
        )}
      </div>
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-0.5">
        {NAV_TREE.map(item => (
          <TreeNode key={item.id} item={item} activeId={activeId} onSelect={handleSelect} />
        ))}
      </nav>
      <div className="px-4 py-3 border-t border-gray-100 dark:border-gray-700 space-y-2">
        {/* 테마 토글 */}
        <ThemeToggle onSelect={handleSelect} activeId={activeId} />
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
          <span className="text-xs text-gray-400">더미 데이터 모드</span>
        </div>
      </div>
    </aside>
  )
}

function ThemeToggle({ onSelect, activeId }: { onSelect: (id: string) => void; activeId: string }) {
  const { theme, setTheme } = useTheme()

  const cycle = () => {
    const order = ['light', 'soft', 'dark', 'system'] as const
    const idx = order.indexOf(theme as (typeof order)[number])
    const next = order[(idx + 1) % order.length]
    setTheme(next)
  }

  const icons: Record<string, string> = { light: '☀️', soft: '🌤️', dark: '🌙', system: '💻' }
  const labels: Record<string, string> = { light: 'Light', soft: 'Soft', dark: 'Dark', system: 'System' }

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={cycle}
        title="테마 변경"
        className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 transition"
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
