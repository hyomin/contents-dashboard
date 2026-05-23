import { createHash } from 'crypto'
import { supabase } from './supabase'

export interface RssFeedConfig {
  name: string
  url: string
}

export interface RssTopicCandidateRow {
  id: string
  title: string
  link: string | null
  source_feed: string
  summary: string | null
  published_at: string | null
  relevance_score: number
  target_audience: string
  collected_at: string
  source: string
  updated_at: string
  ai_title?: string | null
  ai_reason?: string | null
  /** 같은 주제를 다룬 피드 이름 배열 (급상승 감지용) */
  sources?: string[]
}

export interface RssTopicCollectResult {
  ok: boolean
  targetAudience: string
  feedCount: number
  parsedCount: number
  savedCount: number
  preview?: boolean
  topics: RssTopicCandidateRow[]
  message: string
  aiEnhanced?: boolean
}

/** 체널 카테고리와 1:1 대응하는 RSS 피드 카테고리 */
export type RssFeedCategory =
  | '뉴스·시사'
  | '경제'
  | 'IT·테크'
  | '게임'
  | '육아'
  | '교육'
  | '엔터'
  | '라이프'
  | '부동산'
  | '건강·의료'
  | '복지·정책'

export interface RssFeedConfigExtended extends RssFeedConfig {
  category: RssFeedCategory
}

