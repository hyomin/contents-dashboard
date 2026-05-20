import { supabaseAdmin } from '@/lib/supabase-admin'
import { classifyVideoFormat } from '@/lib/video-format'

export async function backfillVideoFormats(): Promise<{ updated: number; error?: string }> {
  const { data, error } = await supabaseAdmin
    .from('videos')
    .select('id, video_id, duration, title, format, channel_id, views, avg_views')

  if (error) return { updated: 0, error: error.message }
  if (!data?.length) return { updated: 0 }

  let updated = 0
  for (const row of data) {
    const next = classifyVideoFormat(row.duration, row.title)
    if (row.format === next) continue
    const { error: upErr } = await supabaseAdmin
      .from('videos')
      .update({ format: next })
      .eq('id', row.id)
    if (!upErr) updated++
  }

  // 포맷별 vs_avg 재계산 (채널 단위)
  const byChannel = new Map<string, typeof data>()
  for (const row of data) {
    if (!row.channel_id) continue
    const list = byChannel.get(row.channel_id) ?? []
    list.push({ ...row, format: classifyVideoFormat(row.duration, row.title) })
    byChannel.set(row.channel_id, list)
  }

  for (const [, rows] of byChannel) {
    for (const fmt of ['short', 'long'] as const) {
      const subset = rows.filter((r) => r.format === fmt)
      if (subset.length === 0) continue
      const avg = Math.round(subset.reduce((s, r) => s + (r.views ?? 0), 0) / subset.length)
      for (const r of subset) {
        const vsAvg = avg > 0 ? Math.round(((r.views ?? 0) / avg) * 10) / 10 : 0
        await supabaseAdmin
          .from('videos')
          .update({ avg_views: avg, vs_avg: vsAvg })
          .eq('id', r.id)
      }
    }
  }

  return { updated }
}
