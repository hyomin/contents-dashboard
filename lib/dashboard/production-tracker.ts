/**
 * 영상 제작 진행 보드 — 6단계(기획→비주얼→나레이션→BGM→편집→자막) 제작 과정을
 * 여러 콘텐츠를 동시에·여러 날에 걸쳐 진행할 수 있도록, 단계별 진행 상태와
 * "오늘 어디까지 했는지" 메모를 중간 저장해 기록 관리하는 localStorage 기반 보드.
 */

export interface ProductionStageDef {
  id: string
  order: number
  icon: string
  title: string
  subtitle: string
}

export const PRODUCTION_STAGES = [
  { id: 'plan', order: 1, icon: '📝', title: '기획·대본', subtitle: '주제 선정 → 스크립트 작성 — 콘텐츠 가이드 활용' },
  { id: 'visual', order: 2, icon: '🎬', title: '비주얼·클립 확보', subtitle: '스톡 영상·직접 촬영·화면 녹화(OBS)로 씬별 컷 준비 · 실패·과정 클립 캡처 → 숏폼 소재 확보' },
  { id: 'narration', order: 3, icon: '🎙️', title: '나레이션', subtitle: '대본을 음성으로 변환 — TTS(브루 등) 또는 직접 녹음' },
  { id: 'bgm', order: 4, icon: '🎵', title: 'BGM 선곡·배치', subtitle: '분위기에 맞는 곡 식별·확보(콘텐츠 분석기) 후 영상에 배치·더킹' },
  { id: 'edit', order: 5, icon: '✂️', title: '편집·합성', subtitle: '클립+나레이션+BGM+자막을 하나로 합쳐 컷 편집·트랜지션 정리' },
  { id: 'subtitle', order: 6, icon: '💬', title: '자막', subtitle: '음성 인식 기반 자막 자동 생성·교정 후 최종 내보내기' },
] as const satisfies readonly ProductionStageDef[]

export type ProductionStageId = (typeof PRODUCTION_STAGES)[number]['id']

export const PRODUCTION_STAGE_IDS = PRODUCTION_STAGES.map((s) => s.id) as ProductionStageId[]

export type ProductionStageStatus = 'todo' | 'in_progress' | 'done'

export const STAGE_STATUS_LABEL: Record<ProductionStageStatus, string> = {
  todo: '할 일',
  in_progress: '진행 중',
  done: '완료',
}

export interface ProductionStageState {
  status: ProductionStageStatus
  /** 중간 저장 메모 — "오늘 어디까지 했는지·다음에 뭘 이어갈지"를 자유롭게 기록 */
  note: string
  updatedAt: string | null
}

export interface ProductionProject {
  id: string
  title: string
  /** 프로젝트 전체에 대한 메모(선택) */
  memo?: string
  stages: Record<ProductionStageId, ProductionStageState>
  createdAt: string
  updatedAt: string
}

const STORAGE_KEY = 'dashboard_production_tracker_projects'
const MAX_PROJECTS = 60

function isBrowser(): boolean {
  return typeof window !== 'undefined'
}

function createEmptyStageState(): ProductionStageState {
  return { status: 'todo', note: '', updatedAt: null }
}

function createInitialStages(): Record<ProductionStageId, ProductionStageState> {
  const stages = {} as Record<ProductionStageId, ProductionStageState>
  for (const id of PRODUCTION_STAGE_IDS) stages[id] = createEmptyStageState()
  return stages
}

