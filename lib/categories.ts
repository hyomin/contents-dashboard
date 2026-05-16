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

export const DEFAULT_CATEGORIES: Category[] = [
  { id: 'cat-1', name: '경제/재테크',  bgColor: '#2563EB', textColor: 'auto', createdAt: '2026-05-16' },
  { id: 'cat-2', name: '자기계발',     bgColor: '#16A34A', textColor: 'auto', createdAt: '2026-05-16' },
  { id: 'cat-3', name: '라이프스타일', bgColor: '#9333EA', textColor: 'auto', createdAt: '2026-05-16' },
  { id: 'cat-4', name: '수익화',       bgColor: '#EA580C', textColor: 'auto', createdAt: '2026-05-16' },
]

export const DEFAULT_BENCHMARKS: BenchmarkItem[] = [
  {
    id: 'bm-1',
    url: 'https://www.youtube.com/watch?v=example1',
    title: '2024 경제 전망 - 금리 인상의 끝은?',
    memo: '인트로 훅 방식 참고, 첫 15초 안에 핵심 수치 제시',
    categoryId: 'cat-1',
    platform: 'youtube',
    addedAt: '2일 전',
    vsAvg: 5.2,
    views: 150000,
  },
  {
    id: 'bm-2',
    url: 'https://www.youtube.com/watch?v=example2',
    title: '부동산 투자 가이드 - 초보자도 쉽게',
    memo: '썸네일 숫자 강조 레이아웃 참고',
    categoryId: 'cat-1',
    platform: 'youtube',
    addedAt: '3일 전',
    vsAvg: 4.1,
    views: 120000,
  },
  {
    id: 'bm-3',
    url: 'https://blog.naver.com/example',
    title: '아침 루틴으로 하루를 바꾸는 방법',
    memo: 'SEO 제목 구조, H2 사용 방식 참고',
    categoryId: 'cat-2',
    platform: 'naver-blog',
    addedAt: '5일 전',
    vsAvg: 3.4,
    views: 85000,
  },
  {
    id: 'bm-4',
    url: 'https://www.instagram.com/p/example',
    title: '월 100만원 블로그 수익화 전략',
    memo: '릴스 첫 3초 훅, 자막 크기 참고',
    categoryId: 'cat-4',
    platform: 'instagram',
    addedAt: '1주일 전',
    vsAvg: 6.8,
    views: 200000,
  },
]
