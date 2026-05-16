export interface Category {
  id: string
  name: string
  color: string
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

export const CATEGORY_COLORS = [
  { value: 'blue',   label: '파란색', bg: 'bg-blue-100',   text: 'text-blue-700',   border: 'border-blue-300' },
  { value: 'green',  label: '초록색', bg: 'bg-green-100',  text: 'text-green-700',  border: 'border-green-300' },
  { value: 'purple', label: '보라색', bg: 'bg-purple-100', text: 'text-purple-700', border: 'border-purple-300' },
  { value: 'orange', label: '주황색', bg: 'bg-orange-100', text: 'text-orange-700', border: 'border-orange-300' },
  { value: 'red',    label: '빨간색', bg: 'bg-red-100',    text: 'text-red-700',    border: 'border-red-300' },
  { value: 'yellow', label: '노란색', bg: 'bg-yellow-100', text: 'text-yellow-700', border: 'border-yellow-300' },
  { value: 'pink',   label: '분홍색', bg: 'bg-pink-100',   text: 'text-pink-700',   border: 'border-pink-300' },
  { value: 'gray',   label: '회색',   bg: 'bg-gray-100',   text: 'text-gray-600',   border: 'border-gray-300' },
]

export function getColorConfig(color: string) {
  return CATEGORY_COLORS.find(c => c.value === color) ?? CATEGORY_COLORS[0]
}

export const DEFAULT_CATEGORIES: Category[] = [
  { id: 'cat-1', name: '경제/재테크', color: 'blue',   createdAt: '2026-05-16' },
  { id: 'cat-2', name: '자기계발',    color: 'green',  createdAt: '2026-05-16' },
  { id: 'cat-3', name: '라이프스타일',color: 'purple', createdAt: '2026-05-16' },
  { id: 'cat-4', name: '수익화',      color: 'orange', createdAt: '2026-05-16' },
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
