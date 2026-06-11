export type ContentAnalyzerPlatform = 'youtube' | 'instagram' | 'tiktok' | 'unknown'

export interface ContentAnalyzerResult {
  url: string
  platform: ContentAnalyzerPlatform
  /** 콘텐츠가 추구하는 핵심 감정·정서 */
  targetEmotion: {
    summary: string
    keywords: string[]
  }
  /** BGM — 사용자가 "특히 중요"하다고 강조한 영역 */
  bgm: {
    /** 영상에서 느껴지는 BGM 무드·톤에 대한 분석 (직접 듣고 식별한 곡 정보가 아닐 수 있음을 안내) */
    moodAnalysis: string
    /** AI(Gemini)가 영상에서 직접 알아낸 실제 곡 정보 — 어디까지나 "추정"이며 오인식 가능 (제목·아티스트를 특정할 수 있었을 때만 채워짐) */
    identifiedTrack: {
      title: string
      artist?: string
      /** 식별 확신도 — 영상에서 직접 확인했는지, 추정인지 */
      confidence: 'high' | 'medium' | 'low'
      /** 어떤 근거로 특정했는지 (예: "영상 음성에서 직접 인식", "영상 내 자막/크레딧 표기 확인") */
      basis: string
    } | null
    /**
     * n8n([W11] BGM 정밀 식별 워크플로 · yt-dlp 클립 추출 + AudD 음향 지문 매칭)이 반환한
     * "추정이 아닌 실제 매칭" 결과. AudD DB에 곡이 있어야 채워지며, 워크플로 미설정·실패·미매칭 시 null.
     */
    preciseMatch: {
      title: string
      artist?: string
      album?: string
      releaseDate?: string
      label?: string
      links?: { spotify?: string; appleMusic?: string }
      /** n8n 워크플로가 전달한 상태 메시지 (성공/미매칭/오류 사유) */
      message: string
    } | null
    /** 어떻게 직접 곡을 특정·식별할 것인지 단계별 가이드 (식별에 실패했거나 확신도가 낮을 때를 위한 보조 수단) */
    identifyGuide: string[]
    /** 레퍼런스로 재사용할 수 있게 BGM을 합법적으로 확보하는 방법 가이드 */
    acquireGuide: string[]
  }
  /** 스토리·전개 구조 분석 */
  story: {
    summary: string
    structure: string[]
  }
  /** 사용자가 같은 결의 콘텐츠를 만들 때의 제작 가이드 */
  productionGuide: string[]
  generatedAt: string
}

export function detectContentPlatform(url: string): ContentAnalyzerPlatform {
  const u = url.toLowerCase()
  if (u.includes('youtube.com') || u.includes('youtu.be')) return 'youtube'
  if (u.includes('instagram.com')) return 'instagram'
  if (u.includes('tiktok.com')) return 'tiktok'
  return 'unknown'
}

/** Gemini가 fileData(fileUri)로 영상을 직접 시청·분석할 수 있는 플랫폼 (현재 YouTube 공개 영상만 지원) */
export function supportsDirectVideoAnalysis(platform: ContentAnalyzerPlatform): boolean {
  return platform === 'youtube'
}

const PLATFORM_LABEL: Record<ContentAnalyzerPlatform, string> = {
  youtube: 'YouTube',
  instagram: 'Instagram',
  tiktok: 'TikTok',
  unknown: '알 수 없음(URL 직접 입력)',
}

