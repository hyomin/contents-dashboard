import { NextRequest, NextResponse } from 'next/server'
import { getChannels } from '@/lib/data/queries'
import { supabaseAdmin } from '@/lib/data/supabase-admin'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const platform = searchParams.get('platform') ?? undefined
  const channels = await getChannels(platform)
  return NextResponse.json(channels)
}

export async function POST(request: NextRequest) {
  const body = await request.json()
  const { channel_id, channel_name, platform, category_id, content_style } = body
  if (!channel_id || !channel_name) {
    return NextResponse.json({ error: 'channel_id, channel_name required' }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin
    .from('channels')
    .upsert({
      channel_id,
      channel_name,
      platform: platform ?? 'youtube',
      category_id: category_id ?? null,
      content_style: content_style ?? null,
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

export async function PATCH(request: NextRequest) {
  const body = await request.json()
  const { channel_id, category_id, channel_name, platform, content_style } = body
  if (!channel_id) {
    return NextResponse.json({ error: 'channel_id required' }, { status: 400 })
  }

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (category_id !== undefined) patch.category_id = category_id || null
  if (content_style !== undefined) patch.content_style = content_style || null
  if (channel_name !== undefined) {
    const trimmed = String(channel_name).trim()
    if (!trimmed) {
      return NextResponse.json({ error: 'channel_name cannot be empty' }, { status: 400 })
    }
    patch.channel_name = trimmed
  }
  if (platform !== undefined) patch.platform = platform

  const { data, error } = await supabaseAdmin
    .from('channels')
    .update(patch)
    .eq('channel_id', channel_id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  if (patch.channel_name) {
    await supabaseAdmin
      .from('videos')
      .update({ channel_name: patch.channel_name })
      .eq('channel_id', channel_id)
  }

  return NextResponse.json(data)
}
