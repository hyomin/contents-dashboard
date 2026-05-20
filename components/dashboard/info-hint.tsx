'use client'

import type { ReactNode } from 'react'

interface InfoHintProps {
  text: string
  /** 그라데이션·어두운 배너 위 */
  variant?: 'default' | 'light'
  className?: string
}

export function InfoHint({ text, variant = 'default', className = '' }: InfoHintProps) {
  const buttonClass =
    variant === 'light'
      ? 'border-white/50 bg-white/25 text-white hover:bg-white/40 focus-visible:ring-white/60'
      : 'border-gray-300 bg-gray-100 text-gray-600 hover:bg-gray-200 focus-visible:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'

  return (
    <span className={`relative inline-flex shrink-0 align-middle group ${className}`}>
      <button
        type="button"
        className={`inline-flex h-5 w-5 items-center justify-center rounded-full border text-[11px] font-bold leading-none transition focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 dark:focus-visible:ring-offset-gray-900 ${buttonClass}`}
        aria-label="페이지 설명 보기"
      >
        !
      </button>
      <span
        role="tooltip"
        className="pointer-events-none absolute left-1/2 top-full z-50 mt-2 w-max max-w-[min(22rem,calc(100vw-2rem))] -translate-x-1/2 rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-left text-xs font-normal leading-relaxed text-white opacity-0 shadow-xl transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100"
      >
        {text}
      </span>
    </span>
  )
}

interface TitleWithHintProps {
  as?: 'h1' | 'h2' | 'h3' | 'h4' | 'p' | 'span'
  className?: string
  hint?: string
  hintVariant?: 'default' | 'light'
  children: ReactNode
}

export function TitleWithHint({
  as: Tag = 'h2',
  className = '',
  hint,
  hintVariant = 'default',
  children,
}: TitleWithHintProps) {
  if (!hint) {
    return <Tag className={className}>{children}</Tag>
  }

  return (
    <Tag className={`inline-flex items-center gap-2 flex-wrap ${className}`}>
      <span>{children}</span>
      <InfoHint text={hint} variant={hintVariant} />
    </Tag>
  )
}

interface PageHeaderProps {
  title: string
  description?: string
  className?: string
}

export function PageHeader({ title, description, className = '' }: PageHeaderProps) {
  return (
    <div className={`mb-6 flex items-center gap-2 ${className}`}>
      <h2 className="text-2xl font-bold text-gray-900 dark:text-white">{title}</h2>
      {description ? <InfoHint text={description} /> : null}
    </div>
  )
}
