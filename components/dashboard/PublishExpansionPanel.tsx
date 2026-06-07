'use client'

import Link from 'next/link'
import { getPlatformIcon } from '@/lib/dashboard/dashboard-helpers'
import { TitleWithHint } from '@/components/dashboard/info-hint'
import type { ViewVideoFormat } from '@/lib/dashboard/dashboard-nav'

interface PublishExpansionPanelProps {
  platform: string
  videoFormat?: ViewVideoFormat
  mineOnly?: boolean
}

interface WorkflowLink {
  view: string
  label: string
  icon: string
  desc: string
}

interface PlatformPublishConfig {
  formatLabel: string
  hint: string
  intro: (mineOnly: boolean) => string
  specs: string[]
  specDoc: string
  links: WorkflowLink[]
}

function getPlatformConfig(platform: string, videoFormat?: ViewVideoFormat): PlatformPublishConfig {
  if (platform === 'blogger') {
    return {
      formatLabel: 'Google Blogger',
      hint: '네이버 블로그·콘텐츠 가이드에서 만든 초안을 Blogger(blogspot)에 미러 발행할 때 사용합니다. 레퍼런스·vs.Avg는 네이버 블로그 분석을 사용하세요.',
      intro: (mine) =>
        mine
          ? '내 Blogger 채널 발행 일정은 캘린더에서 관리하세요. 본문은 콘텐츠 가이드 초안을 복사한 뒤 메타·라벨만 Blogger에 맞게 조정합니다.'
          : '네이버에 올린 글과 동일 주제를 Google 검색·AdSense용으로 재발행할 때 참고합니다. 수집·벤치마킹은 네이버 블로그 분석을 사용하세요.',
      specs: [
        '소스: 콘텐츠 가이드(writing/blog) 또는 네이버 발행본',
        '메타 설명 140~160자 · 핵심 키워드 1개 포함',
        '라벨(태그) 3~5개 · H2 구조는 네이버와 동일 유지',
        '대표 이미지 alt 텍스트에 키워드 자연 배치',
        '(선택) 영문 제목·요약 1줄 — 글로벌 검색 대응',
        'AdSense 연동 시 본문 길이 1,000자+ · 광고 밀도 과다 금지',
      ],
      specDoc: 'guidelines/contents_guideline.md (Blogger 섹션)',
      links: [
        { view: 'content-guide', label: '콘텐츠 가이드', icon: '📋', desc: '블로그 초안·H2·FAQ 생성' },
        { view: 'content-studio', label: '발행 편집·변환', icon: '✍️', desc: '네이버↔Blogger 메타 조정' },
        { view: 'naver-blog', label: '네이버 블로그 분석', icon: '🟢', desc: '레퍼런스·vs.Avg (분석)' },
      ],
    }
  }

  if (platform === 'tiktok') {
    return {
      formatLabel: 'TikTok 숏폼',
      hint: '숏폼 레퍼런스·vs.Avg·Outlier 분석은 YouTube Shorts만 사용합니다. TikTok은 완성 Shorts를 다른 포맷으로 보낼 때만 활용합니다.',
      intro: (mine) =>
        mine
          ? '내 TikTok 발행은 캘린더·발행 편집에서 관리하세요.'
          : '레퍼런스·벤치마킹은 YouTube Shorts를 사용하고, 이 화면은 업로드 포맷·변환 워크플로 안내입니다.',
      specs: [
        '1080×1920 · 9:16 세로',
        '안전 영역: 중앙 1080×1300px',
        'YouTube Shorts 완성본 → 동일 소스 재활용',
        '알고리즘 최적: 15~60초',
        '해시태그·훅 3초 이내 강조',
      ],
      specDoc: 'guidelines/platform_shortform_specs.md',
      links: [
        { view: 'content-guide', label: '콘텐츠 가이드', icon: '📋', desc: 'Shorts 스크립트·Flow 블록 생성' },
        { view: 'content-studio', label: '발행 편집·변환', icon: '✍️', desc: '플랫폼별 캡션·포맷 변환' },
        { view: 'repurpose', label: 'Repurposing', icon: '🔄', desc: 'Outlier → 멀티플랫폼 태스크' },
      ],
    }
  }

  const isReels = videoFormat === 'short'
  const isCarousel = platform === 'instagram' && !isReels

  return {
    formatLabel: isReels ? 'Instagram Reels' : isCarousel ? 'Instagram 캐러셀' : 'Instagram (Reels·캐러셀)',
    hint: '숏폼 레퍼런스·vs.Avg·Outlier 분석은 YouTube Shorts만 사용합니다. Instagram은 완성 콘텐츠를 다른 포맷으로 보낼 때만 활용합니다.',
    intro: (mine) =>
      mine
        ? '내 Instagram 발행은 캘린더·발행 편집에서 관리하세요.'
        : '레퍼런스·벤치마킹은 YouTube Shorts를 사용하고, 이 화면은 업로드 포맷·변환 워크플로 안내입니다.',
    specs: isCarousel
      ? ['캐러셀 2~10장', '첫 장 훅·마지막 장 CTA', '카드뉴스·인포그래픽 흐름 설계']
      : [
          '1080×1920 · 9:16 세로',
          '안전 영역: 중앙 1080×1300px',
          'YouTube Shorts 완성본 → 동일 소스 재활용',
          'Reels 최적: 15~90초',
          '캡션·해시태그는 발행 편집·변환에서 생성',
        ],
    specDoc: 'guidelines/platform_shortform_specs.md',
    links: [
      { view: 'content-guide', label: '콘텐츠 가이드', icon: '📋', desc: 'Shorts 스크립트·Flow 블록 생성' },
      { view: 'content-studio', label: '발행 편집·변환', icon: '✍️', desc: '플랫폼별 캡션·포맷 변환' },
      { view: 'repurpose', label: 'Repurposing', icon: '🔄', desc: 'Outlier → 멀티플랫폼 태스크' },
      ],
  }
}

