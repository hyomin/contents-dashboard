import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/data/supabase-admin'
import {
  groupVerifiedBySection,
} from '@/lib/dashboard/verified-channels-shared'
import { loadVerifiedChannelsFromDoc } from '@/lib/dashboard/verified-channels-server'

export async function GET() {
  try {
    const verified = loadVerifiedChannelsFromDoc()
    const { data: registered } = await supabaseAdmin
      .from('channels')
      .select('channel_id')

    const registeredSet = new Set((registered ?? []).map((r) => r.channel_id))
    const sections = groupVerifiedBySection(verified).map((sec) => ({
      ...sec,
      channels: sec.channels.map((ch) => ({
        ...ch,
        registered: registeredSet.has(ch.channelId),
      })),
    }))

    const total = verified.length
    const registeredCount = verified.filter((c) => registeredSet.has(c.channelId)).length

    return NextResponse.json({
      source: 'YOUTUBE_CHANNELS_VERIFIED_20260525.md',
      total,
      registeredCount,
      notRegisteredCount: total - registeredCount,
      sections,
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'verified channels load failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
