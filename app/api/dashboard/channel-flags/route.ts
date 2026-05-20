import { NextRequest, NextResponse } from 'next/server'
import { getChannelFlags, upsertChannelFlag } from '@/lib/workspace-queries'

export async function GET() {
  const flags = await getChannelFlags()
  return NextResponse.json(flags)
}

export async function PATCH(request: NextRequest) {
  const body = await request.json()
  const { channel_id, is_tracked, is_mine } = body
  if (!channel_id) {
    return NextResponse.json({ error: 'channel_id required' }, { status: 400 })
  }

  const row = await upsertChannelFlag(channel_id, { is_tracked, is_mine })
  if (!row) {
    return NextResponse.json({ error: 'Failed to update flag' }, { status: 500 })
  }
  return NextResponse.json(row)
}
