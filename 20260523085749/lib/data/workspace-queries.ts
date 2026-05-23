import { supabaseAdmin } from '@/lib/data/supabase-admin'
import type { CalendarItemStored, DeployTaskStored, RepurposeItemStored } from '@/lib/dashboard/dashboard-storage'

export interface ChannelFlagRow {
  channel_id: string
  is_tracked: boolean
  is_mine: boolean
}

export async function getChannelFlags(): Promise<ChannelFlagRow[]> {
  const { data, error } = await supabaseAdmin.from('channel_flags').select('*')
  if (error) {
    console.error('getChannelFlags:', error)
    return []
  }
  return data ?? []
}

export async function upsertChannelFlag(
  channelId: string,
  patch: { is_tracked?: boolean; is_mine?: boolean },
): Promise<ChannelFlagRow | null> {
  const { data: existing } = await supabaseAdmin
    .from('channel_flags')
    .select('*')
    .eq('channel_id', channelId)
    .maybeSingle()

  const row = {
    channel_id: channelId,
    is_tracked: patch.is_tracked ?? existing?.is_tracked ?? true,
    is_mine: patch.is_mine ?? existing?.is_mine ?? false,
    updated_at: new Date().toISOString(),
  }

  const { data, error } = await supabaseAdmin
    .from('channel_flags')
    .upsert(row, { onConflict: 'channel_id' })
    .select()
    .single()

  if (error) {
    console.error('upsertChannelFlag:', error)
    return null
  }
  return data
}

export async function getCalendarItems(): Promise<CalendarItemStored[]> {
  const { data, error } = await supabaseAdmin
    .from('calendar_items')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) {
    console.error('getCalendarItems:', error)
    return []
  }

  return (data ?? []).map((r) => ({
    id: r.id,
    day: r.day,
    title: r.title,
    platform: r.platform,
    status: r.status as CalendarItemStored['status'],
    time: r.time_label,
  }))
}

export async function replaceCalendarItems(items: CalendarItemStored[]): Promise<boolean> {
  const { data: existing } = await supabaseAdmin.from('calendar_items').select('id')
  const newIds = new Set(items.map((i) => i.id))
  const remove = (existing ?? []).map((r) => r.id).filter((id) => !newIds.has(id))
  if (remove.length > 0) {
    await supabaseAdmin.from('calendar_items').delete().in('id', remove)
  }
  if (items.length === 0) return true

  const rows = items.map((i) => ({
    id: i.id,
    day: i.day,
    title: i.title,
    platform: i.platform,
    status: i.status,
    time_label: i.time,
    updated_at: new Date().toISOString(),
  }))

  const { error } = await supabaseAdmin.from('calendar_items').upsert(rows, { onConflict: 'id' })
  if (error) console.error('replaceCalendarItems:', error)
  return !error
}

export async function getRepurposeItems(): Promise<RepurposeItemStored[]> {
  const { data, error } = await supabaseAdmin
    .from('repurpose_items')
    .select('*')
    .order('source_vs_avg', { ascending: false })

  if (error) {
    console.error('getRepurposeItems:', error)
    return []
  }

  return (data ?? []).map((r) => ({
    id: r.id,
    sourceTitle: r.source_title,
    sourcePlatform: r.source_platform,
    sourceVsAvg: Number(r.source_vs_avg ?? 0),
    videoId: r.video_id ?? undefined,
    tasks: (r.tasks as RepurposeItemStored['tasks']) ?? [],
  }))
}

export async function replaceRepurposeItems(items: RepurposeItemStored[]): Promise<boolean> {
  const { data: existing } = await supabaseAdmin.from('repurpose_items').select('id')
  const newIds = new Set(items.map((i) => i.id))
  const remove = (existing ?? []).map((r) => r.id).filter((id) => !newIds.has(id))
  if (remove.length > 0) {
    await supabaseAdmin.from('repurpose_items').delete().in('id', remove)
  }
  if (items.length === 0) return true

  const rows = items.map((i) => ({
    id: i.id,
    source_title: i.sourceTitle,
    source_platform: i.sourcePlatform,
    source_vs_avg: i.sourceVsAvg,
    video_id: i.videoId ?? null,
    tasks: i.tasks,
    updated_at: new Date().toISOString(),
  }))

  const { error } = await supabaseAdmin.from('repurpose_items').upsert(rows, { onConflict: 'id' })
  if (error) console.error('replaceRepurposeItems:', error)
  return !error
}

export async function getDeployTasks(): Promise<DeployTaskStored[]> {
  const { data, error } = await supabaseAdmin.from('deploy_tasks').select('*').order('created_at', {
    ascending: false,
  })

  if (error) {
    console.error('getDeployTasks:', error)
    return []
  }

  return (data ?? []).map((r) => ({
    id: r.id,
    title: r.title,
    platform: r.platform,
    icon: r.icon,
    scheduledAt: r.scheduled_at,
    status: r.status as DeployTaskStored['status'],
    channel: r.channel ?? '',
    auto: r.auto ?? false,
  }))
}

export async function replaceDeployTasks(tasks: DeployTaskStored[]): Promise<boolean> {
  const { data: existing } = await supabaseAdmin.from('deploy_tasks').select('id')
  const newIds = new Set(tasks.map((t) => t.id))
  const remove = (existing ?? []).map((r) => r.id).filter((id) => !newIds.has(id))
  if (remove.length > 0) {
    await supabaseAdmin.from('deploy_tasks').delete().in('id', remove)
  }
  if (tasks.length === 0) return true

  const rows = tasks.map((t) => ({
    id: t.id,
    title: t.title,
    platform: t.platform,
    icon: t.icon,
    scheduled_at: t.scheduledAt,
    status: t.status,
    channel: t.channel,
    auto: t.auto,
    updated_at: new Date().toISOString(),
  }))

  const { error } = await supabaseAdmin.from('deploy_tasks').upsert(rows, { onConflict: 'id' })
  if (error) console.error('replaceDeployTasks:', error)
  return !error
}
