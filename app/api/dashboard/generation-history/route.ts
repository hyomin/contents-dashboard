import { NextRequest, NextResponse } from 'next/server'
import type { ContentPolishResult } from '@/lib/dashboard/content-polish'
import type { GuideCategory } from '@/lib/dashboard/content-creation-guide'
import {
  polishToHistory,
  scriptToDraft,
  type GenerationHistoryItem,
} from '@/lib/dashboard/generation-history-types'
import type { ScriptGuideOutput } from '@/lib/dashboard/script-guide-output'
import {
  attachPolishedToHistory,
  bulkInsertGenerationHistory,
  clearGenerationHistory,
  deleteGenerationHistory,
  insertGenerationHistory,
  listGenerationHistory,
} from '@/lib/data/generation-history-queries'

export async function GET() {
  const items = await listGenerationHistory()
  return NextResponse.json({ items })
}

/** 신규 생성 기록 추가 */
export async function POST(request: NextRequest) {
  const body = await request.json()

  if (body.action === 'migrate' && Array.isArray(body.items)) {
    const result = await bulkInsertGenerationHistory(body.items as GenerationHistoryItem[])
    if (!result.ok) {
      return NextResponse.json({ error: result.error ?? 'Migration failed' }, { status: 500 })
    }
    return NextResponse.json({ ok: true, count: result.count })
  }

  const result = body.result as ScriptGuideOutput | undefined
  const publishTopic = String(body.publishTopic ?? '').trim()
  const category = (body.category ?? 'writing') as GuideCategory
  const referenceTitles = Array.isArray(body.referenceTitles)
    ? body.referenceTitles.map(String)
    : []

  if (!result?.fullScript?.trim() && !result?.title?.trim()) {
    return NextResponse.json({ error: 'result가 필요합니다' }, { status: 400 })
  }

  if (!result.fullScript?.trim()) {
    console.warn('[generation-history] draft fullScript empty, title only saved', result.title)
  }

  const now = new Date().toISOString()
  const item: GenerationHistoryItem = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    publishTopic,
    category,
    referenceCount: referenceTitles.length,
    referenceTitles: referenceTitles.slice(0, 10),
    draft: scriptToDraft(result),
    createdAt: now,
    updatedAt: now,
  }

  const saved = await insertGenerationHistory(item)
  if (!saved.ok || !saved.item) {
    return NextResponse.json({ error: saved.error ?? 'Save failed' }, { status: 500 })
  }
  return NextResponse.json({ item: saved.item })
}

/** 내 콘텐츠화 결과 연결 */
export async function PATCH(request: NextRequest) {
  const body = await request.json()
  const id = String(body.id ?? '')
  const polished = body.polished as ContentPolishResult | undefined

  if (!id || !polished?.fullContent) {
    return NextResponse.json({ error: 'id와 polished가 필요합니다' }, { status: 400 })
  }

  const saved = await attachPolishedToHistory(id, polishToHistory(polished))
  if (!saved.ok || !saved.item) {
    return NextResponse.json({ error: saved.error ?? 'Update failed' }, { status: 500 })
  }
  return NextResponse.json({ item: saved.item })
}

export async function DELETE(request: NextRequest) {
  const url = new URL(request.url)
  const all = url.searchParams.get('all') === '1'

  if (all) {
    const result = await clearGenerationHistory()
    if (!result.ok) {
      return NextResponse.json({ error: result.error ?? 'Clear failed' }, { status: 500 })
    }
    return NextResponse.json({ ok: true })
  }

  const id = url.searchParams.get('id') ?? (await request.json().catch(() => ({}))).id
  if (!id) {
    return NextResponse.json({ error: 'id required' }, { status: 400 })
  }

  const result = await deleteGenerationHistory(String(id))
  if (!result.ok) {
    return NextResponse.json({ error: result.error ?? 'Delete failed' }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
