import { marked } from 'marked'
import type { GenerationHistoryItem, GenerationHistoryPolished } from '@/lib/dashboard/generation-history-types'
import { STOCK_CHART_LABELS, type StockChartIndex } from '@/lib/dashboard/stock-chart-render'

marked.setOptions({ gfm: true, breaks: false })

/**
 * "가이드 블록" 매칭 — 가이드라인 권장 형식과 실제 Gemini 출력이 달라 아래 변형을 모두 허용한다:
 *   **📊 [차트 이미지 — output_N.png]**\n- **삽입 위치:** ...\n- ...   (이모지가 ** 안쪽)
 *   📊 **[차트 이미지 — output_N.png]**\n- **삽입 위치:** ...\n- ...   (이모지가 ** 바깥쪽)
 *   > **📷 [환기용 이미지 가이드 1/3 — 직접 제작·삽입]**\n> - **...:** ...\n> - ...
 * 1번 캡처그룹: 이모지(📊|📷), 2번 캡처그룹: [ ] 안의 제목 텍스트
 */
const GUIDE_BLOCK_REGEX = /^[ \t]*>?[ \t]*\*{0,2}(📊|📷)\*{0,2}[ \t]*\*{0,2}\[([^\]]*)\]\*{0,2}[ \t]*\n(?:>?[ \t]*[-*][^\n]*\n?)*/gm

const CHART_PLACEHOLDER_REGEX = /^차트 이미지 — output_(\d+)\.png$/

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function inline(text: string): string {
  return marked.parseInline(text, { gfm: true }) as string
}

/** 가이드 블록을 "📌 직접 제작 필요" 안내 카드(div.guide-block)로 변환 */
function renderGuideBlockHtml(emoji: string, title: string, block: string): string {
  const lines = block.split('\n').slice(1).filter((l) => l.trim().length > 0)
  const items = lines
    .map((l) => l.replace(/^>?[ \t]*[-*]\s*/, '').trim())
    .filter(Boolean)
    .map((l) => `<li>${inline(l)}</li>`)
    .join('')

  const heading = inline(`${emoji} ${title}`)
  return `\n\n<div class="guide-block"><p class="guide-title">${heading}</p>${items ? `<ul>${items}</ul>` : ''}</div>\n\n`
}

/** output_N.png 가이드 블록을 실제 차트 슬라이드 <figure>로 변환 */
function renderChartFigureHtml(chartIndex: StockChartIndex, polished: GenerationHistoryPolished): string | null {
  const { chartIndexes, chartImages } = polished
  if (!chartIndexes || !chartImages || chartImages.length === 0) return null

  const pos = chartIndexes.indexOf(chartIndex)
  if (pos === -1) return null

  const items = chartImages
    .filter((entry) => entry.slideFiles[pos])
    .map((entry) => {
      const path = entry.slideFiles[pos]
      const src = `/api/dashboard/stock-output-image?path=${encodeURIComponent(path)}`
      const label = STOCK_CHART_LABELS[chartIndex] ?? `차트 ${chartIndex}`
      const caption = `${entry.name} · ${label}`
      return (
        `<div class="chart-figure-item">` +
        `<img src="${escapeHtml(src)}" alt="${escapeHtml(caption)}" loading="lazy" onclick="openLightbox(this.src)">` +
        `<figcaption>${escapeHtml(caption)}</figcaption>` +
        `</div>`
      )
    })

  if (items.length === 0) return null
  return `\n\n<figure class="chart-figure"><div class="chart-figure-grid">${items.join('')}</div></figure>\n\n`
}

/** 가이드 블록을 변환: 차트 placeholder는 실제 이미지로, 나머지는 "직접 제작 필요" 안내 카드로 */
function preprocessMarkdown(fullContent: string, polished: GenerationHistoryPolished): string {
  return fullContent.replace(GUIDE_BLOCK_REGEX, (block, emoji: string, title: string) => {
    const chartMatch = CHART_PLACEHOLDER_REGEX.exec(title.trim())
    if (chartMatch) {
      const figure = renderChartFigureHtml(Number(chartMatch[1]) as StockChartIndex, polished)
      if (figure) return figure
    }
    return renderGuideBlockHtml(emoji, title, block)
  })
}

