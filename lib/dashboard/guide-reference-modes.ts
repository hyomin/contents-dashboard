import type { GuideReference } from '@/lib/dashboard/guide-references'

export type GuideReferenceMode = 'structure' | 'content'

export interface AiScriptGuideReference {
  title: string
  platform?: string
  channel?: string
  vsAvg?: number
  url?: string
  siteName?: string
  referenceMode: GuideReferenceMode
  contentExcerpt?: string
}

export function normalizeReferenceMode(ref: Pick<GuideReference, 'referenceMode'>): GuideReferenceMode {
  return ref.referenceMode === 'content' ? 'content' : 'structure'
}

export function guideRefToAi(ref: GuideReference): AiScriptGuideReference {
  return {
    title: ref.title,
    platform: ref.platform,
    channel: ref.channel,
    vsAvg: ref.vsAvg,
    url: ref.url,
    siteName: ref.siteName,
    referenceMode: normalizeReferenceMode(ref),
    contentExcerpt: ref.contentExcerpt,
  }
}

export function partitionReferences(refs: AiScriptGuideReference[]) {
  const structureRefs = refs.filter((r) => r.referenceMode !== 'content')
  const contentRefs = refs.filter((r) => r.referenceMode === 'content')
  return { structureRefs, contentRefs }
}

/** script-guide · content-generate 프롬프트용 레퍼런스 블록 */
export function buildReferencePromptBlock(refs: AiScriptGuideReference[]): string {
  const { structureRefs, contentRefs } = partitionReferences(refs)
  const parts: string[] = []

  if (structureRefs.length > 0) {
    const lines = structureRefs.slice(0, 8).map((r, i) => {
      const meta = [r.siteName ?? r.platform, r.channel, r.url].filter(Boolean).join(' · ')
      return `${i + 1}. ${r.title}${meta ? ` (${meta})` : ''}`
    })
    parts.push(
      `[구조·톤 레퍼런스 — 제목·H2 목차·문장 리듬·톤만 벤치마킹. 문장 복사·주제 변경 금지]\n${lines.join('\n')}`,
    )
  }

  if (contentRefs.length > 0) {
    for (const [i, r] of contentRefs.slice(0, 4).entries()) {
      const header = `[내용 레퍼런스 ${i + 1} — 사실·데이터·설명을 발행 주제에 맞게 재구성해 반영. 원문 문장 그대로 복사 금지]\n제목: ${r.title}${r.url ? `\nURL: ${r.url}` : ''}${r.siteName ? `\n출처: ${r.siteName}` : ''}`
      const body = r.contentExcerpt?.trim()
        ? `\n---\n${r.contentExcerpt.trim().slice(0, 3500)}`
        : '\n(본문 미수집 — URL 기준으로 일반 지식 보완)'
      parts.push(header + body)
    }
  }

  if (parts.length === 0) {
    return '\n\n[참고 레퍼런스 없음 — 발행 주제만으로 작성]'
  }

  return `\n\n${parts.join('\n\n')}`
}

export function structureOnlyReferenceTitles(refs: AiScriptGuideReference[]): string[] {
  return refs.filter((r) => r.referenceMode !== 'content').map((r) => r.title)
}

export function contentReferenceTitles(refs: AiScriptGuideReference[]): string[] {
  return refs.filter((r) => r.referenceMode === 'content').map((r) => r.title)
}
