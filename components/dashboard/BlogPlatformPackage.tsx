'use client'

import { useState } from 'react'
import type { AddToast } from '@/lib/dashboard/dashboard-types'
import {
  BLOG_PUBLISH_PLATFORMS,
  buildPlatformCopyText,
  type BlogPlatformVariants,
} from '@/lib/dashboard/blog-platform-variants'
import { getPlatformName, getPlatformIcon, getPlatformColor } from '@/lib/dashboard/dashboard-helpers'

interface BlogPlatformPackageProps {
  variants: BlogPlatformVariants
  fallbackTitle: string
  body: string
  addToast: AddToast
}

/** 네이버/티스토리/Blogger 동시 발행 패키지 — 탭별 제목·메타·태그/라벨 확인 + 복사 */
export function BlogPlatformPackage({ variants, fallbackTitle, body, addToast }: BlogPlatformPackageProps) {
  const available = BLOG_PUBLISH_PLATFORMS.filter((p) => variants[p])
  const [active, setActive] = useState(available[0])

  if (!active || available.length === 0) return null

  const variant = variants[active]

  return (
    <div className="rounded-xl bg-white dark:bg-gray-900 border border-indigo-100 dark:border-indigo-900 overflow-hidden">
      <div className="px-4 py-2 border-b border-indigo-100 dark:border-indigo-900 bg-indigo-50/50 dark:bg-indigo-950/30 flex items-center justify-between flex-wrap gap-2">
        <span className="text-xs font-semibold text-indigo-800 dark:text-indigo-300">3플랫폼 발행 패키지</span>
        <div className="flex gap-1.5">
          {available.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setActive(p)}
              className={`text-[11px] font-semibold px-2 py-0.5 rounded-md transition ${
                active === p ? getPlatformColor(p) : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400'
              }`}
            >
              {getPlatformIcon(p)} {getPlatformName(p)}
            </button>
          ))}
        </div>
      </div>
      <div className="p-4 space-y-2 text-sm">
        <div>
          <p className="text-[11px] font-bold text-gray-500 dark:text-gray-400 mb-0.5">제목</p>
          <p className="text-gray-800 dark:text-gray-200">{variant?.title || fallbackTitle}</p>
        </div>
        {variant?.metaDescription && (
          <div>
            <p className="text-[11px] font-bold text-gray-500 dark:text-gray-400 mb-0.5">메타 설명</p>
            <p className="text-gray-700 dark:text-gray-300 text-xs">{variant.metaDescription}</p>
          </div>
        )}
        {active === 'tistory' && variant?.category && (
          <div>
            <p className="text-[11px] font-bold text-gray-500 dark:text-gray-400 mb-0.5">카테고리</p>
            <p className="text-gray-700 dark:text-gray-300 text-xs">{variant.category}</p>
          </div>
        )}
        {(active === 'naver-blog' || active === 'tistory') && variant?.tags && variant.tags.length > 0 && (
          <div>
            <p className="text-[11px] font-bold text-gray-500 dark:text-gray-400 mb-0.5">태그</p>
            <div className="flex flex-wrap gap-1">
              {variant.tags.map((t) => (
                <span
                  key={t}
                  className="text-[11px] px-2 py-0.5 rounded-md bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300"
                >
                  #{t}
                </span>
              ))}
            </div>
          </div>
        )}
        {active === 'blogger' && variant?.labels && variant.labels.length > 0 && (
          <div>
            <p className="text-[11px] font-bold text-gray-500 dark:text-gray-400 mb-0.5">라벨</p>
            <div className="flex flex-wrap gap-1">
              {variant.labels.map((l) => (
                <span
                  key={l}
                  className="text-[11px] px-2 py-0.5 rounded-md bg-sky-50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300"
                >
                  {l}
                </span>
              ))}
            </div>
          </div>
        )}
        <button
          type="button"
          onClick={() => {
            const text = buildPlatformCopyText(active, variant, fallbackTitle, body)
            void navigator.clipboard.writeText(text)
            addToast(`${getPlatformName(active)} 발행 패키지 복사됨 (제목+메타+본문)`, 'success')
          }}
          className="w-full mt-1 text-xs font-semibold px-3 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition"
        >
          📋 {getPlatformName(active)} 발행용 복사 (제목+메타+본문)
        </button>
      </div>
    </div>
  )
}
