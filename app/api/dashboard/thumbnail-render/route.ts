/**
 * 썸네일 자동 생성 API
 * background.png 위에 제목 텍스트를 오버레이해 PNG를 반환/저장.
 * POST { historyId, title? } → { ok, path } (저장 후 history 업데이트)
 * GET  ?title=...            → PNG 스트림 (미리보기용)
 */
import { NextRequest, NextResponse } from 'next/server'
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { createCanvas, loadImage, GlobalFonts } from '@napi-rs/canvas'
import { denyUnlessDashboardMutationAuth } from '@/lib/dashboard/api-auth'
import { supabaseAdmin } from '@/lib/data/supabase-admin'
import type { GenerationHistoryPolished } from '@/lib/dashboard/generation-history-types'

const FONT_CANDIDATES = [
  '/System/Library/Fonts/Supplemental/AppleGothic.ttf',
  '/System/Library/Fonts/Supplemental/NotoSansGothic-Regular.ttf',
]
let FONT_FAMILY = 'sans-serif'
for (const fp of FONT_CANDIDATES) {
  if (existsSync(fp)) {
    GlobalFonts.registerFromPath(fp, 'ThumbKR')
    FONT_FAMILY = 'ThumbKR'
    break
  }
}

const BG_PATH = resolve(process.cwd(), 'stock', 'background.png')
const OUT_W = 1200
const OUT_H = 1200

