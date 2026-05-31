import { NextRequest, NextResponse } from 'next/server'
import type { GuideCategory } from '@/lib/dashboard/content-creation-guide'
import {
  suggestionToHistory,
  type TopicGuideHistoryItem,
} from '@/lib/dashboard/topic-guide-history-types'
import type { TopicKeywordGuideSuggestion } from '@/lib/dashboard/topic-keyword-guide'
import {
  attachSelectionToTopicGuideHistory,
  clearTopicGuideHistory,
  deleteTopicGuideHistory,
  insertTopicGuideHistory,
  listTopicGuideHistory,
} from '@/lib/data/topic-guide-history-queries'

export async function GET() {
  const items = await listTopicGuideHistory()
  return NextResponse.json({ items })
}

/** 가이드 생성 결과 저장 */
export async function POST(request: NextRequest) {
  const body = await request.json()
  const seedKeyword = String(body.seedKeyword ?? '').trim()
  const category = (body.category ?? 'writing') as GuideCategory
  const suggestionsRaw = body.suggestions as TopicKeywordGuideSuggestion[] | undefined
  const guideGeneratedAt = body.guideGeneratedAt
    ? String(body.guideGeneratedAt)
    : new Date().toISOString()

  if (!seedKeyword) {
    return NextResponse.json({ error: 'seedKeyword가 필요합니다' }, { status: 400 })
  }
  if (!Array.isArray(suggestionsRaw) || suggestionsRaw.length === 0) {
    return NextResponse.json({ error: 'suggestions가 필요합니다' }, { status: 400 })
  }

  const now = new Date().toISOString()
  const item: TopicGuideHistoryItem = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    seedKeyword,
    category,
    suggestions: suggestionsRaw.map(suggestionToHistory).slice(0, 10),
    guideGeneratedAt,
    createdAt: now,
    updatedAt: now,
  }

  const saved = await insertTopicGuideHistory(item)
  if (!saved.ok || !saved.item) {
    return NextResponse.json({ error: saved.error ?? 'Save failed' }, { status: 500 })
  }
  return NextResponse.json({ item: saved.item })
}

/** 사용자 선택 기록 */
export async function PATCH(request: NextRequest) {
  const body = await request.json()
  const id = String(body.id ?? '')
  const selected = body.selectedSuggestion as TopicKeywordGuideSuggestion | undefined
  const selectedPublishTopic = String(body.selectedPublishTopic ?? selected?.title ?? '').trim()

  if (!id || !selected?.title?.trim()) {
    return NextResponse.json({ error: 'id와 selectedSuggestion이 필요합니다' }, { status: 400 })
  }

  const saved = await attachSelectionToTopicGuideHistory(
    id,
    suggestionToHistory(selected),
    selectedPublishTopic,
  )
  if (!saved.ok || !saved.item) {
    return NextResponse.json({ error: saved.error ?? 'Update failed' }, { status: 500 })
  }
  return NextResponse.json({ item: saved.item })
}

export async function DELETE(request: NextRequest) {
  const url = new URL(request.url)
  const all = url.searchParams.get('all') === '1'

  if (all) {
    const result = await clearTopicGuideHistory()
    if (!result.ok) {
      return NextResponse.json({ error: result.error ?? 'Clear failed' }, { status: 500 })
    }
    return NextResponse.json({ ok: true })
  }

  const id = url.searchParams.get('id')
  if (!id) {
    return NextResponse.json({ error: 'id required' }, { status: 400 })
  }

  const result = await deleteTopicGuideHistory(id)
  if (!result.ok) {
    return NextResponse.json({ error: result.error ?? 'Delete failed' }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
