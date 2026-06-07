import { supabase } from './supabase'
import { getOutlierVideos } from './queries'
import { tierForVsAvg, outlierTagToVideo, type OutlierTagRow } from '@/lib/dashboard/dashboard-helpers'

export { outlierTagToVideo, type OutlierTagRow }

/** 상위 Outlier 영상 제목에서 공통 성과 패턴을 Gemini로 분석 */
async function analyzeOutlierPatterns(
  titles: string[],
): Promise<string | null> {
  const apiKey = process.env.GEMINI_API_KEY?.trim()
  if (!apiKey || titles.length === 0) return null

  const list = titles.slice(0, 15).map((t, i) => `${i + 1}. ${t}`).join('\n')

  const prompt = `아래는 유튜브에서 평균 대비 높은 성과를 낸 영상 제목 목록입니다.
이 영상들의 공통 패턴(제목 구조·후킹 방식·키워드 특징)을 2~3문장으로 분석해주세요.
콘텐츠 기획자가 다음 영상에 바로 적용할 수 있도록 구체적으로 작성하세요.

영상 제목 목록:
${list}

한국어로, 2~3문장만 응답하세요. 목록·마크다운 없이 단락으로.`

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.4, maxOutputTokens: 512 },
        }),
        signal: AbortSignal.timeout(20000),
      },
    )
    if (!res.ok) return null
    const data = (await res.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[]
    }
    return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? null
  } catch {
    return null
  }
}

export interface OutlierTaggingResult {
  ok: boolean
  minVsAvg: number
  candidateCount: number
  taggedCount: number
  tierUpdatedCount: number
  preview?: boolean
  message: string
  aiInsight?: string | null
}

const TIER_RANK: Record<string, number> = { C: 0, B: 1, A: 2, S: 3 }

function shouldUpgradeTier(current: string | null | undefined, next: 'S' | 'A' | 'B' | 'C'): boolean {
  const cur = TIER_RANK[current ?? 'C'] ?? 0
  return TIER_RANK[next] > cur
}

export async function getTaggedOutlierVideos(limit = 50): Promise<OutlierTagRow[]> {
  const { data, error } = await supabase
    .from('outlier_tags')
    .select('*')
    .order('vs_avg', { ascending: false })
    .limit(limit)

  if (error) {
    console.error('getTaggedOutlierVideos error:', error)
    return []
  }
  return (data ?? []) as OutlierTagRow[]
}

export async function runOutlierTagging(options?: {
  minVsAvg?: number
  persistTagged?: boolean
  source?: string
  limit?: number
  includeAiInsight?: boolean
}): Promise<OutlierTaggingResult> {
  const minVsAvg = options?.minVsAvg ?? 3
  const persistTagged = options?.persistTagged ?? true
  const source = options?.source ?? 'dashboard'
  const limit = options?.limit ?? 100
  const includeAiInsight = options?.includeAiInsight ?? true

  const candidates = await getOutlierVideos(minVsAvg, limit)
  if (candidates.length === 0) {
    return {
      ok: true,
      minVsAvg,
      candidateCount: 0,
      taggedCount: 0,
      tierUpdatedCount: 0,
      message: `vs.Avg ${minVsAvg}x 이상 영상이 없습니다. 먼저 YouTube 수집을 실행하세요.`,
    }
  }

  if (!persistTagged) {
    return {
      ok: true,
      minVsAvg,
      candidateCount: candidates.length,
      taggedCount: 0,
      tierUpdatedCount: 0,
      preview: true,
      message: `미리보기: ${candidates.length}개 후보 (저장 안 함)`,
    }
  }

  const now = new Date().toISOString()
  const tagRows: OutlierTagRow[] = candidates.map((v) => ({
    video_id: v.video_id,
    title: v.title,
    channel_id: v.channel_id ?? null,
    channel_name: v.channel_name ?? null,
    platform: v.platform ?? 'youtube',
    vs_avg: Number(v.vs_avg ?? 0),
    min_vs_avg_threshold: minVsAvg,
    tagged_at: now,
    source,
    updated_at: now,
  }))

  const { error: upsertError } = await supabase
    .from('outlier_tags')
    .upsert(tagRows, { onConflict: 'video_id' })

  if (upsertError) {
    console.error('runOutlierTagging upsert error:', upsertError)
    return {
      ok: false,
      minVsAvg,
      candidateCount: candidates.length,
      taggedCount: 0,
      tierUpdatedCount: 0,
      message: upsertError.message,
    }
  }

  let tierUpdatedCount = 0
  for (const v of candidates) {
    const vsAvg = Number(v.vs_avg ?? 0)
    const nextTier = tierForVsAvg(vsAvg)
    if (!shouldUpgradeTier(v.tier, nextTier)) continue
    const { error } = await supabase
      .from('videos')
      .update({ tier: nextTier, updated_at: now })
      .eq('video_id', v.video_id)
    if (!error) tierUpdatedCount += 1
  }

  // AI 패턴 분석 (비동기, 실패해도 태깅 결과에 영향 없음)
  const aiInsight = includeAiInsight
    ? await analyzeOutlierPatterns(candidates.slice(0, 15).map((v) => v.title))
    : null

  return {
    ok: true,
    minVsAvg,
    candidateCount: candidates.length,
    taggedCount: tagRows.length,
    tierUpdatedCount,
    message: `아웃라이어 ${tagRows.length}개 태깅 · Tier 상향 ${tierUpdatedCount}건`,
    aiInsight,
  }
}