/** 카테고리별 RSS 피드 (체널 카테고리와 동일 분류 — 50개+) */
export const ALL_RSS_FEEDS: RssFeedConfigExtended[] = [
  // ── 뉴스·시사 ─────────────────────────────────────────────────
  { name: '연합뉴스', category: '뉴스·시사', url: 'https://www.yna.co.kr/rss/news.xml' },
  { name: '동아일보', category: '뉴스·시사', url: 'https://rss.donga.com/total.xml' },
  { name: '경향신문', category: '뉴스·시사', url: 'https://www.khan.co.kr/rss/rssdata/total_news.xml' },
  { name: '조선일보', category: '뉴스·시사', url: 'https://www.chosun.com/arc/outboundfeeds/rss/category/national/?outputType=xml' },
  { name: '중앙일보', category: '뉴스·시사', url: 'https://rss.joins.com/joins_news_list.xml' },
  { name: 'KBS 뉴스', category: '뉴스·시사', url: 'https://news.kbs.co.kr/rss/rss_news.htm' },
  { name: 'MBC 뉴스', category: '뉴스·시사', url: 'https://imnews.imbc.com/rss/news/news_00.xml' },
  { name: 'YTN', category: '뉴스·시사', url: 'https://www.ytn.co.kr/rss/0801.xml' },
  { name: '오마이뉴스', category: '뉴스·시사', url: 'https://www.ohmynews.com/NWS_Web/Rss/rss_news.xml' },
  { name: '시사IN', category: '뉴스·시사', url: 'https://www.sisain.co.kr/rss/allArticle.xml' },
  // ── 경제 ──────────────────────────────────────────────────────
  { name: '매일경제', category: '경제', url: 'https://www.mk.co.kr/rss/30000001/' },
  { name: '한국경제', category: '경제', url: 'https://www.hankyung.com/feed/economy' },
  { name: '이데일리', category: '경제', url: 'https://www.edaily.co.kr/rss/all.xml' },
  { name: '머니투데이', category: '경제', url: 'https://rss.mt.co.kr/rss/010202000000.xml' },
  { name: '파이낸셜뉴스', category: '경제', url: 'https://www.fnnews.com/rss/fn_realnews_010100.xml' },
  { name: '헤럴드경제', category: '경제', url: 'https://biz.heraldkorea.co.kr/rss/allNews.xml' },
  { name: '연합뉴스 경제', category: '경제', url: 'https://www.yna.co.kr/rss/economy.xml' },
  { name: '서울경제', category: '경제', url: 'https://www.sedaily.com/RSS' },
  { name: '한겨레 경제', category: '경제', url: 'https://www.hani.co.kr/rss/economy/' },
  // ── IT·테크 ───────────────────────────────────────────────────
  { name: 'ZDNet Korea', category: 'IT·테크', url: 'https://zdnet.co.kr/rss.xml' },
  { name: '블로터', category: 'IT·테크', url: 'https://www.bloter.net/feed' },
  { name: 'IT동아', category: 'IT·테크', url: 'https://it.donga.com/rss/' },
  { name: '전자신문', category: 'IT·테크', url: 'https://www.etnews.com/rss/all.xml' },
  { name: '디지털데일리', category: 'IT·테크', url: 'https://www.ddaily.co.kr/rss/allArticle.xml' },
  { name: '아이뉴스24', category: 'IT·테크', url: 'https://www.inews24.com/rss/' },
  { name: '테크플러스', category: 'IT·테크', url: 'https://www.techplus.co.kr/rss/allArticle.xml' },
  // ── 게임 ──────────────────────────────────────────────────────
  { name: '인벤', category: '게임', url: 'https://www.inven.co.kr/rss/news.xml' },
  { name: 'GameMeca', category: '게임', url: 'https://www.gamemeca.com/feed.php' },
  { name: '디스이즈게임', category: '게임', url: 'https://www.thisisgame.com/webzine/rss/nboard.xml' },
  { name: '게임메카', category: '게임', url: 'https://www.gamemeca.com/rss/all.xml' },
  { name: '경향게임스', category: '게임', url: 'https://www.khgames.co.kr/rss/allArticle.xml' },
  // ── 육아 ──────────────────────────────────────────────────────
  { name: '베이비뉴스', category: '육아', url: 'https://www.ibabynews.com/rss/allArticle.xml' },
  { name: '베이비타임즈', category: '육아', url: 'https://www.babytimes.co.kr/rss/allArticle.xml' },
  { name: '뉴스1 육아', category: '육아', url: 'https://www.news1.kr/rss/baby' },
  { name: '맘앤앙팡', category: '육아', url: 'https://www.mamandenfant.co.kr/rss/allArticle.xml' },
  // ── 교육 ──────────────────────────────────────────────────────
  { name: '베리타스알파', category: '교육', url: 'https://www.veritas-a.com/rss/allArticle.xml' },
  { name: '한국대학신문', category: '교육', url: 'https://news.unn.net/rss/allArticle.xml' },
  { name: '에듀프레스', category: '교육', url: 'https://www.edupress.kr/rss' },
  { name: '교육부 정책브리핑', category: '교육', url: 'https://www.korea.kr/rss/education.xml' },
  { name: '에듀동아', category: '교육', url: 'https://edu.donga.com/rss/' },
  // ── 엔터 ──────────────────────────────────────────────────────
  { name: '텐아시아', category: '엔터', url: 'https://tenasia.hankyung.com/rss' },
  { name: '뉴스엔', category: '엔터', url: 'https://www.newsen.com/rss/news_culture_list.xml' },
  { name: 'OSEN', category: '엔터', url: 'https://osen.mt.co.kr/rss/osen_news.xml' },
  { name: '스타뉴스', category: '엔터', url: 'https://star.mt.co.kr/rss/star_all.xml' },
  { name: '스포츠조선 엔터', category: '엔터', url: 'https://sports.chosun.com/arc/outboundfeeds/rss/category/entertainment/?outputType=xml' },
  // ── 라이프 ────────────────────────────────────────────────────
  { name: '위키트리', category: '라이프', url: 'https://www.wikitree.co.kr/rss/allArticle.xml' },
  { name: '데일리팝', category: '라이프', url: 'https://www.dailypop.kr/rss/allArticle.xml' },
  { name: '시니어조선', category: '라이프', url: 'https://senior.chosun.com/arc/outboundfeeds/rss/?outputType=xml' },
  { name: '오마이뉴스 라이프', category: '라이프', url: 'https://www.ohmynews.com/NWS_Web/Rss/life.xml' },
  // ── 부동산 ────────────────────────────────────────────────────
  { name: '조선비즈 부동산', category: '부동산', url: 'https://biz.chosun.com/arc/outboundfeeds/rss/category/real-estate/?outputType=xml' },
  { name: '한경 부동산', category: '부동산', url: 'https://www.hankyung.com/feed/realestate' },
  { name: '매경 부동산', category: '부동산', url: 'https://www.mk.co.kr/rss/50400012/' },
  { name: '이데일리 부동산', category: '부동산', url: 'https://www.edaily.co.kr/rss/real-estate.xml' },
  // ── 건강·의료 ─────────────────────────────────────────────────
  { name: '헬스조선', category: '건강·의료', url: 'https://health.chosun.com/arc/outboundfeeds/rss/?outputType=xml' },
  { name: '메디컬투데이', category: '건강·의료', url: 'https://www.mdtoday.co.kr/rss/allArticle.xml' },
  { name: '코메디닷컴', category: '건강·의료', url: 'https://kormedi.com/feed/' },
  { name: '하이닥', category: '건강·의료', url: 'https://www.hidoc.co.kr/rss/allArticle.xml' },
  // ── 복지·정책 ─────────────────────────────────────────────────
  { name: '정책브리핑', category: '복지·정책', url: 'https://www.korea.kr/rss/policy.xml' },
  { name: '복지타임스', category: '복지·정책', url: 'https://www.bokjitimes.com/rss/allArticle.xml' },
  { name: 'KBS 사회', category: '복지·정책', url: 'https://news.kbs.co.kr/rss/rss_society.htm' },
]

