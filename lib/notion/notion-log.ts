/**
 * n8n 워크플로 실행 결과를 Notion에 기록하는 서비스
 *
 * 구조:
 *   1depth: yyyy-MM-dd  (날짜 페이지, NOTION_LOG_PARENT_PAGE_ID 하위)
 *   2depth: {플랫폼/워크플로명}  (수집 결과 서브 페이지)
 *     - 수집 글·영상 링크 목록
 */

import { supabaseAdmin } from '@/lib/supabase-admin'
import {
  notionPost,
  notionPatch,
  headingBlock,
  bulletBlock,
  paragraphBlock,
  dividerBlock,
} from './notion-client'

// ─── 상수·타입 ────────────────────────────────────────────────────

const PLATFORM_EMOJI: Record<string, string> = {
  youtube: '🔴',
  'naver-blog': '🟢',
  tistory: '🟠',
}

const PLATFORM_NAME: Record<string, string> = {
  youtube: 'YouTube',
  'naver-blog': '네이버 블로그',
  tistory: '티스토리',
}

const WORKFLOW_META: Record<string, { emoji: string; name: string; platform?: string }> = {
  'youtube-collect': { emoji: '🔴', name: 'YouTube 수집', platform: 'youtube' },
  'naver-blog-collect': { emoji: '🟢', name: '네이버 블로그 수집', platform: 'naver-blog' },
  'naver-blog-views': { emoji: '📊', name: '네이버 블로그 조회수 갱신', platform: 'naver-blog' },
  'tistory-collect': { emoji: '🟠', name: '티스토리 수집', platform: 'tistory' },
  'outlier-tagging': { emoji: '🏷️', name: '아웃라이어 태깅' },
  'rss-topic-collect': { emoji: '📰', name: 'RSS 주제 수집' },
}

export interface NotionSyncInput {
  workflowKey: string
  platform?: string
  date?: string // yyyy-MM-dd KST (미지정 시 자동)
  summary?: {
    ok?: boolean
    succeeded?: number
    failed?: number
    total?: number
    message?: string
  }
}

interface NotionSyncResult {
  ok: boolean
  datePageId?: string
  subPageId?: string
  subPageUrl?: string
  itemCount?: number
  error?: string
}

// ─── KST 날짜 ─────────────────────────────────────────────────────

function kstDateStr(): string {
  const now = new Date()
  const kst = new Date(now.getTime() + 9 * 3600 * 1000)
  return kst.toISOString().split('T')[0]
}

// ─── 콘텐츠 URL 생성 ───────────────────────────────────────────────

function makeContentUrl(
  videoId: string,
  platform: string,
  channelId: string | null,
): string | null {
  if (videoId.startsWith('http')) return videoId
  if (platform === 'youtube') return `https://www.youtube.com/watch?v=${videoId}`
  if (platform === 'naver-blog') return `https://blog.naver.com/${videoId}`
  if (platform === 'tistory') return `https://${channelId ?? ''}.tistory.com`
  return null
}

// ─── Supabase: 오늘 수집 콘텐츠 조회 ─────────────────────────────

async function fetchTodayContent(platform: string, dateStr: string) {
  // videos 테이블은 scraped_at 컬럼 사용 (updated_at 없음)
  const dayStart = `${dateStr}T00:00:00+09:00`
  const dayEnd = `${dateStr}T23:59:59+09:00`

  const { data } = await supabaseAdmin
    .from('videos')
    .select('video_id, title, platform, channel_id, channel_name, views, vs_avg, published_at, scraped_at')
    .eq('platform', platform)
    .gte('scraped_at', dayStart)
    .lte('scraped_at', dayEnd)
    .order('vs_avg', { ascending: false })
    .limit(50)

  return data ?? []
}

// ─── Supabase: 오늘 아웃라이어 조회 ──────────────────────────────

async function fetchTodayOutliers(dateStr: string) {
  const dayStart = `${dateStr}T00:00:00+09:00`
  const dayEnd = `${dateStr}T23:59:59+09:00`

  const { data } = await supabaseAdmin
    .from('outlier_tags')
    .select('video_id, title, platform, vs_avg, channel_name, tagged_at')
    .gte('tagged_at', dayStart)
    .lte('tagged_at', dayEnd)
    .order('vs_avg', { ascending: false })
    .limit(30)

  return data ?? []
}

// ─── Supabase: 오늘 RSS 주제 조회 ────────────────────────────────

