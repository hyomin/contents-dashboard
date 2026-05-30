import { supabaseAdmin } from '@/lib/data/supabase-admin'

export interface ChannelCategoryRow {
  id: string
  name: string
  icon: string
  bg_color: string
  text_color: string
  sort_order: number
  created_at?: string
}

export const DEFAULT_CHANNEL_CATEGORIES: Omit<ChannelCategoryRow, 'created_at'>[] = [
  { id: 'cat-parenting', name: '육아', icon: '👶', bg_color: '#F472B6', text_color: 'auto', sort_order: 10 },
  { id: 'cat-economy', name: '경제', icon: '💰', bg_color: '#34D399', text_color: 'auto', sort_order: 20 },
  { id: 'cat-game', name: '게임', icon: '🎮', bg_color: '#818CF8', text_color: 'auto', sort_order: 30 },
  { id: 'cat-education', name: '교육', icon: '📚', bg_color: '#38BDF8', text_color: 'auto', sort_order: 40 },
  { id: 'cat-lifestyle', name: '라이프', icon: '🏠', bg_color: '#FBBF24', text_color: 'auto', sort_order: 50 },
  { id: 'cat-tech', name: 'IT·테크', icon: '💻', bg_color: '#60A5FA', text_color: 'auto', sort_order: 60 },
  { id: 'cat-entertainment', name: '엔터', icon: '🎭', bg_color: '#A78BFA', text_color: 'auto', sort_order: 70 },
  { id: 'cat-news', name: '뉴스·시사', icon: '📰', bg_color: '#94A3B8', text_color: 'auto', sort_order: 80 },
  { id: 'cat-other', name: '기타', icon: '📁', bg_color: '#9CA3AF', text_color: 'auto', sort_order: 99 },
]

export async function ensureDefaultChannelCategories(): Promise<void> {
  const { count } = await supabaseAdmin
    .from('channel_categories')
    .select('*', { count: 'exact', head: true })
  if ((count ?? 0) > 0) return
  await supabaseAdmin.from('channel_categories').insert(DEFAULT_CHANNEL_CATEGORIES)
}

export async function listChannelCategories(): Promise<ChannelCategoryRow[]> {
  await ensureDefaultChannelCategories()
  const { data, error } = await supabaseAdmin
    .from('channel_categories')
    .select('*')
    .order('sort_order', { ascending: true })
  if (error) {
    console.error('listChannelCategories:', error)
    return DEFAULT_CHANNEL_CATEGORIES
  }

  const byId = new Map<string, ChannelCategoryRow>()
  for (const row of data ?? []) {
    const canonical = DEFAULT_CHANNEL_CATEGORIES.find((d) => d.name === row.name)
    const id = canonical?.id ?? row.id
    if (!byId.has(id)) {
      byId.set(id, {
        ...row,
        id,
        icon: canonical?.icon ?? row.icon ?? '📁',
        bg_color: canonical?.bg_color ?? row.bg_color,
        sort_order: canonical?.sort_order ?? row.sort_order,
      })
    }
  }
  for (const def of DEFAULT_CHANNEL_CATEGORIES) {
    if (!byId.has(def.id)) byId.set(def.id, { ...def })
  }
  return Array.from(byId.values()).sort((a, b) => a.sort_order - b.sort_order)
}

export async function upsertChannelCategory(
  row: Pick<ChannelCategoryRow, 'id' | 'name'> &
    Partial<Pick<ChannelCategoryRow, 'icon' | 'bg_color' | 'text_color' | 'sort_order'>>,
): Promise<ChannelCategoryRow | null> {
  const { data, error } = await supabaseAdmin
    .from('channel_categories')
    .upsert({
      icon: '📁',
      bg_color: '#6B7280',
      text_color: 'auto',
      sort_order: 50,
      ...row,
    })
    .select()
    .single()
  if (error) {
    console.error('upsertChannelCategory:', error)
    return null
  }
  return data
}