export function buildContentAnalyzerPrompt(
  url: string,
  platform: ContentAnalyzerPlatform,
  canWatchDirectly: boolean,
  userNotes?: string,
): string {
  const notesBlock = userNotes?.trim()
    ? `\n## 사용자가 직접 남긴 관찰 메모 (참고)\n${userNotes.trim()}\n`
    : ''

  const watchGuide = canWatchDirectly
    ? '아래 첨부된 영상을 직접 시청하고 분석하세요. 화면·내레이션·자막·배경음악(BGM)의 톤과 무드를 실제로 듣고 본 그대로 분석에 반영하세요.'
    : `이 플랫폼(${PLATFORM_LABEL[platform]})은 시스템이 영상을 직접 재생할 수 없습니다. URL과 사용자 메모만으로 추정 가능한 범위에서 "일반적으로 이런 유형의 콘텐츠가 어떻게 구성되는지" 기준으로 분석하고, 추정인 부분은 "추정:"이라고 명시하세요.`

  return `당신은 콘텐츠 레퍼런스 분석 전문가입니다. 사용자가 본인이 참고하고 싶은 콘텐츠의 URL을 입력했습니다.
${watchGuide}

## 분석 대상
- URL: ${url}
- 플랫폼: ${PLATFORM_LABEL[platform]}
${notesBlock}
## 분석 항목 (4가지, 모두 필수)

1. **targetEmotion (추구하는 감정)**: 이 콘텐츠가 시청자에게 전달하려는 핵심 감정·정서. summary(2~3문장)와 keywords(감정 키워드 3~6개, 예: "뭉클함", "통쾌함", "긴장감").

2. **bgm (★특히 중요 — BGM 분석)**: 사용자가 가장 중요하게 생각하는 영역입니다. 다음 4가지를 모두 채우세요.
   - moodAnalysis: 영상에서 느껴지는 BGM의 분위기·템포·악기 구성·사용 방식(예: 도입부 잔잔하다가 클라이맥스에 고조 등)을 2~4문장으로 분석. ${canWatchDirectly ? '실제로 들은 내용을 기반으로 작성.' : '추정 기반임을 "추정:"으로 표시.'}
   - identifiedTrack: ${
     canWatchDirectly
       ? `**가장 먼저 시도할 것 — 이 영상에 사용된 실제 곡의 제목과 아티스트를 직접 특정해 보세요.** 다음 두 경로를 모두 적극적으로 활용하세요:
     (a) 음성 인식 — 영상의 오디오를 직접 듣고, 잘 알려진 곡(특히 유명 팝/영화음악/클래식 등)이라면 곡명과 아티스트를 인식해서 알려주세요.
     (b) 화면·텍스트 단서 — 영상 속 자막, 워터마크, 크레딧 표기, 채널 설명에 노출된 텍스트에 곡 정보(예: "Music: Bonnie Tyler - Holding Out For A Hero")가 보이면 그것을 그대로 활용하세요.
     둘 중 하나라도 합리적 확신을 가지고 특정할 수 있었다면 title(곡 제목)과 artist(아티스트명)를 정확히 채우고, confidence를 "high"(직접 듣고 인식했거나 화면에 명시된 텍스트로 확인) 또는 "medium"(유사하지만 100% 확신은 아님)으로, basis에는 어떻게 알아냈는지("영상 음성에서 직접 인식함" 또는 "영상 내 텍스트 크레딧에서 확인함" 등)를 적으세요.
     **확실히 특정할 수 없다면 추측해서 지어내지 말고 반드시 null로 응답하세요** (잘못된 곡명을 알려주는 것이 가장 나쁩니다).`
       : `이 플랫폼은 직접 시청이 불가능하므로, 사용자 메모에 곡 정보에 대한 단서가 있을 때만 채우고, 그렇지 않으면 반드시 null로 응답하세요.`
   }
   - identifyGuide: identifiedTrack을 특정하지 못했거나 confidence가 낮을 때를 대비해, 사용자가 **직접 영상을 보면서 BGM을 정확히 특정(식별)하는 방법**을 단계별로 4~6개 작성. (예: Shazam·SoundHound 같은 음악 인식 앱으로 재생 중 캡처하는 법, 영상 설명란·고정 댓글·자막의 "Music/Audio" 크레딧 확인법, YouTube 자체의 "정보 더보기 → 음악" 패널 확인법, 화면에 잠깐 노출되는 워터마크·로고로 라이브러리 추정하는 법 등 — 실제로 따라할 수 있는 구체적 행동 단위로 작성)
   - acquireGuide: 식별한(혹은 비슷한 무드의) BGM을 **합법적으로 확보해서 본인 콘텐츠의 레퍼런스·소스로 재사용하는 방법**을 4~6개 작성. (예: YouTube Audio Library·Epidemic Sound·Artlist·Soundstripe·Musicbed 등 로열티프리 라이브러리에서 같은 무드 검색해 다운로드, identifiedTrack으로 특정한 곡이 상업 트랙이면 정식 라이선스(싱크 라이선스) 구매·문의 경로, AI 음악 생성 도구(Suno 등)로 비슷한 무드의 오리지널 BGM 만들기 등 — 저작권 문제 없이 재사용 가능한 경로 위주로 작성. 무단 다운로드·추출 도구 사용은 권하지 말 것)

3. **story (스토리·전개 분석)**: summary(이 콘텐츠의 핵심 줄거리·메시지를 2~3문장)와 structure(도입→전개→절정→마무리 등 전개 단계를 3~6개 항목의 배열로, 각 항목은 "[단계] 내용" 형식).

4. **productionGuide (내가 만들면 어떻게 만들면 되는지)**: 사용자가 이 레퍼런스를 참고해 **자신만의 오리지널 콘텐츠**를 만들 때 따라할 수 있는 실전 가이드를 4~7개 항목으로. (소재를 자신의 상황에 맞게 바꾸는 법, 위에서 분석한 감정·BGM 무드·전개 구조를 응용하는 법, 표절이 아닌 레퍼런스로 활용하는 선 등을 포함)

반드시 JSON만 응답:
{
  "targetEmotion": { "summary": "...", "keywords": ["...", "..."] },
  "bgm": {
    "moodAnalysis": "...",
    "identifiedTrack": { "title": "...", "artist": "...", "confidence": "high|medium|low", "basis": "..." } | null,
    "identifyGuide": ["...", "..."],
    "acquireGuide": ["...", "..."]
  },
  "story": { "summary": "...", "structure": ["[도입] ...", "[전개] ...", "[절정] ...", "[마무리] ..."] },
  "productionGuide": ["...", "..."]
}`
}