/** 투자 판단 디스클레이머 단락에 스타일용 클래스 부여 */
function postprocessHtml(html: string): string {
  const withDisclaimer = html.replace(
    /<p>(※ 본 콘텐츠는 투자 판단에[\s\S]*?)<\/p>/,
    '<div class="disclaimer-block"><p>$1</p></div>',
  )
  return colorizeChangeColumns(withDisclaimer)
}

/** 시세 표에서 "등락률" 헤더를 가진 열을 찾아 값의 증감(+/-/0)에 따라 색상 클래스 부여 */
function colorizeChangeColumns(html: string): string {
  return html.replace(/<table>([\s\S]*?)<\/table>/g, (tableHtml, tableInner: string) => {
    const theadMatch = /<thead>([\s\S]*?)<\/thead>/.exec(tableInner)
    if (!theadMatch) return tableHtml

    const headerCells = [...theadMatch[1].matchAll(/<th[^>]*>([\s\S]*?)<\/th>/g)]
      .map((m) => m[1].replace(/<[^>]+>/g, '').trim())
    const colIndex = headerCells.findIndex((h) => h.includes('등락률'))
    if (colIndex === -1) return tableHtml

    const tbodyMatch = /<tbody>([\s\S]*?)<\/tbody>/.exec(tableInner)
    if (!tbodyMatch) return tableHtml

    const newTbody = tbodyMatch[1].replace(/<tr>([\s\S]*?)<\/tr>/g, (rowHtml, rowInner: string) => {
      let cellIdx = -1
      const newRowInner = rowInner.replace(/<td[^>]*>([\s\S]*?)<\/td>/g, (cellHtml: string, cellInner: string) => {
        cellIdx += 1
        if (cellIdx !== colIndex) return cellHtml
        const text = cellInner.replace(/<[^>]+>/g, '').trim()
        const value = Number.parseFloat(text.replace(/[^0-9.+-]/g, ''))
        if (Number.isNaN(value)) return cellHtml
        const colorClass = value > 0 ? 'val-up' : value < 0 ? 'val-down' : 'val-flat'
        return `<td><span class="${colorClass}">${cellInner}</span></td>`
      })
      return `<tr>${newRowInner}</tr>`
    })

    const newTableInner = tableInner.replace(tbodyMatch[0], `<tbody>${newTbody}</tbody>`)
    return `<table>${newTableInner}</table>`
  })
}

