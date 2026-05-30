import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/data/supabase-admin'
import { resolveSectionCategoryId } from '@/lib/dashboard/verified-channels-shared'
import { loadVerifiedChannelsFromDoc } from '@/lib/dashboard/verified-channels-server'

interface BulkImportBody {
  channel_ids?: string[]
  section?: string
  category_id?: string
  skip_existing?: boolean
}

export async function POST(request: NextRequest) {
  const body = (await request.json()) as BulkImportBody
  const skipExisting = body.skip_existing !== false

  let toImport = loadVerifiedChannelsFromDoc()

  if (body.section) {
    toImport = toImport.filter((c) => c.section === body.section)
  }
  if (body.channel_ids?.length) {
    const idSet = new Set(body.channel_ids)
    toImport = toImport.filter((c) => idSet.has(c.channelId))
  }

  if (toImport.length === 0) {
    return NextResponse.json({ error: '등록할 채널이 없습니다' }, { status: 400 })
  }

  const { data: existing } = await supabaseAdmin.from('channels').select('channel_id')
  const existingSet = new Set((existing ?? []).map((r) => r.channel_id))

  const rows = toImport
    .filter((c) => !skipExisting || !existingSet.has(c.channelId))
    .map((c) => ({
      channel_id: c.channelId,
      channel_name: c.title || c.handle,
      platform: 'youtube',
      category_id: body.category_id ?? c.categoryId ?? resolveSectionCategoryId(c.section),
      updated_at: new Date().toISOString(),
    }))

  if (rows.length === 0) {
    return NextResponse.json({
      ok: true,
      imported: 0,
      skipped: toImport.length,
      message: '선택한 채널이 모두 이미 등록되어 있습니다.',
    })
  }

  const { error } = await supabaseAdmin
    .from('channels')
    .upsert(rows, { onConflict: 'channel_id' })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // 추적 플래그 기본 ON
  const flagRows = rows.map((r) => ({
    channel_id: r.channel_id,
    is_tracked: true,
    is_mine: false,
  }))
  await supabaseAdmin.from('channel_flags').upsert(flagRows, { onConflict: 'channel_id' })

  return NextResponse.json({
    ok: true,
    imported: rows.length,
    skipped: toImport.length - rows.length,
    message: `${rows.length}개 채널을 등록했습니다${toImport.length - rows.length > 0 ? ` (${toImport.length - rows.length}개는 기존 등록)` : ''}.`,
  })
}