export function PublishExpansionPanel({ platform, videoFormat, mineOnly = false }: PublishExpansionPanelProps) {
  const config = getPlatformConfig(platform, videoFormat)

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-violet-200 dark:border-violet-800 bg-violet-50 dark:bg-violet-950/30 px-5 py-4 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-2xl">{getPlatformIcon(platform)}</span>
          <TitleWithHint
            as="h3"
            className="text-base font-bold text-violet-950 dark:text-violet-100"
            hint={config.hint}
          >
            {config.formatLabel} · 발행 확장
          </TitleWithHint>
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-violet-600 text-white">
            발행 전용
          </span>
        </div>
        <p className="text-sm text-violet-900/90 dark:text-violet-200/90">
          {config.intro(mineOnly)}
          {platform !== 'blogger' && ' 필요 시 Apify 등 외부 수집은 나중에 검토할 수 있습니다.'}
        </p>
      </div>

      <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5 space-y-3">
        <p className="text-sm font-semibold text-gray-900 dark:text-white">발행 체크리스트 요약</p>
        <ul className="text-sm text-gray-600 dark:text-gray-300 space-y-1.5 list-disc list-inside">
          {config.specs.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
        <p className="text-xs text-gray-500">
          상세: <code className="text-[11px]">{config.specDoc}</code>
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {config.links.map((item) => (
          <Link
            key={item.view}
            href={`/dashboard?view=${item.view}`}
            className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 hover:border-violet-400 dark:hover:border-violet-600 transition group"
          >
            <span className="text-xl">{item.icon}</span>
            <p className="text-sm font-semibold text-gray-900 dark:text-white mt-2 group-hover:text-violet-700 dark:group-hover:text-violet-300">
              {item.label} →
            </p>
            <p className="text-xs text-gray-500 mt-1">{item.desc}</p>
          </Link>
        ))}
      </div>
    </div>
  )
}
