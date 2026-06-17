/**
 * guidelines/contents_guideline.md — Agent 프롬프트용 가이드라인 로더 (서버 전용)
 */
import fs from 'fs'
import path from 'path'
import { STOCK_CHART_LABELS, type StockChartIndex } from '@/lib/dashboard/stock-chart-render'

export type ContentsGuidelineSectionId =
  | 'common'
  | 'blog'
  | 'blog-image'
  | 'stock-report'
  | 'stock-chart-image'
  | 'platform-shortform-spec'
  | 'shortform'
  | 'shortform-categories'

export interface ContentsGuidelineCategory {
  id: string
  label: string
  description: string
}

export interface ContentsGuidelineFile {
  path: string
  blogImageGuideCount: number
  sections: Record<ContentsGuidelineSectionId, string>
  categories: ContentsGuidelineCategory[]
}

const SECTION_IDS: ContentsGuidelineSectionId[] = [
  'common',
  'blog',
  'blog-image',
  'stock-report',
  'stock-chart-image',
  'platform-shortform-spec',
  'shortform',
  'shortform-categories',
]

let platformSpecCache: { mtimeMs: number; text: string } | null = null

export function getPlatformShortformSpecsPath(): string {
  return path.join(process.cwd(), 'guidelines', 'platform_shortform_specs.md')
}

/** Branderkey 플랫폼 스펙 — 숏폼 Agent **최우선** (별도 MD) */
export function getPlatformShortformSpecBlock(): string {
  const filePath = getPlatformShortformSpecsPath()
  if (!fs.existsSync(filePath)) {
    return getAgentGuidelineSection('platform-shortform-spec')
  }
  try {
    const stat = fs.statSync(filePath)
    if (platformSpecCache && platformSpecCache.mtimeMs === stat.mtimeMs) {
      return platformSpecCache.text
    }
    const raw = fs.readFileSync(filePath, 'utf8')
    const { body } = parseFrontmatter(raw)
    const marker = body.match(/<!--\s*agent:platform-shortform-spec\s*-->/i)
    let text = body
    if (marker && marker.index !== undefined) {
      const start = marker.index + marker[0].length
      const next = body.slice(start).search(/<!--\s*agent:/i)
      text = next >= 0 ? body.slice(start, start + next) : body.slice(start)
    }
    const trimmed = text.trim()
    platformSpecCache = { mtimeMs: stat.mtimeMs, text: trimmed }
    return trimmed
  } catch (err) {
    console.warn('[contents-guideline] platform spec load failed', err)
    return getAgentGuidelineSection('platform-shortform-spec')
  }
}

const AGENT_MARKER = /<!--\s*agent:([\w-]+)\s*-->/g

let cache: { mtimeMs: number; data: ContentsGuidelineFile } | null = null

export function getContentsGuidelinePath(): string {
  return path.join(process.cwd(), 'guidelines', 'contents_guideline.md')
}

function parseFrontmatter(raw: string): { meta: Record<string, string>; body: string } {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/)
  if (!match) return { meta: {}, body: raw }
  const meta: Record<string, string> = {}
  for (const line of match[1].split('\n')) {
    const t = line.trim()
    if (!t || t.startsWith('#')) continue
    const colon = t.indexOf(':')
    if (colon === -1) continue
    meta[t.slice(0, colon).trim()] = t.slice(colon + 1).trim()
  }
  return { meta, body: raw.slice(match[0].length) }
}

function parseAgentSections(body: string): Record<string, string> {
  const sections: Record<string, string> = {}
  const markers: { id: string; index: number; len: number }[] = []
  let m: RegExpExecArray | null
  const re = new RegExp(AGENT_MARKER.source, 'g')
  while ((m = re.exec(body)) !== null) {
    markers.push({ id: m[1], index: m.index, len: m[0].length })
  }
  for (let i = 0; i < markers.length; i++) {
    const start = markers[i].index + markers[i].len
    const end = i + 1 < markers.length ? markers[i + 1].index : body.length
    sections[markers[i].id] = body.slice(start, end).trim()
  }
  return sections
}

