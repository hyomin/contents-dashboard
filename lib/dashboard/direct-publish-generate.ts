import type { ContentFormat } from '@/app/api/dashboard/content-generate/route'
import type { AiScriptGuideRequestContext } from '@/lib/dashboard/content-creation-guide'
import {
  buildAgentFormatGuidelineBlock,
  getAgentGuidelineSection,
  getBlogImageGuideCount,
} from '@/lib/dashboard/contents-guideline'
import {
  buildReferencePromptBlock,
  partitionReferences,
  type AiScriptGuideReference,
} from '@/lib/dashboard/guide-reference-modes'
import {
  parseContentPolishResponse,
  type ContentPolishResult,
} from '@/lib/dashboard/content-polish'
import { BLOG_PLATFORM_VARIANTS_SCHEMA } from '@/lib/dashboard/blog-platform-variants'
import { buildEmotionToneScriptBlock } from '@/lib/dashboard/emotion-tones'
import { sanitizeGeminiJsonText } from '@/lib/dashboard/gemini-models'
import {
  categoryToTargetFormat,
  deriveTopic,
  buildScriptGuideOutput,
  type ScriptGuideOutput,
} from '@/lib/dashboard/script-guide-output'

const PLATFORM_BY_CATEGORY = {
  writing: 'naver-blog',
  image: 'instagram',
  video: 'youtube',
} as const

const CAROUSEL_RULES = `
## 캐러셀 발행 형식
- fullContent는 슬라이드별 «## 슬라이드 N: 제목» + 본문 2~3줄 마크다운.
- 마지막에 CTA 슬라이드·해시태그 5개 포함.
`.trim()

function polishRefBlock(refs: AiScriptGuideReference[]): string {
  const { structureRefs, contentRefs } = partitionReferences(refs)
  let block = ''
  if (structureRefs.length > 0) {
    block += `\n[구조·톤 레퍼런스 — 채널명·제목·표현 흔적 금지, 목차·톤만 참고]\n${structureRefs.map((r, i) => `${i + 1}. ${r.title}`).join('\n')}\n`
  }
  if (contentRefs.length > 0) {
    block += `\n[내용 레퍼런스 — 사실은 유지·출처·URL·인용 표현 금지·새 문장으로]\n${contentRefs.map((r, i) => `${i + 1}. ${r.title}`).join('\n')}\n`
  }
  if (!block) block = '\n[참고 레퍼런스 없음 — 발행 주제만으로 작성]\n'
  return block
}

