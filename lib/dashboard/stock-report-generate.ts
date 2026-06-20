import {
  buildSectorResearchReportGuidelineBlock,
  buildStockDailyItemGuidelineBlock,
  buildStockFocusReportGuidelineBlock,
} from '@/lib/dashboard/contents-guideline'
import { BLOG_PLATFORM_VARIANTS_SCHEMA } from '@/lib/dashboard/blog-platform-variants'
import { parseContentPolishResponse, type ContentPolishResult } from '@/lib/dashboard/content-polish'
import type { StockSeriesForPrompt } from '@/lib/data/stock-collect'
import type { StockChartIndex } from '@/lib/dashboard/stock-chart-render'

export interface StockReportPromptResult {
  prompt: string
  maxOutputTokens: number
  imageGuideCount: number
  topic: string
}

const MARKET_LABEL: Record<StockSeriesForPrompt['market'], string> = {
  KR: '국내',
  US: '미국',
}

function formatSeriesBlock(series: StockSeriesForPrompt[]): string {
  if (series.length === 0) return '(수집된 시세 데이터 없음 — 일반적인 시황 설명 위주로 작성)'

  return series
    .map((s) => {
      if (s.bars.length === 0) return `### ${s.name} (${s.ticker}, ${MARKET_LABEL[s.market]})\n- 데이터 없음`
      const rows = s.bars
        .map((b) => `  - ${b.tradeDate}: 시가 ${b.open}, 종가 ${b.close}${b.changePct !== null ? ` (전일대비 ${b.changePct.toFixed(2)}%)` : ''}`)
        .join('\n')
      const latest = s.bars[s.bars.length - 1]
      return `### ${s.name} (${s.ticker}, ${MARKET_LABEL[s.market]}${s.assetType === 'index' ? ' · 지수' : ''})\n- 최신 종가: ${latest.close}${latest.changePct !== null ? ` (전일대비 ${latest.changePct.toFixed(2)}%)` : ''}\n- 최근 ${s.bars.length}일 시세:\n${rows}`
    })
    .join('\n\n')
}

function formatTopicsBlock(topics: string[]): string {
  if (topics.length === 0) return '(제공된 경제 뉴스 없음 — 시세 데이터·패턴 분석 중심으로 작성)'
  return topics.map((t, i) => `${i + 1}. ${t}`).join('\n')
}

