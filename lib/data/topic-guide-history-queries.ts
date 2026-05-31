import { supabaseAdmin } from '@/lib/data/supabase-admin'
import type { TopicGuideHistoryItem } from '@/lib/dashboard/topic-guide-history-types'
import type { TopicKeywordGuideSuggestion } from '@/lib/dashboard/topic-keyword-guide'

const MAX_ITEMS = 30

interface HistoryRow {
  id: string
  seed_keyword: string
  category: string
  suggestions: TopicKeywordGuideSuggestion[]
  selected_suggestion: TopicKeywordGuideSuggestion | null
  selected_publish_topic: string | null
  guide_generated_at: string | null
  created_at: string
  updated_at: string
}

function rowToItem(row: HistoryRow): TopicGuideHistoryItem {
  return {
    id: row.id,
    seedKeyword: row.seed_keyword ?? '',
    category: row.category as TopicGuideHistoryItem['category'],
    suggestions: Array.isArray(row.suggestions) ? row.suggestions : [],
    selectedSuggestion: row.selected_suggestion ?? undefined,
    selectedPublishTopic: row.selected_publish_topic ?? undefined,
    guideGeneratedAt: row.guide_generated_at ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function itemToRow(item: TopicGuideHistoryItem): Record<string, unknown> {
  return {
    id: item.id,
    seed_keyword: item.seedKeyword,
    category: item.category,
    suggestions: item.suggestions,
    selected_suggestion: item.selectedSuggestion ?? null,
    selected_publish_topic: item.selectedPublishTopic ?? null,
    guide_generated_at: item.guideGeneratedAt ?? null,
    created_at: item.createdAt,
    updated_at: item.updatedAt,
  }
}

export async function listTopicGuideHistory(): Promise<TopicGuideHistoryItem[]> {
  const { data, error } = await supabaseAdmin
    .from('topic_keyword_guide_history')
    .select('*')
    .order('updated_at', { ascending: false })
    .limit(MAX_ITEMS)

  if (error) {
    console.error('[topic-guide-history] list failed', error.message)
    return []
  }
  return (data ?? []).map((row) => rowToItem(row as HistoryRow))
}

async function trimOldHistory(): Promise<void> {
  const { data, error } = await supabaseAdmin
    .from('topic_keyword_guide_history')
    .select('id')
    .order('updated_at', { ascending: false })

  if (error || !data || data.length <= MAX_ITEMS) return

  const removeIds = data.slice(MAX_ITEMS).map((r) => r.id)
  if (removeIds.length === 0) return

  await supabaseAdmin.from('topic_keyword_guide_history').delete().in('id', removeIds)
}

export async function insertTopicGuideHistory(
  item: TopicGuideHistoryItem,
): Promise<{ ok: boolean; item?: TopicGuideHistoryItem; error?: string }> {
  const { data, error } = await supabaseAdmin
    .from('topic_keyword_guide_history')
    .insert(itemToRow(item))
    .select('*')
    .single()

  if (error) {
    console.error('[topic-guide-history] insert failed', error.message)
    return { ok: false, error: error.message }
  }

  await trimOldHistory()
  return { ok: true, item: rowToItem(data as HistoryRow) }
}

export async function attachSelectionToTopicGuideHistory(
  id: string,
  selected: TopicKeywordGuideSuggestion,
  selectedPublishTopic: string,
): Promise<{ ok: boolean; item?: TopicGuideHistoryItem; error?: string }> {
  const now = new Date().toISOString()
  const { data, error } = await supabaseAdmin
    .from('topic_keyword_guide_history')
    .update({
      selected_suggestion: selected,
      selected_publish_topic: selectedPublishTopic,
      updated_at: now,
    })
    .eq('id', id)
    .select('*')
    .single()

  if (error) {
    console.error('[topic-guide-history] attach selection failed', error.message)
    return { ok: false, error: error.message }
  }
  return { ok: true, item: rowToItem(data as HistoryRow) }
}

export async function deleteTopicGuideHistory(id: string): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabaseAdmin.from('topic_keyword_guide_history').delete().eq('id', id)
  if (error) {
    console.error('[topic-guide-history] delete failed', error.message)
    return { ok: false, error: error.message }
  }
  return { ok: true }
}

export async function clearTopicGuideHistory(): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabaseAdmin
    .from('topic_keyword_guide_history')
    .delete()
    .neq('id', '')

  if (error) {
    console.error('[topic-guide-history] clear failed', error.message)
    return { ok: false, error: error.message }
  }
  return { ok: true }
}
