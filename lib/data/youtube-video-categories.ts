/** YouTube Data API video snippet.categoryId → 한글 라벨 (참고용) */
export const YOUTUBE_VIDEO_CATEGORY_LABELS: Record<string, string> = {
  '1': '영화·애니',
  '2': '자동차',
  '10': '음악',
  '15': '반려동물',
  '17': '스포츠',
  '19': '여행·이벤트',
  '20': '게임',
  '22': '블로그·일상',
  '23': '코미디',
  '24': '엔터테인먼트',
  '25': '뉴스·정치',
  '26': '노하우·스타일',
  '27': '교육',
  '28': '과학·기술',
  '29': '비영리',
}

export function youtubeCategoryLabel(categoryId: string | null | undefined): string | null {
  if (!categoryId) return null
  return YOUTUBE_VIDEO_CATEGORY_LABELS[categoryId] ?? `카테고리 ${categoryId}`
}
