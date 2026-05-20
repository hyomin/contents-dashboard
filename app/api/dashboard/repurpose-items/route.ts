import { NextRequest, NextResponse } from 'next/server'
import { getRepurposeItems, replaceRepurposeItems } from '@/lib/workspace-queries'
import type { RepurposeItemStored } from '@/lib/dashboard-storage'

export async function GET() {
  return NextResponse.json(await getRepurposeItems())
}

export async function PUT(request: NextRequest) {
  const items = (await request.json()) as RepurposeItemStored[]
  const ok = await replaceRepurposeItems(items)
  if (!ok) return NextResponse.json({ error: 'Save failed' }, { status: 500 })
  return NextResponse.json({ ok: true })
}
