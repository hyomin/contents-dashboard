import { NextResponse } from 'next/server'
import { supabase } from '@/lib/data/supabase'

const RPM_BY_PLATFORM: Record<string, number> = {
  youtube: 1500,
  instagram: 0,
  'naver-blog': 800,
  tistory: 1200,
}

const GOAL_BY_PLATFORM: Record<string, number> = {
  youtube: 50000,
  instagram: 100000,
  'naver-blog': 30000,
  tistory: 30000,
}

const LABEL_BY_PLATFORM: Record<string, string> = {
  youtube: 'YouTube AdSense (추정)',
  instagram: 'Instagram 협찬 (추정)',
  'naver-blog': '네이버 AdPost (추정)',
  tistory: '티스토리 AdSense (추정)',
}

export async function GET() {
  const { data, error } = await supabase.from('videos').select('platform, views')
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const viewsByPlatform: Record<string, number> = {}
  for (const row of data ?? []) {
    viewsByPlatform[row.platform] = (viewsByPlatform[row.platform] ?? 0) + (row.views ?? 0)
  }

  const platforms = ['youtube', 'tiktok', 'instagram', 'naver-blog', 'tistory'] as const
  const revenue = platforms.map((platform) => {
    const views = viewsByPlatform[platform] ?? 0
    const rpm = RPM_BY_PLATFORM[platform] ?? 0
    const monthly = rpm > 0 ? Math.round((views / 1000) * rpm) : 0
    return {
      platform,
      label: LABEL_BY_PLATFORM[platform] ?? platform,
      monthly,
      rpm,
      totalViews: views,
      status: views > 0 && rpm > 0 ? 'active' : 'inactive',
      goal: GOAL_BY_PLATFORM[platform] ?? 30000,
    }
  })

  const monthlyGoal = 500000
  const totalMonthly = revenue.reduce((s, r) => s + r.monthly, 0)

  return NextResponse.json({
    monthlyGoal,
    totalMonthly,
    note: '수집된 조회수 × 플랫폼별 참고 RPM으로 추정한 값입니다. 실제 수익과 다를 수 있습니다.',
    platforms: revenue,
  })
}
