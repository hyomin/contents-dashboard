export interface Category {
  id: string
  name: string
  bgColor: string           // hex e.g. "#3B82F6"
  textColor: 'auto' | 'white' | 'dark'  // auto = luminance 기반 자동 결정
  createdAt: string
}

export interface BenchmarkItem {
  id: string
  url: string
  title: string
  memo: string
  categoryId: string
  platform: 'youtube' | 'instagram' | 'naver-blog' | 'tistory' | 'other'
  addedAt: string
  vsAvg?: number
  views?: number
}

// ─── 색상 유틸 ────────────────────────────────────────────────
export function hexLuminance(hex: string): number {
  const clean = hex.replace('#', '')
  const r = parseInt(clean.slice(0, 2), 16) / 255
  const g = parseInt(clean.slice(2, 4), 16) / 255
  const b = parseInt(clean.slice(4, 6), 16) / 255
  const lin = (c: number) => c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)
}

/** 자동 대비 결정: luminance 0.35 기준 이하면 흰 글씨 */
export function autoTextColor(bgHex: string): '#ffffff' | '#1f2937' {
  return hexLuminance(bgHex) <= 0.35 ? '#ffffff' : '#1f2937'
}

/** Category의 실제 텍스트 색상 값 반환 */
export function resolveTextColor(cat: Category): string {
  if (cat.textColor === 'white') return '#ffffff'
  if (cat.textColor === 'dark') return '#1f2937'
  return autoTextColor(cat.bgColor)
}

/** 배경이 진하면 solid, 밝으면 light tint */
export function getCategoryStyle(cat: Category): {
  background: string
  color: string
  border: string
} {
  const textCol = resolveTextColor(cat)
  const lum = hexLuminance(cat.bgColor)
  if (lum <= 0.35) {
    // 진한 색: solid bg
    return { background: cat.bgColor, color: textCol, border: cat.bgColor }
  } else {
    // 밝은 색: tint bg (hex + 25% opacity)
    return { background: `${cat.bgColor}40`, color: textCol, border: `${cat.bgColor}80` }
  }
}

// 카테고리/벤치마크 데이터는 Supabase에서 관리됩니다.
// API: /api/dashboard/benchmark-categories, /api/dashboard/benchmarks
// 아래는 신규 설치 시 seed 용도 또는 TopicSuggestView 등에서 폴백으로 사용합니다.
export const DEFAULT_CATEGORIES: Category[] = []
