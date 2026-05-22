import { NextResponse } from 'next/server'
import { backfillVideoFormats } from '@/lib/data/video-format-backfill'

export async function POST() {
  const result = await backfillVideoFormats()
  if (result.error) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 500 })
  }
  return NextResponse.json({ ok: true, updated: result.updated })
}