async function fetchTodayRssTopics(dateStr: string) {
  const dayStart = `${dateStr}T00:00:00+09:00`
  const dayEnd = `${dateStr}T23:59:59+09:00`

  const { data } = await supabaseAdmin
    .from('rss_topic_candidates')
    .select('title, link, source_feed, relevance_score, published_at, collected_at, ai_title, ai_reason')
    .gte('collected_at', dayStart)
    .lte('collected_at', dayEnd)
    .order('relevance_score', { ascending: false })
    .limit(30)

  return data ?? []
}

// ─── Notion: 날짜 페이지 조회 or 생성 ─────────────────────────────

async function getOrCreateDatePage(
  token: string,
  parentPageId: string,
  dateStr: string,
): Promise<string> {
  // Supabase 캐시 확인 (테이블 없으면 skip)
  try {
    const { data: cached, error } = await supabaseAdmin
      .from('notion_daily_logs')
      .select('notion_page_id')
      .eq('date', dateStr)
      .maybeSingle()

    if (!error && cached?.notion_page_id) return cached.notion_page_id
  } catch {
    // 테이블 미존재 시 무시 — 매 실행마다 새 날짜 페이지 생성
  }

  // 새 날짜 페이지 생성
  const res = await notionPost<{ id: string }>(token, '/pages', {
    parent: { type: 'page_id', page_id: parentPageId },
    icon: { type: 'emoji', emoji: '📅' },
    properties: {
      title: { title: [{ type: 'text', text: { content: dateStr } }] },
    },
    children: [
      headingBlock(1, `n8n 자동화 로그 · ${dateStr}`),
      paragraphBlock('이 페이지는 n8n 워크플로 실행 결과가 자동 기록됩니다.'),
      dividerBlock(),
    ],
  })

  // Supabase에 캐시 (테이블 없으면 skip)
  try {
    await supabaseAdmin
      .from('notion_daily_logs')
      .upsert({ date: dateStr, notion_page_id: res.id })
  } catch {
    // 테이블 미존재 시 무시
  }

  return res.id
}

// ─── Notion: 플랫폼·워크플로 서브 페이지 생성 ──────────────────────

async function createSubPage(
  token: string,
  datePageId: string,
  emoji: string,
  title: string,
  children: unknown[],
): Promise<{ id: string; url: string }> {
  const res = await notionPost<{ id: string; url: string }>(token, '/pages', {
    parent: { type: 'page_id', page_id: datePageId },
    icon: { type: 'emoji', emoji },
    properties: {
      title: { title: [{ type: 'text', text: { content: title } }] },
    },
    children,
  })
  return { id: res.id, url: res.url }
}

// ─── Notion: 기존 페이지에 블록 append ───────────────────────────

async function appendBlocks(token: string, pageId: string, children: unknown[]) {
  await notionPatch(token, `/blocks/${pageId}/children`, { children })
}

// ─── 블록 빌더: 플랫폼 콘텐츠 ────────────────────────────────────

function buildContentBlocks(
  items: Array<{
    video_id: string
    title: string
    platform: string
    channel_id: string | null
    channel_name: string | null
    views?: number | null
    vs_avg?: number | null
    published_at?: string | null
    scraped_at?: string | null
  }>,
  platform: string,
) {
  if (items.length === 0) {
    return [paragraphBlock('수집된 콘텐츠가 없습니다.')]
  }
  return items.map((item) => {
    const url = makeContentUrl(item.video_id, platform, item.channel_id)
    const vsText =
      item.vs_avg != null && item.vs_avg > 0
        ? `vs.Avg ${item.vs_avg.toFixed(1)}x`
        : item.views
          ? `조회수 ${item.views.toLocaleString()}`
          : ''
    const suffix = [
      item.channel_name ?? '',
      item.published_at?.split('T')[0] ?? '',
      vsText,
    ]
      .filter(Boolean)
      .join(' · ')

    return bulletBlock(item.title, url, suffix || undefined)
  })
}

// ─── 블록 빌더: 아웃라이어 ────────────────────────────────────────

function buildOutlierBlocks(
  items: Array<{
    video_id: string
    title: string
    platform: string
    vs_avg: number | null
    channel_name: string | null
    tagged_at: string | null
  }>,
) {
  if (items.length === 0) return [paragraphBlock('새로 태깅된 아웃라이어가 없습니다.')]
  return items.map((item) => {
    const url = makeContentUrl(item.video_id, item.platform, null)
    const suffix = [
      item.vs_avg != null ? `vs.Avg ${item.vs_avg.toFixed(1)}x` : '',
      item.channel_name ?? '',
    ]
      .filter(Boolean)
      .join(' · ')
    return bulletBlock(item.title, url, suffix || undefined)
  })
}

// ─── 블록 빌더: RSS 주제 ──────────────────────────────────────────