/** 워치리스트 종목/지수 1건 + 경제 뉴스 토픽으로 «종목/지수별 일일 리포트» 프롬프트 생성 (content-polish와 동일 출력 스키마) */
export function buildStockDailyItemReportPrompt(
  item: StockSeriesForPrompt,
  economyTopics: string[],
  reportDate: string,
  chartIndexes: StockChartIndex[],
): StockReportPromptResult {
  const imageGuideCount = chartIndexes.length
  const guidelineBlock = buildStockDailyItemGuidelineBlock(chartIndexes)
  const seriesBlock = formatSeriesBlock([item])
  const topicsBlock = formatTopicsBlock(economyTopics)
  const topic = `${reportDate} ${item.name} 일일 리포트`
  const subjectKind = item.assetType === 'index' ? '지수' : '종목'

  const prompt = `당신은 증권 시황 콘텐츠 에디터입니다. 아래 데이터를 바탕으로 **${reportDate} ${item.name}(${MARKET_LABEL[item.market]} ${subjectKind}) 일일 리포트** 블로그 글을 처음부터 작성합니다.
이번 요청은 워치리스트 전체 통합 시황이 아니라 **${item.name} 1건에 대한 개별 일일 리포트**이며, 가이드라인의 "종목/지수별 일일 리포트 모드" 구성 순서를 따릅니다.

[발행 주제 — 반드시 유지]
${topic}

## 가이드라인 (guidelines/contents_guideline.md)
${guidelineBlock || '(가이드라인 로드 실패 — 시세 요약·패턴분석·디스클레이머 구조만 반영)'}

## ${item.name} 시세 데이터 (최근 시세·등락률)
${seriesBlock}

## 참고 경제 뉴스·토픽 (인용 없이 재구성)
${topicsBlock}

## 출력 형식
반드시 JSON만 응답:
{
  "title": "발행용 제목 (날짜 + '${item.name}' + '일일 리포트' 포함)",
  "fullContent": "마크다운 전체 본문 (오늘의 시세·등락 요약 → 최근 시세 패턴분석 표 → 공개정보·예정 이벤트 → 신호 요약 표(아래 형식 준수) → 고정 디스클레이머, 차트 이미지 가이드 블록 포함). \\n신호 요약 표는 본문에서 언급한 내용을 근거로 채워야 하며 반드시 고정 디스클레이머 직전에 아래 HTML 그대로 삽입(괄호 안만 본문 근거로 교체):\\n\\n<h2 data-no-toc>📊 신호 요약</h2>\\n<table style='width:100%;border-collapse:collapse;margin:16px 0;font-size:14px;'>\\n<thead><tr><th style='padding:10px 14px;border:1px solid #e2e8f0;background:#f1f5f9;color:#475569;width:12%;'></th><th style='padding:10px 14px;border:1px solid #fca5a5;background:#ef4444;color:#ffffff;text-align:center;'>긍정적 신호 🔴</th><th style='padding:10px 14px;border:1px solid #93c5fd;background:#3b82f6;color:#ffffff;text-align:center;'>부정적 신호 🔵</th></tr></thead>\\n<tbody>\\n<tr><td style='padding:10px 14px;border:1px solid #e2e8f0;background:#f8fafc;font-weight:bold;text-align:center;'>단기</td><td style='padding:10px 14px;border:1px solid #fca5a5;background:#fef2f2;'>(본문 근거 단기 긍정 요인 1~2가지)</td><td style='padding:10px 14px;border:1px solid #bfdbfe;background:#eff6ff;'>(본문 근거 단기 부정 요인 1~2가지)</td></tr>\\n<tr><td style='padding:10px 14px;border:1px solid #e2e8f0;background:#f8fafc;font-weight:bold;text-align:center;'>장기</td><td style='padding:10px 14px;border:1px solid #fca5a5;background:#fef2f2;'>(본문 근거 중장기 긍정 요인 1~2가지)</td><td style='padding:10px 14px;border:1px solid #bfdbfe;background:#eff6ff;'>(본문 근거 중장기 부정 요인 1~2가지)</td></tr>\\n</tbody></table>\\n<p style='font-size:12px;color:#94a3b8;'>🔴 적색=상승·긍정 / 🔵 청색=하락·부정 (국내 주식시장 표기 관행 기준)</p>",
  "summary": "작성 요약 2~3문장",
  "imageGuideCount": ${imageGuideCount},
  "seoKeywords": ["키워드1", "키워드2"],
  "chapterSummary": ["소제목1", "소제목2"],
  ${BLOG_PLATFORM_VARIANTS_SCHEMA}
}`

  return { prompt, maxOutputTokens: 8192, imageGuideCount, topic }
}

/** Gemini 응답 파싱 — content-polish와 동일 스키마 (platformVariants 포함) */
export function parseStockReportResponse(text: string, fallbackTitle: string): ContentPolishResult | null {
  return parseContentPolishResponse(text, fallbackTitle)
}

