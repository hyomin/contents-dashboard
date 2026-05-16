'use client'

import { useState } from 'react'
import { useSearchParams } from 'next/navigation'
import BenchmarkViewComponent from '@/components/dashboard/BenchmarkView'
import { DEFAULT_CATEGORIES } from '@/lib/categories'

// ─── 타입 ────────────────────────────────────────────────────
interface Video {
  id: number
  tier: 'S' | 'A' | 'B' | 'C'
  title: string
  channel: string
  views: number
  vsAvg: number
  platform: 'youtube' | 'instagram' | 'naver-blog' | 'tistory'
  publishedAt: string
  keyword: string
}

interface Toast {
  id: number
  message: string
  type: 'success' | 'info' | 'warning'
}

// ─── 더미 데이터 ─────────────────────────────────────────────
const ALL_VIDEOS: Video[] = [
  { id: 1,  tier: 'S', title: '경제 뉴스 분석 - 2024년 전망',     channel: 'Travel Tube',    views: 150000, vsAvg: 5.2, platform: 'youtube',    publishedAt: '2일 전', keyword: '경제' },
  { id: 2,  tier: 'A', title: '부동산 시장 전망과 투자 전략',       channel: 'Travel Tube',    views: 120000, vsAvg: 4.1, platform: 'youtube',    publishedAt: '3일 전', keyword: '부동산' },
  { id: 3,  tier: 'A', title: '주식 투자 가이드 - 초보자 필독',    channel: 'Content Master', views: 95000,  vsAvg: 3.8, platform: 'youtube',    publishedAt: '4일 전', keyword: '주식' },
  { id: 4,  tier: 'B', title: '금 투자 vs 달러 투자 비교',          channel: 'Travel Tube',    views: 80000,  vsAvg: 2.3, platform: 'youtube',    publishedAt: '5일 전', keyword: '투자' },
  { id: 5,  tier: 'B', title: '인스타그램 릴스 트렌드',              channel: 'Social Creator', views: 50000,  vsAvg: 2.5, platform: 'instagram',  publishedAt: '1일 전', keyword: '릴스' },
  { id: 6,  tier: 'C', title: '일상 브이로그',                        channel: 'Daily Life',     views: 25000,  vsAvg: 1.2, platform: 'youtube',    publishedAt: '6일 전', keyword: '일상' },
  { id: 7,  tier: 'A', title: '2024 부동산 투자 가이드',              channel: '경제블로그',      views: 85000,  vsAvg: 3.4, platform: 'naver-blog', publishedAt: '2일 전', keyword: '부동산' },
  { id: 8,  tier: 'B', title: '티스토리 AdSense 수익 공개',          channel: '블로그수익화',    views: 45000,  vsAvg: 2.1, platform: 'tistory',    publishedAt: '4일 전', keyword: '수익' },
  { id: 9,  tier: 'S', title: '금리 인상 시대의 재테크 전략',        channel: 'Money Tube',     views: 200000, vsAvg: 6.1, platform: 'youtube',    publishedAt: '1일 전', keyword: '금리' },
  { id: 10, tier: 'A', title: '노후 대비 연금 완벽 정리',            channel: 'Senior Finance', views: 110000, vsAvg: 3.5, platform: 'youtube',    publishedAt: '3일 전', keyword: '연금' },
]

const INSIGHTS = [
  { icon: '🔥', text: '"부동산" 키워드가 최근 7일간 230% 급상승 → 관련 콘텐츠 즉시 제작 추천' },
  { icon: '💡', text: '시니어 타겟 경제 뉴스가 평균 5.2x 조회수 → 핵심 타겟층 집중 공략' },
  { icon: '⏰', text: 'YouTube 오후 6~8시 업로드가 평균 대비 2.3x 높은 성과' },
  { icon: '📈', text: '"금리 인상" 키워드 Outlier 6.1x → OSMU 2차 콘텐츠 제작 기회' },
]

const TRENDING_KEYWORDS = [
  { rank: 1, keyword: '금리 인상',   change: 230, trend: 'up' },
  { rank: 2, keyword: '부동산 투자', change: 180, trend: 'up' },
  { rank: 3, keyword: '주식 전망',   change: 150, trend: 'up' },
  { rank: 4, keyword: '노후 연금',   change: 120, trend: 'up' },
  { rank: 5, keyword: '달러 환율',   change: 15,  trend: 'down' },
]

// ─── 헬퍼 함수 ───────────────────────────────────────────────
const getTierColor = (tier: string) => ({
  S: 'bg-purple-100 text-purple-800 border border-purple-300',
  A: 'bg-blue-100 text-blue-800 border border-blue-300',
  B: 'bg-green-100 text-green-800 border border-green-300',
  C: 'bg-gray-100 text-gray-700 border border-gray-300',
}[tier] ?? 'bg-gray-100 text-gray-700')

const getPlatformName = (p: string) => ({ youtube: 'YouTube', instagram: 'Instagram', 'naver-blog': '네이버', tistory: '티스토리' }[p] ?? p)
const getPlatformColor = (p: string) => ({ youtube: 'bg-red-100 text-red-700', instagram: 'bg-pink-100 text-pink-700', 'naver-blog': 'bg-green-100 text-green-700', tistory: 'bg-orange-100 text-orange-700' }[p] ?? 'bg-gray-100 text-gray-700')
const getVsAvgColor = (v: number) => v >= 3.0 ? 'text-green-600 font-bold' : v >= 2.0 ? 'text-yellow-600 font-semibold' : 'text-gray-500'
const formatViews = (v: number) => v >= 10000 ? `${(v / 10000).toFixed(1)}만` : v.toLocaleString()

// ─── Toast 컴포넌트 ──────────────────────────────────────────
function ToastContainer({ toasts, onRemove }: { toasts: Toast[]; onRemove: (id: number) => void }) {
  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2">
      {toasts.map(t => (
        <div key={t.id} className={`flex items-center gap-3 px-5 py-3 rounded-xl shadow-lg text-sm font-medium text-white
          ${t.type === 'success' ? 'bg-green-600' : t.type === 'warning' ? 'bg-yellow-500' : 'bg-blue-600'}`}>
          <span>{t.type === 'success' ? '✅' : t.type === 'warning' ? '⚠️' : 'ℹ️'}</span>
          <span>{t.message}</span>
          <button onClick={() => onRemove(t.id)} className="ml-2 opacity-70 hover:opacity-100">✕</button>
        </div>
      ))}
    </div>
  )
}

