import { DEFAULT_GEMINI_MODEL, resolveGeminiModel } from '@/lib/dashboard/gemini-models'

const LS_TOPIC = 'guide-ai-model-topic'
const LS_SCRIPT = 'guide-ai-model-script'
const LS_POLISH = 'guide-ai-model-polish'

function load(key: string): string {
  if (typeof window === 'undefined') return DEFAULT_GEMINI_MODEL
  try {
    return resolveGeminiModel(localStorage.getItem(key))
  } catch {
    return DEFAULT_GEMINI_MODEL
  }
}

function save(key: string, model: string): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(key, resolveGeminiModel(model))
}

export function loadTopicGuideModel(): string {
  return load(LS_TOPIC)
}

export function saveTopicGuideModel(model: string): void {
  save(LS_TOPIC, model)
}

export function loadScriptGuideModel(): string {
  return load(LS_SCRIPT)
}

export function saveScriptGuideModel(model: string): void {
  save(LS_SCRIPT, model)
}

export function loadPolishModel(): string {
  return load(LS_POLISH)
}

export function savePolishModel(model: string): void {
  save(LS_POLISH, model)
}
