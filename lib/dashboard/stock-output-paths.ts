/**
 * 주식 리포트 차트/슬라이드 이미지 출력 경로 규칙
 *
 * 출력 구조: stock/<YYYY-MM-DD>/<daily|research>/<chart|slide>/{종목명}-{번호}.png
 */
import { mkdirSync } from 'node:fs'
import { resolve } from 'node:path'

export type StockOutputKind = 'daily' | 'research'
export type StockOutputVariant = 'chart' | 'slide'

/** 출력 디렉터리 절대경로 반환 (없으면 생성) */
export function resolveStockOutputDir(reportDate: string, kind: StockOutputKind, variant: StockOutputVariant): string {
  const dir = resolve(process.cwd(), 'stock', reportDate, kind, variant)
  mkdirSync(dir, { recursive: true })
  return dir
}

/** 종목/지수명을 파일명으로 안전하게 변환 (공백·특수문자 제거, 한글은 유지) */
export function sanitizeStockName(name: string): string {
  return name
    .trim()
    .replace(/[\s&/\\?%*:|"<>()[\]{}.,]+/g, '')
    || 'unnamed'
}

/** {종목명}-{번호}.png 파일명 생성 */
export function stockChartFileName(name: string, index: number): string {
  return `${sanitizeStockName(name)}-${index}.png`
}

/** API 응답·UI 노출용 상대경로: stock/<date>/<daily|research>/<chart|slide>/파일명.png */
export function stockOutputRelativePath(
  reportDate: string,
  kind: StockOutputKind,
  variant: StockOutputVariant,
  fileName: string,
): string {
  return `stock/${reportDate}/${kind}/${variant}/${fileName}`
}
