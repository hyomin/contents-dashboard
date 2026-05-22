import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin as supabase } from '@/lib/data/supabase-admin'

export async function GET() {
  const { data, error } = await supabase
    .from('benchmark_categories')
    .select('*')
    .order('created_at', { ascending: true })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

export async function POST(request: NextRequest) {
  const body = await request.json()
  const { id, name, bg_color, text_color } = body
  if (!id || !name) return NextResponse.json({ error: 'id, name required' }, { status: 400 })

  const { data, error } = await supabase
    .from('benchmark_categories')
    .upsert({ id, name, bg_color: bg_color ?? '#3B82F6', text_color: text_color ?? 'auto' })
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
