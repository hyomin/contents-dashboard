import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin as supabase } from '@/lib/data/supabase-admin'

export async function GET() {
  const { data, error } = await supabase
    .from('benchmarks')
    .select(`
      *,
      benchmark_categories (
        id, name, bg_color, text_color
      )
    `)
    .order('created_at', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

export async function POST(request: NextRequest) {
  const body = await request.json()
  const { id, url, title, memo, category_id, platform, views, vs_avg } = body
  if (!id || !url || !title) {
    return NextResponse.json({ error: 'id, url, title required' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('benchmarks')
    .insert({ id, url, title, memo: memo ?? '', category_id, platform: platform ?? 'other', views, vs_avg })
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