export function buildDirectPublishPrompt(
  ctx: AiScriptGuideRequestContext,
  topic: string,
  targetFormat: ContentFormat,
): { prompt: string; maxOutputTokens: number; imageGuideCount: number } {
  const refs = ctx.references ?? []
  const refInputBlock = buildReferencePromptBlock(refs).trim()
  const refPolishBlock = polishRefBlock(refs)
  const shortform = targetFormat === 'shortform'
  const longform = targetFormat === 'longform'
  const blog = targetFormat === 'blog' || ctx.category === 'writing'
  const carousel = targetFormat === 'carousel' || ctx.category === 'image'
  const imageGuideCount = blog ? getBlogImageGuideCount() : 0

  const formatLabel = {
    shortform: '숏폼(YouTube Shorts, 60초 이내)',
    longform: '롱폼 YouTube(8~12분)',
    blog: '블로그 글',
    carousel: '인스타그램 캐러셀',
    'sns-caption': 'SNS 캡션',
  }[targetFormat]

  const commonGuideline = getAgentGuidelineSection('common')
  const formatGuideline = shortform
    ? buildAgentFormatGuidelineBlock('shortform', ctx.shortformCategoryId)
    : blog
      ? buildAgentFormatGuidelineBlock('blog')
      : ''
  const carouselExtra = carousel ? CAROUSEL_RULES : ''
  const emotionToneBlock = ctx.category === 'video' ? buildEmotionToneScriptBlock(ctx.emotionTone) : ''

  const guidelineBlock = [commonGuideline, formatGuideline, carouselExtra].filter(Boolean).join('\n\n')

  const fullContentHint = shortform
    ? '시간대별 장면 스크립트 ([0~N초] + 화면(한글) + 자막·제작 메모, Google Flow 줄 없음)'
    : longform
      ? '챕터별 내레이션 전체 대본 (마크다운 ## 챕터 제목 + 실제로 읽는 문장체 본문, Google Flow·씬 표기 없음)'
      : blog
        ? '마크다운 전체 본문 (H2·이미지·표 가이드 블록 포함)'
        : carousel
          ? '슬라이드별 마크다운 전체'
          : '마크다운 전체 본문'

  const shortformOutputRules = shortform
    ? `
## 숏폼 출력 규칙 (필수)
1. **플랫폼 스펙을 먼저 적용**한 뒤 장면·길이·안전영역을 설계합니다 (YouTube Shorts / Reels / TikTok 통합 1080×1300).
2. JSON **flowPasteBlock** (씬별 Flow **유일한** 영문 위치): 씬마다 \`### 씬N · 0~5초 · (한글 장면 제목)\` 다음 줄에 **해당 씬 전체를 한 번에 붙여넣을 영문만** (비주얼·동작·조명·카메라·무드·9:16·안전영역을 **한 덩어리**로, 문장 중복 없이).
3. JSON **fullContent**: [0~N초]·나레이션·**화면(한글)**·자막·제작 메모만. **\`**Google Flow:\`**\` 줄은 fullContent에 넣지 마세요** (서버가 flowPasteBlock을 맨 위에 고정하고 본문 Flow 줄은 제거합니다).
4. 총 길이 **45~60초**, 씬 **3~5개**.
`
    : longform
      ? `
## 롱폼 출력 규칙 (필수)
1. 총 분량 **8~12분**짜리 YouTube 본영상 내레이션 **전체 대본**을 작성합니다 — 진행자가 그대로 읽는 문장체이며, 장면 컷·Flow 프롬프트·씬 표기는 포함하지 않습니다.
2. 구성은 서론(약 10%, 도입 훅 포함) · 본론(약 75%, **챕터 3~6개**) · 결론+CTA(약 15%) 비율로 설계합니다.
3. JSON **chapterSummary**: 챕터 제목을 등장 순서대로 나열하세요 (YouTube 설명란 타임스탬프 자동 생성에 사용됩니다).
4. JSON **fullContent**: 챕터마다 \`## (챕터 제목)\` 다음 줄부터 **실제 내레이션 문장**을 작성하세요 (불릿 요약이 아닌 완성 문장체).
5. **flowPasteBlock·"씬N"·Google Flow 관련 표기는 절대 포함하지 마세요** — 롱폼은 실사·자료화면·인터뷰 기반이며 Flow(Veo) 생성 대상이 아닙니다.
`
      : ''

  const prompt = `당신은 콘텐츠 기획·에디터입니다. 아래 조건으로 **내가 직접 발행할 오리지널 콘텐츠**를 처음부터 한 번에 작성합니다. (중간 초안 없이 발행용 최종본)

[발행 주제 — 반드시 유지]
${topic}

${refInputBlock}

${refPolishBlock}

## 가이드라인 (guidelines/contents_guideline.md · platform_shortform_specs.md)
${guidelineBlock || '(가이드라인 파일 로드 실패 — 발행 주제와 포맷만 반영)'}

포맷: ${formatLabel} · 카테고리: ${ctx.category}
${shortformOutputRules}
${emotionToneBlock}

## 출력 형식
반드시 JSON만 응답:
{
  "title": "발행용 제목",
  ${shortform ? '"flowPasteBlock": "씬별 ### 씬N · 시간 · 제목 + 영문 한 덩어리 (중복 없음)",' : ''}
  "fullContent": "${fullContentHint}",
  "summary": "작성 요약 2~3문장${shortform ? ' (장면 수·플랫폼 스펙 준수·Flow 씬 요약)' : longform ? ' (챕터 구성·총 분량 요약)' : ''}",
  "imageGuideCount": ${imageGuideCount},
  "hook": "오프닝 훅 한 문단 (선택)",
  "cta": "마무리 CTA (선택)",
  "seoKeywords": ["키워드1", "키워드2"],
  "chapterSummary": ["소제목1", "소제목2"]${
    blog
      ? `,
  ${BLOG_PLATFORM_VARIANTS_SCHEMA}`
      : ''
  }
}`

  // 숏폼은 title·flowPasteBlock·fullContent(시간대별 전체 스크립트)·기타 메타를 하나의 JSON으로
  // 한 번에 받아야 해서 분량이 크다 — 토큰 한도에 걸려 JSON이 잘리는 사례가 있어 여유 있게 책정
  const maxOutputTokens = shortform ? 16_384 : targetFormat === 'longform' ? 12_288 : 8192
  return { prompt, maxOutputTokens, imageGuideCount }
}