function parseCategoriesBlock(block: string): ContentsGuidelineCategory[] {
  const categories: ContentsGuidelineCategory[] = []
  const parts = block.split(/###\s+category-id:\s*/i).filter(Boolean)
  for (const part of parts) {
    const idLine = part.split('\n')[0]?.trim()
    if (!idLine) continue
    const id = idLine.replace(/\s+#.*$/, '').trim()
    const label = part.match(/\*\*label:\*\*\s*(.+)/i)?.[1]?.trim()
    const description = part.match(/\*\*description:\*\*\s*(.+)/i)?.[1]?.trim()
    if (!label || !description) continue
    categories.push({ id, label, description })
  }
  return categories
}

function parseGuidelineFile(raw: string, filePath: string): ContentsGuidelineFile {
  const { meta, body } = parseFrontmatter(raw)
  const parsed = parseAgentSections(body)
  const sections = {} as Record<ContentsGuidelineSectionId, string>
  for (const id of SECTION_IDS) {
    sections[id] = parsed[id] ?? ''
  }
  const countRaw = meta.blog_image_guide_count ?? '3'
  const blogImageGuideCount = Math.min(5, Math.max(1, Number.parseInt(countRaw, 10) || 3))
  return {
    path: filePath,
    blogImageGuideCount,
    sections,
    categories: parseCategoriesBlock(sections['shortform-categories']),
  }
}

/** 서버: MD 파일 로드 (mtime 캐시) */
export function loadContentsGuideline(): ContentsGuidelineFile {
  const filePath = getContentsGuidelinePath()
  if (!fs.existsSync(filePath)) {
    throw new Error(`가이드라인 파일이 없습니다: ${filePath}`)
  }
  const stat = fs.statSync(filePath)
  if (cache && cache.mtimeMs === stat.mtimeMs) return cache.data
  const raw = fs.readFileSync(filePath, 'utf8')
  const data = parseGuidelineFile(raw, filePath)
  cache = { mtimeMs: stat.mtimeMs, data }
  return data
}

export function getAgentGuidelineSection(id: ContentsGuidelineSectionId): string {
  try {
    return loadContentsGuideline().sections[id] ?? ''
  } catch (err) {
    console.warn('[contents-guideline] load failed', err)
    return ''
  }
}

export function getBlogImageGuideCount(): number {
  try {
    return loadContentsGuideline().blogImageGuideCount
  } catch {
    return 3
  }
}

/** blog-image 섹션 + {{imageGuideCount}} 치환 */
export function getBlogImageAgentBlock(imageGuideCount?: number): string {
  const count = imageGuideCount ?? getBlogImageGuideCount()
  const section = getAgentGuidelineSection('blog-image')
  if (!section) return ''
  return section.replace(/\{\{imageGuideCount\}\}/g, String(count))
}

export function findGuidelineCategory(
  categoryId: string | undefined,
): ContentsGuidelineCategory | undefined {
  if (!categoryId) return undefined
  try {
    return loadContentsGuideline().categories.find((c) => c.id === categoryId)
  } catch {
    return undefined
  }
}

/** 숏폼 카테고리 → Agent 프롬프트 블록 (MD 우선) */
export function buildShortformCategoryAgentBlock(categoryId: string | undefined): string {
  const fromMd = findGuidelineCategory(categoryId)
  if (!fromMd) return ''

  return `
## 숏폼 카테고리 (필수 반영 — contents_guideline.md)
- 유형: ${fromMd.label}
- 제작 방향: ${fromMd.description}
`.trim()
}

/** common + blog | shortform (+ 선택 카테고리) */
export function buildAgentFormatGuidelineBlock(
  format: 'blog' | 'shortform',
  shortformCategoryId?: string,
): string {
  const common = getAgentGuidelineSection('common')
  const parts: string[] = []
  if (common) parts.push(common)

  if (format === 'blog') {
    const blog = getAgentGuidelineSection('blog')
    const blogImage = getBlogImageAgentBlock()
    if (blog) parts.push(blog)
    if (blogImage) parts.push(blogImage)
  } else {
    const platformSpec = getPlatformShortformSpecBlock()
    if (platformSpec) {
      parts.push(
        `## [최우선] 플랫폼별 숏폼 스펙 (스크립트·길이·안전영역 — 반드시 먼저 준수)\n\n${platformSpec}`,
      )
    }
    const shortform = getAgentGuidelineSection('shortform')
    const category = buildShortformCategoryAgentBlock(shortformCategoryId)
    if (shortform) parts.push(shortform)
    if (category) parts.push(category)
  }

  return parts.filter(Boolean).join('\n\n')
}

/** stock-chart-image 섹션 + {{availableCharts}} 치환 — 이번 리포트에서 자동 생성될 차트 목록 */
export function buildStockChartImageAgentBlock(chartIndexes: StockChartIndex[]): string {
  const section = getAgentGuidelineSection('stock-chart-image')
  if (!section) return ''
  const availableCharts = chartIndexes
    .map((index) => `- output_${index}.png: ${STOCK_CHART_LABELS[index]}`)
    .join('\n')
  return section.replace(/\{\{availableCharts\}\}/g, availableCharts)
}

/** common + blog + stock-chart-image + stock-report — 주식 리포트(일일/포커스/섹터 공통) Agent 프롬프트 블록 */
function buildStockReportGuidelineBlock(chartIndexes: StockChartIndex[]): string {
  const common = getAgentGuidelineSection('common')
  const blog = getAgentGuidelineSection('blog')
  const stockChartImage = buildStockChartImageAgentBlock(chartIndexes)
  const stockReport = getAgentGuidelineSection('stock-report')
  return [common, blog, stockChartImage, stockReport].filter(Boolean).join('\n\n')
}

/** 종목/지수별 일일 리포트 Agent 프롬프트 블록 */
export function buildStockDailyItemGuidelineBlock(chartIndexes: StockChartIndex[]): string {
  return buildStockReportGuidelineBlock(chartIndexes)
}

/** 종목 분석(포커스) 리포트 Agent 프롬프트 블록 */
export function buildStockFocusReportGuidelineBlock(chartIndexes: StockChartIndex[]): string {
  return buildStockReportGuidelineBlock(chartIndexes)
}

/** 섹터/카테고리 종합분석 리포트 Agent 프롬프트 블록 */
export function buildSectorResearchReportGuidelineBlock(chartIndexes: StockChartIndex[]): string {
  return buildStockReportGuidelineBlock(chartIndexes)
}

/** 캐시 초기화 (테스트·핫 리로드) */
export function clearContentsGuidelineCache(): void {
  cache = null
  platformSpecCache = null
}