/** 관심 종목(1~3개) 즉석 시세 + 사용자 메모로 «종목 분석 리포트»(포커스 모드) 프롬프트 생성 */
export function buildStockFocusReportPrompt(
  series: StockSeriesForPrompt[],
  note: string,
  economyTopics: string[],
  reportDate: string,
  chartIndexes: StockChartIndex[],
): StockReportPromptResult {
  const imageGuideCount = chartIndexes.length
  const guidelineBlock = buildStockFocusReportGuidelineBlock(chartIndexes)
  const seriesBlock = formatSeriesBlock(series)
  const topicsBlock = formatTopicsBlock(economyTopics)
  const names = series.map((s) => s.name).join('·')
  const topic = `${reportDate} ${names} 종목 분석 리포트`
  const noteBlock = note.trim()
    ? `## 사용자 참고 메모 (최근 이슈·관심사 — 본문에 반영)\n${note.trim()}`
    : '## 사용자 참고 메모\n(제공된 메모 없음 — 시세 데이터·일반적인 업종 맥락 중심으로 작성)'

  const prompt = `당신은 증권 시황 콘텐츠 에디터입니다. 아래 데이터를 바탕으로 **관심 종목 분석(포커스) 리포트** 블로그 글을 처음부터 작성합니다.
이번 요청은 일일 시황 리포트가 아니라 **관심 종목 분석 모드**이며, 가이드라인의 "관심 종목 분석 모드 (포커스 리포트)" 구성 순서를 따릅니다.

[발행 주제 — 반드시 유지]
${topic}

## 가이드라인 (guidelines/contents_guideline.md)
${guidelineBlock || '(가이드라인 로드 실패 — 종목 개요·가격 추이 분석·고정 디스클레이머 구조만 반영)'}

## 분석 대상 종목 시세 데이터 (최근 시세·등락률)
${seriesBlock}

${noteBlock}

## 참고 경제 뉴스·토픽 (인용 없이 재구성, 업종/거시 맥락 보강용)
${topicsBlock}

## 출력 형식
반드시 JSON만 응답:
{
  "title": "발행용 제목 (날짜 + 종목명 + '종목 분석 리포트' 포함)",
  "fullContent": "마크다운 전체 본문 (종목 개요·이슈 → 가격 추이·패턴분석 표 → 업종/거시 맥락 → 신호 요약 표(아래 형식 준수) → 고정 디스클레이머, 차트 이미지 가이드 블록 포함). \\n신호 요약 표는 본문에서 언급한 내용을 근거로 채워야 하며 반드시 고정 디스클레이머 직전에 아래 HTML 그대로 삽입(괄호 안만 본문 근거로 교체):\\n\\n<h2 data-no-toc>📊 신호 요약</h2>\\n<table style='width:100%;border-collapse:collapse;margin:16px 0;font-size:14px;'>\\n<thead><tr><th style='padding:10px 14px;border:1px solid #e2e8f0;background:#f1f5f9;color:#475569;width:12%;'></th><th style='padding:10px 14px;border:1px solid #fca5a5;background:#ef4444;color:#ffffff;text-align:center;'>긍정적 신호 🔴</th><th style='padding:10px 14px;border:1px solid #93c5fd;background:#3b82f6;color:#ffffff;text-align:center;'>부정적 신호 🔵</th></tr></thead>\\n<tbody>\\n<tr><td style='padding:10px 14px;border:1px solid #e2e8f0;background:#f8fafc;font-weight:bold;text-align:center;'>단기</td><td style='padding:10px 14px;border:1px solid #fca5a5;background:#fef2f2;'>(본문 근거 단기 긍정 요인 1~2가지)</td><td style='padding:10px 14px;border:1px solid #bfdbfe;background:#eff6ff;'>(본문 근거 단기 부정 요인 1~2가지)</td></tr>\\n<tr><td style='padding:10px 14px;border:1px solid #e2e8f0;background:#f8fafc;font-weight:bold;text-align:center;'>장기</td><td style='padding:10px 14px;border:1px solid #fca5a5;background:#fef2f2;'>(본문 근거 중장기 긍정 요인 1~2가지)</td><td style='padding:10px 14px;border:1px solid #bfdbfe;background:#eff6ff;'>(본문 근거 중장기 부정 요인 1~2가지)</td></tr>\\n</tbody></table>\\n<p style='font-size:12px;color:#94a3b8;'>🔴 적색=상승·긍정 / 🔵 청색=하락·부정 (국내 주식시장 표기 관행 기준)</p>",
  "summary": "작성 요약 2~3문장",
  "imageGuideCount": ${imageGuideCount},
  "seoKeywords": ["키워드1", "키워드2"],
  "chapterSummary": ["소제목1", "소제목2"],
  ${BLOG_PLATFORM_VARIANTS_SCHEMA}
}`

  return { prompt, maxOutputTokens: 8192, imageGuideCount, topic }
}

