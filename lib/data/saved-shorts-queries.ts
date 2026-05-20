import { supabaseAdmin } from '@/lib/supabase-admin'
import type { DBVideo } from '@/lib/supabase'

export interface SavedShortRow {
  video_id: string
  channel_id: string | null
  channel_name: string | null
  title: string
  thumbnail_url: string | null
  views: number
  vs_avg: number
  duration: number
  saved_at: string
}

export async function listSavedShorts(): Promise<SavedShortRow[]> {
  const { data, error } = await supabaseAdmin
    .from('saved_shorts')
    .select('*')
    .order('saved_at', { ascending: false })
  if (error) {
    console.error('listSavedShorts:', error)
    return []
  }
  return (data ?? []) as SavedShortRow[]
}

export async function saveShortFromVideo(video: DBVideo): Promise<{ ok: boolean; error?: string }> {
  const row = {
    video_id: video.video_id,
    channel_id: video.channel_id,
    channel_name: video.channel_name,
    title: video.title,
    thumbnail_url: video.thumbnail_url,
    views: video.views ?? 0,
    vs_avg: video.vs_avg ?? 0,
    duration: video.duration ?? 0,
    saved_at: new Date().toISOString(),
  }
  const { error } = await supabaseAdmin.from('saved_shorts').upsert(row, { onConflict: 'video_id' })
  if (error) return { ok: false, error: error.message }
  return { ok: true }
}

export async function removeSavedShort(videoId: string): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabaseAdmin.from('saved_shorts').delete().eq('video_id', videoId)
  if (error) return { ok: false, error: error.message }
  return { ok: true }
}

export async function isShortSaved(videoId: string): Promise<boolean> {
  const { data, error } = await supabaseAdmin
    .from('saved_shorts')
    .select('video_id')
    .eq('video_id', videoId)
    .maybeSingle()
  if (error) return false
  return Boolean(data)
}