/** canvas에 둥근 사각형 경로 추가 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function roundRect(ctx: any, x: number, y: number, w: number, h: number, r: number) {
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y)
  ctx.quadraticCurveTo(x + w, y, x + w, y + r)
  ctx.lineTo(x + w, y + h - r)
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
  ctx.lineTo(x + r, y + h)
  ctx.quadraticCurveTo(x, y + h, x, y + h - r)
  ctx.lineTo(x, y + r)
  ctx.quadraticCurveTo(x, y, x + r, y)
  ctx.closePath()
}

/** 지정 폭 내에서 공백 단위 줄바꿈. 최대 3줄로 제한 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function wrapLines(ctx: any, text: string, maxWidth: number): string[] {
  const words = text.split(' ')
  const lines: string[] = []
  let cur = ''

  for (const w of words) {
    const test = cur ? `${cur} ${w}` : w
    if (ctx.measureText(test).width <= maxWidth) {
      cur = test
    } else {
      if (cur) lines.push(cur)
      cur = w
    }
  }
  if (cur) lines.push(cur)

  // 3줄 초과 시 3번째 이후를 마지막 줄에 합침
  if (lines.length > 3) {
    return [lines[0], lines[1], lines.slice(2).join(' ')]
  }
  return lines
}

async function renderThumbnail(title: string): Promise<Uint8Array> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const canvas: any = createCanvas(OUT_W, OUT_H)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ctx: any = canvas.getContext('2d')

  // ── 1. 배경 그리기 (center-crop) ──────────────────────────────────────────
  const bgBuf = readFileSync(BG_PATH)
  const bgImg = await loadImage(bgBuf)
  const scale = Math.max(OUT_W / (bgImg as unknown as { width: number }).width, OUT_H / (bgImg as unknown as { height: number }).height)
  const bw = (bgImg as unknown as { width: number }).width
  const bh = (bgImg as unknown as { height: number }).height
  const sw = bw * scale
  const sh = bh * scale
  ctx.drawImage(bgImg, (OUT_W - sw) / 2, (OUT_H - sh) / 2, sw, sh)

  // ── 2. Gemini 워터마크 제거 — 하단 그라데이션 페이드 ─────────────────────
  const fadeH = 100
  const fadeGrad = ctx.createLinearGradient(0, OUT_H - fadeH, 0, OUT_H)
  fadeGrad.addColorStop(0, 'rgba(6, 10, 26, 0)')
  fadeGrad.addColorStop(1, 'rgba(6, 10, 26, 0.97)')
  ctx.fillStyle = fadeGrad
  ctx.fillRect(0, OUT_H - fadeH, OUT_W, fadeH)

  // ── 3. Frosted glass 텍스트 박스 ─────────────────────────────────────────
  const padH = 44
  const boxSideMargin = 44
  const boxX = boxSideMargin
  const boxW = OUT_W - boxSideMargin * 2
  const boxH = OUT_H * 0.43         // 하단 43% 높이
  const boxY = OUT_H - boxH - padH
  const radius = 28

  // 박스 뒤 글로우
  ctx.fillStyle = 'rgba(20, 40, 120, 0.18)'
  ctx.beginPath()
  roundRect(ctx, boxX - 10, boxY - 10, boxW + 20, boxH + 20, radius + 10)
  ctx.fill()

  // 박스 본체
  ctx.fillStyle = 'rgba(6, 12, 36, 0.84)'
  ctx.beginPath()
  roundRect(ctx, boxX, boxY, boxW, boxH, radius)
  ctx.fill()

  // 박스 테두리
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.13)'
  ctx.lineWidth = 2
  ctx.beginPath()
  roundRect(ctx, boxX, boxY, boxW, boxH, radius)
  ctx.stroke()

  // ── 4. 텍스트 렌더링 ────────────────────────────────────────────────────
  const fontSize = 68
  const lineHeight = fontSize * 1.38
  ctx.font = `bold ${fontSize}px ${FONT_FAMILY}`

  const textMaxWidth = boxW - 96
  const rawLines = wrapLines(ctx, title, textMaxWidth)

  // 첫 줄에 「, 마지막 줄에 」추가
  const displayLines = rawLines.map((l, i) => {
    if (i === 0 && rawLines.length === 1) return `「${l} 」`
    if (i === 0) return `「${l}`
    if (i === rawLines.length - 1) return `${l} 」`
    return l
  })

  const totalTextH = displayLines.length * lineHeight
  const textStartY = boxY + (boxH - totalTextH) / 2 + fontSize * 0.9

  ctx.fillStyle = '#ffffff'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'alphabetic'

  // 텍스트 그림자 (가독성 향상)
  ctx.shadowColor = 'rgba(0, 0, 0, 0.6)'
  ctx.shadowBlur = 8
  ctx.shadowOffsetY = 3

  for (let i = 0; i < displayLines.length; i++) {
    ctx.fillText(displayLines[i], OUT_W / 2, textStartY + i * lineHeight)
  }

  ctx.shadowColor = 'transparent'
  ctx.shadowBlur = 0
  ctx.shadowOffsetY = 0

  return canvas.toBuffer('image/png') as Uint8Array
}

// ─── GET: 미리보기 (historyId 또는 title 쿼리) ────────────────────────────
export async function GET(req: NextRequest) {
  const denied = await denyUnlessDashboardMutationAuth(req)
  if (denied) return denied

  if (!existsSync(BG_PATH)) {
    return NextResponse.json({ error: 'stock/background.png 파일이 없습니다.' }, { status: 404 })
  }

  const sp = req.nextUrl.searchParams
  let title = sp.get('title') ?? ''

  const historyId = sp.get('historyId')
  if (!title && historyId) {
    const { data } = await supabaseAdmin
      .from('content_generation_history')
      .select('polished')
      .eq('id', historyId)
      .single()
    title = ((data?.polished ?? {}) as GenerationHistoryPolished).title ?? ''
  }

  if (!title) return NextResponse.json({ error: '제목(title)이 필요합니다.' }, { status: 400 })

  try {
    const buf = await renderThumbnail(title)
    return new NextResponse(Buffer.from(buf) as unknown as BodyInit, {
      headers: { 'Content-Type': 'image/png', 'Cache-Control': 'no-store' },
    })
  } catch (err) {
    console.error('[thumbnail-render GET]', err)
    return NextResponse.json({ error: '렌더링 실패' }, { status: 500 })
  }
}

// ─── POST: 생성 + 저장 + history 업데이트 ────────────────────────────────
export async function POST(req: NextRequest) {
  const denied = await denyUnlessDashboardMutationAuth(req)
  if (denied) return denied

  if (!existsSync(BG_PATH)) {
    return NextResponse.json({ error: 'stock/background.png 파일이 없습니다.' }, { status: 404 })
  }

  const body = (await req.json()) as { historyId?: string; title?: string }
  let { title = '' } = body
  const { historyId } = body

  if (!title && historyId) {
    const { data } = await supabaseAdmin
      .from('content_generation_history')
      .select('polished')
      .eq('id', historyId)
      .single()
    title = ((data?.polished ?? {}) as GenerationHistoryPolished).title ?? ''
  }

  if (!title) return NextResponse.json({ error: '제목(title)이 필요합니다.' }, { status: 400 })

  try {
    const pngBuf = await renderThumbnail(title)

    const thumbDir = resolve(process.cwd(), 'stock', 'thumbnails')
    mkdirSync(thumbDir, { recursive: true })

    // 파일명: historyId 있으면 그걸로, 없으면 타임스탬프
    const safeId = historyId
      ? historyId.replace(/[^a-zA-Z0-9\-_]/g, '_')
      : `thumb_${Date.now()}`
    const fileName = `${safeId}.png`
    const filePath = resolve(thumbDir, fileName)
    writeFileSync(filePath, Buffer.from(pngBuf))

    const thumbPath = `stock/thumbnails/${fileName}`

    // history 업데이트
    if (historyId) {
      const { data: row } = await supabaseAdmin
        .from('content_generation_history')
        .select('polished')
        .eq('id', historyId)
        .single()
      const existing = (row?.polished ?? {}) as GenerationHistoryPolished
      await supabaseAdmin
        .from('content_generation_history')
        .update({ polished: { ...existing, customThumbnail: thumbPath }, updated_at: new Date().toISOString() })
        .eq('id', historyId)
    }

    return NextResponse.json({ ok: true, path: thumbPath })
  } catch (err) {
    console.error('[thumbnail-render POST]', err)
    return NextResponse.json({ error: '렌더링 실패' }, { status: 500 })
  }
}