function buildRssBlocks(
  items: Array<{
    title: string
    link: string | null
    source_feed: string | null
    relevance_score: number | null
    published_at: string | null
    ai_title?: string | null
    ai_reason?: string | null
  }>,
) {
  if (items.length === 0) return [paragraphBlock('새로 수집된 RSS 주제가 없습니다.')]
  return items.map((item) => {
    const displayTitle = item.ai_title || item.title
    const suffix = [
      item.source_feed ?? '',
      item.relevance_score != null ? `관련도 ${item.relevance_score}점` : '',
      item.ai_reason ? `[Gemini] ${item.ai_reason.slice(0, 40)}` : '',
      item.published_at?.split('T')[0] ?? '',
    ]
      .filter(Boolean)
      .join(' · ')
    return bulletBlock(displayTitle, item.link ?? undefined, suffix || undefined)
  })
}

// ─── 메인 함수 ─────────────────────────────────────────────────────

export async function recordWorkflowToNotion(
  input: NotionSyncInput,
): Promise<NotionSyncResult> {
  const token = process.env.NOTION_API_KEY
  const parentPageId = process.env.NOTION_LOG_PARENT_PAGE_ID

  if (!token) {
    return { ok: false, error: 'NOTION_API_KEY가 설정되지 않았습니다.' }
  }
  if (!parentPageId) {
    return { ok: false, error: 'NOTION_LOG_PARENT_PAGE_ID가 설정되지 않았습니다.' }
  }

  const dateStr = input.date ?? kstDateStr()
  const meta = WORKFLOW_META[input.workflowKey] ?? {
    emoji: '🤖',
    name: input.workflowKey,
    platform: input.platform,
  }
  const platform = input.platform ?? meta.platform
  const summaryMsg = input.summary?.message ?? '실행 완료'
  const isOk = input.summary?.ok !== false

  // 1. 날짜 페이지 조회/생성
  const datePageId = await getOrCreateDatePage(token, parentPageId, dateStr)

  // 2. 서브 페이지 제목
  const now = new Date(new Date().getTime() + 9 * 3600 * 1000)
    .toISOString()
    .replace('T', ' ')
    .slice(0, 16)
  const subTitle = `${meta.emoji} ${meta.name} · ${now}`

  // 3. 콘텐츠 블록 구성
  const children: unknown[] = [
    headingBlock(2, `${isOk ? '✅' : '❌'} ${meta.name}`),
    paragraphBlock(summaryMsg),
  ]

  if (input.summary?.succeeded != null || input.summary?.total != null) {
    const { succeeded = 0, failed = 0, total = 0 } = input.summary
    children.push(
      paragraphBlock(`채널 수: ${total} · 성공: ${succeeded} · 실패: ${failed}`),
    )
  }

  children.push(dividerBlock())

  if (platform && (platform === 'youtube' || platform === 'naver-blog' || platform === 'tistory')) {
    const platformName = PLATFORM_NAME[platform] ?? platform
    const platformEmoji = PLATFORM_EMOJI[platform] ?? '🔗'
    children.push(headingBlock(3, `${platformEmoji} ${platformName} 수집 콘텐츠`))

    const items = await fetchTodayContent(platform, dateStr)
    children.push(...buildContentBlocks(items, platform))

    const sub = await createSubPage(token, datePageId, meta.emoji, subTitle, children)
    return {
      ok: true,
      datePageId,
      subPageId: sub.id,
      subPageUrl: sub.url,
      itemCount: items.length,
    }
  }

  if (input.workflowKey === 'outlier-tagging') {
    children.push(headingBlock(3, '🏷️ 오늘 태깅된 아웃라이어'))
    const items = await fetchTodayOutliers(dateStr)
    children.push(...buildOutlierBlocks(items))

    const sub = await createSubPage(token, datePageId, meta.emoji, subTitle, children)
    return {
      ok: true,
      datePageId,
      subPageId: sub.id,
      subPageUrl: sub.url,
      itemCount: items.length,
    }
  }

  if (input.workflowKey === 'rss-topic-collect') {
    children.push(headingBlock(3, '📰 오늘 수집된 RSS 주제'))
    const items = await fetchTodayRssTopics(dateStr)
    children.push(...buildRssBlocks(items))

    const sub = await createSubPage(token, datePageId, meta.emoji, subTitle, children)
    return {
      ok: true,
      datePageId,
      subPageId: sub.id,
      subPageUrl: sub.url,
      itemCount: items.length,
    }
  }

  // 기타 워크플로: 요약만 기록
  const sub = await createSubPage(token, datePageId, meta.emoji, subTitle, children)
  return {
    ok: true,
    datePageId,
    subPageId: sub.id,
    subPageUrl: sub.url,
    itemCount: 0,
  }
}
