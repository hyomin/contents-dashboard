import { readFileSync } from 'fs'
import { join } from 'path'

export interface VerifiedYoutubeChannel {
  channelId: string
  title: string
  handle: string
  section: string
  subscribers: string
  videoCount: string
  categoryId: string
}

export interface VerifiedChannelSection {
  name: string
  categoryId: string
  channels: VerifiedYoutubeChannel[]
}

/** MD 섹션명 → channel_categories.id */
export const SECTION_CATEGORY_MAP: Record<string, string> = {
  '한국 구독자 상위 50개 종합 채널': 'cat-entertainment',
  '재테크 / 경제 채널 8개': 'cat-economy',
  'IT / 테크 채널 7개': 'cat-tech',
  '국뽕 / 역사 채널 5개': 'cat-education',
  '게임 채널 10개': 'cat-game',
  '국내사 (한국사) 채널 10개': 'cat-education',
  '세계사 채널 10개': 'cat-education',
  '우주 / 천문 채널 10개': 'cat-education',
  '물리 채널 10개': 'cat-education',
  '화학 채널 10개': 'cat-education',
  '지구과학 채널 10개': 'cat-education',
}

const DEFAULT_CATEGORY_ID = 'cat-other'

export function resolveSectionCategoryId(section: string): string {
  return SECTION_CATEGORY_MAP[section] ?? DEFAULT_CATEGORY_ID
}

export function parseVerifiedChannelsMd(md: string): VerifiedYoutubeChannel[] {
  const channels: VerifiedYoutubeChannel[] = []
  let currentSection = ''
  let inValidSection = false

  for (const line of md.split('\n')) {
    if (line.startsWith('## ✅')) {
      inValidSection = true
      continue
    }
    if (line.startsWith('## ❌') || line.startsWith('---') && inValidSection && channels.length > 0 && line.includes('---')) {
      // stop at invalid section header (after we've parsed valid tables)
    }
    if (line.startsWith('## ❌')) {
      break
    }

    const secMatch = line.match(/^###\s+(.+)/)
    if (secMatch && inValidSection) {
      currentSection = secMatch[1].trim()
      continue
    }

    if (!inValidSection || !currentSection) continue
    if (!line.trim().startsWith('|') || line.includes(':--:') || line.includes('| # |')) continue

    const handleCol = line.match(/@([\w.-]+)/)
    const idMatch = line.match(/`(UC[\w-]{22})`/)
    if (!handleCol || !idMatch) continue

    const cols = line.split('|').map((c) => c.trim()).filter(Boolean)
    const nameCol = cols.find((c) => c.includes('**'))
    const title = nameCol ? nameCol.replace(/\*\*/g, '').trim() : ''
    const subs = cols.find((c, i) => i >= 3 && /^[\d.]+[MK만,]|^비공개|^0$/.test(c)) ?? ''
    const vidCol = cols[cols.length - 1] ?? ''

    const handle = handleCol[1]
    if (channels.some((c) => c.channelId === idMatch[1])) continue

    channels.push({
      channelId: idMatch[1],
      title,
      handle,
      section: currentSection,
      subscribers: subs,
      videoCount: vidCol,
      categoryId: resolveSectionCategoryId(currentSection),
    })
  }

  return channels
}

export function loadVerifiedChannelsFromDoc(): VerifiedYoutubeChannel[] {
  const path = join(process.cwd(), 'docs/YOUTUBE_CHANNELS_VERIFIED_20260525.md')
  const md = readFileSync(path, 'utf8')
  return parseVerifiedChannelsMd(md)
}

export function groupVerifiedBySection(channels: VerifiedYoutubeChannel[]): VerifiedChannelSection[] {
  const map = new Map<string, VerifiedYoutubeChannel[]>()
  for (const ch of channels) {
    if (!map.has(ch.section)) map.set(ch.section, [])
    map.get(ch.section)!.push(ch)
  }
  return Array.from(map.entries()).map(([name, list]) => ({
    name,
    categoryId: resolveSectionCategoryId(name),
    channels: list,
  }))
}
