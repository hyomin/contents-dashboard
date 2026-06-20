import { marked } from 'marked'
import type { GenerationHistoryItem, GenerationHistoryPolished } from '@/lib/dashboard/generation-history-types'
import { STOCK_CHART_LABELS, type StockChartIndex } from '@/lib/dashboard/stock-chart-render'

marked.setOptions({ gfm: true, breaks: false })

export type PlatformId = 'naver-blog' | 'tistory' | 'blogger'

const PLATFORM_META: Record<PlatformId, { label: string; accent: string; accentLight: string; textDark: string; emoji: string }> = {
  'naver-blog': { label: '네이버 블로그', accent: '#03c75a', accentLight: '#e6f9ef', textDark: '#008c3e', emoji: '🟢' },
  'tistory':    { label: '티스토리',      accent: '#ff6b35', accentLight: '#fff3ee', textDark: '#c44b1c', emoji: '🟠' },
  'blogger':    { label: 'Google Blogger', accent: '#1a73e8', accentLight: '#e8f0fd', textDark: '#1558b0', emoji: '🔵' },
}

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
function renderChartFigureHtml(chartIndex: StockChartIndex, polished: GenerationHistoryPolished, chartBgBase64?: string): string | null {
  const { chartIndexes, chartImages } = polished
  if (!chartIndexes || !chartImages || chartImages.length === 0) return null

  const pos = chartIndexes.indexOf(chartIndex)
  if (pos === -1) return null

  const bgStyle = chartBgBase64
    ? ` style="background-image:url('data:image/png;base64,${chartBgBase64}');background-size:cover;background-position:center;"`
    : ''

  const items = chartImages
    .filter((entry) => entry.slideFiles[pos])
    .map((entry) => {
      const path = entry.slideFiles[pos]
      const src = `/api/dashboard/stock-output-image?path=${encodeURIComponent(path)}`
      const label = STOCK_CHART_LABELS[chartIndex] ?? `차트 ${chartIndex}`
      const caption = `${entry.name} · ${label}`
      return (
        `<div class="chart-figure-item"${bgStyle}>` +
        `<img src="${escapeHtml(src)}" alt="${escapeHtml(caption)}" loading="lazy" onclick="openLightbox(this.src)">` +
        `<figcaption>${escapeHtml(caption)}</figcaption>` +
        `</div>`
      )
    })

  if (items.length === 0) return null
  return `\n\n<figure class="chart-figure"><div class="chart-figure-grid">${items.join('')}</div></figure>\n\n`
}

