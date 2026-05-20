import { NextRequest, NextResponse } from 'next/server'
import { getCalendarItems, replaceCalendarItems } from '@/lib/workspace-queries'
import type { CalendarItemStored } from '@/lib/dashboard-storage'

export async function GET() {
  return NextResponse.json(await getCalendarItems())
}

export async function PUT(request: NextRequest) {
  const items = (await request.json()) as CalendarItemStored[]
  const ok = await replaceCalendarItems(items)
  if (!ok) return NextResponse.json({ error: 'Save failed' }, { status: 500 })
  return NextResponse.json({ ok: true })
}
