import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/data/supabase'
import { parseJsonBody } from '@/lib/utils/request'

export interface StockReportSettings {
  id: string
  auto_generate_enabled: boolean
  skip_until: string | null
  updated_at: string
}

const DEFAULT_SETTINGS: StockReportSettings = {
  id: 'default',
  auto_generate_enabled: true,
  skip_until: null,
  updated_at: new Date().toISOString(),
}

export async function GET() {
  const { data, error } = await supabase
    .from('stock_report_settings')
    .select('*')
    .eq('id', 'default')
    .maybeSingle()

  if (error) {
    console.error('stock-report-settings GET error:', error)
    return NextResponse.json(DEFAULT_SETTINGS)
  }
  return NextResponse.json((data ?? DEFAULT_SETTINGS) as StockReportSettings)
}

export async function PATCH(request: NextRequest) {
  const body = await parseJsonBody(request)
  const update: Record<string, unknown> = { id: 'default', updated_at: new Date().toISOString() }

  if (typeof body.autoGenerateEnabled === 'boolean') {
    update.auto_generate_enabled = body.autoGenerateEnabled
  }
  if (body.skipUntil === null || typeof body.skipUntil === 'string') {
    update.skip_until = body.skipUntil
  }

  const { data, error } = await supabase
    .from('stock_report_settings')
    .upsert(update, { onConflict: 'id' })
    .select('*')
    .maybeSingle()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json((data ?? { ...DEFAULT_SETTINGS, ...update }) as StockReportSettings)
}
