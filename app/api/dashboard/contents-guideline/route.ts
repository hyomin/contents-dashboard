import { NextResponse } from 'next/server'
import {
  getContentsGuidelinePath,
  loadContentsGuideline,
} from '@/lib/dashboard/contents-guideline'

/** 가이드라인 MD 메타 (편집·확인용) */
export async function GET() {
  try {
    const data = loadContentsGuideline()
    return NextResponse.json({
      path: data.path,
      blogImageGuideCount: data.blogImageGuideCount,
      sections: Object.fromEntries(
        (Object.keys(data.sections) as (keyof typeof data.sections)[]).map((k) => [
          k,
          { charCount: data.sections[k].length, preview: data.sections[k].slice(0, 120) },
        ]),
      ),
      categoryIds: data.categories.map((c) => c.id),
      readme: 'dashboard-app/guidelines/README.md',
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : '가이드라인 로드 실패'
    return NextResponse.json(
      { error: message, path: getContentsGuidelinePath() },
      { status: 500 },
    )
  }
}
