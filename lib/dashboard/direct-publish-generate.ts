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
  const shortform = targetFormat === 'shortform' || ctx.category === 'video'
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

  const guidelineBlock = [commonGuideline, formatGuideline, carouselExtra].filter(Boolean).join('\n\n')

  const fullContentHint = shortform
    ? '시간대별 장면 스크립트 ([0~N초] + 화면(한글) + 자막·제작 메모, Google Flow 줄 없음)'
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

## 출력 형식
반드시 JSON만 응답:
{
  "title": "발행용 제목",
  ${shortform ? '"flowPasteBlock": "씬별 ### 씬N · 시간 · 제목 + 영문 한 덩어리 (중복 없음)",' : ''}
  "fullContent": "${fullContentHint}",
  "summary": "작성 요약 2~3문장${shortform ? ' (장면 수·플랫폼 스펙 준수·Flow 씬 요약)' : ''}",
  "imageGuideCount": ${imageGuideCount},
  "hook": "오프닝 훅 한 문단 (선택)",
  "cta": "마무리 CTA (선택)",
  "seoKeywords": ["키워드1", "키워드2"],
  "chapterSummary": ["소제목1", "소제목2"]
}`

  const maxOutputTokens = shortform ? 10_240 : targetFormat === 'longform' ? 8192 : 8192
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
  const shortform = targetFormat === 'shortform' || ctx.category === 'video'
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
    if (jsonMatch) {
      const fixed = jsonMatch[0].replace(/,\s*([}\]])/g, '$1')
      const parsed = JSON.parse(fixed) as Record<string, unknown>
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
