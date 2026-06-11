'use client'

import { useEffect, useState } from 'react'
import type { AddToast } from '@/lib/dashboard/dashboard-types'
import {
  PRODUCTION_STAGES,
  STAGE_STATUS_LABEL,
  loadProductionProjects,
  createProductionProject,
  renameProductionProject,
  saveProductionStageProgress,
  removeProductionProject,
  getProjectProgress,
  getNextActionableStage,
  type ProductionProject,
  type ProductionStageId,
  type ProductionStageStatus,
} from '@/lib/dashboard/production-tracker'

const STATUS_DOT: Record<ProductionStageStatus, string> = {
  todo: 'bg-gray-200 dark:bg-gray-600',
  in_progress: 'bg-amber-400',
  done: 'bg-emerald-500',
}

const STATUS_BADGE: Record<ProductionStageStatus, string> = {
  todo: 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-300',
  in_progress: 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-200',
  done: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-200',
}

const STATUS_ORDER: ProductionStageStatus[] = ['todo', 'in_progress', 'done']

function formatTimestamp(iso: string | null): string {
  if (!iso) return '저장 기록 없음'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '저장 기록 없음'
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  const hh = String(d.getHours()).padStart(2, '0')
  const mi = String(d.getMinutes()).padStart(2, '0')
  return `${mm}/${dd} ${hh}:${mi} 저장`
}

function StageStepper({ project }: { project: ProductionProject }) {
  return (
    <div className="flex items-center gap-1.5">
      {PRODUCTION_STAGES.map((stage) => {
        const status = project.stages[stage.id]?.status ?? 'todo'
        return (
          <span
            key={stage.id}
            title={`${stage.icon} ${stage.title} · ${STAGE_STATUS_LABEL[status]}`}
            className={`w-2.5 h-2.5 rounded-full ${STATUS_DOT[status]}`}
          />
        )
      })}
    </div>
  )
}

