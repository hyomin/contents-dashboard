/** 숏폼 결과 최상단 — Google Flow / Gemini Pro 씬별 한 번에 복사 */

export const GEMINI_FLOW_PASTE_HEADER = `## 📋 Google Flow · Gemini Pro 붙여넣기용

> **씬마다** 아래 \`---\` **바로 위 블록 전체**(### 씬N 제목 + 영문)를 **한 번에 복사**해 Flow에 붙여넣으세요.  
> 플랫폼: 9:16 · 1080×1920 · 중앙 안전영역 1080×1300 · [Branderkey 가이드](https://branderkey.notion.site/33c835c9591a8008b0cef37fcf50043f)

`

export const GEMINI_FLOW_PASTE_SEPARATOR = '\n\n---\n\n## 발행용 숏폼 스크립트\n\n'

export const FLOW_SCRIPT_DEDUP_NOTE =
  '> **Flow 프롬프트는 상단 «붙여넣기용» 씬 블록에만 있습니다.** 아래는 시간·나레이션·화면(한글)·자막·편집 메모입니다.\n\n'

/** 씬 블록 사이 구분 (복사 경계) */
export const SCENE_PASTE_DIVIDER = '\n\n---\n\n'

const FLOW_LINE_RE =
  /\*\*Google Flow:\*\*\s*([\s\S]*?)(?=\n\*\*|\n\[|\n## |\n---|\n\n---|$)/gi

const SCENE_HEADER_RE = /^###\s*씬\s*(\d+)\s*(?:·\s*([^\n]+))?\s*$/im

const TIMING_SCENE_RE =
  /\[(\d+)~(\d+)초\]\s*장면\s*(\d+)?\s*[·)]\s*([^)\n]+)?\)?\s*([^\n]*)/i

export interface FlowScenePaste {
  index: number
  timing?: string
  titleKo?: string
  narration?: string
  screenKo?: string
  flowEn: string
}

function normalizePromptText(text: string): string {
  let t = text.replace(/\s+/g, ' ').trim()
  const sentences = t.split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter(Boolean)
  const seen = new Set<string>()
  const unique: string[] = []
  for (const s of sentences) {
    const key = s.toLowerCase()
    if (!seen.has(key)) {
      seen.add(key)
      unique.push(s)
    }
  }
  if (unique.length > 1) t = unique.join(' ')
  return t
}

