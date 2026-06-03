import type { ContentFormat, ContentGenerateResult } from '@/app/api/dashboard/content-generate/route'
import type { GuideCategory } from '@/lib/dashboard/content-creation-guide'
import type { AiScriptGuideReference } from '@/lib/dashboard/content-creation-guide'

export interface ScriptGuideOutput {
  mode: 'n8n' | 'dashboard' | 'gemini' | 'direct'
  category: GuideCategory
  intent: string
  targetFormat: ContentFormat
  platform: string
  topic: string
  title: string
  fullScript: string
  hook?: string
  cta?: string
  seoKeywords?: string[]
  chapterSummary?: string[]
  generatedAt: string
  message?: string
}

export function categoryToTargetFormat(
  category: GuideCategory,
  intent?: 'longform_video' | 'shortform_video' | 'blog' | 'carousel' | 'general',
): ContentFormat {
  if (category === 'writing') return 'blog'
  if (category === 'image') return 'carousel'
  if (intent === 'shortform_video' || category === 'video') return 'shortform'
  return 'longform'
}

export function deriveTopic(
  keywords: string[],
  references: AiScriptGuideReference[],
  userTopic?: string,
): string {
  const direct = userTopic?.trim()
  if (direct) return direct.slice(0, 200)
  const kw = keywords.map((k) => k.trim()).filter(Boolean)
  if (kw.length > 0) return kw.slice(0, 3).join(' · ').slice(0, 120)
  const refTitles = references.map((r) => r.title.trim()).filter((t) => t.length >= 4)
  if (refTitles.length > 0) return refTitles[0].slice(0, 120)
  return '콘텐츠 주제'
}

/** n8n Gemini 실패 시 반환되는 짧은 폴백 대본 */
export function isStubScript(fullScript: string): boolean {
  const t = fullScript.trim()
  if (t.length < 200) return true
  return (
    t.includes('직접 작성해주세요') ||
    t.includes('GEMINI_API_KEY 미설정') ||
    t.includes('(이하 내용을')
  )
}

export function contentResultToMarkdown(result: ContentGenerateResult): { title: string; body: string } {
  if (result.format === 'longform') {
    const r = result
    const body = [
      `# ${r.title}`,
      '',
      `## 오프닝 훅\n${r.hook}`,
      '',
      ...r.chapters.flatMap((c) => [
        `## ${c.heading}`,
        ...c.bullets.map((b) => `- ${b}`),
        `*(약 ${Math.round(c.durationSec / 60)}분)*`,
        '',
      ]),
      `## CTA\n${r.cta}`,
      '',
      `**SEO 키워드:** ${r.seoKeywords.join(', ')}`,
      '',
      '---',
      r.fullScript,
    ].join('\n')
    return { title: r.title, body }
  }
  if (result.format === 'shortform') {
    const r = result
    const body = [
      `# ${r.title}`,
      `**훅:** ${r.hook}`,
      '',
      ...r.keyPoints.map((p, i) => `${i + 1}. ${p}`),
      '',
      `**CTA:** ${r.cta}`,
      `**자막:** ${r.onScreenText.join(' / ')}`,
      '',
      '---',
      r.fullScript,
    ].join('\n')
    return { title: r.title, body }
  }
  if (result.format === 'blog') {
    const r = result
    const body =
      r.fullContent ||
      [
        `# ${r.title}`,
        `> ${r.metaDescription}`,
        '',
        ...r.h2Sections.flatMap((s) => [`## ${s.heading}`, ...s.paragraphs, '']),
        r.closingCta,
      ].join('\n')
    return { title: r.title, body }
  }
  if (result.format === 'carousel') {
    const r = result
    const body = [
      `# ${r.title}`,
      '',
      ...r.slides.map((s, i) => `## 슬라이드 ${i + 1}: ${s.heading}\n${s.body}`),
      '',
      `**CTA:** ${r.cta}`,
      `**해시태그:** ${r.hashtags.map((h) => `#${h}`).join(' ')}`,
    ].join('\n')
    return { title: r.title, body }
  }
  const r = result
  const body = [
    `# ${r.title}`,
    '',
    `**Instagram:**\n${r.captions.instagram}`,
    '',
    `**네이버:**\n${r.captions.naver}`,
    '',
    `**Thread:**\n${r.captions.thread}`,
  ].join('\n')
  return { title: r.title, body }
}

export function normalizeN8nScriptBody(body: unknown): Partial<ScriptGuideOutput> | null {
  if (!body || typeof body !== 'object') return null
  const b = body as Record<string, unknown>
  const scriptRaw = b.script
  const script = (scriptRaw && typeof scriptRaw === 'object' ? scriptRaw : b) as Record<string, unknown>

  const title = String(script.title ?? b.topic ?? '').trim()
  let fullScript = String(script.fullScript ?? script.fullContent ?? '').trim()

  if (!fullScript && title) {
    const parts: string[] = [`# ${title}`]
    if (script.hook) parts.push('', String(script.hook))
    if (Array.isArray(script.chapters)) {
      for (const ch of script.chapters as { heading?: string; bullets?: string[] }[]) {
        if (ch.heading) parts.push('', `## ${ch.heading}`)
        if (Array.isArray(ch.bullets)) parts.push(...ch.bullets.map((x) => `- ${x}`))
      }
    }
    if (script.cta) parts.push('', String(script.cta))
    fullScript = parts.join('\n')
  }

  if (!title && !fullScript) return null

  const chapters = Array.isArray(script.chapters)
    ? (script.chapters as { heading?: string }[]).map((c) => String(c.heading ?? '')).filter(Boolean)
    : undefined

  const modeRaw = String(b.mode ?? 'n8n')
  const mode: ScriptGuideOutput['mode'] =
    modeRaw === 'fallback' ? 'dashboard' : modeRaw === 'n8n' ? 'n8n' : 'dashboard'

  return {
    mode,
    topic: String(b.topic ?? title),
    title: title || String(b.topic ?? '제목 없음'),
    fullScript: fullScript || title,
    hook: script.hook ? String(script.hook) : undefined,
    cta: script.cta ? String(script.cta) : undefined,
    seoKeywords: Array.isArray(script.seoKeywords) ? script.seoKeywords.map(String) : undefined,
    chapterSummary: chapters,
    generatedAt: String(b.generatedAt ?? new Date().toISOString()),
    message: b.message ? String(b.message) : undefined,
  }
}

export function buildScriptGuideOutput(
  partial: Partial<ScriptGuideOutput> & Pick<ScriptGuideOutput, 'category' | 'intent' | 'targetFormat' | 'platform'>,
): ScriptGuideOutput {
  return {
    mode: partial.mode ?? 'dashboard',
    category: partial.category,
    intent: partial.intent,
    targetFormat: partial.targetFormat,
    platform: partial.platform,
    topic: partial.topic ?? partial.title ?? '',
    title: partial.title ?? partial.topic ?? '',
    fullScript: partial.fullScript ?? '',
    hook: partial.hook,
    cta: partial.cta,
    seoKeywords: partial.seoKeywords,
    chapterSummary: partial.chapterSummary,
    generatedAt: partial.generatedAt ?? new Date().toISOString(),
    message: partial.message,
  }
}
