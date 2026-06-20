'use client'

import { useState, useCallback } from 'react'
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
  chartImages?: { name: string; slideFiles: string[] }[]
  customThumbnail?: string
}

interface GenerationResultViewProps {
  result: ScriptGuideOutput
  polished?: GenerationResultPolished | null
  modeLabel: string
  addToast: AddToast
  onGoToStudio?: () => void
  historyId?: string | null
}

/** 썸네일 생성 가이드 텍스트 — 나노바나나·Canva AI 등에 붙여넣기용 */
function buildThumbnailGuide(title: string, summary: string | undefined, platform: string): string {
  const platformLabel =
    platform === 'naver-blog' ? '네이버 블로그'
    : platform === 'tistory' ? '티스토리'
    : platform === 'youtube' ? 'YouTube'
    : platform === 'instagram' ? 'Instagram'
    : '블로그'
  const sizeSpec =
    platform === 'youtube' ? '1280×720px (16:9)'
    : platform === 'instagram' ? '1080×1080px (1:1)'
    : '1200×630px (네이버·티스토리 권장)'

  const summaryLine = summary
    ? summary.replace(/\n/g, ' ').slice(0, 80) + (summary.length > 80 ? '…' : '')
    : '관련 배경 이미지'

  return [
    `📌 포스트 제목`,
    title,
    ``,
    `🎨 이미지 프롬프트 (나노바나나·Canva AI·Adobe Firefly 등에 붙여넣기)`,
    `${platformLabel} 썸네일. 제목 텍스트 「${title}」이 굵고 선명하게 표시된 다크 그라데이션 배경.`,
    `${summaryLine}`,
    `전문 투자·경제 분석 블로그 스타일. 신뢰감 있고 임팩트 있는 레이아웃. 한국어 블로그.`,
    ``,
    `📐 권장 스펙: ${sizeSpec}`,
    `💡 이미지 생성 후 「썸네일 보기」 팝업에 드래그&드랍으로 업로드하세요.`,
  ].join('\n')
}

/** «콘텐츠 가이드»의 생성 결과 UI를 재사용 가능한 형태로 분리한 컴포넌트.
 *  히스토리 관리에서도 같은 수준의 결과 미리보기를 보여주기 위해 사용. */
