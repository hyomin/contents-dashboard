import { NextRequest, NextResponse } from 'next/server'
import type { GuideCategory, AiScriptGuideRequestContext } from '@/lib/dashboard/content-creation-guide'
import { GUIDE_BY_CATEGORY } from '@/lib/dashboard/content-creation-guide'

export interface ScriptGuideResult {
  hookVariants: string[]
  chapterBullets: string[]
  ctaLine: string
  subtitleLines: string[]
  toneHints: string[]
  category: GuideCategory
  intent: string
  generatedAt: string
}

const INTENT_LABEL: Record<string, string> = {
  longform_video: '롱폼 영상 (10분+)',
  shortform_video: '숏폼 / 릴스 (60초)',
  blog: '블로그 / 티스토리',
  carousel: '인스타 캐러셀',
  general: '일반',
}

async function generateScriptGuide(ctx: AiScriptGuideRequestContext): Promise<ScriptGuideResult | null> {
  const apiKey = process.env.GEMINI_API_KEY?.trim()
  if (!apiKey) return null

  const guide = GUIDE_BY_CATEGORY[ctx.category]
  const keywordList = ctx.keywords.slice(0, 6).join(', ') || '없음'
  const refList = ctx.referenceTitles.slice(0, 5).map((t, i) => `${i + 1}. ${t}`).join('\n') || '없음'
  const intentLabel = INTENT_LABEL[ctx.intent] ?? ctx.intent
  const checklist = guide.checklist.join('\n')

  const prompt = `당신은 유튜브·블로그 콘텐츠 전문 스크립트 기획자입니다.
아래 정보를 바탕으로 "${intentLabel}" 콘텐츠의 스크립트 가이드를 작성해주세요.

[현재 키워드 트렌드]
${keywordList}

[고성과 레퍼런스 제목 (Outlier)]
${refList}

[카테고리 체크리스트]
${checklist}

다음 형식의 JSON만 응답하세요 (다른 텍스트 없이):
{
  "hookVariants": ["오프닝 훅 방식1", "오프닝 훅 방식2", "오프닝 훅 방식3"],
  "chapterBullets": ["챕터1: ...", "챕터2: ...", "챕터3: ...", "챕터4: ...", "챕터5: ..."],
  "ctaLine": "마지막 CTA 한 줄",
  "subtitleLines": ["자막용 짧은 문장1", "자막용 짧은 문장2", "자막용 짧은 문장3"],
  "toneHints": ["톤·금기 힌트1", "톤·금기 힌트2"]
}`

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.5, maxOutputTokens: 2048 },
        }),
        signal: AbortSignal.timeout(25000),
      },
    )
    if (!res.ok) {
      console.error('[script-guide] gemini error', res.status)
      return null
    }
    const data = (await res.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[]
    }
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return null
    const parsed = JSON.parse(jsonMatch[0]) as Omit<ScriptGuideResult, 'category' | 'intent' | 'generatedAt'>
    return {
      ...parsed,
      category: ctx.category,
      intent: ctx.intent,
      generatedAt: new Date().toISOString(),
    }
  } catch (err) {
    console.error('[script-guide] failed', err)
    return null
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json() as { context?: AiScriptGuideRequestContext }
  const ctx = body.context

  if (!ctx?.category || !ctx?.intent) {
    return NextResponse.json({ error: 'context.category와 context.intent가 필요합니다' }, { status: 400 })
  }

  const apiKey = process.env.GEMINI_API_KEY?.trim()
  if (!apiKey) {
    return NextResponse.json({ error: 'GEMINI_API_KEY가 설정되지 않았습니다' }, { status: 503 })
  }

  const result = await generateScriptGuide(ctx)
  if (!result) {
    return NextResponse.json({ error: 'AI 가이드 생성에 실패했습니다. 잠시 후 다시 시도해주세요.' }, { status: 500 })
  }

  return NextResponse.json(result)
}