// ─── Video 상세 모달 ─────────────────────────────────────────
function VideoModal({ video, onClose }: { video: Video; onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/50 z-40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-lg p-6" onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between mb-4">
          <span className={`px-3 py-1 text-sm font-bold rounded-full ${getTierColor(video.tier)}`}>Tier {video.tier}</span>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl font-bold">✕</button>
        </div>
        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">{video.title}</h3>
        <div className="grid grid-cols-2 gap-4 mb-6">
          {[
            { label: '조회수', value: formatViews(video.views), sub: '', color: 'bg-gray-50' },
            { label: 'vs. 채널 평균', value: `${video.vsAvg}x`, sub: '', color: 'bg-green-50' },
            { label: '채널', value: video.channel, sub: '', color: 'bg-gray-50' },
            { label: '게시일', value: video.publishedAt, sub: '', color: 'bg-gray-50' },
          ].map(c => (
            <div key={c.label} className={`${c.color} dark:bg-gray-700 rounded-xl p-4 text-center`}>
              <p className="text-lg font-bold text-gray-900 dark:text-white">{c.value}</p>
              <p className="text-xs text-gray-500 mt-1">{c.label}</p>
            </div>
          ))}
        </div>
        <div className="bg-blue-50 dark:bg-blue-900/30 rounded-xl p-4 mb-4">
          <p className="text-sm font-semibold text-blue-800 dark:text-blue-200 mb-1">💡 인사이트</p>
          <p className="text-sm text-blue-700 dark:text-blue-300">
            채널 평균 대비 <span className="font-bold">{video.vsAvg}배</span> 높은 조회수.
            &quot;{video.keyword}&quot; 관련 후속 콘텐츠를 추천합니다.
          </p>
        </div>
        <div className="flex gap-2">
          <button className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition">벤치마킹 저장</button>
          <button className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 transition" onClick={onClose}>닫기</button>
        </div>
      </div>
    </div>
  )
}

// ─── 뷰별 타이틀 매핑 ───────────────────────────────────────
const VIEW_META: Record<string, { title: string; desc: string; filter?: string }> = {
  overview:          { title: '전체 개요',       desc: '모든 플랫폼의 콘텐츠 분석 현황' },
  youtube:           { title: 'YouTube',         desc: 'YouTube 콘텐츠 분석',       filter: 'youtube' },
  'youtube-shorts':  { title: 'YouTube Shorts',  desc: '숏폼 콘텐츠 분석',           filter: 'youtube' },
  'youtube-longform':{ title: 'YouTube 롱폼',    desc: '롱폼 콘텐츠 분석',           filter: 'youtube' },
  instagram:         { title: 'Instagram',       desc: 'Instagram 콘텐츠 분석',     filter: 'instagram' },
  'instagram-reels': { title: 'Instagram Reels', desc: 'Reels 분석',                filter: 'instagram' },
  'instagram-carousel':{ title: '캐러셀 포스트', desc: '캐러셀 분석',               filter: 'instagram' },
  'naver-blog':      { title: '네이버 블로그',   desc: '네이버 블로그 분석',         filter: 'naver-blog' },
  tistory:           { title: '티스토리',         desc: '티스토리 분석',              filter: 'tistory' },
  trending:              { title: '트렌딩 키워드',    desc: '급상승 키워드 및 트렌드' },
  outlier:               { title: 'Outlier 분석',     desc: 'vs.Avg 3.0x 이상 콘텐츠' },
  'ai-insight':          { title: 'AI 인사이트',      desc: 'AI 기반 콘텐츠 기획 추천' },
  benchmark:             { title: '벤치마킹 저장함',  desc: '분석용으로 저장한 콘텐츠 모음' },
  channels:              { title: '채널 관리',         desc: '경쟁 채널 및 내 채널 현황' },
  'channels-competitor': { title: '경쟁 채널 목록',   desc: '벤치마킹 대상 채널 관리' },
  'channels-mine':       { title: '내 채널',           desc: '내 채널 현황 및 목표' },
  calendar:              { title: '콘텐츠 캘린더',     desc: '콘텐츠 업로드 스케줄 관리' },
  pipeline:              { title: '파이프라인',         desc: '콘텐츠 생산 자동화 현황' },
  repurpose:             { title: 'Repurposing',        desc: '콘텐츠 재가공 현황' },
  deploy:                { title: '배포 자동화',        desc: '멀티채널 배포 현황' },
  'data-collect':        { title: '데이터 수집',        desc: 'API 및 크롤링 수집 관리' },
  revenue:               { title: '수익 추적',          desc: '플랫폼별 수익 및 로드맵' },
}

// ─── 준비중 화면 ─────────────────────────────────────────────
function ComingSoon({ title }: { title: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-96 text-center">
      <span className="text-5xl mb-4">🚧</span>
      <p className="text-lg font-bold text-gray-700 dark:text-gray-200">{title}</p>
      <p className="text-sm text-gray-400 mt-2">준비 중입니다. 곧 만나보실 수 있어요!</p>
    </div>
  )
}

