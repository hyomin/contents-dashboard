import { NextRequest, NextResponse } from 'next/server'
import {
  getCalendarItems,
  replaceCalendarItems,
  upsertCalendarItem,
  deleteCalendarItem,
} from '@/lib/data/workspace-queries'
import type { CalendarItemStored } from '@/lib/dashboard/dashboard-storage'

export async function GET() {
  return NextResponse.json(await getCalendarItems())
}

/** 전체 목록 교체 (기존 동작 유지) */
export async function PUT(request: NextRequest) {
  const items = (await request.json()) as CalendarItemStored[]
  const ok = await replaceCalendarItems(items)
  if (!ok) return NextResponse.json({ error: 'Save failed' }, { status: 500 })
  return NextResponse.json({ ok: true })
}

/** 단건 추가/수정 */
export async function PATCH(request: NextRequest) {
  const item = (await request.json()) as CalendarItemStored
  if (!item?.id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  const ok = await upsertCalendarItem(item)
  if (!ok) return NextResponse.json({ error: 'Save failed' }, { status: 500 })
  return NextResponse.json({ ok: true })
}

/** 단건 삭제 */
export async function DELETE(request: NextRequest) {
  const { id } = (await request.json()) as { id: string }
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  const ok = await deleteCalendarItem(id)
  if (!ok) return NextResponse.json({ error: 'Delete failed' }, { status: 500 })
  return NextResponse.json({ ok: true })
}
