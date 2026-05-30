import { NextResponse } from 'next/server'
import { syncChannelCategoriesFromMd } from '@/lib/dashboard/sync-channel-categories'

/** MD 검증 목록과 DB YouTube 채널을 비교해 category_id가 비어 있으면 채움 */
export async function POST() {
  const result = await syncChannelCategoriesFromMd()
  if (!result.ok) {
    return NextResponse.json({ error: result.message }, { status: 500 })
  }
  return NextResponse.json(result)
}