/** 기본 수집 피드 = 전체 */
export const DEFAULT_RSS_FEEDS: RssFeedConfig[] = ALL_RSS_FEEDS

/** 카테고리별 키워드 세트 (스코어링용) */
export const CATEGORY_KEYWORDS: Record<string, string[]> = {
  '뉴스·시사': [
    '정치', '사회', '시사', '국회', '대통령', '정부', '외교', '국제', '사건', '사고',
    '선거', '법원', '검찰', '청문회', '여당', '야당', '국정',
  ],
  '경제': [
    '주식', '금리', '부동산', '경제', '투자', '재테크', '코스피', '달러', '금융', '연금',
    '은퇴', '노후', '전세', '상속', '절약', '보험', '펀드', '채권', '환율', '물가',
    '고금리', '인플레', '증시', '코인', '비트코인',
  ],
  'IT·테크': [
    'AI', '인공지능', '스타트업', '앱', '스마트폰', '테크', 'IT', '클라우드', '빅데이터',
    '반도체', '삼성', '애플', '구글', '메타', 'GPT', '챗GPT', '로봇', '자율주행',
    '소프트웨어', '플랫폼', '모바일', '데이터센터',
  ],
  '게임': [
    '게임', '출시', '업데이트', '리그오브레전드', '배틀그라운드', 'RPG', '모바일게임',
    'e스포츠', '닌텐도', 'PC게임', '콘솔', '스팀', '넥슨', 'NC소프트', '카카오게임즈',
    '신작', '패치', '서버', '캐릭터',
  ],
  '육아': [
    '육아', '아이', '어린이', '임신', '출산', '어린이집', '유치원', '보육', '태교',
    '신생아', '육아휴직', '출산휴가', '아기', '엄마', '아빠', '양육', '교육비', '돌봄',
  ],
  '교육': [
    '교육', '입시', '수능', '학교', '학원', '대학교', '전형', '장학금', '영어',
    '공부', '내신', '논술', '수시', '정시', '교과', '방과후', 'EBS', '시험',
  ],
  '엔터': [
    '연예', '아이돌', '드라마', '영화', '음악', '콘서트', '배우', '가수', 'K팝', '공연',
    '예능', '방송', '유튜버', '인플루언서', '오디션', '앨범', '시청률', '박스오피스',
  ],
  '라이프': [
    '건강', '다이어트', '요리', '여행', '인테리어', '반려동물', '생활', '취미',
    '음식', '휴가', '레시피', '패션', '뷰티', '운동', '헬스', '맛집', '카페',
  ],
  '부동산': [
    '아파트', '부동산', '전세', '월세', '주택', '재건축', '청약', '집값', '매매',
    '분양', '갭투자', '임대차', '임대', '공시가', '세금', '취득세', '양도세',
  ],
  '건강·의료': [
    '건강', '질병', '치료', '병원', '의료', '백신', '암', '당뇨', '고혈압', '약',
    '수술', '진료', '건강검진', '영양제', '면역', '노화', '심장', '뇌졸중',
  ],
  '복지·정책': [
    '복지', '정책', '지원금', '보조금', '연금', '의료급여', '기초생활', '사회보장',
    '지원', '혜택', '신청', '자격', '수급', '바우처', '급여', '공공',
  ],
  // 하위호환: 기존 시니어 키워드 유지
  '시니어': [
    '연금', '재테크', '은퇴', '노후', '시니어', '실버', '건강', '국민연금',
    '전세', '금리', '복지', '상속', '부동산', '투자', '절약', '노인', '요양', '의료',
  ],
}

function decodeXmlEntities(text: string): string {
  return text
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/gi, '$1')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim()
}