// ─── 콘텐츠 테이블 섹션 ──────────────────────────────────────
function ContentTable({ videos, onSelect, addToast }: {
  videos: Video[]
  onSelect: (v: Video) => void
  addToast: (msg: string, type?: Toast['type']) => void
}) {
  const [vsAvgFilter, setVsAvgFilter] = useState('전체 vs.Avg')

  const filtered = videos.filter(v =>
    vsAvgFilter === '전체 vs.Avg' ? true :
    vsAvgFilter === '3.0x 이상' ? v.vsAvg >= 3.0 :
    v.vsAvg >= 2.0
  )

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm overflow-hidden">
      <div className="p-5 border-b border-gray-100 dark:border-gray-700 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-gray-900 dark:text-white">📋 수집 콘텐츠 목록</h2>
          <p className="text-xs text-gray-400 mt-0.5">{filtered.length}개 표시 중 (전체 {videos.length}개)</p>
        </div>
        <div className="flex gap-2">
          <select
            value={vsAvgFilter}
            onChange={e => { setVsAvgFilter(e.target.value); addToast(`${e.target.value} 필터 적용`, 'info') }}
            className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white"
          >
            <option>전체 vs.Avg</option>
            <option>3.0x 이상</option>
            <option>2.0x 이상</option>
          </select>
          <button
            onClick={() => { setVsAvgFilter('전체 vs.Avg'); addToast('필터 초기화', 'warning') }}
            className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 transition text-gray-600"
          >
            초기화
          </button>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 dark:bg-gray-700">
            <tr>
              {['Tier', '제목', '채널', '조회수', 'vs.Avg', '플랫폼', '날짜'].map(h => (
                <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-300 uppercase tracking-wider">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
            {filtered.length === 0 ? (
              <tr><td colSpan={7} className="px-5 py-12 text-center text-sm text-gray-400">조건에 맞는 콘텐츠가 없습니다</td></tr>
            ) : filtered.map(video => (
              <tr key={video.id} onClick={() => onSelect(video)} className="hover:bg-blue-50/50 dark:hover:bg-gray-700 cursor-pointer transition">
                <td className="px-5 py-4"><span className={`px-2 py-0.5 text-xs font-bold rounded ${getTierColor(video.tier)}`}>{video.tier}</span></td>
                <td className="px-5 py-4 max-w-xs">
                  <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{video.title}</p>
                  <p className="text-xs text-gray-400 mt-0.5">#{video.keyword}</p>
                </td>
                <td className="px-5 py-4 whitespace-nowrap text-sm text-gray-500">{video.channel}</td>
                <td className="px-5 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">{formatViews(video.views)}</td>
                <td className="px-5 py-4 whitespace-nowrap"><span className={`text-sm ${getVsAvgColor(video.vsAvg)}`} suppressHydrationWarning>{video.vsAvg}x</span></td>
                <td className="px-5 py-4 whitespace-nowrap"><span className={`px-2 py-1 text-xs rounded-full font-medium ${getPlatformColor(video.platform)}`}>{getPlatformName(video.platform)}</span></td>
                <td className="px-5 py-4 whitespace-nowrap text-xs text-gray-400">{video.publishedAt}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="p-4 border-t border-gray-100 dark:border-gray-700 flex justify-between items-center">
        <p className="text-xs text-gray-400">{filtered.length}개 결과</p>
        <button
          onClick={() => addToast('데이터 수집이 시작되었습니다 (더미)', 'success')}
          className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition font-medium"
        >
          + 새 데이터 수집
        </button>
      </div>
    </div>
  )
}

// ─── Overview 화면 ───────────────────────────────────────────
function OverviewView({ onSelect, addToast }: { onSelect: (v: Video) => void; addToast: (msg: string, type?: Toast['type']) => void }) {
  const outliers = ALL_VIDEOS.filter(v => v.vsAvg >= 3.0)
  const avgVsAvg = (ALL_VIDEOS.reduce((s, v) => s + v.vsAvg, 0) / ALL_VIDEOS.length).toFixed(1)
  const distribution = [
    { range: '0.5–1.0x', count: ALL_VIDEOS.filter(v => v.vsAvg < 1.0).length,                     color: 'bg-gray-400' },
    { range: '1.0–2.0x', count: ALL_VIDEOS.filter(v => v.vsAvg >= 1.0 && v.vsAvg < 2.0).length,  color: 'bg-blue-400' },
    { range: '2.0–3.0x', count: ALL_VIDEOS.filter(v => v.vsAvg >= 2.0 && v.vsAvg < 3.0).length,  color: 'bg-yellow-400' },
    { range: '3.0–5.0x', count: ALL_VIDEOS.filter(v => v.vsAvg >= 3.0 && v.vsAvg < 5.0).length,  color: 'bg-green-500' },
    { range: '5.0x+',    count: ALL_VIDEOS.filter(v => v.vsAvg >= 5.0).length,                     color: 'bg-purple-500' },
  ]

  return (
    <div className="space-y-6">
      {/* KPI */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: '전체 수집량',   value: `${ALL_VIDEOS.length}`,    unit: 'videos',      icon: '🎬', bg: 'bg-blue-50',   accent: 'text-blue-600' },
          { label: 'Outlier 발견',  value: `${outliers.length}개`,    unit: 'vs.Avg≥3.0', icon: '🚀', bg: 'bg-green-50',  accent: 'text-green-600' },
          { label: '오늘의 핫토픽', value: '"부동산"',                 unit: '가장 많이 등장', icon: '🔥', bg: 'bg-orange-50', accent: 'text-orange-600' },
          { label: '평균 vs.Avg',   value: `${avgVsAvg}x`,            unit: '전체 평균',   icon: '📈', bg: 'bg-purple-50', accent: 'text-purple-600' },
        ].map(c => (
          <div key={c.label} className={`${c.bg} rounded-2xl p-5 cursor-pointer hover:shadow-md transition`} onClick={() => addToast(`${c.label}: ${c.value}`, 'info')}>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-gray-500">{c.label}</span>
              <span className="text-xl">{c.icon}</span>
            </div>
            <p className={`text-3xl font-bold ${c.accent}`}>{c.value}</p>
            <p className="text-xs text-gray-400 mt-1">{c.unit}</p>
          </div>
        ))}
      </div>

      {/* AI 인사이트 배너 */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl p-6 text-white">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-bold">💡 AI 인사이트 & 추천 액션</h2>
          <button onClick={() => addToast('인사이트 새로고침 완료', 'success')} className="text-xs bg-white/20 hover:bg-white/30 px-3 py-1 rounded-full transition">새로고침</button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {INSIGHTS.map((ins, i) => (
            <div key={i} onClick={() => addToast('콘텐츠 기획 목록에 추가되었습니다 ✅', 'success')} className="bg-white/10 hover:bg-white/20 rounded-xl p-3 flex gap-3 items-start cursor-pointer transition">
              <span className="text-xl">{ins.icon}</span>
              <p className="text-sm leading-relaxed">{ins.text}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Outlier + 트렌딩 키워드 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-bold text-gray-900 dark:text-white">🏆 Outlier Videos</h2>
            <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full">vs.Avg ≥ 3.0</span>
          </div>
          <div className="space-y-3">
            {outliers.slice(0, 5).map((video, i) => (
              <div key={video.id} onClick={() => onSelect(video)} className="flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer transition">
                <span className="text-lg font-black text-gray-300 w-6 text-center">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{video.title}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{video.channel} · {formatViews(video.views)} views</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-base font-black text-green-600">{video.vsAvg}x</p>
                  <span className={`text-xs px-1.5 py-0.5 rounded ${getTierColor(video.tier)}`}>{video.tier}</span>
                </div>
              </div>
            ))}
          </div>
          <button onClick={() => addToast('전체 Outlier 목록을 불러왔습니다', 'info')} className="w-full mt-4 py-2 text-sm text-blue-600 hover:bg-blue-50 rounded-xl transition font-medium">전체 보기 →</button>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-bold text-gray-900 dark:text-white">🔥 급상승 키워드</h2>
            <span className="text-xs text-gray-400">최근 7일</span>
          </div>
          <div className="space-y-3">
            {TRENDING_KEYWORDS.map(kw => (
              <div key={kw.rank} onClick={() => addToast(`"${kw.keyword}" 콘텐츠 기획 추천!`, 'success')} className="flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer transition">
                <span className={`text-base font-black w-6 text-center ${kw.rank === 1 ? 'text-yellow-500' : kw.rank === 2 ? 'text-gray-400' : kw.rank === 3 ? 'text-orange-400' : 'text-gray-300'}`}>{kw.rank}</span>
                <span className="flex-1 text-sm font-medium text-gray-800 dark:text-white">#{kw.keyword}</span>
                <span className={`text-sm font-bold ${kw.trend === 'up' ? 'text-red-500' : 'text-blue-400'}`}>{kw.trend === 'up' ? '▲' : '▼'} {kw.change}%</span>
              </div>
            ))}
          </div>
          <button onClick={() => addToast('트렌드 리포트를 준비했습니다', 'info')} className="w-full mt-4 py-2 text-sm text-blue-600 hover:bg-blue-50 rounded-xl transition font-medium">트렌드 리포트 →</button>
        </div>
      </div>

      {/* 분포도 + 플랫폼 성과 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm p-6">
          <h2 className="text-base font-bold text-gray-900 dark:text-white mb-4">📊 vs.Avg 분포도</h2>
          <div className="space-y-3">
            {distribution.map(item => (
              <div key={item.range} className="flex items-center gap-3">
                <span className="w-20 text-xs text-gray-500 shrink-0">{item.range}</span>
                <div className="flex-1 bg-gray-100 dark:bg-gray-700 rounded-full h-7 overflow-hidden">
                  <div className={`${item.color} h-full rounded-full flex items-center justify-end pr-3`} style={{ width: `${Math.max((item.count / ALL_VIDEOS.length) * 100, 8)}%` }}>
                    <span className="text-white text-xs font-bold">{item.count}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <p className="text-xs text-gray-400 mt-4 text-center">💡 3.0x 이상 구간이 콘텐츠 기회입니다</p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm p-6">
          <h2 className="text-base font-bold text-gray-900 dark:text-white mb-4">🎯 플랫폼별 평균 성과</h2>
          <div className="space-y-4">
            {(['youtube', 'instagram', 'naver-blog', 'tistory'] as const).map(platform => {
              const pvids = ALL_VIDEOS.filter(v => v.platform === platform)
              if (!pvids.length) return null
              const pavg = (pvids.reduce((s, v) => s + v.vsAvg, 0) / pvids.length).toFixed(1)
              const pmax = Math.max(...pvids.map(v => v.vsAvg))
              return (
                <div key={platform} onClick={() => addToast(`${getPlatformName(platform)} 탭으로 이동하려면 왼쪽 메뉴를 클릭하세요`, 'info')} className="flex items-center gap-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 rounded-xl p-2 transition">
                  <span className={`px-2 py-1 text-xs font-medium rounded shrink-0 ${getPlatformColor(platform)}`}>{getPlatformName(platform)}</span>
                  <div className="flex-1">
                    <div className="flex justify-between text-xs text-gray-500 mb-1"><span>평균 {pavg}x</span><span>최고 {pmax}x</span></div>
                    <div className="bg-gray-100 dark:bg-gray-700 rounded-full h-2">
                      <div className="bg-blue-400 h-2 rounded-full" style={{ width: `${Math.min((pmax / 7) * 100, 100)}%` }} />
                    </div>
                  </div>
                  <span className="text-xs text-gray-400">{pvids.length}개</span>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* 전체 테이블 */}
      <ContentTable videos={ALL_VIDEOS} onSelect={onSelect} addToast={addToast} />
    </div>
  )
}

// ─── 플랫폼별 화면 ───────────────────────────────────────────
function PlatformView({ filter, onSelect, addToast }: { filter: string; onSelect: (v: Video) => void; addToast: (msg: string, type?: Toast['type']) => void }) {
  const [selectedCategory, setSelectedCategory] = useState('')
  const baseVideos = ALL_VIDEOS.filter(v => v.platform === filter)

  // 카테고리 매핑 (keyword 기반으로 더미 카테고리 매칭)
  const KEYWORD_TO_CATEGORY: Record<string, string> = {
    '경제': 'cat-1', '부동산': 'cat-1', '주식': 'cat-1', '투자': 'cat-1', '금리': 'cat-1',
    '생산성': 'cat-2', '독서': 'cat-2', '커리어': 'cat-2',
    '건강': 'cat-3', '요리': 'cat-3', '여행': 'cat-3',
    '수익화': 'cat-4', '유튜브': 'cat-4', '블로그': 'cat-4',
  }

  const videos = selectedCategory
    ? baseVideos.filter(v => KEYWORD_TO_CATEGORY[v.keyword] === selectedCategory)
    : baseVideos

  const outliers = videos.filter(v => v.vsAvg >= 3.0)
  const avgVsAvg = videos.length ? (videos.reduce((s, v) => s + v.vsAvg, 0) / videos.length).toFixed(1) : '0'

  return (
    <div className="space-y-6">
      {/* 카테고리 필터 */}
      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-sm text-gray-500 font-medium">주제 필터:</span>
        <button
          onClick={() => setSelectedCategory('')}
          className={`px-3 py-1.5 text-sm rounded-xl font-medium transition
            ${!selectedCategory ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
        >
          전체 ({baseVideos.length})
        </button>
        {DEFAULT_CATEGORIES.map(cat => {
          const count = baseVideos.filter(v => KEYWORD_TO_CATEGORY[v.keyword] === cat.id).length
          const isActive = selectedCategory === cat.id
          return (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(isActive ? '' : cat.id)}
              className={`px-3 py-1.5 text-sm rounded-xl font-medium transition border
                ${isActive ? 'bg-blue-600 text-white border-blue-600' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}
            >
              {cat.name} ({count})
            </button>
          )
        })}
      </div>

      <div className="grid grid-cols-3 gap-4">
        {[
          { label: '수집된 콘텐츠', value: `${videos.length}개`, icon: '🎬', bg: 'bg-blue-50', accent: 'text-blue-600' },
          { label: 'Outlier',      value: `${outliers.length}개`, icon: '🚀', bg: 'bg-green-50', accent: 'text-green-600' },
          { label: '평균 vs.Avg',  value: `${avgVsAvg}x`,         icon: '📈', bg: 'bg-purple-50', accent: 'text-purple-600' },
        ].map(c => (
          <div key={c.label} className={`${c.bg} rounded-2xl p-5`}>
            <div className="flex justify-between mb-2"><span className="text-xs text-gray-500">{c.label}</span><span>{c.icon}</span></div>
            <p className={`text-3xl font-bold ${c.accent}`}>{c.value}</p>
          </div>
        ))}
      </div>
      <ContentTable videos={videos} onSelect={onSelect} addToast={addToast} />
    </div>
  )
}

// ─── Outlier 전용 화면 ───────────────────────────────────────
function OutlierView({ onSelect, addToast }: { onSelect: (v: Video) => void; addToast: (msg: string, type?: Toast['type']) => void }) {
  const outliers = ALL_VIDEOS.filter(v => v.vsAvg >= 3.0).sort((a, b) => b.vsAvg - a.vsAvg)
  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-green-500 to-emerald-600 rounded-2xl p-6 text-white">
        <h2 className="text-lg font-bold mb-1">🚀 Outlier 분석</h2>
        <p className="text-sm opacity-80">채널 평균 대비 3.0x 이상 달성한 콘텐츠 {outliers.length}개</p>
      </div>
      <ContentTable videos={outliers} onSelect={onSelect} addToast={addToast} />
    </div>
  )
}

// ─── 트렌딩 키워드 화면 ──────────────────────────────────────
function TrendingView({ addToast }: { addToast: (msg: string, type?: Toast['type']) => void }) {
  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-orange-500 to-red-500 rounded-2xl p-6 text-white">
        <h2 className="text-lg font-bold mb-1">🔥 트렌딩 키워드</h2>
        <p className="text-sm opacity-80">최근 7일간 급상승한 키워드 분석</p>
      </div>
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm p-6 space-y-3">
        {TRENDING_KEYWORDS.map(kw => (
          <div key={kw.rank} onClick={() => addToast(`"${kw.keyword}" 콘텐츠 기획 목록에 추가!`, 'success')} className="flex items-center gap-4 p-4 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer transition">
            <span className={`text-2xl font-black w-8 text-center ${kw.rank === 1 ? 'text-yellow-500' : kw.rank === 2 ? 'text-gray-400' : kw.rank === 3 ? 'text-orange-400' : 'text-gray-300'}`}>{kw.rank}</span>
            <span className="flex-1 text-base font-semibold text-gray-900 dark:text-white">#{kw.keyword}</span>
            <span className={`text-base font-bold ${kw.trend === 'up' ? 'text-red-500' : 'text-blue-400'}`}>{kw.trend === 'up' ? '▲' : '▼'} {kw.change}%</span>
            <button className="px-3 py-1.5 bg-blue-600 text-white text-xs rounded-lg hover:bg-blue-700 transition">기획 추가</button>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── AI 인사이트 화면 ────────────────────────────────────────
function AiInsightView({ addToast }: { addToast: (msg: string, type?: Toast['type']) => void }) {
  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl p-6 text-white">
        <h2 className="text-lg font-bold mb-1">🤖 AI 인사이트</h2>
        <p className="text-sm opacity-80">데이터 기반 콘텐츠 기획 추천</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {INSIGHTS.map((ins, i) => (
          <div key={i} onClick={() => addToast('콘텐츠 기획 목록에 추가되었습니다 ✅', 'success')} className="bg-white dark:bg-gray-800 rounded-2xl p-5 shadow-sm hover:shadow-md cursor-pointer transition border border-gray-100 dark:border-gray-700">
            <span className="text-3xl">{ins.icon}</span>
            <p className="mt-3 text-sm leading-relaxed text-gray-700 dark:text-gray-200">{ins.text}</p>
            <button className="mt-4 px-4 py-1.5 bg-blue-600 text-white text-xs rounded-lg hover:bg-blue-700 transition">기획 추가</button>
          </div>
        ))}
      </div>
    </div>
  )
}


// ─── 더미: 채널 데이터 ───────────────────────────────────────
const COMPETITOR_CHANNELS = [
  { id: 1, name: 'Travel Tube',     platform: 'youtube' as const, subs: 250000, avgViews: 42000, videos: 340, topKeyword: '경제/부동산', tier: 'A', tracked: true },
  { id: 2, name: 'Money Tube',      platform: 'youtube' as const, subs: 180000, avgViews: 35000, videos: 210, topKeyword: '재테크/금리', tier: 'A', tracked: true },
  { id: 3, name: 'Content Master',  platform: 'youtube' as const, subs: 120000, avgViews: 28000, videos: 190, topKeyword: '주식/투자',   tier: 'B', tracked: true },
  { id: 4, name: 'Senior Finance',  platform: 'youtube' as const, subs: 90000,  avgViews: 22000, videos: 150, topKeyword: '연금/노후',   tier: 'B', tracked: false },
  { id: 5, name: '경제블로그',       platform: 'naver-blog' as const, subs: 45000, avgViews: 8000, videos: 320, topKeyword: '부동산/경제', tier: 'B', tracked: true },
  { id: 6, name: '블로그수익화',     platform: 'tistory' as const, subs: 22000, avgViews: 4500, videos: 180, topKeyword: '수익화/AdSense', tier: 'C', tracked: false },
]

const MY_CHANNELS = [
  { id: 1, name: '내 유튜브 채널',   platform: 'youtube' as const,    subs: 0,    videos: 0, status: '준비중', goal: 1000 },
  { id: 2, name: '내 인스타그램',    platform: 'instagram' as const,  subs: 120,  videos: 5, status: '운영중', goal: 1000 },
  { id: 3, name: '내 네이버 블로그', platform: 'naver-blog' as const, subs: 0,    videos: 0, status: '준비중', goal: 100 },
  { id: 4, name: '내 티스토리',      platform: 'tistory' as const,    subs: 0,    videos: 0, status: '준비중', goal: 50 },
]

// ─── 더미: 캘린더 ────────────────────────────────────────────
const CALENDAR_ITEMS = [
  { id: 1, date: '2026-05-16', day: '오늘',  title: '금리 인상 분석 영상 업로드',        platform: 'youtube' as const,    status: 'scheduled', time: '오후 6시' },
  { id: 2, date: '2026-05-17', day: '내일',  title: '부동산 투자 블로그 포스팅',          platform: 'naver-blog' as const, status: 'scheduled', time: '오전 9시' },
  { id: 3, date: '2026-05-18', day: '모레',  title: '주식 투자 인스타 카드뉴스',          platform: 'instagram' as const,  status: 'scheduled', time: '오전 11시' },
  { id: 4, date: '2026-05-19', day: '3일 후', title: '경제 뉴스 Shorts 업로드',           platform: 'youtube' as const,    status: 'draft', time: '오후 7시' },
  { id: 5, date: '2026-05-20', day: '4일 후', title: '재테크 티스토리 포스팅',             platform: 'tistory' as const,   status: 'draft', time: '오전 10시' },
  { id: 6, date: '2026-05-21', day: '5일 후', title: '노후 연금 분석 영상',                platform: 'youtube' as const,    status: 'idea', time: '미정' },
  { id: 7, date: '2026-05-22', day: '6일 후', title: '달러 환율 전망 릴스',                platform: 'instagram' as const,  status: 'idea', time: '미정' },
]

// ─── 더미: 데이터 수집 ───────────────────────────────────────
const COLLECT_JOBS = [
  { id: 1, name: 'YouTube API 수집',    platform: 'youtube' as const,    lastRun: '2시간 전',  status: 'success', count: 47,  next: '4시간 후' },
  { id: 2, name: 'Instagram Scraper',   platform: 'instagram' as const,  lastRun: '5시간 전',  status: 'success', count: 23,  next: '7시간 후' },
  { id: 3, name: '네이버 블로그 수집',   platform: 'naver-blog' as const, lastRun: '1일 전',   status: 'warning', count: 12,  next: '수동 실행 필요' },
  { id: 4, name: '티스토리 수집',        platform: 'tistory' as const,    lastRun: '실행 안됨', status: 'idle',    count: 0,   next: '설정 필요' },
]

const COLLECT_LOGS = [
  { time: '14:32', message: 'YouTube API: 영상 47개 수집 완료', type: 'success' },
  { time: '11:15', message: 'Instagram: 포스트 23개 수집 완료', type: 'success' },
  { time: '09:00', message: '네이버 블로그: Rate limit 경고 (429)', type: 'warning' },
  { time: '어제', message: 'YouTube API: vs.Avg 계산 완료 (10개)', type: 'success' },
  { time: '어제', message: '티스토리: API 키 미설정', type: 'error' },
]

// ─── 더미: 수익 데이터 ───────────────────────────────────────
const REVENUE_DATA = [
  { platform: 'youtube' as const,    label: 'YouTube AdSense', monthly: 0,    total: 0,    rpm: 1500, status: 'inactive', goal: 50000 },
  { platform: 'instagram' as const,  label: 'Instagram 협찬',  monthly: 0,    total: 0,    rpm: 0,    status: 'inactive', goal: 100000 },
  { platform: 'naver-blog' as const, label: '네이버 AdPost',    monthly: 0,    total: 0,    rpm: 800,  status: 'inactive', goal: 30000 },
  { platform: 'tistory' as const,    label: '티스토리 AdSense', monthly: 0,    total: 0,    rpm: 1200, status: 'inactive', goal: 30000 },
]

const MONTHLY_GOAL = 500000


// ─── 뷰: 경쟁 채널 목록 ─────────────────────────────────────
function CompetitorChannelsView({ addToast }: { addToast: (m: string, t?: Toast['type']) => void }) {
  const [channels, setChannels] = useState(COMPETITOR_CHANNELS)

  const toggleTrack = (id: number) => {
    setChannels(prev => prev.map(c => c.id === id ? { ...c, tracked: !c.tracked } : c))
    const ch = channels.find(c => c.id === id)
    addToast(ch?.tracked ? `"${ch.name}" 추적 해제` : `"${ch?.name}" 추적 시작!`, ch?.tracked ? 'warning' : 'success')
  }

  return (
    <div className="space-y-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm overflow-hidden">
        <div className="p-5 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center">
          <div>
            <h3 className="font-bold text-gray-900 dark:text-white">경쟁 채널 목록</h3>
            <p className="text-xs text-gray-400 mt-0.5">추적 중: {channels.filter(c => c.tracked).length}개</p>
          </div>
          <button onClick={() => addToast('채널 추가 기능은 준비 중입니다', 'info')} className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition">+ 채널 추가</button>
        </div>
        <div className="divide-y divide-gray-100 dark:divide-gray-700">
          {channels.map(ch => (
            <div key={ch.id} className="p-5 flex items-center gap-4 hover:bg-gray-50 dark:hover:bg-gray-700 transition">
              <div className="w-10 h-10 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-lg shrink-0">
                {ch.platform === 'youtube' ? '🔴' : ch.platform === 'instagram' ? '💗' : ch.platform === 'naver-blog' ? '🟢' : '🟠'}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">{ch.name}</p>
                  <span className={`px-1.5 py-0.5 text-xs rounded-full ${getPlatformColor(ch.platform)}`}>{getPlatformName(ch.platform)}</span>
                  <span className={`px-1.5 py-0.5 text-xs rounded ${getTierColor(ch.tier)}`}>{ch.tier}</span>
                </div>
                <div className="flex gap-4 mt-1 text-xs text-gray-400">
                  <span>구독자 {(ch.subs / 10000).toFixed(1)}만</span>
                  <span>평균 {formatViews(ch.avgViews)} views</span>
                  <span>영상 {ch.videos}개</span>
                  <span className="text-blue-500">#{ch.topKeyword}</span>
                </div>
              </div>
              <button
                onClick={() => toggleTrack(ch.id)}
                className={`px-3 py-1.5 text-xs rounded-lg font-medium transition shrink-0
                  ${ch.tracked ? 'bg-green-100 text-green-700 hover:bg-red-100 hover:text-red-700' : 'bg-gray-100 text-gray-500 hover:bg-blue-100 hover:text-blue-700'}`}
              >
                {ch.tracked ? '✓ 추적 중' : '+ 추적'}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── 뷰: 내 채널 ─────────────────────────────────────────────
function MyChannelsView({ addToast }: { addToast: (m: string, t?: Toast['type']) => void }) {
  return (
    <div className="space-y-4">
      <div className="bg-blue-50 border border-blue-200 rounded-2xl p-5">
        <p className="text-sm font-semibold text-blue-800">📺 내 채널 현황</p>
        <p className="text-xs text-blue-600 mt-1">실제 데이터 연동 전 · 수동 업데이트 가능</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {MY_CHANNELS.map(ch => {
          const progress = Math.min((ch.subs / ch.goal) * 100, 100)
          return (
            <div key={ch.id} className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <span className="text-xl">{ch.platform === 'youtube' ? '🔴' : ch.platform === 'instagram' ? '💗' : ch.platform === 'naver-blog' ? '🟢' : '🟠'}</span>
                  <span className="text-sm font-semibold text-gray-900 dark:text-white">{ch.name}</span>
                </div>
                <span className={`px-2 py-1 text-xs rounded-full font-medium ${ch.status === '운영중' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                  {ch.status}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="bg-gray-50 dark:bg-gray-700 rounded-xl p-3 text-center">
                  <p className="text-xl font-bold text-gray-900 dark:text-white">{ch.subs.toLocaleString()}</p>
                  <p className="text-xs text-gray-400 mt-0.5">구독자/팔로워</p>
                </div>
                <div className="bg-gray-50 dark:bg-gray-700 rounded-xl p-3 text-center">
                  <p className="text-xl font-bold text-gray-900 dark:text-white">{ch.videos}</p>
                  <p className="text-xs text-gray-400 mt-0.5">게시물</p>
                </div>
              </div>
              <div>
                <div className="flex justify-between text-xs text-gray-500 mb-1">
                  <span>목표: {ch.goal.toLocaleString()}명</span>
                  <span>{progress.toFixed(0)}%</span>
                </div>
                <div className="bg-gray-100 dark:bg-gray-700 rounded-full h-2">
                  <div className={`h-2 rounded-full ${progress > 0 ? 'bg-blue-500' : 'bg-gray-300'}`} style={{ width: `${Math.max(progress, 2)}%` }} />
                </div>
              </div>
              <button onClick={() => addToast(`"${ch.name}" 정보 업데이트 완료`, 'success')} className="w-full mt-4 py-2 text-xs text-blue-600 hover:bg-blue-50 rounded-xl transition font-medium">수동 업데이트</button>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── 뷰: 콘텐츠 캘린더 ──────────────────────────────────────
function CalendarView({ addToast }: { addToast: (m: string, t?: Toast['type']) => void }) {
  const [items, setItems] = useState(CALENDAR_ITEMS)

  const statusConfig = {
    scheduled: { label: '예약됨',  color: 'bg-blue-100 text-blue-700' },
    draft:      { label: '초안',    color: 'bg-yellow-100 text-yellow-700' },
    idea:       { label: '아이디어', color: 'bg-gray-100 text-gray-600' },
    done:       { label: '완료',    color: 'bg-green-100 text-green-700' },
  }

  const markDone = (id: number) => {
    setItems(prev => prev.map(item => item.id === id ? { ...item, status: 'done' } : item))
    addToast('업로드 완료로 표시했습니다 ✅', 'success')
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: '이번 주 예약', value: items.filter(i => i.status === 'scheduled').length, color: 'bg-blue-50 text-blue-600' },
          { label: '초안 작성 중', value: items.filter(i => i.status === 'draft').length,     color: 'bg-yellow-50 text-yellow-600' },
          { label: '아이디어',     value: items.filter(i => i.status === 'idea').length,      color: 'bg-gray-50 text-gray-600' },
        ].map(s => (
          <div key={s.label} className={`${s.color.split(' ')[0]} rounded-2xl p-5`}>
            <p className="text-xs text-gray-500 mb-1">{s.label}</p>
            <p className={`text-3xl font-bold ${s.color.split(' ')[1]}`}>{s.value}건</p>
          </div>
        ))}
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm overflow-hidden">
        <div className="p-5 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center">
          <h3 className="font-bold text-gray-900 dark:text-white">이번 주 스케줄</h3>
          <button onClick={() => addToast('콘텐츠 일정 추가 기능 준비 중', 'info')} className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition">+ 일정 추가</button>
        </div>
        <div className="divide-y divide-gray-100 dark:divide-gray-700">
          {items.map(item => {
            const s = statusConfig[item.status as keyof typeof statusConfig]
            const isDone = item.status === 'done'
            return (
              <div key={item.id} className={`p-5 flex items-center gap-4 hover:bg-gray-50 dark:hover:bg-gray-700 transition ${isDone ? 'opacity-50' : ''}`}>
                <div className="text-center shrink-0 w-14">
                  <p className="text-xs font-bold text-blue-600">{item.day}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{item.time}</p>
                </div>
                <span className="text-xl shrink-0">{item.platform === 'youtube' ? '🔴' : item.platform === 'instagram' ? '💗' : item.platform === 'naver-blog' ? '🟢' : '🟠'}</span>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium text-gray-900 dark:text-white truncate ${isDone ? 'line-through' : ''}`}>{item.title}</p>
                  <span className={`mt-1 inline-block px-2 py-0.5 text-xs rounded-full ${s.color}`}>{s.label}</span>
                </div>
                {!isDone && (
                  <button onClick={() => markDone(item.id)} className="px-3 py-1.5 text-xs bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition shrink-0">완료</button>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ─── 뷰: 데이터 수집 ─────────────────────────────────────────
function DataCollectView({ addToast }: { addToast: (m: string, t?: Toast['type']) => void }) {
  const [jobs, setJobs] = useState(COLLECT_JOBS)
  const [running, setRunning] = useState<number | null>(null)

  const runJob = (id: number) => {
    setRunning(id)
    addToast('데이터 수집을 시작합니다...', 'info')
    setTimeout(() => {
      setJobs(prev => prev.map(j => j.id === id ? { ...j, status: 'success', lastRun: '방금 전', count: j.count + Math.floor(Math.random() * 20 + 5) } : j))
      setRunning(null)
      addToast('수집 완료! 새 데이터가 추가되었습니다 ✅', 'success')
    }, 2000)
  }

  const statusColor = { success: 'bg-green-100 text-green-700', warning: 'bg-yellow-100 text-yellow-700', idle: 'bg-gray-100 text-gray-500', error: 'bg-red-100 text-red-700', running: 'bg-blue-100 text-blue-700' }
  const statusLabel = { success: '정상', warning: '경고', idle: '대기', error: '오류', running: '수집 중' }

  return (
    <div className="space-y-4">
      {/* 수집 잡 목록 */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm overflow-hidden">
        <div className="p-5 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center">
          <h3 className="font-bold text-gray-900 dark:text-white">수집 작업 목록</h3>
          <button onClick={() => { jobs.forEach(j => runJob(j.id)); }} className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition">전체 실행</button>
        </div>
        <div className="divide-y divide-gray-100 dark:divide-gray-700">
          {jobs.map(job => {
            const isRunning = running === job.id
            const st = isRunning ? 'running' : job.status as keyof typeof statusColor
            return (
              <div key={job.id} className="p-5 flex items-center gap-4">
                <span className="text-xl">{job.platform === 'youtube' ? '🔴' : job.platform === 'instagram' ? '💗' : job.platform === 'naver-blog' ? '🟢' : '🟠'}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-gray-900 dark:text-white">{job.name}</p>
                    <span className={`px-2 py-0.5 text-xs rounded-full ${statusColor[st]}`}>{statusLabel[st]}</span>
                  </div>
                  <div className="flex gap-3 text-xs text-gray-400 mt-1">
                    <span>마지막: {job.lastRun}</span>
                    <span>수집량: {job.count}개</span>
                    <span>다음: {job.next}</span>
                  </div>
                </div>
                <button
                  onClick={() => runJob(job.id)}
                  disabled={isRunning}
                  className={`px-4 py-2 text-sm rounded-lg font-medium transition shrink-0
                    ${isRunning ? 'bg-gray-200 text-gray-400 cursor-not-allowed' : 'bg-blue-600 text-white hover:bg-blue-700'}`}
                >
                  {isRunning ? '수집 중...' : '▶ 실행'}
                </button>
              </div>
            )
          })}
        </div>
      </div>

      {/* 수집 로그 */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm p-5">
        <h3 className="font-bold text-gray-900 dark:text-white mb-4">📋 최근 수집 로그</h3>
        <div className="space-y-2">
          {COLLECT_LOGS.map((log, i) => (
            <div key={i} className="flex items-start gap-3 text-sm">
              <span className="text-xs text-gray-400 shrink-0 w-10">{log.time}</span>
              <span className={`text-xs shrink-0 ${log.type === 'success' ? '✅' : log.type === 'warning' ? '⚠️' : '❌'}`}>
                {log.type === 'success' ? '✅' : log.type === 'warning' ? '⚠️' : '❌'}
              </span>
              <span className="text-gray-600 dark:text-gray-300">{log.message}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── 뷰: 수익 추적 ───────────────────────────────────────────
function RevenueView({ addToast }: { addToast: (m: string, t?: Toast['type']) => void }) {
  const totalMonthly = REVENUE_DATA.reduce((s, r) => s + r.monthly, 0)
  const progress = Math.min((totalMonthly / MONTHLY_GOAL) * 100, 100)

  return (
    <div className="space-y-4">
      {/* 월 목표 */}
      <div className="bg-gradient-to-r from-yellow-500 to-orange-500 rounded-2xl p-6 text-white">
        <p className="text-sm opacity-80 mb-1">이번 달 수익</p>
        <p className="text-4xl font-black">₩{totalMonthly.toLocaleString()}</p>
        <div className="mt-4">
          <div className="flex justify-between text-sm opacity-80 mb-1">
            <span>목표 ₩{MONTHLY_GOAL.toLocaleString()}</span>
            <span>{progress.toFixed(0)}%</span>
          </div>
          <div className="bg-white/30 rounded-full h-2">
            <div className="bg-white h-2 rounded-full" style={{ width: `${Math.max(progress, 2)}%` }} />
          </div>
        </div>
        <p className="text-xs opacity-70 mt-3">💡 수익은 채널 운영 시작 후 자동 연동 예정</p>
      </div>

      {/* 플랫폼별 수익 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {REVENUE_DATA.map(r => (
          <div key={r.platform} className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <span className="text-xl">{r.platform === 'youtube' ? '🔴' : r.platform === 'instagram' ? '💗' : r.platform === 'naver-blog' ? '🟢' : '🟠'}</span>
                <span className="text-sm font-semibold text-gray-900 dark:text-white">{r.label}</span>
              </div>
              <span className={`px-2 py-1 text-xs rounded-full ${r.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                {r.status === 'active' ? '활성' : '준비 중'}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="bg-gray-50 dark:bg-gray-700 rounded-xl p-3 text-center">
                <p className="text-lg font-bold text-gray-900 dark:text-white">₩{r.monthly.toLocaleString()}</p>
                <p className="text-xs text-gray-400 mt-0.5">이번 달</p>
              </div>
              <div className="bg-gray-50 dark:bg-gray-700 rounded-xl p-3 text-center">
                <p className="text-lg font-bold text-gray-400">{r.rpm > 0 ? `₩${r.rpm.toLocaleString()}` : '-'}</p>
                <p className="text-xs text-gray-400 mt-0.5">예상 RPM</p>
              </div>
            </div>
            <div>
              <div className="flex justify-between text-xs text-gray-400 mb-1">
                <span>월 목표 ₩{r.goal.toLocaleString()}</span>
                <span>{r.monthly > 0 ? ((r.monthly / r.goal) * 100).toFixed(0) : 0}%</span>
              </div>
              <div className="bg-gray-100 dark:bg-gray-700 rounded-full h-1.5">
                <div className={`h-1.5 rounded-full ${r.monthly > 0 ? 'bg-green-500' : 'bg-gray-300'}`} style={{ width: `${Math.max((r.monthly / r.goal) * 100, 2)}%` }} />
              </div>
            </div>
            <button onClick={() => addToast(`${r.label} 수익 데이터 업데이트 (더미)`, 'info')} className="w-full mt-4 py-1.5 text-xs text-blue-600 hover:bg-blue-50 rounded-xl transition">수동 업데이트</button>
          </div>
        ))}
      </div>

      {/* 수익화 로드맵 */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm p-5">
        <h3 className="font-bold text-gray-900 dark:text-white mb-4">🗺️ 수익화 로드맵</h3>
        <div className="space-y-3">
          {[
            { step: 1, label: 'YouTube 1,000 구독자 달성',  target: '2026 Q4', status: 'pending' },
            { step: 2, label: 'YPP 신청 (4,000시간 시청)',   target: '2027 Q1', status: 'pending' },
            { step: 3, label: '네이버 AdPost 신청 (일 방문 100+)', target: '2027 Q1', status: 'pending' },
            { step: 4, label: '티스토리 AdSense 연동',        target: '2026 Q3', status: 'pending' },
            { step: 5, label: '월 50만원 수익 달성',           target: '2027 Q2', status: 'pending' },
          ].map(r => (
            <div key={r.step} className="flex items-center gap-3">
              <span className="w-7 h-7 rounded-full bg-gray-100 dark:bg-gray-700 text-xs font-bold text-gray-500 flex items-center justify-center shrink-0">{r.step}</span>
              <p className="flex-1 text-sm text-gray-700 dark:text-gray-300">{r.label}</p>
              <span className="text-xs text-gray-400 shrink-0">{r.target}</span>
              <button onClick={() => addToast(`${r.label} 목표 달성!`, 'success')} className="text-xs px-2 py-1 bg-gray-100 hover:bg-green-100 hover:text-green-700 text-gray-500 rounded-lg transition">완료</button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── 메인 ────────────────────────────────────────────────────
export default function DashboardPage() {
  const searchParams = useSearchParams()
  const view = searchParams.get('view') ?? 'overview'
  const meta = VIEW_META[view] ?? VIEW_META['overview']

  const [selectedVideo, setSelectedVideo] = useState<Video | null>(null)
  const [toasts, setToasts] = useState<Toast[]>([])
  const [counter, setCounter] = useState(0)

  const addToast = (message: string, type: Toast['type'] = 'info') => {
    const id = counter + 1
    setCounter(id)
    setToasts(prev => [...prev, { id, message, type }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3000)
  }

  const renderContent = () => {
    if (meta.filter) return <PlatformView filter={meta.filter} onSelect={setSelectedVideo} addToast={addToast} />
    switch (view) {
      case 'overview':              return <OverviewView onSelect={setSelectedVideo} addToast={addToast} />
      case 'outlier':               return <OutlierView onSelect={setSelectedVideo} addToast={addToast} />
      case 'trending':              return <TrendingView addToast={addToast} />
      case 'ai-insight':            return <AiInsightView addToast={addToast} />
      case 'benchmark':             return <BenchmarkViewComponent addToast={addToast} />
      case 'channels':
      case 'channels-competitor':   return <CompetitorChannelsView addToast={addToast} />
      case 'channels-mine':         return <MyChannelsView addToast={addToast} />
      case 'calendar':              return <CalendarView addToast={addToast} />
      case 'data-collect':          return <DataCollectView addToast={addToast} />
      case 'revenue':               return <RevenueView addToast={addToast} />
      default:                      return <ComingSoon title={meta.title} />
    }
  }

  return (
    <>
      <ToastContainer toasts={toasts} onRemove={id => setToasts(prev => prev.filter(t => t.id !== id))} />
      {selectedVideo && <VideoModal video={selectedVideo} onClose={() => setSelectedVideo(null)} />}

      <div className="p-6 md:p-8">
        {/* 페이지 헤더 */}
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">{meta.title}</h2>
          <p className="text-sm text-gray-500 mt-1">{meta.desc}</p>
        </div>

        {renderContent()}
      </div>
    </>
  )
}