export function GenerationResultView({ result, polished, modeLabel, addToast, onGoToStudio, historyId }: GenerationResultViewProps) {
  const { category } = result
  const videoMode: 'shortform' | 'longform' = result.targetFormat === 'longform' ? 'longform' : 'shortform'
  const [thumbOpen, setThumbOpen] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [uploadState, setUploadState] = useState<'idle' | 'uploading' | 'done' | 'error'>('idle')
  const [customThumb, setCustomThumb] = useState<string | null>(polished?.customThumbnail ?? null)
  const [autoGenState, setAutoGenState] = useState<'idle' | 'generating' | 'done' | 'error'>('idle')

  const allSlideFiles = polished?.chartImages?.flatMap((c) => c.slideFiles) ?? []
  const displayThumb = customThumb ?? allSlideFiles[0] ?? null

  const title = polished?.title ?? result.title
  const thumbnailGuide = buildThumbnailGuide(title, polished?.summary, result.platform)

  const handleFileDrop = useCallback(async (file: File) => {
    if (!historyId) { addToast('히스토리 ID가 없어 업로드할 수 없습니다.', 'error'); return }
    if (!file.type.startsWith('image/')) { addToast('이미지 파일만 업로드 가능합니다.', 'error'); return }
    if (file.size > 5 * 1024 * 1024) { addToast('5MB 이하 이미지만 업로드 가능합니다.', 'error'); return }

    setUploadState('uploading')
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('historyId', historyId)
      const res = await fetch('/api/dashboard/thumbnail-upload', { method: 'POST', body: fd })
      const data = await res.json() as { ok?: boolean; path?: string; error?: string }
      if (data.ok && data.path) {
        setCustomThumb(data.path)
        setUploadState('done')
        addToast('썸네일 업로드 완료', 'success')
      } else {
        setUploadState('error')
        addToast(data.error ?? '업로드 실패', 'error')
      }
    } catch {
      setUploadState('error')
      addToast('업로드 중 오류가 발생했습니다.', 'error')
    }
  }, [historyId, addToast])

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) void handleFileDrop(file)
  }, [handleFileDrop])

  return (
    <div className="space-y-4">
      {/* 썸네일 가이드 + 자동 생성 */}
      {historyId && (
        <div className="rounded-xl border-2 border-dashed border-sky-300 dark:border-sky-700 bg-sky-50/60 dark:bg-sky-950/20 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold text-sky-700 dark:text-sky-400">📷 썸네일 가이드</p>
            <div className="flex gap-2">
              {/* 자동 생성 버튼 */}
              <button
                type="button"
                disabled={autoGenState === 'generating'}
                onClick={async () => {
                  setAutoGenState('generating')
                  try {
                    const res = await fetch('/api/dashboard/thumbnail-render', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ historyId, title }),
                    })
                    const data = await res.json() as { ok?: boolean; path?: string; error?: string }
                    if (data.ok && data.path) {
                      setCustomThumb(data.path)
                      setAutoGenState('done')
                      addToast('썸네일 자동 생성 완료', 'success')
                    } else {
                      setAutoGenState('error')
                      addToast(data.error ?? '생성 실패', 'error')
                    }
                  } catch {
                    setAutoGenState('error')
                    addToast('썸네일 생성 중 오류', 'error')
                  }
                }}
                className="text-[11px] px-3 py-1 rounded-lg bg-sky-500 hover:bg-sky-600 disabled:opacity-50 text-white font-semibold transition shrink-0"
              >
                {autoGenState === 'generating' ? '⏳ 생성 중…' : autoGenState === 'done' ? '✅ 재생성' : '🎨 자동 생성'}
              </button>
              <button
                type="button"
                onClick={() => { void navigator.clipboard.writeText(thumbnailGuide); addToast('가이드 복사됨', 'success') }}
                className="text-[11px] px-2.5 py-1 rounded-lg border border-sky-400 dark:border-sky-600 text-sky-700 dark:text-sky-300 hover:bg-sky-100 dark:hover:bg-sky-900/30 font-semibold transition shrink-0"
              >
                프롬프트 복사
              </button>
            </div>
          </div>
          <p className="text-[11px] text-sky-700 dark:text-sky-300">
            <strong>background.png</strong> 위에 제목 텍스트를 자동 합성합니다 →{' '}
            <span className="text-sky-500">🎨 자동 생성</span> 클릭 후 「📷 썸네일 보기」에서 확인.{' '}
            외부 AI 툴(Canva AI 등) 사용 시 아래 프롬프트를 복사하세요.
          </p>
          <details className="group">
            <summary className="text-[11px] text-sky-500 dark:text-sky-400 cursor-pointer select-none group-open:mb-2">
              ▸ AI 프롬프트 보기 (Canva AI·Adobe Firefly 등)
            </summary>
            <pre className="text-[11px] text-sky-900 dark:text-sky-200 whitespace-pre-wrap font-sans leading-relaxed">
              {thumbnailGuide}
            </pre>
          </details>
        </div>
      )}

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h4 className="text-base font-bold text-gray-900 dark:text-white">
            {title}
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
          {historyId && (
            <button
              type="button"
              onClick={() => setThumbOpen(true)}
              className="px-4 py-2 rounded-xl text-sm font-medium bg-sky-500 hover:bg-sky-600 text-white transition shrink-0 shadow-sm"
              title="블로그 검색 결과 썸네일 미리보기"
            >
              📷 썸네일 보기{customThumb ? ' ✓' : ''}
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

      {/* 썸네일 미리보기 모달 — 블로그 검색 결과 형태 + 드래그&드랍 업로드 */}
      {thumbOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={() => setThumbOpen(false)}
        >
          <div
            className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl max-w-xl w-full max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* 헤더 */}
            <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-gray-200 dark:border-gray-700">
              <div>
                <p className="text-xs font-bold text-sky-600 dark:text-sky-400">📷 썸네일 미리보기</p>
                <p className="text-[11px] text-gray-400 mt-0.5">네이버·티스토리 검색 시 첫 번째 이미지가 썸네일로 사용됩니다</p>
              </div>
              <button type="button" onClick={() => setThumbOpen(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-xl leading-none ml-3">×</button>
            </div>

            <div className="p-4 space-y-4">
              {/* 드래그&드랍 업로드 영역 */}
              {historyId && (
                <div
                  onDragEnter={(e) => { e.preventDefault(); setIsDragging(true) }}
                  onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
                  onDragLeave={(e) => { e.preventDefault(); setIsDragging(false) }}
                  onDrop={onDrop}
                  className={`relative rounded-xl border-2 border-dashed transition-all p-4 text-center cursor-pointer
                    ${isDragging
                      ? 'border-sky-500 bg-sky-50 dark:bg-sky-950/30 scale-[1.01]'
                      : 'border-gray-300 dark:border-gray-600 hover:border-sky-400 dark:hover:border-sky-600 hover:bg-sky-50/50 dark:hover:bg-sky-950/10'
                    }`}
                  onClick={() => {
                    const input = document.createElement('input')
                    input.type = 'file'
                    input.accept = 'image/png,image/jpeg,image/webp'
                    input.onchange = (ev) => {
                      const f = (ev.target as HTMLInputElement).files?.[0]
                      if (f) void handleFileDrop(f)
                    }
                    input.click()
                  }}
                >
                  {uploadState === 'uploading' ? (
                    <p className="text-sm text-sky-600 dark:text-sky-400 font-medium">업로드 중…</p>
                  ) : uploadState === 'done' ? (
                    <p className="text-sm text-emerald-600 dark:text-emerald-400 font-medium">✅ 썸네일 등록 완료 — 다시 업로드하려면 클릭 또는 드래그</p>
                  ) : (
                    <>
                      <p className="text-2xl mb-1">🖼️</p>
                      <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                        {isDragging ? '여기에 놓으세요!' : '나노바나나 등에서 생성한 이미지를 드래그&드랍'}
                      </p>
                      <p className="text-[11px] text-gray-400 mt-0.5">또는 클릭해서 파일 선택 · PNG / JPG / WebP · 5MB 이하</p>
                    </>
                  )}
                </div>
              )}

              {displayThumb ? (
                <>
                  {/* 네이버 블로그 검색 결과 카드 목업 */}
                  <div className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden shadow-sm bg-white dark:bg-gray-800">
                    <div className="flex items-center gap-1.5 px-3 pt-3 pb-1">
                      <div className="w-4 h-4 rounded bg-green-500 flex items-center justify-center text-white text-[8px] font-bold shrink-0">M</div>
                      <span className="text-[10px] text-gray-400">marketlog · 방금 전</span>
                    </div>
                    <p className="px-3 pb-1 text-sm font-bold text-blue-700 dark:text-blue-400 leading-snug">{title}</p>
                    {polished?.summary && (
                      <p className="px-3 pb-2 text-xs text-gray-500 dark:text-gray-400 line-clamp-2">{polished.summary}</p>
                    )}
                    {/* 이미지 행 (최대 5장) */}
                    <div className="px-3 pb-3 flex gap-1.5 overflow-hidden">
                      {[...(customThumb ? [customThumb] : []), ...allSlideFiles.filter((f) => f !== customThumb)].slice(0, 5).map((f, i) => (
                        <div key={f} className="relative flex-1 min-w-0 rounded overflow-hidden bg-gray-100 dark:bg-gray-700 cursor-zoom-in"
                          style={{ aspectRatio: '1/1' }}
                          onClick={(e) => { e.stopPropagation(); window.open(`/api/dashboard/stock-output-image?path=${encodeURIComponent(f)}`, '_blank') }}>
                          <img
                            src={`/api/dashboard/stock-output-image?path=${encodeURIComponent(f)}`}
                            alt={`이미지 ${i + 1}`}
                            className="w-full h-full object-cover"
                          />
                          {i === 0 && (
                            <span className="absolute top-1 left-1 bg-sky-500 text-white text-[8px] font-bold rounded px-1 py-0.5">
                              {customThumb ? '커스텀 ★' : '썸네일 ★'}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* 전체 슬라이드 그리드 */}
                  {allSlideFiles.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2">전체 차트 슬라이드 ({allSlideFiles.length}장) — 클릭하면 원본 크기로 보기</p>
                      <div className="grid grid-cols-2 gap-2">
                        {allSlideFiles.map((f, i) => (
                          <div key={f} className="relative rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700 cursor-zoom-in"
                            onClick={(e) => { e.stopPropagation(); window.open(`/api/dashboard/stock-output-image?path=${encodeURIComponent(f)}`, '_blank') }}>
                            <img src={`/api/dashboard/stock-output-image?path=${encodeURIComponent(f)}`}
                              alt={`차트 ${i + 1}`} className="w-full object-cover" style={{ aspectRatio: '16/9' }} />
                            <span className="absolute top-1 left-1 bg-black/60 text-white text-[9px] font-bold rounded px-1.5 py-0.5">
                              {i === 0 ? '썸네일 ★' : `차트 ${i + 1}`}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <p className="text-[11px] text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/30 rounded-lg p-2.5">
                    ⚠️ 현재 로컬 이미지 — Supabase Storage 연동 시 외부 플랫폼에서도 표시됩니다
                  </p>
                </>
              ) : (
                /* 이미지 없는 경우 */
                <div className="text-center py-4 space-y-2">
                  <p className="text-sm font-semibold text-gray-600 dark:text-gray-400">아직 등록된 이미지가 없습니다</p>
                  <p className="text-xs text-gray-400">위 썸네일 가이드를 복사해 나노바나나 등에서 이미지를 생성한 뒤<br />드래그&드랍으로 등록하세요.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

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