function StageEditor({
  project,
  stageId,
  onSave,
}: {
  project: ProductionProject
  stageId: ProductionStageId
  onSave: (stageId: ProductionStageId, status: ProductionStageStatus, note: string) => void
}) {
  const stageDef = PRODUCTION_STAGES.find((s) => s.id === stageId)!
  const stageState = project.stages[stageId]
  const [status, setStatus] = useState<ProductionStageStatus>(stageState?.status ?? 'todo')
  const [note, setNote] = useState(stageState?.note ?? '')
  const dirty = status !== (stageState?.status ?? 'todo') || note !== (stageState?.note ?? '')

  return (
    <div className="rounded-xl border border-gray-100 dark:border-gray-700 bg-gray-50/60 dark:bg-gray-900/40 p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
            <span>{stageDef.icon}</span>
            <span>{stageDef.order}단계 · {stageDef.title}</span>
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{stageDef.subtitle}</p>
        </div>
        <span className="shrink-0 text-[11px] text-gray-400 dark:text-gray-500 whitespace-nowrap">
          {formatTimestamp(stageState?.updatedAt ?? null)}
        </span>
      </div>

      <div className="flex items-center gap-1.5">
        {STATUS_ORDER.map((s) => (
          <button
            key={s}
            onClick={() => setStatus(s)}
            className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors ${
              status === s
                ? STATUS_BADGE[s] + ' ring-1 ring-inset ring-current'
                : 'bg-white dark:bg-gray-800 text-gray-400 dark:text-gray-500 border border-gray-200 dark:border-gray-700'
            }`}
          >
            {STAGE_STATUS_LABEL[s]}
          </button>
        ))}
      </div>

      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="오늘 어디까지 했는지, 다음에 이어서 뭘 할지 메모해 두면 다음에 작업을 이어가기 편해요"
        rows={3}
        className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-400 resize-none"
      />

      <div className="flex items-center justify-end gap-2">
        {dirty && <span className="text-[11px] text-amber-600 dark:text-amber-400">저장하지 않은 변경 사항이 있어요</span>}
        <button
          onClick={() => onSave(stageId, status, note)}
          disabled={!dirty}
          className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold transition-colors"
        >
          💾 이 단계 중간 저장
        </button>
      </div>
    </div>
  )
}

function ProjectCard({
  project,
  expanded,
  onToggle,
  onSaveStage,
  onRename,
  onRemove,
}: {
  project: ProductionProject
  expanded: boolean
  onToggle: () => void
  onSaveStage: (stageId: ProductionStageId, status: ProductionStageStatus, note: string) => void
  onRename: (title: string) => void
  onRemove: () => void
}) {
  const { done, total } = getProjectProgress(project)
  const next = getNextActionableStage(project)
  const [renaming, setRenaming] = useState(false)
  const [titleDraft, setTitleDraft] = useState(project.title)

  const submitRename = () => {
    const trimmed = titleDraft.trim()
    if (trimmed && trimmed !== project.title) onRename(trimmed)
    setRenaming(false)
  }

  return (
    <div className="rounded-2xl border border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden">
      <div className="p-4 flex items-center gap-3">
        <button onClick={onToggle} className="shrink-0 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors">
          {expanded ? '▾' : '▸'}
        </button>

        <div className="min-w-0 flex-1">
          {renaming ? (
            <input
              autoFocus
              value={titleDraft}
              onChange={(e) => setTitleDraft(e.target.value)}
              onBlur={submitRename}
              onKeyDown={(e) => {
                if (e.key === 'Enter') submitRename()
                if (e.key === 'Escape') { setTitleDraft(project.title); setRenaming(false) }
              }}
              className="w-full px-2 py-1 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm font-bold text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-400"
            />
          ) : (
            <button
              onClick={() => { setTitleDraft(project.title); setRenaming(true) }}
              className="text-sm font-bold text-gray-900 dark:text-white truncate hover:underline decoration-dotted text-left"
              title="클릭해서 제목 수정"
            >
              {project.title}
            </button>
          )}
          <div className="mt-1.5 flex items-center gap-2.5">
            <StageStepper project={project} />
            <span className="text-[11px] text-gray-400 dark:text-gray-500">{done}/{total}단계 완료</span>
            {next && (
              <span className="text-[11px] text-amber-600 dark:text-amber-400">
                다음: {next.icon} {next.order}. {next.title}
              </span>
            )}
            {!next && <span className="text-[11px] text-emerald-600 dark:text-emerald-400">🎉 전체 단계 완료</span>}
          </div>
        </div>

        <button
          onClick={onRemove}
          className="shrink-0 text-xs text-gray-300 hover:text-red-500 dark:text-gray-600 dark:hover:text-red-400 transition-colors"
          title="작업 삭제"
        >
          삭제
        </button>
      </div>

      {expanded && (
        <div className="px-4 pb-4 space-y-3 border-t border-gray-100 dark:border-gray-700 pt-3">
          {PRODUCTION_STAGES.map((stage) => (
            <StageEditor key={stage.id} project={project} stageId={stage.id} onSave={onSaveStage} />
          ))}
        </div>
      )}
    </div>
  )
}

export default function ProductionTrackerView({ addToast }: { addToast: AddToast }) {
  const [projects, setProjects] = useState<ProductionProject[]>([])
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [newTitle, setNewTitle] = useState('')
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null)

  useEffect(() => {
    setProjects(loadProductionProjects())
  }, [])

  const handleCreate = () => {
    const trimmed = newTitle.trim()
    if (!trimmed) {
      addToast('새로 시작할 콘텐츠 제목을 입력해 주세요', 'warning')
      return
    }
    const next = createProductionProject(trimmed)
    setProjects(next)
    setExpandedId(next[0]?.id ?? null)
    setNewTitle('')
    addToast(`✨ "${trimmed}" 제작을 진행 보드에 추가했어요`, 'success')
  }

  const handleSaveStage = (projectId: string, stageId: ProductionStageId, status: ProductionStageStatus, note: string) => {
    const next = saveProductionStageProgress(projectId, stageId, { status, note })
    setProjects(next)
    const stageDef = PRODUCTION_STAGES.find((s) => s.id === stageId)
    addToast(`💾 ${stageDef?.icon ?? ''} ${stageDef?.title ?? ''} 단계 진행 상황을 중간 저장했어요`, 'success')
  }

  const handleRename = (projectId: string, title: string) => {
    setProjects(renameProductionProject(projectId, title))
  }

  const handleRemove = (projectId: string) => {
    if (confirmRemoveId !== projectId) {
      setConfirmRemoveId(projectId)
      addToast('한 번 더 클릭하면 이 작업의 진행 기록이 모두 삭제됩니다', 'warning')
      return
    }
    const target = projects.find((p) => p.id === projectId)
    setProjects(removeProductionProject(projectId))
    setConfirmRemoveId(null)
    if (expandedId === projectId) setExpandedId(null)
    addToast(`🗑️ "${target?.title ?? '작업'}" 진행 기록을 삭제했어요`, 'info')
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-gray-900 dark:text-white">🗂️ 제작 진행 보드</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          영상 제작 6단계(기획·대본 → 비주얼·클립 확보 → 나레이션 → BGM 선곡·배치 → 편집·합성 → 자막)의 진행 상황을
          콘텐츠별로 한눈에 보고, 단계 도중에도 메모와 함께 중간 저장해 여러 작업을 동시에·여러 날에 걸쳐 이어갈 수 있어요.
        </p>
      </div>

      <div className="rounded-2xl border border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800 p-5">
        <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1.5">새 제작 작업 추가</label>
        <div className="flex items-center gap-2">
          <input
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleCreate() }}
            placeholder="예: 6월 3주차 — 밤 루틴 브이로그"
            className="flex-1 px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-400"
          />
          <button
            onClick={handleCreate}
            className="shrink-0 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold transition-colors"
          >
            + 추가
          </button>
        </div>
      </div>

      {projects.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-200 dark:border-gray-700 p-8 text-center">
          <p className="text-sm text-gray-400 dark:text-gray-500">
            아직 등록된 제작 작업이 없어요. 위에서 새 작업을 추가하면 6단계 진행 상황을 단계별로 기록할 수 있어요.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {projects.map((project) => (
            <ProjectCard
              key={project.id}
              project={project}
              expanded={expandedId === project.id}
              onToggle={() => setExpandedId(expandedId === project.id ? null : project.id)}
              onSaveStage={(stageId, status, note) => handleSaveStage(project.id, stageId, status, note)}
              onRename={(title) => handleRename(project.id, title)}
              onRemove={() => handleRemove(project.id)}
            />
          ))}
        </div>
      )}

      <div className="rounded-2xl border border-gray-100 dark:border-gray-700 bg-gray-50/60 dark:bg-gray-900/30 p-4">
        <p className="text-xs text-gray-400 dark:text-gray-500 leading-relaxed">
          💡 같은 콘텐츠를 여러 날에 나눠 진행해도 괜찮아요 — 오늘 1단계까지만 했다면 «진행 중»으로 메모를 남기고 중간 저장한 뒤,
          다음에 이어서 작업할 때 메모를 보고 바로 이어갈 수 있어요. 모든 기록은 이 브라우저(localStorage)에만 저장됩니다.
        </p>
      </div>
    </div>
  )
}