export interface DirectPublishResult {
  script: ScriptGuideOutput
  polished: ContentPolishResult
}

export function parseDirectPublishResponse(
  text: string,
  ctx: AiScriptGuideRequestContext,
  topic: string,
  targetFormat: ContentFormat,
  fallbackImageCount: number,
): DirectPublishResult | null {
  const shortform = targetFormat === 'shortform'
  const polished = parseContentPolishResponse(text, topic, { shortform })
  if (!polished) return null

  if (!polished.imageGuideCount && fallbackImageCount > 0) {
    polished.imageGuideCount = fallbackImageCount
  }

  let hook: string | undefined
  let cta: string | undefined
  let seoKeywords: string[] | undefined
  let chapterSummary: string[] | undefined

  try {
    const fence = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/)
    const cleaned = fence ? fence[1].trim() : text
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/)
    const raw = jsonMatch ? jsonMatch[0].replace(/,\s*([}\]])/g, '$1') : null
    const sanitized = sanitizeGeminiJsonText(text)

    let parsed: Record<string, unknown> | null = null
    for (const candidate of [raw, sanitized]) {
      if (!candidate) continue
      try {
        parsed = JSON.parse(candidate)
        break
      } catch {
        // 다음 후보로
      }
    }

    if (parsed) {
      if (parsed.hook) hook = String(parsed.hook).trim()
      if (parsed.cta) cta = String(parsed.cta).trim()
      if (Array.isArray(parsed.seoKeywords)) {
        seoKeywords = parsed.seoKeywords.map(String).filter(Boolean)
      }
      if (Array.isArray(parsed.chapterSummary)) {
        chapterSummary = parsed.chapterSummary.map(String).filter(Boolean)
      }
    }
  } catch {
    /* optional meta fields */
  }

  const intent =
    ctx.intent ??
    (ctx.category === 'video' ? 'shortform_video' : ctx.category === 'writing' ? 'blog' : 'carousel')

  const script = buildScriptGuideOutput({
    mode: 'direct',
    category: ctx.category,
    intent,
    targetFormat,
    platform: PLATFORM_BY_CATEGORY[ctx.category],
    topic,
    title: polished.title,
    fullScript: polished.fullContent,
    hook,
    cta,
    seoKeywords,
    chapterSummary,
    message: '발행용 콘텐츠를 한 번에 생성했습니다',
  })

  return { script, polished }
}

export function resolveDirectPublishContext(ctx: AiScriptGuideRequestContext) {
  const topic = deriveTopic(ctx.keywords ?? [], ctx.references ?? [], ctx.userTopic)
  const intent =
    ctx.intent ??
    (ctx.category === 'video' ? 'shortform_video' : ctx.category === 'writing' ? 'blog' : 'carousel')
  const targetFormat = categoryToTargetFormat(ctx.category, intent)
  return { topic, intent, targetFormat }
}