export function parseContentAnalyzerResponse(
  text: string,
  url: string,
  platform: ContentAnalyzerPlatform,
): ContentAnalyzerResult | null {
  if (!text.trim()) return null
  try {
    const fence = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/)
    const cleaned = fence ? fence[1].trim() : text
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return null
    const fixed = jsonMatch[0].replace(/,\s*([}\]])/g, '$1')
    const parsed = JSON.parse(fixed) as {
      targetEmotion?: { summary?: string; keywords?: string[] }
      bgm?: {
        moodAnalysis?: string
        identifiedTrack?: { title?: string; artist?: string; confidence?: string; basis?: string } | null
        identifyGuide?: string[]
        acquireGuide?: string[]
      }
      story?: { summary?: string; structure?: string[] }
      productionGuide?: string[]
    }

    const toStrArray = (arr?: unknown[]) =>
      Array.isArray(arr) ? arr.map((x) => String(x).trim()).filter(Boolean) : []

    const targetEmotionSummary = parsed.targetEmotion?.summary?.trim() ?? ''
    const bgmMoodAnalysis = parsed.bgm?.moodAnalysis?.trim() ?? ''
    const storySummary = parsed.story?.summary?.trim() ?? ''
    if (!targetEmotionSummary || !bgmMoodAnalysis || !storySummary) return null

    const rawTrack = parsed.bgm?.identifiedTrack
    const trackTitle = rawTrack?.title?.trim() ?? ''
    const confidence = rawTrack?.confidence?.trim().toLowerCase()
    const identifiedTrack =
      trackTitle && (confidence === 'high' || confidence === 'medium' || confidence === 'low')
        ? {
            title: trackTitle,
            artist: rawTrack?.artist?.trim() || undefined,
            confidence: confidence as 'high' | 'medium' | 'low',
            basis: rawTrack?.basis?.trim() ?? '',
          }
        : null

    return {
      url,
      platform,
      targetEmotion: {
        summary: targetEmotionSummary,
        keywords: toStrArray(parsed.targetEmotion?.keywords),
      },
      bgm: {
        moodAnalysis: bgmMoodAnalysis,
        identifiedTrack,
        // n8n BGM 정밀 식별 워크플로 결과는 이 함수 밖(라우트)에서 병합됨 — 기본값 null
        preciseMatch: null,
        identifyGuide: toStrArray(parsed.bgm?.identifyGuide),
        acquireGuide: toStrArray(parsed.bgm?.acquireGuide),
      },
      story: {
        summary: storySummary,
        structure: toStrArray(parsed.story?.structure),
      },
      productionGuide: toStrArray(parsed.productionGuide),
      generatedAt: new Date().toISOString(),
    }
  } catch {
    return null
  }
}
