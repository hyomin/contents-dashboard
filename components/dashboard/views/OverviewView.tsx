'use client'
import type { Video, AddToast } from '@/lib/dashboard-types'
import { ALL_VIDEOS, INSIGHTS, TRENDING_KEYWORDS } from '@/lib/dummy-data'
import { getTierColor, getPlatformName, getPlatformColor, formatViews } from '@/lib/dashboard-helpers'
import ContentTable from '@/components/dashboard/ContentTable'

export default function OverviewView({ onSelect, addToast }: { onSelect: (v: Video) => void; addToast: AddToast }) {
  const outliers = ALL_VIDEOS.filter(v => v.vsAvg >= 3.0)
  const avgVsAvg = (ALL_VIDEOS.reduce((s, v) => s + v.vsAvg, 0) / ALL_VIDEOS.length).toFixed(1)
  const distribution = [
    { range: '0.5–1.0x', count: ALL_VIDEOS.filter(v => v.vsAvg < 1.0).length,                    color: 'bg-gray-400' },
    { range: '1.0–2.0x', count: ALL_VIDEOS.filter(v => v.vsAvg >= 1.0 && v.vsAvg < 2.0).length,  color: 'bg-blue-400' },
    { range: '2.0–3.0x', count: ALL_VIDEOS.filter(v => v.vsAvg >= 2.0 && v.vsAvg < 3.0).length,  color: 'bg-yellow-400' },
    { range: '3.0–5.0x', count: ALL_VIDEOS.filter(v => v.vsAvg >= 3.0 && v.vsAvg < 5.0).length,  color: 'bg-green-500' },
    { range: '5.0x+',    count: ALL_VIDEOS.filter(v => v.vsAvg >= 5.0).length,                    color: 'bg-purple-500' },
  ]

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: '전체 수집량',   value: `${ALL_VIDEOS.length}`,  unit: 'videos',       icon: '🎬', bg: 'bg-blue-50',   accent: 'text-blue-600' },
          { label: 'Outlier 발견',  value: `${outliers.length}개`,  unit: 'vs.Avg≥3.0',  icon: '🚀', bg: 'bg-green-50',  accent: 'text-green-600' },
          { label: '오늘의 핫토픽', value: '"부동산"',               unit: '가장 많이 등장', icon: '🔥', bg: 'bg-orange-50', accent: 'text-orange-600' },
          { label: '평균 vs.Avg',   value: `${avgVsAvg}x`,          unit: '전체 평균',    icon: '📈', bg: 'bg-purple-50', accent: 'text-purple-600' },
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

      <ContentTable videos={ALL_VIDEOS} onSelect={onSelect} addToast={addToast} />
    </div>
  )
}