/** 섹터/카테고리 구성종목 시세 + 경제 뉴스 토픽으로 «섹터/카테고리 종합분석 리포트» 프롬프트 생성 */
export function buildSectorResearchReportPrompt(
  sectorLabel: string,
  seriesList: StockSeriesForPrompt[],
  economyTopics: string[],
  reportDate: string,
  chartIndexes: StockChartIndex[],
): StockReportPromptResult {
  const imageGuideCount = chartIndexes.length
  const guidelineBlock = buildSectorResearchReportGuidelineBlock(chartIndexes)
  const seriesBlock = formatSeriesBlock(seriesList)
  const topicsBlock = formatTopicsBlock(economyTopics)
  const topic = `${reportDate} ${sectorLabel} 산업 분석 리포트`

  const prompt = `당신은 증권 시황 콘텐츠 에디터입니다. 아래 데이터를 바탕으로 **${sectorLabel} 섹터 종합분석 리포트** 블로그 글을 처음부터 작성합니다.
이번 요청은 개별 종목 분석이 아니라 **섹터/카테고리 종합분석 모드**이며, 가이드라인의 "섹터/카테고리 종합분석 모드" 구성 순서를 따릅니다.

[발행 주제 — 반드시 유지]
${topic}

## 가이드라인 (guidelines/contents_guideline.md)
${guidelineBlock || '(가이드라인 로드 실패 — 섹터 개요·구성종목 비교·고정 디스클레이머 구조만 반영)'}

## ${sectorLabel} 구성종목 시세 데이터 (최근 시세·등락률)
${seriesBlock}

## 참고 경제 뉴스·토픽 (인용 없이 재구성, 섹터 거시 맥락 보강용)
${topicsBlock}

## 출력 형식
반드시 JSON만 응답:
{
  "title": "발행용 제목 (날짜 + '${sectorLabel}' + '산업 분석 리포트' 포함)",
  "fullContent": "마크다운 전체 본문 (섹터 개요·최근 화두 → 구성종목별 가격추이 비교표 → 섹터 공통 거시/이벤트 맥락 → 신호 요약 표(아래 형식 준수) → 고정 디스클레이머, 차트 이미지 가이드 블록 포함). \\n신호 요약 표는 본문에서 언급한 내용을 근거로 채워야 하며 반드시 고정 디스클레이머 직전에 아래 HTML 그대로 삽입(괄호 안만 본문 근거로 교체):\\n\\n<h2 data-no-toc>📊 신호 요약</h2>\\n<table style='width:100%;border-collapse:collapse;margin:16px 0;font-size:14px;'>\\n<thead><tr><th style='padding:10px 14px;border:1px solid #e2e8f0;background:#f1f5f9;color:#475569;width:12%;'></th><th style='padding:10px 14px;border:1px solid #fca5a5;background:#ef4444;color:#ffffff;text-align:center;'>긍정적 신호 🔴</th><th style='padding:10px 14px;border:1px solid #93c5fd;background:#3b82f6;color:#ffffff;text-align:center;'>부정적 신호 🔵</th></tr></thead>\\n<tbody>\\n<tr><td style='padding:10px 14px;border:1px solid #e2e8f0;background:#f8fafc;font-weight:bold;text-align:center;'>단기</td><td style='padding:10px 14px;border:1px solid #fca5a5;background:#fef2f2;'>(본문 근거 단기 긍정 요인 1~2가지)</td><td style='padding:10px 14px;border:1px solid #bfdbfe;background:#eff6ff;'>(본문 근거 단기 부정 요인 1~2가지)</td></tr>\\n<tr><td style='padding:10px 14px;border:1px solid #e2e8f0;background:#f8fafc;font-weight:bold;text-align:center;'>장기</td><td style='padding:10px 14px;border:1px solid #fca5a5;background:#fef2f2;'>(본문 근거 중장기 긍정 요인 1~2가지)</td><td style='padding:10px 14px;border:1px solid #bfdbfe;background:#eff6ff;'>(본문 근거 중장기 부정 요인 1~2가지)</td></tr>\\n</tbody></table>\\n<p style='font-size:12px;color:#94a3b8;'>🔴 적색=상승·긍정 / 🔵 청색=하락·부정 (국내 주식시장 표기 관행 기준)</p>",
  "summary": "작성 요약 2~3문장",
  "imageGuideCount": ${imageGuideCount},
  "seoKeywords": ["키워드1", "키워드2"],
  "chapterSummary": ["소제목1", "소제목2"],
  ${BLOG_PLATFORM_VARIANTS_SCHEMA}
}`

  return { prompt, maxOutputTokens: 8192, imageGuideCount, topic }
}
