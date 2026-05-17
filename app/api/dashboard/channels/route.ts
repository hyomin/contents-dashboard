import { NextRequest, NextResponse } from 'next/server'
import { getChannels } from '@/lib/queries'
import { supabaseAdmin } from '@/lib/supabase-admin'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const platform = searchParams.get('platform') ?? undefined
  const channels = await getChannels(platform)
  return NextResponse.json(channels)
}

export async function POST(request: NextRequest) {
  const body = await request.json()
  const { channel_id, channel_name, platform } = body
  if (!channel_id || !channel_name) {
    return NextResponse.json({ error: 'channel_id, channel_name required' }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin
    .from('channels')
    .upsert({
      channel_id,
      channel_name,
      platform: platform ?? 'youtube',
      updated_at: new Date().toISOString(),
    }, { onConflict: 'channel_id' })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const channel_id = searchParams.get('channel_id')
  if (!channel_id) return NextResponse.json({ error: 'channel_id required' }, { status: 400 })

  const { error } = await supabaseAdmin.from('channels').delete().eq('channel_id', channel_id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