function extractTag(block: string, tag: string): string {
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i')
  const m = block.match(re)
  // decodeXmlEntities를 먼저 실행해 CDATA 추출 → 그 다음 남은 HTML 태그 제거
  return m ? decodeXmlEntities(m[1]).replace(/<[^>]+>/g, ' ').trim() : ''
}

export function parseRssXml(xml: string): {
  title: string
  link: string
  pubDate?: string
  description?: string
}[] {
  const items: { title: string; link: string; pubDate?: string; description?: string }[] = []
  const itemBlocks = xml.match(/<item[\s\S]*?<\/item>/gi) ?? []
  for (const block of itemBlocks) {
    const title = extractTag(block, 'title')
    const link = extractTag(block, 'link') || extractTag(block, 'guid')
    if (!title) continue
    items.push({
      title: title.slice(0, 500),
      link: link.slice(0, 2000) || '',
      pubDate: extractTag(block, 'pubDate') || extractTag(block, 'published'),
      description: extractTag(block, 'description').slice(0, 1000),
    })
  }
  return items
}

function topicId(link: string, title: string): string {
  const raw = link || title
  return createHash('sha256').update(raw).digest('hex').slice(0, 32)
}

function scoreTitle(title: string, description: string, keywords: string[]): number {
  const text = `${title} ${description}`.toLowerCase()
  let score = 0
  for (const kw of keywords) {
    if (text.includes(kw.toLowerCase())) score += title.includes(kw) ? 12 : 4
  }
  return score
}

async function fetchFeed(feed: RssFeedConfig): Promise<
  { feed: RssFeedConfig; items: ReturnType<typeof parseRssXml> } | null
> {
  try {
    const res = await fetch(feed.url, {
      headers: { 'User-Agent': 'ContentsDashboard/1.0' },
      cache: 'no-store',
    })
    if (!res.ok) {
      console.error('[rss-topic] feed HTTP error', feed.name, res.status)
      return null
    }
    const buf = await res.arrayBuffer()
    const xml = new TextDecoder('utf-8').decode(buf)
    const items = parseRssXml(xml)
    if (!items.length) return null
    return { feed, items }
  } catch (err) {
    console.error('[rss-topic] feed failed', feed.name, (err as Error).message)
    return null
  }
}

interface GeminiRefinedTopic {
  rank: number
  original: string
  youtube_title: string
  reason: string
}

/** Gemini 2.0 Flash (무료 한도: 일 1500회, 분 15회) */
async function refineWithGemini(
  topics: Array<{ title: string; summary: string | null }>,
  targetAudience: string,
  maxTopics: number,
): Promise<GeminiRefinedTopic[] | null> {
  const apiKey = process.env.GEMINI_API_KEY?.trim()
  if (!apiKey || topics.length === 0) return null

  const topicList = topics
    .slice(0, 15)
    .map((t, i) => `${i + 1}. ${t.title}`)
    .join('\n')

  const prompt = `당신은 ${targetAudience} 타겟 유튜브·블로그 콘텐츠 전문 기획자입니다.
아래 뉴스 기사 제목 목록에서 ${targetAudience}가 실제로 관심 가질 주제 ${maxTopics}개를 선별해 주세요.

조건:
- 클릭하고 싶은 유튜브 영상 제목으로 재구성 (30자 이내)
- 선별 이유를 한 줄로 설명
- JSON 배열로만 응답 (앞뒤 다른 텍스트 없이)

응답 형식 (예시):
[
  {"rank":1,"original":"원본제목","youtube_title":"유튜브 제목 제안","reason":"선별 이유"},
  ...
]

뉴스 제목 목록:
${topicList}`

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.3,
            maxOutputTokens: 2048,
            thinkingConfig: { thinkingBudget: 0 },
          },
        }),
        signal: AbortSignal.timeout(30000),
      },
    )
    if (!res.ok) {
      console.error('[rss-topic] gemini http', res.status, await res.text())
      return null
    }
    const data = (await res.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[]
    }
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
    const jsonMatch = text.match(/\[[\s\S]*\]/)
    if (!jsonMatch) return null
    const parsed: GeminiRefinedTopic[] = JSON.parse(jsonMatch[0])
    return Array.isArray(parsed) ? parsed.slice(0, maxTopics) : null
  } catch (err) {
    console.error('[rss-topic] gemini failed', err)
    return null
  }
}

