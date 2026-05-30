import { readFileSync } from 'fs'
import { join } from 'path'
import {
  parseVerifiedChannelsMd,
  type VerifiedYoutubeChannel,
} from '@/lib/dashboard/verified-channels-shared'

export function loadVerifiedChannelsFromDoc(): VerifiedYoutubeChannel[] {
  const path = join(process.cwd(), 'docs/YOUTUBE_CHANNELS_VERIFIED_20260525.md')
  const md = readFileSync(path, 'utf8')
  return parseVerifiedChannelsMd(md)
}
