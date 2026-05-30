import { supabaseAdmin } from '@/lib/data/supabase-admin'
import { DEFAULT_CHANNEL_CATEGORIES } from '@/lib/data/channel-category-queries'
import { loadVerifiedChannelsFromDoc } from '@/lib/dashboard/verified-channels-server'
import { resolveChannelCategoryId } from '@/lib/dashboard/verified-channels-shared'

const DEFAULT_CATEGORY_ID = 'cat-other'

const CANONICAL_ID_BY_NAME = new Map(
  DEFAULT_CHANNEL_CATEGORIES.map((c) => [c.name, c.id]),
)

export interface SyncChannelCategoriesResult {
  ok: boolean
  updated: number
  unchanged: number
  remappedDuplicates: number
  notInMd: number
  details: Array<{ channel_id: string; channel_name: string; category_id: string; source: string }>
  message: string
}

/** 중복 카테고리 행(같은 이름·다른 id) → 표준 id로 채널 이전 */
async function consolidateDuplicateCategoryRows(): Promise<number> {
  const { data: cats } = await supabaseAdmin.from('channel_categories').select('id, name')
  if (!cats?.length) return 0

  let remapped = 0
  for (const row of cats) {
    const canonicalId = CANONICAL_ID_BY_NAME.get(row.name)
    if (!canonicalId || canonicalId === row.id) continue

    const { data: affected } = await supabaseAdmin
      .from('channels')
      .update({ category_id: canonicalId })
      .eq('category_id', row.id)
      .select('channel_id')

    remapped += affected?.length ?? 0
    await supabaseAdmin.from('channel_categories').delete().eq('id', row.id)
  }
  return remapped
}

/** MD 검증 목록 기준 YouTube 채널 카테고리 현행화 */
export async function syncChannelCategoriesFromMd(): Promise<SyncChannelCategoriesResult> {
  const remappedDuplicates = await consolidateDuplicateCategoryRows()

  const verified = loadVerifiedChannelsFromDoc()
  const mdMap = new Map(
    verified.map((c) => [
      c.channelId,
      resolveChannelCategoryId({
        title: c.title,
        handle: c.handle,
        section: c.section,
      }),
    ]),
  )

  const { data: rows, error } = await supabaseAdmin
    .from('channels')
    .select('channel_id, channel_name, category_id')
    .eq('platform', 'youtube')

  if (error) {
    return {
      ok: false,
      updated: 0,
      unchanged: 0,
      remappedDuplicates,
      notInMd: 0,
      details: [],
      message: error.message,
    }
  }

  const toUpdate: Array<{ channel_id: string; channel_name: string; category_id: string; source: string }> = []
  let unchanged = 0
  let notInMd = 0

  for (const row of rows ?? []) {
    const fromMd = mdMap.get(row.channel_id)

    if (fromMd) {
      if (row.category_id === fromMd) {
        unchanged++
        continue
      }
      toUpdate.push({
        channel_id: row.channel_id,
        channel_name: row.channel_name,
        category_id: fromMd,
        source: 'md',
      })
      continue
    }

    notInMd++
    if (!row.category_id) {
      toUpdate.push({
        channel_id: row.channel_id,
        channel_name: row.channel_name,
        category_id: DEFAULT_CATEGORY_ID,
        source: 'default',
      })
    } else {
      unchanged++
    }
  }

  if (toUpdate.length === 0) {
    return {
      ok: true,
      updated: 0,
      unchanged,
      remappedDuplicates,
      notInMd,
      details: [],
      message:
        remappedDuplicates > 0
          ? `중복 카테고리 ${remappedDuplicates}건 정리됨. 변경할 채널 카테고리가 없습니다.`
          : '모든 채널 카테고리가 최신 상태입니다.',
    }
  }

  const now = new Date().toISOString()
  for (const item of toUpdate) {
    const { error: upErr } = await supabaseAdmin
      .from('channels')
      .update({ category_id: item.category_id, updated_at: now })
      .eq('channel_id', item.channel_id)

    if (upErr) {
      return {
        ok: false,
        updated: 0,
        unchanged,
        remappedDuplicates,
        notInMd,
        details: [],
        message: upErr.message,
      }
    }
  }

  const mdCount = toUpdate.filter((d) => d.source === 'md').length
  const defaultCount = toUpdate.filter((d) => d.source === 'default').length

  return {
    ok: true,
    updated: toUpdate.length,
    unchanged,
    remappedDuplicates,
    notInMd,
    details: toUpdate,
    message: `카테고리 ${toUpdate.length}개 갱신 (MD ${mdCount} · 기타 ${defaultCount}${remappedDuplicates ? ` · 중복정리 ${remappedDuplicates}` : ''})`,
  }
}