/** Claude Haiku fallback (ANTHROPIC_API_KEY 있을 때) */
async function refineWithClaude(
  titles: string[],
  targetAudience: string,
  maxTopics: number,
): Promise<string[] | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim()
  if (!apiKey || titles.length === 0) return null

  const prompt = `다음 뉴스 제목 목록에서 ${targetAudience} 타겟 유튜브·블로그 콘텐츠 주제 후보 ${maxTopics}개를 한국어로 골라 주세요.
각 줄에 주제 한 줄만 출력하세요. 번호·불릿 없이 주제 문장만 ${maxTopics}줄.

제목 목록:
${titles.slice(0, 30).map((t, i) => `${i + 1}. ${t}`).join('\n')}`

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-3-5-haiku-20241022',
        max_tokens: 600,
        messages: [{ role: 'user', content: prompt }],
      }),
      signal: AbortSignal.timeout(25000),
    })
    if (!res.ok) return null
    const data = (await res.json()) as {
      content?: { type: string; text?: string }[]
    }
    const text = data.content?.find((c) => c.type === 'text')?.text ?? ''
    const lines = text
      .split('\n')
      .map((l) => l.replace(/^[\d.)\-\s]+/, '').trim())
      .filter((l) => l.length > 8)
    return lines.slice(0, maxTopics)
  } catch (err) {
    console.error('[rss-topic] claude failed', err)
    return null
  }
}

export async function getRssTopicCandidates(limit = 30): Promise<RssTopicCandidateRow[]> {
  const { data, error } = await supabase
    .from('rss_topic_candidates')
    .select('*')
    .order('relevance_score', { ascending: false })
    .order('collected_at', { ascending: false })
    .limit(limit)

  if (error) {
    console.error('getRssTopicCandidates error:', error)
    return []
  }
  return (data ?? []) as RssTopicCandidateRow[]
}

/** feed 이름 → 카테고리 매핑 */
export const FEED_CATEGORY_MAP: Map<string, RssFeedCategory> = new Map(
  ALL_RSS_FEEDS.map((f) => [f.name, f.category]),
)