/** 저장된 데이터에 단계가 누락돼 있을 수 있으므로(스키마 변경 대비) 항상 모든 단계를 채워 반환 */
function normalizeProject(raw: unknown): ProductionProject | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  const id = typeof r.id === 'string' ? r.id : ''
  const title = typeof r.title === 'string' ? r.title.trim() : ''
  if (!id || !title) return null

  const rawStages = (r.stages && typeof r.stages === 'object' ? r.stages : {}) as Record<string, unknown>
  const stages = createInitialStages()
  for (const sid of PRODUCTION_STAGE_IDS) {
    const s = rawStages[sid]
    if (s && typeof s === 'object') {
      const ss = s as Record<string, unknown>
      const status = ss.status === 'in_progress' || ss.status === 'done' ? ss.status : 'todo'
      stages[sid] = {
        status,
        note: typeof ss.note === 'string' ? ss.note : '',
        updatedAt: typeof ss.updatedAt === 'string' ? ss.updatedAt : null,
      }
    }
  }

  const now = new Date().toISOString()
  return {
    id,
    title,
    memo: typeof r.memo === 'string' && r.memo.trim() ? r.memo.trim() : undefined,
    stages,
    createdAt: typeof r.createdAt === 'string' ? r.createdAt : now,
    updatedAt: typeof r.updatedAt === 'string' ? r.updatedAt : now,
  }
}

export function loadProductionProjects(): ProductionProject[] {
  if (!isBrowser()) return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.map(normalizeProject).filter((x): x is ProductionProject => x !== null)
  } catch {
    return []
  }
}

function saveProductionProjects(projects: ProductionProject[]): void {
  if (!isBrowser()) return
  localStorage.setItem(STORAGE_KEY, JSON.stringify(projects.slice(0, MAX_PROJECTS)))
}

export function createProductionProject(title: string, memo?: string): ProductionProject[] {
  const now = new Date().toISOString()
  const project: ProductionProject = {
    id: `prod-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    title: title.trim(),
    memo: memo?.trim() || undefined,
    stages: createInitialStages(),
    createdAt: now,
    updatedAt: now,
  }
  const next = [project, ...loadProductionProjects()]
  saveProductionProjects(next)
  return next
}

export function renameProductionProject(projectId: string, title: string, memo?: string): ProductionProject[] {
  const now = new Date().toISOString()
  const next = loadProductionProjects().map((p) =>
    p.id === projectId ? { ...p, title: title.trim() || p.title, memo: memo?.trim() || undefined, updatedAt: now } : p,
  )
  saveProductionProjects(next)
  return next
}

/**
 * 단계의 진행 상태·메모를 "중간 저장"한다.
 * 같은 단계를 여러 날에 걸쳐 이어서 진행할 때마다 호출해 그때까지의 진척을 기록한다.
 */
export function saveProductionStageProgress(
  projectId: string,
  stageId: ProductionStageId,
  patch: { status?: ProductionStageStatus; note?: string },
): ProductionProject[] {
  const now = new Date().toISOString()
  const next = loadProductionProjects().map((p) => {
    if (p.id !== projectId) return p
    const prevStage = p.stages[stageId] ?? createEmptyStageState()
    const nextStage: ProductionStageState = {
      status: patch.status ?? prevStage.status,
      note: patch.note ?? prevStage.note,
      updatedAt: now,
    }
    return { ...p, stages: { ...p.stages, [stageId]: nextStage }, updatedAt: now }
  })
  saveProductionProjects(next)
  return next
}

export function removeProductionProject(projectId: string): ProductionProject[] {
  const next = loadProductionProjects().filter((p) => p.id !== projectId)
  saveProductionProjects(next)
  return next
}

export function clearProductionProjects(): void {
  saveProductionProjects([])
}

/** 완료(done) 단계 수 / 전체 단계 수 — 진행률 표시용 */
export function getProjectProgress(project: ProductionProject): { done: number; total: number } {
  const total = PRODUCTION_STAGE_IDS.length
  const done = PRODUCTION_STAGE_IDS.filter((id) => project.stages[id]?.status === 'done').length
  return { done, total }
}

/** 가장 먼저 손대야 할 단계 — "할 일" 또는 "진행 중" 중 순서가 가장 빠른 단계 (전부 완료면 null) */
export function getNextActionableStage(project: ProductionProject): ProductionStageDef | null {
  for (const stage of PRODUCTION_STAGES) {
    const status = project.stages[stage.id]?.status
    if (status === 'todo' || status === 'in_progress') return stage
  }
  return null
}
