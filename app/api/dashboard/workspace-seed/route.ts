import { NextResponse } from 'next/server'
import { getOutlierVideos } from '@/lib/queries'
import {
  getCalendarItems,
  getRepurposeItems,
  getDeployTasks,
  replaceCalendarItems,
  replaceRepurposeItems,
  replaceDeployTasks,
} from '@/lib/workspace-queries'
import {
  seedCalendarFromOutliers,
  seedRepurposeFromOutliers,
  seedDeployFromOutliers,
} from '@/lib/dashboard-storage'

export async function GET() {
  const outliers = await getOutlierVideos(2.0, 6)
  const mapped = outliers.map((v) => ({
    video_id: v.video_id,
    title: v.title,
    vs_avg: Number(v.vs_avg ?? 0),
    platform: v.platform,
    channel_name: v.channel_name,
  }))
  return NextResponse.json({ outliers: mapped })
}

export async function POST() {
  const [calendar, repurpose, deploy, outliers] = await Promise.all([
    getCalendarItems(),
    getRepurposeItems(),
    getDeployTasks(),
    getOutlierVideos(2.0, 6),
  ])

  const mapped = outliers
    .filter((v) => v.platform !== 'instagram')
    .map((v) => ({
      video_id: v.video_id,
      title: v.title,
      vs_avg: Number(v.vs_avg ?? 0),
      platform: v.platform,
      channel_name: v.channel_name,
    }))

  let seeded = false

  if (calendar.length === 0 && mapped.length > 0) {
    await replaceCalendarItems(seedCalendarFromOutliers(mapped))
    seeded = true
  }
  if (repurpose.length === 0 && mapped.length > 0) {
    await replaceRepurposeItems(seedRepurposeFromOutliers(mapped))
    seeded = true
  }
  if (deploy.length === 0 && mapped.length > 0) {
    await replaceDeployTasks(seedDeployFromOutliers(mapped))
    seeded = true
  }

  return NextResponse.json({ seeded, outlierCount: mapped.length })
}