export async function runRssTopicCollect(options?: {
  targetAudience?: string
  maxTopics?: number
  persistCollected?: boolean
  feeds?: RssFeedConfig[]
  source?: string
  useAi?: boolean
}): Promise<RssTopicCollectResult> {
  const targetAudience = options?.targetAudience ?? '전체'
  const maxTopics = Math.min(Math.max(options?.maxTopics ?? 10, 1), 50)
  const persistCollected = options?.persistCollected ?? true
  const feeds = options?.feeds?.length ? options.feeds : DEFAULT_RSS_FEEDS
  const source = options?.source ?? 'dashboard'

  // 카테고리별 키워드: 타겟 오디언스가 특정 카테고리면 해당 키워드, 전체면 모든 키워드 합산
  const keywords: string[] =
    targetAudience === '전체' || !CATEGORY_KEYWORDS[targetAudience]
      ? Array.from(new Set(Object.values(CATEGORY_KEYWORDS).flat()))
      : CATEGORY_KEYWORDS[targetAudience]

  const feedResults = await Promise.all(feeds.map(fetchFeed))
  const okFeeds = feedResults.filter(Boolean) as NonNullable<
    (typeof feedResults)[number]
  >[]

  if (!okFeeds.length) {
    return {
      ok: false,
      targetAudience,
      feedCount: feeds.length,
      parsedCount: 0,
      savedCount: 0,
      topics: [],
      message: 'RSS 피드를 가져오지 못했습니다. 네트워크·피드 URL을 확인하세요.',
    }
  }

  type Scored = {
    title: string
    link: string | null
    source_feed: string
    summary: string | null
    published_at: string | null
    relevance_score: number
    sources: string[]
  }

  const scored: Scored[] = []
  for (const { feed, items } of okFeeds) {
    // 피드 카테고리 전용 키워드로 스코어링 (없으면 공통 키워드)
    const feedCategory = FEED_CATEGORY_MAP.get(feed.name)
    const feedKeywords = feedCategory && CATEGORY_KEYWORDS[feedCategory]
      ? CATEGORY_KEYWORDS[feedCategory]
      : keywords

    for (const item of items) {
      const relevance_score = scoreTitle(item.title, item.description ?? '', feedKeywords)
      // 전문 카테고리 피드는 기본 점수 1 부여 (키워드 미매칭이어도 수집)
      const finalScore = relevance_score > 0 ? relevance_score : (feedCategory ? 1 : 0)
      if (finalScore <= 0) continue
      scored.push({
        title: item.title,
        link: item.link || null,
        source_feed: feed.name,
        summary: item.description ?? null,
        published_at: item.pubDate ? new Date(item.pubDate).toISOString() : null,
        relevance_score: finalScore,
        sources: [feed.name],
      })
    }
  }

  scored.sort((a, b) => b.relevance_score - a.relevance_score)

  // 동일 주제를 다룬 피드 집계: 제목 키워드 overlap 기준으로 sources[] 머지
  const STOP_WORDS = new Set(['이', '가', '을', '를', '의', '에', '은', '는', '도', '와', '과', '로', '으로', '에서', '에게', '부터', '까지'])
  function extractKeywords(title: string): string[] {
    return title.split(/[\s,\.\[\]""''·—\-·]+/)
      .map((w) => w.trim())
      .filter((w) => w.length >= 2 && !STOP_WORDS.has(w))
  }
  function keywordOverlap(a: string, b: string): number {
    const setA = new Set(extractKeywords(a))
    const setB = extractKeywords(b)
    return setB.filter((w) => setA.has(w)).length
  }

  // 같은 주제(키워드 2개 이상 겹침)를 다룬 articles끼리 sources 합산
  for (let i = 0; i < scored.length; i++) {
    for (let j = i + 1; j < scored.length; j++) {
      if (keywordOverlap(scored[i].title, scored[j].title) >= 2) {
        const merged = Array.from(new Set([...scored[i].sources, ...scored[j].sources]))
        scored[i].sources = merged
        scored[j].sources = merged
      }
    }
  }

  let top = scored.slice(0, maxTopics * 3)

  let aiEnhanced = false
  let aiProvider: string | null = null

  if (options?.useAi !== false) {
    // 1순위: Gemini (무료 한도 넉넉)
    const geminiResults = await refineWithGemini(
      top.map((t) => ({ title: t.title, summary: t.summary })),
      targetAudience,
      maxTopics,
    )

    if (geminiResults?.length) {
      aiEnhanced = true
      aiProvider = 'gemini'
      const matched = new Set<number>()
      const aiOrdered: Array<Scored & { ai_title?: string | null; ai_reason?: string | null }> = []
      for (const ai of geminiResults) {
        const idx = top.findIndex(
          (t, i) =>
            !matched.has(i) &&
            (t.title.includes(ai.original.slice(0, 12)) ||
              ai.original.includes(t.title.slice(0, 12))),
        )
        const base = idx >= 0 ? top[idx] : top[aiOrdered.length] ?? top[0]
        if (idx >= 0) matched.add(idx)
        // 관련 articles의 sources 모두 합산
        const allSources = Array.from(new Set([
          ...base.sources,
          ...(idx >= 0 ? top.filter((_, i) => !matched.has(i) && keywordOverlap(base.title, top[i].title) >= 2).flatMap((t) => t.sources) : []),
        ]))
        aiOrdered.push({
          ...base,
          title: ai.youtube_title || base.title,
          summary: ai.reason ? `[Gemini] ${ai.reason}` : base.summary,
          relevance_score: (base?.relevance_score ?? 0) + 50,
          sources: allSources,
          ai_title: ai.youtube_title || null,
          ai_reason: ai.reason || null,
        })
      }
      // 미매칭 원본으로 부족분 채우기
      for (let i = 0; i < top.length && aiOrdered.length < maxTopics; i++) {
        if (!matched.has(i)) aiOrdered.push(top[i])
      }
      top = aiOrdered.slice(0, maxTopics)
    } else if (process.env.ANTHROPIC_API_KEY) {
      // 2순위: Claude Haiku fallback
      const claudeLines = await refineWithClaude(
        top.map((t) => t.title),
        targetAudience,
        maxTopics,
      )
      if (claudeLines?.length) {
        aiEnhanced = true
        aiProvider = 'claude'
        const matched = new Set<number>()
        const aiOrdered: Scored[] = []
        for (const line of claudeLines) {
          const idx = top.findIndex(
            (t, i) =>
              !matched.has(i) &&
              (t.title.includes(line.slice(0, 12)) || line.includes(t.title.slice(0, 12))),
          )
          if (idx >= 0) {
            matched.add(idx)
            aiOrdered.push({
              ...top[idx],
              title: line,
              relevance_score: top[idx].relevance_score + 50,
            })
          } else {
            aiOrdered.push({
              title: line,
              link: null,
              source_feed: 'AI 추천',
              summary: `${targetAudience} 타겟 주제 후보 (Claude)`,
              published_at: null,
              relevance_score: 80,
              sources: ['AI 추천'],
            })
          }
        }
        for (let i = 0; i < top.length && aiOrdered.length < maxTopics; i++) {
          if (!matched.has(i)) aiOrdered.push(top[i])
        }
        top = aiOrdered.slice(0, maxTopics)
      } else {
        top = top.slice(0, maxTopics)
      }
    } else {
      top = top.slice(0, maxTopics)
    }
  } else {
    top = top.slice(0, maxTopics)
  }

  const now = new Date().toISOString()
  const rowsRaw: RssTopicCandidateRow[] = top.map((t) => ({
    id: topicId(t.link ?? '', t.title),
    title: t.title,
    link: t.link,
    source_feed: t.source_feed,
    summary: t.summary,
    published_at: t.published_at,
    relevance_score: t.relevance_score,
    target_audience: targetAudience,
    collected_at: now,
    source,
    updated_at: now,
    sources: Array.from(new Set(t.sources ?? [t.source_feed])),
    ai_title: (t as RssTopicCandidateRow).ai_title ?? null,
    ai_reason: (t as RssTopicCandidateRow).ai_reason ?? null,
  }))

  // 동일 id 중복 제거: 같은 id가 여러 개면 sources를 합산하고 하나만 유지
  const rowMap = new Map<string, RssTopicCandidateRow>()
  for (const r of rowsRaw) {
    if (rowMap.has(r.id)) {
      const existing = rowMap.get(r.id)!
      existing.sources = Array.from(new Set([...(existing.sources ?? []), ...(r.sources ?? [])]))
      if (r.relevance_score > existing.relevance_score) {
        existing.relevance_score = r.relevance_score
      }
    } else {
      rowMap.set(r.id, { ...r })
    }
  }
  const rows = Array.from(rowMap.values())

  if (!persistCollected) {
    return {
      ok: true,
      targetAudience,
      feedCount: okFeeds.length,
      parsedCount: scored.length,
      savedCount: 0,
      preview: true,
      topics: rows,
      aiEnhanced,
      message: `미리보기: ${rows.length}개 주제 후보 (저장 안 함)`,
    }
  }

  if (rows.length === 0) {
    return {
      ok: true,
      targetAudience,
      feedCount: okFeeds.length,
      parsedCount: scored.length,
      savedCount: 0,
      topics: [],
      message: '관련 키워드에 맞는 기사가 없습니다. 피드·키워드를 조정해 보세요.',
    }
  }

  // ai_title·ai_reason·sources 컬럼이 없는 경우를 대비해 단계적으로 재시도
  const rowsClean = rows.map(({ ai_title, ai_reason, sources, ...rest }) => ({
    ...rest,
    ...(ai_title !== undefined ? { ai_title } : {}),
    ...(ai_reason !== undefined ? { ai_reason } : {}),
    ...(sources !== undefined ? { sources } : {}),
  }))
  let { error } = await supabase
    .from('rss_topic_candidates')
    .upsert(rowsClean, { onConflict: 'id' })

  if (error?.message?.includes('ai_title') || error?.message?.includes('ai_reason') || error?.message?.includes('sources')) {
    const rowsBase = rows.map(({ ai_title: _a, ai_reason: _r, sources: _s, ...rest }) => rest)
    const result = await supabase.from('rss_topic_candidates').upsert(rowsBase, { onConflict: 'id' })
    error = result.error
  }

  if (error) {
    console.error('runRssTopicCollect upsert error:', error)
    return {
      ok: false,
      targetAudience,
      feedCount: okFeeds.length,
      parsedCount: scored.length,
      savedCount: 0,
      topics: rows,
      message: error.message,
    }
  }

  return {
    ok: true,
    targetAudience,
    feedCount: okFeeds.length,
    parsedCount: scored.length,
    savedCount: rows.length,
    topics: rows,
    aiEnhanced,
    message: `RSS 주제 ${rows.length}개 저장${aiEnhanced ? ` (${aiProvider === 'gemini' ? 'Gemini' : 'Claude'} 정제)` : ''}`,
  }
}
