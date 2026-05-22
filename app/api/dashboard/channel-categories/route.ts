import { NextRequest, NextResponse } from 'next/server'
import { listChannelCategories, upsertChannelCategory } from '@/lib/data/channel-category-queries'

export async function GET() {
  const categories = await listChannelCategories()
  return NextResponse.json(categories)
}

export async function POST(request: NextRequest) {
  const body = await request.json()
  const { id, name, icon, bg_color, text_color, sort_order } = body
  if (!id || !name) {
    return NextResponse.json({ error: 'id, name required' }, { status: 400 })
  }
  const row = await upsertChannelCategory({ id, name, icon, bg_color, text_color, sort_order })
  if (!row) return NextResponse.json({ error: 'Failed to save category' }, { status: 500 })
  return NextResponse.json(row)
}