/** 가이드 블록을 변환: 차트 placeholder는 실제 이미지로, 나머지는 "직접 제작 필요" 안내 카드로 */
function preprocessMarkdown(fullContent: string, polished: GenerationHistoryPolished, chartBgBase64?: string): string {
  return fullContent.replace(GUIDE_BLOCK_REGEX, (block, emoji: string, title: string) => {
    const chartMatch = CHART_PLACEHOLDER_REGEX.exec(title.trim())
    if (chartMatch) {
      const figure = renderChartFigureHtml(Number(chartMatch[1]) as StockChartIndex, polished, chartBgBase64)
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

    // "등락률" 포함 열 인덱스 전체 수집 (섹터 테이블은 모든 종목 열이 "종가/등락률" 형식)
    const rateColIndexes = new Set(
      headerCells.map((h, i) => h.includes('등락률') ? i : -1).filter((i) => i !== -1),
    )
    if (rateColIndexes.size === 0) return tableHtml

    const tbodyMatch = /<tbody>([\s\S]*?)<\/tbody>/.exec(tableInner)
    if (!tbodyMatch) return tableHtml

    const newTbody = tbodyMatch[1].replace(/<tr>([\s\S]*?)<\/tr>/g, (rowHtml, rowInner: string) => {
      let cellIdx = -1
      const newRowInner = rowInner.replace(/<td[^>]*>([\s\S]*?)<\/td>/g, (cellHtml: string, cellInner: string) => {
        cellIdx += 1
        if (!rateColIndexes.has(cellIdx)) return cellHtml
        const text = cellInner.replace(/<[^>]+>/g, '').trim()

        // 복합 형식: "414000 (-1.90%)" 또는 "414000 (+1.90%)"
        // → 종가는 쉼표 포맷, 등락률로 색상 결정
        const compoundMatch = /^([\d,]+)\s*\(([+-]?[\d.]+)%\)$/.exec(text)
        if (compoundMatch) {
          const price = parseInt(compoundMatch[1].replace(/,/g, ''), 10)
          const pct = parseFloat(compoundMatch[2])
          const colorClass = pct > 0 ? 'val-up' : pct < 0 ? 'val-down' : 'val-flat'
          const sign = pct > 0 ? '+' : ''
          const formatted = `${price.toLocaleString('ko-KR')} (${sign}${pct.toFixed(2)}%)`
          return `<td><span class="${colorClass}">${formatted}</span></td>`
        }

        // 단순 등락률 형식: "-1.90%" 또는 "+1.90%"
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

// ─────────────────────────────────────────────
// 공통 CSS (플랫폼 무관)
// ─────────────────────────────────────────────
const CSS_COMMON = `
  :root { color-scheme: light; }
  * { box-sizing: border-box; }
  body { margin: 0; padding: 0; background: #f4f5f7; color: #1f2937; }
  article { margin: 0 auto; background: #fff; }
  header.doc-header { margin-bottom: 24px; padding-bottom: 16px; border-bottom: 1px solid #e5e7eb; }
  header.doc-header h1 { margin: 0 0 8px; line-height: 1.4; }
  header.doc-header .summary { color: #047857; font-size: 0.9rem; margin: 4px 0; }
  header.doc-header .meta { color: #9ca3af; font-size: 0.8rem; margin: 4px 0 0; }
  h1, h2, h3, h4 { line-height: 1.4; margin-top: 1.6em; margin-bottom: 0.6em; }
  h3 { font-size: 1.1rem; }
  p { margin: 0.8em 0; word-break: keep-all; }
  ul, ol { padding-left: 1.4em; }
  table { width: 100%; border-collapse: collapse; margin: 1em 0; font-size: 0.9rem; }
  th, td { border: 1px solid #e5e7eb; padding: 8px 10px; text-align: left; }
  th { background: #f9fafb; font-weight: 600; }
  tr:nth-child(even) td { background: #fafafa; }
  .val-up { color: #dc2626; font-weight: 700; }
  .val-down { color: #2563eb; font-weight: 700; }
  .val-flat { color: #6b7280; font-weight: 600; }
  blockquote { margin: 1em 0; padding: 12px 16px; background: #f9fafb; border-radius: 0 8px 8px 0; }
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
  figure.chart-figure { margin: 1.6em 0; }
  .chart-figure-grid { display: flex; flex-wrap: wrap; gap: 16px; }
  .chart-figure-item {
    flex: 1 1 280px;
    border-radius: 14px;
    padding: 20px 14px 12px;
    overflow: hidden;
    box-shadow: 0 6px 32px rgba(0,0,0,0.6), inset 0 0 0 1.5px rgba(251,191,36,0.32);
  }
  .chart-figure-item img {
    width: 100%;
    border-radius: 6px;
    display: block;
    cursor: zoom-in;
    mix-blend-mode: screen;
  }
  .chart-figure-item figcaption {
    font-size: 0.82rem;
    font-weight: 600;
    color: #fbbf24;
    margin-top: 10px;
    text-align: center;
    text-shadow: 0 1px 6px rgba(0,0,0,0.9);
    letter-spacing: 0.01em;
    padding-bottom: 2px;
  }
  .thumb-banner { width: 100%; max-width: 860px; margin: 0 auto 0; position: relative; overflow: hidden; }
  .thumb-banner img { width: 100%; height: 260px; display: block; object-fit: cover; object-position: center top; }
  .thumb-banner::after { content: ''; position: absolute; bottom: 0; left: 0; right: 0; height: 80px; background: linear-gradient(transparent, #f4f5f7); pointer-events: none; }
  .lightbox-overlay { display: none; position: fixed; inset: 0; z-index: 1000; background: rgba(15,23,42,0.85); align-items: center; justify-content: center; padding: 24px; cursor: zoom-out; }
  .lightbox-overlay.active { display: flex; }
  .lightbox-overlay img { max-width: 100%; max-height: 100%; border-radius: 8px; box-shadow: 0 8px 32px rgba(0,0,0,0.4); }
  .today-row td { background: #fef3c7 !important; }
  .today-row td:first-child { border-left: 3px solid #f59e0b; font-weight: 700; color: #92400e; }
  /* 플랫폼 전환 네비 */
  .platform-nav { position: sticky; top: 0; z-index: 100; background: #fff; border-bottom: 1px solid #e5e7eb; padding: 10px 16px; display: flex; align-items: center; gap: 8px; flex-wrap: wrap; box-shadow: 0 1px 4px rgba(0,0,0,0.06); }
  .platform-nav .nav-label { font-size: 0.75rem; color: #9ca3af; margin-right: 4px; white-space: nowrap; }
  .platform-nav a, .platform-nav span { display: inline-block; padding: 5px 14px; border-radius: 20px; border: 1.5px solid; font-size: 0.8rem; font-weight: 600; text-decoration: none; transition: opacity 0.15s; }
  .platform-nav a:hover { opacity: 0.8; }
  /* 공통 태그/라벨 행 */
  .tag-row { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 20px; padding-top: 16px; border-top: 1px solid #e5e7eb; }
  .tag-chip { padding: 4px 10px; border-radius: 20px; font-size: 0.8rem; }
  .label-chip { padding: 4px 10px; border-radius: 4px; font-size: 0.8rem; }
  /* 메타 설명 박스 (Tistory / Blogger) */
  .meta-desc-box { margin-bottom: 16px; padding: 10px 14px; border-radius: 8px; font-size: 0.88rem; line-height: 1.6; color: #374151; }
  /* TOC (Tistory) */
  .toc-box { margin-bottom: 24px; padding: 14px 18px; border-radius: 10px; }
  .toc-box .toc-title { font-weight: 700; font-size: 0.9rem; margin: 0 0 8px; }
  .toc-box ol { margin: 0; padding-left: 1.2em; font-size: 0.88rem; }
  .toc-box ol li { margin: 4px 0; }
  .toc-box ol li a { text-decoration: none; }
  .toc-box ol li a:hover { text-decoration: underline; }
  /* 읽는 시간 (Tistory) */
  .read-time { font-size: 0.78rem; color: #9ca3af; margin-top: 4px; }
`

// ─────────────────────────────────────────────
// 플랫폼별 CSS 오버라이드
// ─────────────────────────────────────────────
function getPlatformCss(platform: PlatformId): string {
  if (platform === 'naver-blog') {
    return `
      body { font-family: "Apple SD Gothic Neo", "Pretendard", "Malgun Gothic", -apple-system, sans-serif; font-size: 16px; line-height: 1.9; padding: 0 0 80px; }
      article { max-width: 860px; padding: 40px 48px 60px; border-radius: 0; box-shadow: none; }
      header.doc-header h1 { font-size: 1.7rem; }
      h2 { font-size: 1.3rem; border-left: 4px solid #03c75a; padding-left: 12px; color: #111; }
      blockquote { border-left: 4px solid #03c75a; }
      .tag-chip { background: #f0fdf4; color: #166534; border: 1px solid #bbf7d0; }
      .tag-chip::before { content: "#"; }
      .meta-desc-box { display: none; }
      .thumb-banner { max-width: 860px; }
      .thumb-banner::after { background: linear-gradient(transparent, #f4f5f7); }
    `
  }
  if (platform === 'tistory') {
    return `
      body { font-family: "Noto Sans KR", "Apple SD Gothic Neo", "Malgun Gothic", sans-serif; font-size: 15.5px; line-height: 1.8; padding: 24px 16px 80px; }
      article { max-width: 720px; padding: 32px 36px 60px; border-radius: 12px; box-shadow: 0 1px 4px rgba(0,0,0,0.08); }
      header.doc-header h1 { font-size: 1.55rem; }
      h2 { font-size: 1.25rem; border-left: none; padding-left: 0; border-bottom: 2px solid #ff6b35; padding-bottom: 6px; color: #111; }
      blockquote { border-left: 4px solid #ff6b35; }
      .thumb-banner::after { background: linear-gradient(transparent, #f4f5f7); }
      .toc-box { background: #fff9f6; border: 1px solid #ffd5c2; }
      .toc-box .toc-title { color: #c44b1c; }
      .toc-box ol li a { color: #c44b1c; }
      .tag-chip { background: #fff3ee; color: #c44b1c; border: 1px solid #ffd5c2; }
      .tag-chip::before { content: "#"; }
      .meta-desc-box { background: #fff9f6; border-left: 3px solid #ff6b35; color: #555; }
    `
  }
  // blogger
  return `
    body { font-family: "Roboto", "Noto Sans KR", system-ui, sans-serif; font-size: 15px; line-height: 1.7; padding: 24px 16px 80px; }
    article { max-width: 660px; padding: 28px 32px 56px; border-radius: 4px; box-shadow: 0 1px 2px rgba(0,0,0,0.1); }
    header.doc-header h1 { font-size: 1.45rem; font-weight: 500; }
    h2 { font-size: 1.2rem; border-left: none; padding-left: 0; color: #1a73e8; font-weight: 500; border-bottom: 1px solid #e8eaed; padding-bottom: 6px; }
    blockquote { border-left: 4px solid #1a73e8; }
    .label-chip { background: #e8f0fd; color: #1558b0; border: 1px solid #c5d8f8; font-weight: 500; }
    .meta-desc-box { background: #f8f9fa; border-left: 3px solid #1a73e8; color: #5f6368; }
    table { font-size: 0.88rem; }
  `
}

// ─────────────────────────────────────────────
// 플랫폼 전환 네비 바
// ─────────────────────────────────────────────
function buildPlatformNav(historyId: string, current: PlatformId): string {
  const tabs = (['naver-blog', 'tistory', 'blogger'] as PlatformId[])
    .map((pid) => {
      const m = PLATFORM_META[pid]
      const isActive = pid === current
      const activeStyle = `background:${m.accent};color:#fff;border-color:${m.accent};`
      const inactiveStyle = `background:#fff;color:#555;border-color:#d1d5db;`
      if (isActive) {
        return `<span style="${activeStyle}">${m.emoji} ${m.label}</span>`
      }
      const url = `/api/dashboard/content-output-html?historyId=${encodeURIComponent(historyId)}&platform=${pid}`
      return `<a href="${url}" style="${inactiveStyle}">${m.emoji} ${m.label}</a>`
    })
    .join('')
  return `<nav class="platform-nav"><span class="nav-label">미리보기 플랫폼</span>${tabs}</nav>`
}

// ─────────────────────────────────────────────
// 플랫폼별 추가 HTML (TOC 컨테이너, 메타 설명, 태그/라벨)
// ─────────────────────────────────────────────
function buildPlatformExtras(
  platform: PlatformId,
  polished: GenerationHistoryPolished,
): { topHtml: string; bottomHtml: string; readTimeMin?: number } {
  const variants = polished.platformVariants
  const textLen = polished.fullContent.replace(/<[^>]+>/g, '').length
  const readTimeMin = Math.max(1, Math.ceil(textLen / 400))

  if (platform === 'naver-blog') {
    const tags = variants?.['naver-blog']?.tags ?? []
    const bottomHtml = tags.length
      ? `<div class="tag-row">${tags.map((t) => `<span class="tag-chip">${escapeHtml(t)}</span>`).join('')}</div>`
      : ''
    return { topHtml: '', bottomHtml }
  }

  if (platform === 'tistory') {
    const meta = variants?.['tistory']
    const metaHtml = meta?.metaDescription
      ? `<div class="meta-desc-box">${escapeHtml(meta.metaDescription)}</div>`
      : ''
    const tags = meta?.tags ?? []
    const bottomHtml = tags.length
      ? `<div class="tag-row">${tags.map((t) => `<span class="tag-chip">${escapeHtml(t)}</span>`).join('')}</div>`
      : ''
    // TOC는 JS로 동적 생성 — 빈 컨테이너만 여기에 삽입
    return {
      topHtml: `${metaHtml}<div id="toc-box" class="toc-box" style="display:none"></div>`,
      bottomHtml,
      readTimeMin,
    }
  }

  // blogger
  const meta = variants?.['blogger']
  const metaHtml = meta?.metaDescription
    ? `<div class="meta-desc-box">${escapeHtml(meta.metaDescription)}</div>`
    : ''
  const labels = meta?.labels ?? []
  const bottomHtml = labels.length
    ? `<div class="tag-row">${labels.map((l) => `<span class="label-chip">${escapeHtml(l)}</span>`).join('')}</div>`
    : ''
  return { topHtml: metaHtml, bottomHtml }
}

// ─────────────────────────────────────────────
// HTML 문서 래핑
// ─────────────────────────────────────────────
function wrapHtmlDocument(opts: {
  title: string
  bodyHtml: string
  summary?: string
  generatedAt?: string
  platform: PlatformId
  historyId: string
  extras: ReturnType<typeof buildPlatformExtras>
  thumbnailBase64?: string
}): string {
  const { title, bodyHtml, summary, generatedAt, platform, historyId, extras, thumbnailBase64 } = opts
  const m = PLATFORM_META[platform]
  const escapedTitle = escapeHtml(title)

  const readTimeLine =
    extras.readTimeMin && platform === 'tistory'
      ? `<p class="read-time">⏱ 읽는 시간 약 ${extras.readTimeMin}분</p>`
      : ''

  const tocScript =
    platform === 'tistory'
      ? `
(function buildTOC() {
  var toc = document.getElementById('toc-box');
  if (!toc) return;
  /* AI가 본문에 "목차" 섹션을 직접 생성하는 경우 숨김 처리 — toc-box와 중복 방지
     한글(AC00-D7A3)만 남겨 이모지·공백 변형에 무관하게 "목차" 여부 판별 */
  document.querySelectorAll('article h2').forEach(function(h) {
    var kor = h.textContent.replace(/[^가-힣]/g, '');
    if (kor === '목차') {
      h.style.display = 'none';
      var sib = h.nextElementSibling;
      while (sib && (sib.tagName === 'OL' || sib.tagName === 'UL' || sib.tagName === 'P' || sib.tagName === 'LI')) {
        sib.style.display = 'none';
        sib = sib.nextElementSibling;
      }
    }
  });
  /* 목차·no-toc h2를 제외한 실제 섹션 h2만 수집 */
  var h2s = Array.from(document.querySelectorAll('article h2:not([data-no-toc])')).filter(function(h) {
    var kor = h.textContent.replace(/[^가-힣]/g, '');
    return kor !== '목차' && h.style.display !== 'none';
  });
  if (h2s.length < 2) return;
  var items = h2s.map(function(h, i) {
    h.id = 'toc-sec-' + i;
    return '<li><a href="#toc-sec-' + i + '">' + h.textContent.trim() + '</a></li>';
  }).join('');
  toc.innerHTML = '<p class="toc-title">📋 목차</p><ol>' + items + '</ol>';
  toc.style.display = 'block';
})();`
      : ''

  const thumbnailHtml = thumbnailBase64
    ? `<div class="thumb-banner"><img src="data:image/png;base64,${thumbnailBase64}" alt="${escapedTitle} 썸네일"></div>`
    : ''

  return `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapedTitle}</title>
<style>
${CSS_COMMON}
${getPlatformCss(platform)}
</style>
</head>
<body>
${buildPlatformNav(historyId, platform)}
${thumbnailHtml}
<article>
<header class="doc-header">
<h1>${escapedTitle}</h1>
${summary ? `<p class="summary">${escapeHtml(summary)}</p>` : ''}
${readTimeLine}
${generatedAt ? `<p class="meta">기준: ${escapeHtml(new Date(generatedAt).toLocaleString('ko-KR'))} &nbsp;·&nbsp; <span style="background:${m.accentLight};color:${m.textDark};padding:2px 8px;border-radius:10px;font-size:0.78rem;font-weight:600;">${m.label} 미리보기</span></p>` : ''}
</header>
${extras.topHtml}
${bodyHtml}
${extras.bottomHtml}
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
(function initDateTables() {
  /* KST 기준 오늘 날짜 (YYYY-MM-DD) — 서버 데이터와 동일한 형식 */
  var d = new Date();
  var today = d.getFullYear() + '-'
    + String(d.getMonth() + 1).padStart(2, '0') + '-'
    + String(d.getDate()).padStart(2, '0');
  document.querySelectorAll('table').forEach(function(table) {
    var headers = Array.from(table.querySelectorAll('th')).map(function(th) { return th.textContent.trim(); });
    var dateColIdx = headers.findIndex(function(h) { return h.includes('날짜'); });
    if (dateColIdx === -1) return;
    var tbody = table.querySelector('tbody');
    if (!tbody) return;
    /* 단순 숫자 열만 쉼표 포맷 (복합 "N(-P%)" 열은 서버사이드에서 처리됨) */
    var priceColIdxs = headers.reduce(function(acc, h, i) {
      if (i !== dateColIdx && !h.includes('률') && !h.includes('%')) acc.push(i);
      return acc;
    }, []);
    /* 날짜 오름차순 → 내림차순 (최신이 위로) */
    var rows = Array.from(tbody.querySelectorAll('tr'));
    rows.reverse().forEach(function(row) { tbody.appendChild(row); });
    tbody.querySelectorAll('tr').forEach(function(row) {
      var cells = row.querySelectorAll('td');
      /* 순수 숫자 셀만 쉼표 포맷 */
      priceColIdxs.forEach(function(ci) {
        if (!cells[ci]) return;
        var raw = cells[ci].textContent.trim().replace(/,/g, '');
        var num = Number(raw);
        if (!Number.isNaN(num) && raw === String(Math.round(num)) && num > 0) {
          cells[ci].textContent = num.toLocaleString('ko-KR');
        }
      });
      /* 오늘 날짜 행 강조 */
      if (cells[dateColIdx] && cells[dateColIdx].textContent.trim() === today) {
        row.classList.add('today-row');
      }
    });
  });
})();
${tocScript}
</script>
</body>
</html>`
}

// ─────────────────────────────────────────────
// 공개 API
// ─────────────────────────────────────────────

/** content_generation_history 1건을 발행 전 미리보기용 standalone HTML 문서로 렌더링 */
export function renderContentOutputHtml(
  item: GenerationHistoryItem,
  opts?: { platform?: PlatformId; historyId?: string; thumbnailBase64?: string; chartBgBase64?: string },
): string {
  const polished = item.polished
  if (!polished) {
    throw new Error('polished 콘텐츠가 없습니다.')
  }

  const platform: PlatformId = opts?.platform ?? 'naver-blog'
  const historyId = opts?.historyId ?? item.id

  const preprocessed = preprocessMarkdown(polished.fullContent, polished, opts?.chartBgBase64)
  const bodyHtml = postprocessHtml(marked.parse(preprocessed) as string)
  const extras = buildPlatformExtras(platform, polished)

  return wrapHtmlDocument({
    title: polished.title || item.publishTopic,
    bodyHtml,
    summary: polished.summary,
    generatedAt: polished.polishedAt,
    platform,
    historyId,
    extras,
    thumbnailBase64: opts?.thumbnailBase64,
  })
}
