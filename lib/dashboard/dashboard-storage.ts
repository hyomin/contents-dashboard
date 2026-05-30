/** 워크스페이스 타입 + Supabase API 클라이언트 (localStorage 제거) */

export interface CalendarItemStored {
  id: string
  /** ISO 날짜 문자열 (YYYY-MM-DD). 구형 데이터는 '오늘'/'내일' 등 레이블일 수 있음 */
  day: string
  title: string
  platform: string
  status: 'scheduled' | 'draft' | 'idea' | 'done'
  time: string
}

export interface RepurposeTaskStored {
  platform: string
  label: string
  icon: string
  status: 'done' | 'progress' | 'pending'
  notes: string
}

export interface RepurposeItemStored {
  id: string
  sourceTitle: string
  sourcePlatform: string
  sourceVsAvg: number
  videoId?: string
  tasks: RepurposeTaskStored[]
}

export interface DeployTaskStored {
  id: string
  title: string
  platform: string
  icon: string
  scheduledAt: string
  status: 'scheduled' | 'published' | 'failed' | 'draft'
  channel: string
  auto: boolean
}

export interface ChannelFlagStored {
  channel_id: string
  is_tracked: boolean
  is_mine: boolean
}

const DEFAULT_REPURPOSE_TASKS: RepurposeTaskStored[] = [
  { platform: 'youtube-shorts', label: 'YouTube Shorts 컷편집', icon: '🎬', status: 'pending', notes: '미착수' },
  { platform: 'naver-blog', label: '네이버 블로그 포스팅', icon: '🟢', status: 'pending', notes: '미착수' },
  { platform: 'tistory', label: '티스토리 SEO 포스팅', icon: '🟠', status: 'pending', notes: '미착수' },
]

export function seedRepurposeFromOutliers(
  outliers: { video_id: string; title: string; vs_avg: number; platform: string }[],
): RepurposeItemStored[] {
  return outliers
    .filter((v) => v.platform !== 'instagram')
    .slice(0, 5)
    .map((v) => ({
      id: `rp-${v.video_id}`,
      sourceTitle: v.title,
      sourcePlatform: v.platform,
      sourceVsAvg: Number(v.vs_avg),
      videoId: v.video_id,
      tasks: DEFAULT_REPURPOSE_TASKS.map((t) => ({ ...t })),
    }))
}

function addDays(base: Date, n: number): string {
  const d = new Date(base)
  d.setDate(d.getDate() + n)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function seedCalendarFromOutliers(
  outliers: { title: string; platform: string }[],
): CalendarItemStored[] {
  const base = new Date()
  return outliers
    .filter((v) => v.platform !== 'instagram')
    .slice(0, 5)
    .map((v, i) => ({
      id: `cal-seed-${i}`,
      day: addDays(base, i),
      title: v.title.slice(0, 60),
      platform: v.platform,
      status: (i === 0 ? 'scheduled' : i === 1 ? 'draft' : 'idea') as CalendarItemStored['status'],
      time: i === 0 ? '오후 6시' : '미정',
    }))
}

export function seedDeployFromOutliers(
  outliers: { title: string; platform: string; channel_name?: string | null }[],
): DeployTaskStored[] {
  const icons: Record<string, string> = {
    youtube: '🔴',
    'naver-blog': '🟢',
    tistory: '🟠',
  }
  return outliers
    .filter((v) => v.platform !== 'instagram')
    .slice(0, 4)
    .map((v, i) => ({
      id: `dep-${i}`,
      title: v.title.slice(0, 60),
      platform: v.platform,
      icon: icons[v.platform] ?? '🔗',
      scheduledAt: ['오늘 오후 6:00', '내일 오전 9:00', '2일 후', '3일 후'][i] ?? '미정',
      status: i === 0 ? 'scheduled' : 'draft',
      channel: v.channel_name ?? '내 채널',
      auto: v.platform === 'youtube',
    }))
}

async function parseJson<T>(res: Response): Promise<T> {
  if (!res.ok) throw new Error(String(res.status))
  return res.json() as Promise<T>
}

export async function fetchChannelFlags(): Promise<ChannelFlagStored[]> {
  return parseJson(await fetch('/api/dashboard/channel-flags'))
}

export async function patchChannelFlag(
  channelId: string,
  patch: { is_tracked?: boolean; is_mine?: boolean },
): Promise<ChannelFlagStored> {
  return parseJson(
    await fetch('/api/dashboard/channel-flags', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ channel_id: channelId, ...patch }),
    }),
  )
}

export function isChannelTracked(
  channelId: string,
  flags: ChannelFlagStored[],
  defaultIfEmpty = true,
): boolean {
  if (flags.length === 0) return defaultIfEmpty
  const row = flags.find((f) => f.channel_id === channelId)
  if (!row) return defaultIfEmpty
  return row.is_tracked
}

export async function fetchCalendarItems(): Promise<CalendarItemStored[]> {
  return parseJson(await fetch('/api/dashboard/calendar-items'))
}

export async function saveCalendarItems(items: CalendarItemStored[]): Promise<void> {
  await parseJson(
    await fetch('/api/dashboard/calendar-items', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(items),
    }),
  )
}

export async function fetchRepurposeItems(): Promise<RepurposeItemStored[]> {
  return parseJson(await fetch('/api/dashboard/repurpose-items'))
}

export async function saveRepurposeItems(items: RepurposeItemStored[]): Promise<void> {
  await parseJson(
    await fetch('/api/dashboard/repurpose-items', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(items),
    }),
  )
}

export async function fetchDeployTasks(): Promise<DeployTaskStored[]> {
  return parseJson(await fetch('/api/dashboard/deploy-tasks'))
}

export async function saveDeployTasks(tasks: DeployTaskStored[]): Promise<void> {
  await parseJson(
    await fetch('/api/dashboard/deploy-tasks', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(tasks),
    }),
  )
}

/** Outlier 기반 워크스페이스 초기 시드 (Supabase 테이블이 비었을 때) */
export async function seedWorkspaceIfEmpty(): Promise<{ seeded: boolean }> {
  return parseJson(
    await fetch('/api/dashboard/workspace-seed', { method: 'POST' }),
  )
}
