import { NextRequest, NextResponse } from 'next/server'
import { getDeployTasks, replaceDeployTasks } from '@/lib/data/workspace-queries'
import type { DeployTaskStored } from '@/lib/dashboard/dashboard-storage'

export async function GET() {
  return NextResponse.json(await getDeployTasks())
}

export async function PUT(request: NextRequest) {
  const tasks = (await request.json()) as DeployTaskStored[]
  const ok = await replaceDeployTasks(tasks)
  if (!ok) return NextResponse.json({ error: 'Save failed' }, { status: 500 })
  return NextResponse.json({ ok: true })
}
