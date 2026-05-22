import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/data/supabase-admin'
import {
  listSavedShorts,
  saveShortFromVideo,
  removeSavedShort,
} from '@/lib/data/saved-shorts-queries'

export async function GET() {
  const items = await listSavedShorts()
  return NextResponse.json(items)
}

export async function POST(request: NextRequest) {
  const body = await request.json()
  const videoId = body.video_id as string | undefined
  if (!videoId) {
    return NextResponse.json({ error: 'video_id required' }, { status: 400 })
  }

  const { data: video, error } = await supabaseAdmin
    .from('videos')
    .select('*')
    .eq('video_id', videoId)
    .maybeSingle()

  if (error || !video) {
    return NextResponse.json({ error: '영상을 찾을 수 없습니다' }, { status: 404 })
  }

  const result = await saveShortFromVideo(video)
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}

export async function DELETE(request: NextRequest) {
  const videoId = new URL(request.url).searchParams.get('video_id')
  if (!videoId) {
    return NextResponse.json({ error: 'video_id required' }, { status: 400 })
  }
  const result = await removeSavedShort(videoId)
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
