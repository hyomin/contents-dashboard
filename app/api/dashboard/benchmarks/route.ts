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

  // category_id가 benchmark_categories에 실제로 존재하는지 확인 (FK 오류 방지)
  let finalCategoryId: string | null = category_id ?? null
  if (finalCategoryId) {
    const { data: catExists } = await supabase
      .from('benchmark_categories')
      .select('id')
      .eq('id', finalCategoryId)
      .maybeSingle()
    if (!catExists) finalCategoryId = null
  }

  const { data, error } = await supabase
    .from('benchmarks')
    .insert({
      id,
      url,
      title,
      memo: memo ?? '',
      category_id: finalCategoryId,
      platform: platform ?? 'other',
      views,
      vs_avg,
    })
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
