import { NextRequest, NextResponse } from 'next/server'
import { denyUnlessDashboardMutationAuth } from '@/lib/dashboard/api-auth'
import {
  requireGeminiDirectOrRespond,
  isBgmIdentifyN8nConfigured,
  invokeBgmIdentifyN8n,
} from '@/lib/dashboard/n8n-ai'
import {
  buildContentAnalyzerPrompt,
  detectContentPlatform,
  normalizeYoutubeUrlForGemini,
  parseContentAnalyzerResponse,
  supportsDirectVideoAnalysis,
  type ContentAnalyzerResult,
} from '@/lib/dashboard/content-analyzer'
import {
  callGeminiGenerateContent,
  formatGeminiApiError,
  resolveGeminiModel,
} from '@/lib/dashboard/gemini-models'

export type { ContentAnalyzerResult }

interface ContentAnalyzerRequest {
  url?: string
  notes?: string
  aiModel?: string
}

function isLikelyUrl(value: string): boolean {
  try {
    const u = new URL(value)
    return u.protocol === 'http:' || u.protocol === 'https:'
  } catch {
    return false
  }
}

export async function POST(req: NextRequest) {
  const denied = await denyUnlessDashboardMutationAuth(req)
  if (denied) return denied

  const geminiBlocked = requireGeminiDirectOrRespond('콘텐츠 분석기')
  if (geminiBlocked) return geminiBlocked

  const apiKey = process.env.GEMINI_API_KEY!.trim()

  const body = (await req.json()) as ContentAnalyzerRequest
  const url = body.url?.trim() ?? ''
  if (!isLikelyUrl(url)) {
    return NextResponse.json({ error: '분석할 콘텐츠의 URL을 정확히 입력해 주세요. (https://...)' }, { status: 400 })
  }

  const platform = detectContentPlatform(url)
  const canWatchDirectly = supportsDirectVideoAnalysis(platform)
  const model = resolveGeminiModel(body.aiModel)
  const prompt = buildContentAnalyzerPrompt(url, platform, canWatchDirectly, body.notes)

  try {
    // 분석(targetEmotion·story·productionGuide·BGM 무드)은 Gemini가 담당하고,
    // BGM "정확한 곡 식별"은 n8n([W11] yt-dlp 클립 추출 + AudD 음향 지문 매칭)이 병행 담당한다.
    // n8n 워크플로가 설정되어 있지 않으면 자동으로 건너뛰고 Gemini의 추정(identifiedTrack)만 사용한다.
    const bgmIdentifyConfigured = isBgmIdentifyN8nConfigured()
    const [result, bgmPrecise] = await Promise.all([
      callGeminiGenerateContent(apiKey, model, prompt, {
        temperature: 0.6,
        maxOutputTokens: 6144,
        timeoutMs: 90_000,
        fileUri: canWatchDirectly ? normalizeYoutubeUrlForGemini(url) : undefined,
      }),
      bgmIdentifyConfigured
        ? invokeBgmIdentifyN8n(url).catch((err) => {
            console.error('[content-analyzer] bgm-identify n8n failed', err)
            return null
          })
        : Promise.resolve(null),
    ])

    if (!result.ok) {
      console.error('[content-analyzer] gemini error', result.status, result.error)
      const httpStatus = result.status === 403 ? 503 : result.status >= 500 ? 502 : 500
      return NextResponse.json(
        { error: formatGeminiApiError(result.status, result.error) },
        { status: httpStatus },
      )
    }

    const parsed = parseContentAnalyzerResponse(result.text, url, platform)
    if (!parsed) {
      return NextResponse.json({ error: 'AI 분석 응답 파싱에 실패했습니다. 다시 시도해 주세요.' }, { status: 500 })
    }

    if (bgmPrecise?.track) {
      parsed.bgm.preciseMatch = {
        title: bgmPrecise.track.title,
        artist: bgmPrecise.track.artist,
        album: bgmPrecise.track.album,
        releaseDate: bgmPrecise.track.releaseDate,
        label: bgmPrecise.track.label,
        links: bgmPrecise.track.links,
        message: bgmPrecise.message,
      }
    }

    return NextResponse.json({ result: parsed, canWatchDirectly, bgmIdentifyConfigured })
  } catch (err) {
    console.error('[content-analyzer] failed', err)
    return NextResponse.json({ error: '콘텐츠 분석 중 오류가 발생했습니다.' }, { status: 500 })
  }
}
