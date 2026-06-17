'use client'

import type { AddToast } from '@/lib/dashboard/dashboard-types'
import type { ScriptGuideOutput } from '@/lib/dashboard/script-guide-output'
import type { BlogPlatformVariants } from '@/lib/dashboard/blog-platform-variants'
import { FORMAT_META } from '@/components/dashboard/views/ContentStudioView'
import { getPlatformName } from '@/lib/dashboard/dashboard-helpers'
import { BlogPlatformPackage } from '@/components/dashboard/BlogPlatformPackage'

export interface GenerationResultPolished {
  title: string
  fullContent: string
  summary: string
  imageGuideCount: number
  polishedAt: string
  platformVariants?: BlogPlatformVariants
}

interface GenerationResultViewProps {
  result: ScriptGuideOutput
  polished?: GenerationResultPolished | null
  modeLabel: string
  addToast: AddToast
  onGoToStudio?: () => void
  historyId?: string | null
}

/** «콘텐츠 가이드»의 생성 결과 UI를 재사용 가능한 형태로 분리한 컴포넌트.
 *  히스토리 관리에서도 같은 수준의 결과 미리보기를 보여주기 위해 사용. */
export function GenerationResultView({ result, polished, modeLabel, addToast, onGoToStudio, historyId }: GenerationResultViewProps) {
  const { category } = result
  const videoMode: 'shortform' | 'longform' = result.targetFormat === 'longform' ? 'longform' : 'shortform'

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h4 className="text-base font-bold text-gray-900 dark:text-white">
            {polished?.title ?? result.title}
          </h4>
          <p className="text-xs text-gray-500 mt-1">
            발행용 · {modeLabel} ·{' '}
            {FORMAT_META[result.targetFormat]?.label ?? result.targetFormat} ·{' '}
            {getPlatformName(result.platform)} ·{' '}
            {new Date(polished?.polishedAt ?? result.generatedAt).toLocaleString('ko-KR')}
          </p>
          {polished?.summary && (
            <p className="text-xs text-emerald-700 dark:text-emerald-400 mt-1">{polished.summary}</p>
          )}
        </div>
        <div className="flex flex-wrap gap-2 shrink-0">
          {historyId && (
            <button
              type="button"
              onClick={() =>
                window.open(`/api/dashboard/content-output-html?historyId=${encodeURIComponent(historyId)}`, '_blank')
              }
              className="px-4 py-2 rounded-xl text-sm font-medium border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 transition shrink-0"
              title="발행 전 이미지 포함 HTML 미리보기"
            >
              🖼️ HTML 보기
            </button>
          )}
          {onGoToStudio && (
            <button
              type="button"
              onClick={onGoToStudio}
              className="px-4 py-2 rounded-xl text-sm font-medium border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 transition shrink-0"
              title="가이드에서 복사·편집으로도 충분하면 생략 가능"
            >
              발행 편집 (선택) →
            </button>
          )}
        </div>
      </div>

      {result.hook && (
        <div className="rounded-xl bg-white/80 dark:bg-gray-900/60 border border-indigo-100 dark:border-indigo-900 p-4">
          <p className="text-[11px] font-bold text-indigo-700 dark:text-indigo-400 mb-1">오프닝 훅</p>
          <p className="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap">{result.hook}</p>
        </div>
      )}

      {result.chapterSummary && result.chapterSummary.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {result.chapterSummary.map((c, i) => (
            <li
              key={i}
              className="text-xs px-2.5 py-1 rounded-lg bg-white dark:bg-gray-800 border border-indigo-100 dark:border-indigo-900 text-gray-700 dark:text-gray-300"
            >
              {i + 1}. {c}
            </li>
          ))}
        </ul>
      )}

      <div className="rounded-xl bg-white dark:bg-gray-900 border border-indigo-100 dark:border-indigo-900 overflow-hidden">
        <div className="px-4 py-2 border-b border-indigo-100 dark:border-indigo-900 bg-indigo-50/50 dark:bg-indigo-950/30 flex items-center justify-between">
          <span className="text-xs font-semibold text-indigo-800 dark:text-indigo-300">
            {category === 'writing'
              ? '발행용 본문'
              : category === 'video' && videoMode === 'longform'
                ? '롱폼 발행용 대본 (챕터별)'
                : category === 'video'
                  ? '발행용 숏폼 스크립트'
                  : category === 'image'
                    ? '캐러셀 슬라이드 카피'
                    : '발행용 본문'}
            {polished && polished.imageGuideCount > 0 ? ` · 📷 가이드 ${polished.imageGuideCount}` : ''}
          </span>
          <div className="flex flex-wrap gap-2 items-center">
            {/* 롱폼: YouTube 설명란 챕터 복사 버튼 */}
            {category === 'video' && videoMode === 'longform' && result.chapterSummary && result.chapterSummary.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  const lines = result.chapterSummary!.map((title, i) => {
                    const minutes = Math.floor((i * 90) / 60)
                    const seconds = (i * 90) % 60
                    const ts = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
                    return `${ts} ${title}`
                  })
                  void navigator.clipboard.writeText(lines.join('\n'))
                  addToast('YouTube 챕터 타임스탬프 복사됨', 'success')
                }}
                className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300 hover:bg-orange-200 dark:hover:bg-orange-900/60"
              >
                ⏱ 챕터 복사
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                const text = polished?.fullContent ?? result.fullScript
                void navigator.clipboard.writeText(text)
                addToast('전체 복사되었습니다', 'success')
              }}
              className="text-[11px] text-indigo-600 dark:text-indigo-400 hover:underline"
            >
              전체 복사
            </button>
          </div>
        </div>
        <pre className="p-4 text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap font-sans leading-relaxed max-h-[520px] overflow-y-auto">
          {polished?.fullContent ?? result.fullScript}
        </pre>
      </div>

      {result.cta && (
        <p className="text-sm text-gray-600 dark:text-gray-400">
          <span className="font-semibold text-indigo-700 dark:text-indigo-400">CTA:</span> {result.cta}
        </p>
      )}

      {polished && category === 'writing' && (
        <p className="text-xs text-gray-500 dark:text-gray-400 bg-emerald-50/50 dark:bg-emerald-950/20 rounded-lg px-3 py-2">
          📷 «환기용 이미지 가이드»·«표 가이드» 블록은 직접 제작·삽입할 위치 안내입니다.
        </p>
      )}

      {polished?.platformVariants && category === 'writing' && (
        <BlogPlatformPackage
          variants={polished.platformVariants}
          fallbackTitle={polished.title ?? result.title}
          body={polished.fullContent ?? result.fullScript}
          addToast={addToast}
        />
      )}

      {polished && category === 'video' && videoMode === 'shortform' && (
        <p className="text-xs text-gray-500 dark:text-gray-400 bg-violet-50/50 dark:bg-violet-950/20 rounded-lg px-3 py-2">
          🎬 시간대별 씬 스크립트를 복사해 영상 편집 도구(캡컷 등)에서 활용하세요. 플랫폼 스펙:{' '}
          <a
            href="https://branderkey.notion.site/33c835c9591a8008b0cef37fcf50043f"
            target="_blank"
            rel="noopener noreferrer"
            className="text-violet-600 dark:text-violet-400 underline"
          >
            Branderkey 가이드
          </a>
          기준 · 9:16 · 45~60초 이내.
        </p>
      )}
      {polished && category === 'video' && videoMode === 'longform' && (
        <p className="text-xs text-gray-500 dark:text-gray-400 bg-orange-50/50 dark:bg-orange-950/20 rounded-lg px-3 py-2">
          🎞️ <strong>⏱ 챕터 복사</strong> 버튼으로 YouTube 설명란에 바로 붙여넣을 타임스탬프 블록을 복사하세요. 챕터 순서대로 90초 간격으로 자동 계산됩니다.
        </p>
      )}
      {category === 'image' && (
        <p className="text-xs text-gray-500 dark:text-gray-400 bg-pink-50/50 dark:bg-pink-950/20 rounded-lg px-3 py-2">
          🖼️ 슬라이드별 카피를 복사해 <strong>Canva</strong>에 붙여넣으세요. 각 슬라이드는 <code>## 슬라이드 N</code> 형식으로 구분됩니다.
        </p>
      )}

      {onGoToStudio && (
        <p className="text-xs text-center text-gray-500 dark:text-gray-400">
          위 «전체 복사»로 바로 제작 가능합니다. 문장만 더 다듬거나 .txt로 보낼 때만{' '}
          <button type="button" onClick={onGoToStudio} className="font-semibold text-indigo-600 dark:text-indigo-400 underline">
            발행 편집·변환
          </button>
          으로 이동하세요.
        </p>
      )}
    </div>
  )
}
