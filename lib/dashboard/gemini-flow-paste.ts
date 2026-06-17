/**
 * Google Flow 제거됨 — 이 파일은 하위 호환 스텁으로만 유지합니다.
 * flowPasteBlock 기반 UI는 GenerationResultView에서 제거됨.
 */

/** @deprecated Flow 제거됨 — 빈 배열 반환 */
export function listFlowScenePastes(_fullContent: string): { index: number; label: string; text: string }[] {
  return []
}

/** @deprecated Flow 제거됨 — 빈 문자열 반환 */
export function extractFlowScenePaste(_fullContent: string, _sceneIndex: number): string {
  return ''
}

/** @deprecated Flow 제거됨 — 빈 문자열 반환 */
export function extractGeminiFlowPasteSection(_fullContent: string): string {
  return ''
}

/** @deprecated Flow 제거됨 — fullContent 그대로 반환 */
export function prependGeminiFlowPasteBlock(fullContent: string, _flowPasteBlock?: string): string {
  return fullContent
}