function parseFlowPasteBlock(block: string): FlowScenePaste[] {
  const scenes: FlowScenePaste[] = []
  const chunks = block.split(/(?=^###\s*씬\s*\d+)/im).filter((c) => c.trim())
  for (const chunk of chunks) {
    const headerMatch = chunk.match(SCENE_HEADER_RE)
    if (!headerMatch) continue
    const index = Number(headerMatch[1])
    const subtitle = headerMatch[2]?.trim()
    const body = chunk
      .replace(SCENE_HEADER_RE, '')
      .replace(/^\s*---\s*$/gm, '')
      .replace(/\n+---\s*$/g, '')
      .trim()
    const flowEn = normalizePromptText(body.replace(/^```[\w]*\n?|\n?```$/g, '').trim())
    if (!flowEn) continue
    let timing: string | undefined
    let titleKo: string | undefined
    if (subtitle) {
      const timingMatch = subtitle.match(/(\d+~\d+초)/)
      if (timingMatch) timing = timingMatch[1]
      titleKo = subtitle.replace(/\d+~\d+초\s*·?\s*/g, '').trim() || undefined
    }
    scenes.push({ index, timing, titleKo, flowEn })
  }
  if (scenes.length === 0 && block.trim()) {
    const lines = block.split(/\n\n+/).filter((p) => p.trim())
    lines.forEach((part, i) => {
      const m = part.match(SCENE_HEADER_RE)
      const en = normalizePromptText(part.replace(SCENE_HEADER_RE, '').trim())
      if (en) scenes.push({ index: m ? Number(m[1]) : i + 1, flowEn: en })
    })
  }
  return scenes.sort((a, b) => a.index - b.index)
}

function parseScenesFromScript(body: string): FlowScenePaste[] {
  const scenes: FlowScenePaste[] = []
  const blocks = body.split(/(?=\[\d+~\d+초\])/).filter((b) => b.trim())
  for (const block of blocks) {
    const timingMatch = block.match(TIMING_SCENE_RE)
    if (!timingMatch) continue
    const index = Number(timingMatch[3]) || scenes.length + 1
    const timing = `${timingMatch[1]}~${timingMatch[2]}초`
    const titleKo = (timingMatch[4] || '').trim() || undefined
    const narration = (timingMatch[5] || '').trim() || undefined

    const screenMatch = block.match(/\*\*화면\(한글\):\*\*\s*([^\n]+)/i)
    const screenKo = screenMatch?.[1]?.trim()

    const flowRe = new RegExp(FLOW_LINE_RE.source, 'i')
    const flowMatch = flowRe.exec(block)
    const flowEn = flowMatch ? normalizePromptText(flowMatch[1]) : ''

    if (flowEn || screenKo || narration) {
      scenes.push({
        index,
        timing,
        titleKo,
        narration,
        screenKo,
        flowEn: flowEn || '',
      })
    }
  }
  return scenes.sort((a, b) => a.index - b.index)
}

/** flowPasteBlock + 스크립트 본문 병합·중복 제거 */
export function buildConsolidatedFlowScenes(
  flowPasteBlock?: string,
  scriptBody?: string,
): FlowScenePaste[] {
  const fromPaste = flowPasteBlock?.trim() ? parseFlowPasteBlock(flowPasteBlock) : []
  const fromScript = scriptBody?.trim() ? parseScenesFromScript(scriptBody) : []
  const byIndex = new Map<number, FlowScenePaste>()

  for (const s of fromScript) {
    byIndex.set(s.index, { ...s })
  }
  for (const s of fromPaste) {
    const prev = byIndex.get(s.index)
    const flowEn = s.flowEn || prev?.flowEn || ''
    byIndex.set(s.index, {
      index: s.index,
      timing: s.timing || prev?.timing,
      titleKo: s.titleKo || prev?.titleKo,
      narration: prev?.narration,
      screenKo: prev?.screenKo,
      flowEn: flowEn || prev?.flowEn || '',
    })
  }

  return [...byIndex.values()]
    .filter((s) => s.flowEn)
    .sort((a, b) => a.index - b.index)
}

function formatScenePasteHeader(scene: FlowScenePaste): string {
  const parts = [`### 씬${scene.index}`]
  if (scene.timing) parts.push(scene.timing)
  if (scene.titleKo) parts.push(scene.titleKo)
  return parts.join(' · ')
}

function formatScenePasteBody(scene: FlowScenePaste): string {
  return normalizePromptText(scene.flowEn)
}

/** 씬별 Flow 붙여넣기 마크다운 (중복 없이 한곳) */
export function formatConsolidatedFlowPasteBlock(scenes: FlowScenePaste[]): string {
  if (scenes.length === 0) return ''
  return scenes
    .map((s) => `${formatScenePasteHeader(s)}\n\n${formatScenePasteBody(s)}`)
    .join(SCENE_PASTE_DIVIDER)
}

/** 발행용 스크립트에서 Google Flow 줄 제거 */
export function stripDuplicateFlowLines(scriptBody: string): string {
  let body = scriptBody.trim()
  body = body.replace(FLOW_LINE_RE, '')
  body = body.replace(/\n{3,}/g, '\n\n').trim()
  return body
}

/** fullContent에서 Google Flow 줄 추출 → 붙여넣기 블록 (레거시) */
export function extractFlowPasteFromScript(body: string): string {
  const scenes = buildConsolidatedFlowScenes(undefined, body)
  return formatConsolidatedFlowPasteBlock(scenes)
}

export function hasGeminiFlowPasteHeader(content: string): boolean {
  return content.includes('## 📋 Google Flow · Gemini Pro 붙여넣기용')
}

export function listFlowScenePastes(fullContent: string): { index: number; label: string; text: string }[] {
  const section = extractGeminiFlowPasteSection(fullContent)
  if (!section) return []
  let body = section.replace(GEMINI_FLOW_PASTE_HEADER, '').trim()
  const firstScene = body.search(/^###\s*씬/im)
  if (firstScene > 0) body = body.slice(firstScene)
  const chunks = body.split(SCENE_PASTE_DIVIDER).filter((c) => c.trim())
  return chunks.map((chunk) => {
    const headerMatch = chunk.match(SCENE_HEADER_RE)
    const index = headerMatch ? Number(headerMatch[1]) : 0
    const label = (headerMatch?.[0]?.replace(/^###\s*/, '') ?? `씬${index}`).trim()
    return { index, label, text: chunk.trim() }
  })
}

/** 씬 N 전체 복사용 텍스트 */
export function extractFlowScenePaste(fullContent: string, sceneIndex: number): string {
  const scenes = listFlowScenePastes(fullContent)
  const hit = scenes.find((s) => s.index === sceneIndex)
  return hit?.text ?? ''
}

/** UI «Flow만 복사» — 최상단 붙여넣기 블록만 */
export function extractGeminiFlowPasteSection(fullContent: string): string {
  const body = fullContent.trim()
  if (hasGeminiFlowPasteHeader(body)) {
    const sepIdx = body.indexOf('## 발행용 숏폼 스크립트')
    if (sepIdx > 0) return body.slice(0, sepIdx).trim()
    const marker = GEMINI_FLOW_PASTE_SEPARATOR.trim()
    const sep2 = body.indexOf(marker)
    if (sep2 > 0) return body.slice(0, sep2).trim()
  }
  const extracted = extractFlowPasteFromScript(body)
  if (extracted) return `${GEMINI_FLOW_PASTE_HEADER}${extracted}`
  return ''
}

function extractScriptBodyFromFullContent(raw: string): string {
  const body = raw.trim()
  if (hasGeminiFlowPasteHeader(body)) {
    const sepIdx = body.indexOf('## 발행용 숏폼 스크립트')
    if (sepIdx > 0) {
      return body
        .slice(sepIdx)
        .replace(/^## 발행용 숏폼 스크립트\s*\n*/i, '')
        .replace(FLOW_SCRIPT_DEDUP_NOTE, '')
        .trim()
    }
    return body
      .replace(/^## 📋 Google Flow[\s\S]*?(?=\n---\n\n## 발행용|\n## 발행용|\n\[0~|$)/, '')
      .trim()
  }
  return body
}

export function prependGeminiFlowPasteBlock(
  fullContent: string,
  flowPasteBlock?: string,
): string {
  const raw = fullContent.trim()
  const scriptOnly = extractScriptBodyFromFullContent(raw)
  const scenes = buildConsolidatedFlowScenes(flowPasteBlock, scriptOnly)
  const paste = formatConsolidatedFlowPasteBlock(scenes)

  let scriptPart = stripDuplicateFlowLines(scriptOnly)
  if (!scriptPart.startsWith('> **Flow')) {
    scriptPart = `${FLOW_SCRIPT_DEDUP_NOTE}${scriptPart}`
  }

  if (!paste) {
    if (hasGeminiFlowPasteHeader(raw)) return raw
    return scriptPart
  }

  return `${GEMINI_FLOW_PASTE_HEADER}${paste}${GEMINI_FLOW_PASTE_SEPARATOR}${scriptPart}`
}
