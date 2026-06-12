/**
 * YOUTUBE_BENCHMARK_CHANNELS.md의 채널을 YouTube API로 재검증하고
 * 유효한 채널 / 유효하지 않은 채널을 분리한 새 MD 파일을 생성합니다.
 *
 * 실행: node scripts/build-verified-channels-md.mjs
 */

import { readFileSync, writeFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const API_KEY = 'AIzaSyDjX2r_nCfM3LSMhBX623G-MJ4ZsAU3W_w'
const MD_PATH = join(__dirname, '../docs/guides/YOUTUBE_BENCHMARK_CHANNELS.md')
const OUT_PATH = join(__dirname, '../docs/YOUTUBE_CHANNELS_VERIFIED_20260525.md')

// ────────────────────────────────────────────────────────────────────────────
// 1. MD 파싱 — 모든 테이블 행에서 채널 정보 추출
// ────────────────────────────────────────────────────────────────────────────

function parseMd(md) {
  const channels = []

  // 현재 섹션 제목 추적
  let currentSection = ''
  const lines = md.split('\n')

  for (const line of lines) {
    // ## 섹션 제목
    const secMatch = line.match(/^##\s+\d+\.\s+(.+)/)
    if (secMatch) {
      currentSection = secMatch[1].trim()
      continue
    }

    // 테이블 행: | ... | @handle | `UCxxx` ... | 구독자 | ...
    // 헤더·구분선 제외
    if (!line.trim().startsWith('|') || line.includes(':----:') || line.includes('순위') || line.includes(' # ')) continue

    const cols = line.split('|').map(c => c.trim()).filter(Boolean)
    if (cols.length < 4) continue

    // 핸들 찾기
    const handleCol = cols.find(c => c.startsWith('@'))
    if (!handleCol) continue
    const handle = handleCol.replace(/^@/, '')

    // 채널명 찾기 (** ** 제거)
    const nameRaw = cols.find(c => c.includes('**') && !c.startsWith('@'))
    const name = nameRaw ? nameRaw.replace(/\*\*/g, '').trim() : ''

    // 기존 Channel ID (UC...)
    const idCol = cols.find(c => c.includes('`UC'))
    const idMatch = idCol?.match(/`(UC[\w-]+)`/)
    const oldId = idMatch?.[1] ?? ''

    // 구독자 수 (숫자+M/만/+ 패턴)
    const subsCol = cols.find(c => /^[\d.]+[MK만+,]/.test(c))
    const subscribers = subsCol ?? ''

    // 중복 핸들 방지
    if (channels.find(ch => ch.handle === handle)) continue

    channels.push({ handle, name, oldId, subscribers, section: currentSection })
  }

  return channels
}

// ────────────────────────────────────────────────────────────────────────────
// 2. YouTube API 호출
// ────────────────────────────────────────────────────────────────────────────

async function fetchChannel(handle) {
  const url = `https://www.googleapis.com/youtube/v3/channels?part=id,snippet,statistics&forHandle=@${handle}&key=${API_KEY}`
  try {
    const res = await fetch(url)
    const data = await res.json()
    if (data.items?.length) {
      const ch = data.items[0]
      return {
        found: true,
        channelId: ch.id,
        title: ch.snippet.title,
        handle: ch.snippet.customUrl ?? `@${handle}`,
        subscribers: ch.statistics?.hiddenSubscriberCount
          ? null
          : ch.statistics?.subscriberCount
            ? parseInt(ch.statistics.subscriberCount)
            : null,
        videoCount: ch.statistics?.videoCount ? parseInt(ch.statistics.videoCount) : null,
      }
    }
    return { found: false }
  } catch {
    return { found: false }
  }
}

function formatSubs(n) {
  if (n == null) return '비공개'
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 10_000) return `${Math.round(n / 10_000)}만`
  return n.toLocaleString()
}

// ────────────────────────────────────────────────────────────────────────────
// 3. 메인
// ────────────────────────────────────────────────────────────────────────────

async function main() {
  const md = readFileSync(MD_PATH, 'utf8')
  const channels = parseMd(md)

  console.log(`\n📋 파싱된 고유 채널: ${channels.length}개\n`)

  const valid = []
  const invalid = []

  for (let i = 0; i < channels.length; i++) {
    const ch = channels[i]
    process.stdout.write(`[${i + 1}/${channels.length}] @${ch.handle} (${ch.name})... `)

    const result = await fetchChannel(ch.handle)

    if (result.found) {
      const subStr = formatSubs(result.subscribers)
      const idChanged = result.channelId !== ch.oldId
      console.log(`✅ ${subStr}${idChanged ? ' ⚠️ID변경' : ''}`)
      valid.push({ ...ch, ...result })
    } else {
      console.log(`❌`)
      invalid.push(ch)
    }

    await new Promise(r => setTimeout(r, 80))
  }

  console.log(`\n✅ 유효: ${valid.length}개 | ❌ 무효: ${invalid.length}개\n`)

  // ── MD 생성 ────────────────────────────────────────────────
  const now = new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })

  // 섹션별 그룹화 (valid)
  const sectionMap = {}
  for (const ch of valid) {
    if (!sectionMap[ch.section]) sectionMap[ch.section] = []
    sectionMap[ch.section].push(ch)
  }

  let out = `# YouTube 채널 검증 결과 (2026-05-25)

> 검증일시: ${now} (KST)  
> 원본: YOUTUBE_CHANNELS_20260525.md (${channels.length}개 채널)  
> YouTube Data API v3 \`forHandle\` 실검증  
> ✅ 유효: **${valid.length}개** | ❌ 무효/없음: **${invalid.length}개**

---

## ✅ 유효한 채널 (${valid.length}개)

`

  let seq = 1
  for (const [section, list] of Object.entries(sectionMap)) {
    out += `### ${section}\n\n`
    out += `| # | 채널명 | 핸들 | Channel ID | 구독자 | 영상수 |\n`
    out += `|:--:|--------|------|------------|:------:|:------:|\n`
    for (const ch of list) {
      const subStr = ch.subscribers != null ? formatSubs(ch.subscribers) : '비공개'
      const vidStr = ch.videoCount != null ? ch.videoCount.toLocaleString() : '-'
      out += `| ${seq++} | **${ch.title ?? ch.name}** | ${ch.handle.startsWith('@') ? ch.handle : `@${ch.handle}`} | \`${ch.channelId}\` | ${subStr} | ${vidStr} |\n`
    }
    out += '\n'
  }

  out += `---

## ❌ 유효하지 않은 채널 (${invalid.length}개)

> 핸들이 존재하지 않거나 채널이 삭제·변경된 경우입니다.  
> 올바른 핸들을 확인한 뒤 재등록을 권장합니다.

| # | 채널명 | 기존 핸들 | 기존 Channel ID | 원본 섹션 |
|:--:|--------|----------|-----------------|----------|
`

  for (let i = 0; i < invalid.length; i++) {
    const ch = invalid[i]
    out += `| ${i + 1} | ${ch.name} | @${ch.handle} | \`${ch.oldId}\` | ${ch.section} |\n`
  }

  out += `
---

*생성: ${now} (YouTube Data API v3 forHandle 실검증)*
`

  writeFileSync(OUT_PATH, out, 'utf8')
  console.log(`💾 저장 완료: ${OUT_PATH}`)
}

main().catch(console.error)