const PAGE_STYLE = `
  :root { color-scheme: light; }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    padding: 32px 16px 80px;
    background: #f4f5f7;
    font-family: -apple-system, "Apple SD Gothic Neo", "Pretendard", "Malgun Gothic", "Segoe UI", sans-serif;
    color: #1f2937;
    line-height: 1.75;
  }
  article {
    max-width: 760px;
    margin: 0 auto;
    background: #fff;
    border-radius: 16px;
    padding: 32px 36px;
    box-shadow: 0 1px 3px rgba(0,0,0,0.06);
  }
  header.doc-header { margin-bottom: 24px; padding-bottom: 16px; border-bottom: 1px solid #e5e7eb; }
  header.doc-header h1 { font-size: 1.6rem; margin: 0 0 8px; }
  header.doc-header .summary { color: #047857; font-size: 0.9rem; margin: 4px 0; }
  header.doc-header .meta { color: #9ca3af; font-size: 0.8rem; margin: 4px 0 0; }
  h1, h2, h3, h4 { line-height: 1.4; margin-top: 1.6em; margin-bottom: 0.6em; }
  h2 { font-size: 1.3rem; border-left: 4px solid #6366f1; padding-left: 10px; }
  h3 { font-size: 1.1rem; }
  p { margin: 0.8em 0; word-break: keep-all; }
  ul, ol { padding-left: 1.4em; }
  table { width: 100%; border-collapse: collapse; margin: 1em 0; font-size: 0.9rem; }
  th, td { border: 1px solid #e5e7eb; padding: 8px 10px; text-align: left; }
  th { background: #f9fafb; }
  tr:nth-child(even) td { background: #fafafa; }
  .val-up { color: #dc2626; font-weight: 700; }
  .val-down { color: #2563eb; font-weight: 700; }
  .val-flat { color: #6b7280; font-weight: 600; }
  blockquote { margin: 1em 0; padding: 12px 16px; border-left: 4px solid #d1d5db; background: #f9fafb; border-radius: 0 8px 8px 0; }
  blockquote p { margin: 0.3em 0; }
  pre { background: #111827; color: #f3f4f6; padding: 14px 16px; border-radius: 8px; overflow-x: auto; font-size: 0.85rem; }
  code { font-family: "SFMono-Regular", Menlo, Consolas, monospace; }
  :not(pre) > code { background: #f3f4f6; padding: 1px 5px; border-radius: 4px; font-size: 0.85em; }
  .guide-block { margin: 1.2em 0; padding: 12px 16px; border: 1px dashed #f59e0b; background: #fffbeb; border-radius: 8px; }
  .guide-block .guide-title { font-weight: 700; color: #b45309; margin: 0 0 6px; }
  .guide-block .guide-title::before { content: "📌 직접 제작 필요 — "; font-size: 0.78rem; font-weight: 700; color: #b45309; }
  .guide-block ul { margin: 0; padding-left: 1.2em; font-size: 0.88rem; color: #78350f; }
  .disclaimer-block { margin: 1.4em 0; padding: 12px 16px; border-radius: 8px; background: #fffbeb; color: #92400e; font-size: 0.85rem; }
  .disclaimer-block p { margin: 0; }
  figure.chart-figure { margin: 1.4em 0; }
  .chart-figure-grid { display: flex; flex-wrap: wrap; gap: 12px; }
  .chart-figure-item { flex: 1 1 280px; }
  .chart-figure-item img { width: 100%; border-radius: 8px; border: 1px solid #e5e7eb; display: block; cursor: zoom-in; }
  .chart-figure-item figcaption { font-size: 0.78rem; color: #6b7280; margin-top: 4px; text-align: center; }
  .lightbox-overlay { display: none; position: fixed; inset: 0; z-index: 1000; background: rgba(15, 23, 42, 0.85); align-items: center; justify-content: center; padding: 24px; cursor: zoom-out; }
  .lightbox-overlay.active { display: flex; }
  .lightbox-overlay img { max-width: 100%; max-height: 100%; border-radius: 8px; box-shadow: 0 8px 32px rgba(0,0,0,0.4); }
`

function wrapHtmlDocument(opts: { title: string; bodyHtml: string; summary?: string; generatedAt?: string }): string {
  const { title, bodyHtml, summary, generatedAt } = opts
  const escapedTitle = escapeHtml(title)
  return `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapedTitle}</title>
<style>${PAGE_STYLE}</style>
</head>
<body>
<article>
<header class="doc-header">
<h1>${escapedTitle}</h1>
${summary ? `<p class="summary">${escapeHtml(summary)}</p>` : ''}
${generatedAt ? `<p class="meta">기준: ${escapeHtml(new Date(generatedAt).toLocaleString('ko-KR'))}</p>` : ''}
</header>
${bodyHtml}
</article>
<div class="lightbox-overlay" onclick="closeLightbox()">
<img id="lightbox-img" src="" alt="">
</div>
<script>
function openLightbox(src) {
  var overlay = document.querySelector('.lightbox-overlay');
  var img = document.getElementById('lightbox-img');
  img.src = src;
  overlay.classList.add('active');
}
function closeLightbox() {
  document.querySelector('.lightbox-overlay').classList.remove('active');
}
</script>
</body>
</html>`
}

/** content_generation_history 1건을 발행 전 미리보기용 standalone HTML 문서로 렌더링 */
export function renderContentOutputHtml(item: GenerationHistoryItem): string {
  const polished = item.polished
  if (!polished) {
    throw new Error('polished 콘텐츠가 없습니다.')
  }

  const preprocessed = preprocessMarkdown(polished.fullContent, polished)
  const bodyHtml = postprocessHtml(marked.parse(preprocessed) as string)

  return wrapHtmlDocument({
    title: polished.title || item.publishTopic,
    bodyHtml,
    summary: polished.summary,
    generatedAt: polished.polishedAt,
  })
}
