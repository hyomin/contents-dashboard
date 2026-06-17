import { supabaseAdmin } from '@/lib/data/supabase-admin'
import type {
  ChapterMarker,
  GenerationHistoryDraft,
  GenerationHistoryItem,
  GenerationHistoryPolished,
} from '@/lib/dashboard/generation-history-types'
import type { ContentFormat } from '@/app/api/dashboard/content-generate/route'

const MAX_ITEMS = 30

interface HistoryRow {
  id: string
  publish_topic: string
  category: string
  reference_count: number
  reference_titles: string[]
  draft: GenerationHistoryDraft
  polished: GenerationHistoryPolished | null
  target_format: string | null
  chapter_markers: ChapterMarker[] | null
  created_at: string
  updated_at: string
}

function rowToItem(row: HistoryRow): GenerationHistoryItem {
  const draftRaw = row.draft
  const draft: GenerationHistoryDraft =
    draftRaw && typeof draftRaw === 'object' && 'fullScript' in draftRaw
      ? (draftRaw as GenerationHistoryDraft)
      : {
          title: '(원본 없음)',
          fullScript: '',
          mode: 'dashboard',
          targetFormat: 'blog',
          platform: 'naver-blog',
          topic: row.publish_topic ?? '',
          generatedAt: row.created_at,
        }

  // target_format 컬럼이 있으면 draft.targetFormat보다 우선 사용
  if (row.target_format) {
    draft.targetFormat = row.target_format as ContentFormat
  }
  // chapter_markers 컬럼이 있으면 draft에 병합
  if (Array.isArray(row.chapter_markers) && row.chapter_markers.length > 0) {
    draft.chapterMarkers = row.chapter_markers
  }

  const polishedRaw = row.polished
  const polished =
    polishedRaw && typeof polishedRaw === 'object' && 'fullContent' in polishedRaw
      ? (polishedRaw as GenerationHistoryPolished)
      : undefined

  return {
    id: row.id,
    publishTopic: row.publish_topic,
    category: row.category as GenerationHistoryItem['category'],
    referenceCount: row.reference_count,
    referenceTitles: Array.isArray(row.reference_titles) ? row.reference_titles : [],
    draft,
    polished,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function itemToRow(item: GenerationHistoryItem): Record<string, unknown> {
  return {
    id: item.id,
    publish_topic: item.publishTopic,
    category: item.category,
    reference_count: item.referenceCount,
    reference_titles: item.referenceTitles,
    draft: item.draft,
    polished: item.polished ?? null,
    target_format: item.draft.targetFormat ?? null,
    chapter_markers: item.draft.chapterMarkers ?? null,
    created_at: item.createdAt,
    updated_at: item.updatedAt,
  }
}

export async function listGenerationHistory(): Promise<GenerationHistoryItem[]> {
  const { data, error } = await supabaseAdmin
    .from('content_generation_history')
    .select('*')
    .order('updated_at', { ascending: false })
    .limit(MAX_ITEMS)

  if (error) {
    console.error('[generation-history] list failed', error.message)
    return []
  }
  return (data ?? []).map((row) => rowToItem(row as HistoryRow))
}

async function trimOldHistory(): Promise<void> {
  const { data, error } = await supabaseAdmin
    .from('content_generation_history')
    .select('id')
    .order('updated_at', { ascending: false })

  if (error || !data || data.length <= MAX_ITEMS) return

  const removeIds = data.slice(MAX_ITEMS).map((r) => r.id)
  if (removeIds.length === 0) return

  await supabaseAdmin.from('content_generation_history').delete().in('id', removeIds)
}

export async function insertGenerationHistory(
  item: GenerationHistoryItem,
): Promise<{ ok: boolean; item?: GenerationHistoryItem; error?: string }> {
  const { data, error } = await supabaseAdmin
    .from('content_generation_history')
    .insert(itemToRow(item))
    .select('*')
    .single()

  if (error) {
    console.error('[generation-history] insert failed', error.message)
    return { ok: false, error: error.message }
  }

  await trimOldHistory()
  return { ok: true, item: rowToItem(data as HistoryRow) }
}

export async function getGenerationHistoryById(id: string): Promise<GenerationHistoryItem | null> {
  const { data, error } = await supabaseAdmin
    .from('content_generation_history')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (error || !data) {
    if (error) console.error('[generation-history] get by id failed', error.message)
    return null
  }
  return rowToItem(data as HistoryRow)
}

export async function attachPolishedToHistory(
  id: string,
  polished: GenerationHistoryPolished,
): Promise<{ ok: boolean; item?: GenerationHistoryItem; error?: string }> {
  const now = new Date().toISOString()
  const { data, error } = await supabaseAdmin
    .from('content_generation_history')
    .update({ polished, updated_at: now })
    .eq('id', id)
    .select('*')
    .single()

  if (error) {
    console.error('[generation-history] attach polished failed', error.message)
    return { ok: false, error: error.message }
  }
  return { ok: true, item: rowToItem(data as HistoryRow) }
}

export async function deleteGenerationHistory(id: string): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabaseAdmin.from('content_generation_history').delete().eq('id', id)
  if (error) {
    console.error('[generation-history] delete failed', error.message)
    return { ok: false, error: error.message }
  }
  return { ok: true }
}

export async function clearGenerationHistory(): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabaseAdmin
    .from('content_generation_history')
    .delete()
    .neq('id', '')

  if (error) {
    console.error('[generation-history] clear failed', error.message)
    return { ok: false, error: error.message }
  }
  return { ok: true }
}

/** localStorage → Supabase 1회 이전용 */
export async function bulkInsertGenerationHistory(
  items: GenerationHistoryItem[],
): Promise<{ ok: boolean; count: number; error?: string }> {
  if (items.length === 0) return { ok: true, count: 0 }

  const rows = items.slice(0, MAX_ITEMS).map(itemToRow)
  const { error } = await supabaseAdmin
    .from('content_generation_history')
    .upsert(rows, { onConflict: 'id' })

  if (error) {
    console.error('[generation-history] bulk insert failed', error.message)
    return { ok: false, count: 0, error: error.message }
  }

  await trimOldHistory()
  return { ok: true, count: rows.length }
}
