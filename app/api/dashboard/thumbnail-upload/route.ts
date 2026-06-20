import { NextRequest, NextResponse } from 'next/server'
import { writeFileSync, mkdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { denyUnlessDashboardMutationAuth } from '@/lib/dashboard/api-auth'
import { supabaseAdmin } from '@/lib/data/supabase-admin'
import type { GenerationHistoryPolished } from '@/lib/dashboard/generation-history-types'

const ALLOWED_MIME = ['image/png', 'image/jpeg', 'image/webp']
const MAX_BYTES = 5 * 1024 * 1024

const THUMB_PATH_RE = /^[a-zA-Z0-9\-_]+\.(png|jpg|jpeg|webp)$/

function extFromMime(mime: string): string {
  if (mime === 'image/png') return 'png'
  if (mime === 'image/webp') return 'webp'
  return 'jpg'
}

export async function POST(req: NextRequest) {
  const denied = await denyUnlessDashboardMutationAuth(req)
  if (denied) return denied

  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    const historyId = (formData.get('historyId') as string | null)?.trim() ?? ''

    if (!file) return NextResponse.json({ error: '파일이 없습니다.' }, { status: 400 })
    if (!historyId) return NextResponse.json({ error: 'historyId가 없습니다.' }, { status: 400 })
    if (!ALLOWED_MIME.includes(file.type)) {
      return NextResponse.json({ error: 'PNG / JPG / WebP 이미지만 업로드 가능합니다.' }, { status: 400 })
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: '5MB 이하 이미지만 업로드 가능합니다.' }, { status: 400 })
    }

    const safeId = historyId.replace(/[^a-zA-Z0-9\-_]/g, '_')
    const ext = extFromMime(file.type)
    const fileName = `${safeId}.${ext}`

    if (!THUMB_PATH_RE.test(fileName)) {
      return NextResponse.json({ error: '잘못된 파일명입니다.' }, { status: 400 })
    }

    const thumbDir = resolve(process.cwd(), 'stock', 'thumbnails')
    const filePath = resolve(thumbDir, fileName)
    if (!filePath.startsWith(thumbDir + '/') && filePath !== thumbDir) {
      return NextResponse.json({ error: '경로 오류입니다.' }, { status: 400 })
    }

    mkdirSync(thumbDir, { recursive: true })
    writeFileSync(filePath, Buffer.from(await file.arrayBuffer()))

    const thumbnailPath = `stock/thumbnails/${fileName}`

    // 기존 polished 데이터에 customThumbnail 필드를 병합해 업데이트
    const { data: row } = await supabaseAdmin
      .from('content_generation_history')
      .select('polished')
      .eq('id', historyId)
      .single()

    const existing = (row?.polished ?? {}) as GenerationHistoryPolished
    const updated: GenerationHistoryPolished = { ...existing, customThumbnail: thumbnailPath }

    await supabaseAdmin
      .from('content_generation_history')
      .update({ polished: updated, updated_at: new Date().toISOString() })
      .eq('id', historyId)

    return NextResponse.json({ ok: true, path: thumbnailPath })
  } catch (err) {
    console.error('[thumbnail-upload]', err)
    return NextResponse.json({ error: '업로드 실패' }, { status: 500 })
  }
}
