import { NextResponse } from 'next/server'
import { getLatestStockSnapshots, runStockCollect } from '@/lib/data/stock-collect'

export async function GET() {
  const snapshots = await getLatestStockSnapshots()
  return NextResponse.json({ snapshots, count: snapshots.length })
}

export async function POST() {
  const result = await runStockCollect()
  return NextResponse.json(result, { status: result.ok ? 200 : 500 })
}
