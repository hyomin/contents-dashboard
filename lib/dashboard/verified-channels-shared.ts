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

/** 채널명·핸들 키워드로 MD 섹션 기본값 보정 (뉴스·테크 등) */
export function resolveChannelCategoryId(ch: {
  title: string
  handle: string
  section: string
}): string {
  const text = `${ch.title} ${ch.handle}`.toLowerCase()

  if (/뉴스|news|sbsnews|ytn|mbn|jtbc|연합뉴스|channela/i.test(text)) return 'cat-news'
  if (/syuka|슈카|재테크|경제|money|wowtv|sampro|신사임당|smartmoney|머니투데이/i.test(text)) {
    return 'cat-economy'
  }
  if (/itsub|잇섭|techmong|jocoding|조코딩|sanago|테크|tech|coding|reviewroom|samsung/i.test(text)) {
    return 'cat-tech'
  }
  if (/nurituber|howcow|팽귄|quintol|게임|game|gsibaek|testerhoon|kimblue|범석/i.test(text)) {
    return 'cat-game'
  }
  if (
    /history|역사|한국사|chistory|설민석|역tv|지식해적|지식한잔|건들건들|sciencedream|kurzgesagt|physics|chemistry|과학|물리|화학|stranger/i.test(
      text,
    )
  ) {
    return 'cat-education'
  }
  if (/pinkfong|toy|boram|bibotoys|toypudding|kids|육아|병아리|joy_bamm|naofunfun|youchangjo/i.test(text)) {
    return 'cat-parenting'
  }
  if (/paik|백종원|hamzy|mukbang|먹방|ssoyoung|쏘영|yummyboy/i.test(text)) return 'cat-lifestyle'
  if (
    /kpop|blackpink|seventeen|enhypen|exo|itzy|babymonster|lesserafim|treasure|txt|hybe|stonemusic|jfla|rosé|jisoo|mbckpop|mnet|1million|dance|official|asmr|bokyemtv|cure|gh\.s|kimpro|kkubi99|pledis|weareoneexo|team1llusion|chadabin|seoeunstory/i.test(
      text,
    )
  ) {
    return 'cat-entertainment'
  }

  return resolveSectionCategoryId(ch.section)
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
      categoryId: resolveChannelCategoryId({
        title,
        handle,
        section: currentSection,
      }),
    })
  }

  return channels
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
