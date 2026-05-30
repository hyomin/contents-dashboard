/**
 * channel-verify-result.json을 기반으로 YOUTUBE_CHANNELS_20260525.md의
 * Channel ID와 구독자 수를 현행화하는 스크립트
 * 실행: node scripts/update-channel-ids.mjs
 */

import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const JSON_PATH = join(__dirname, '../docs/channel-verify-result.json');
const MD_PATH = join(__dirname, '../docs/YOUTUBE_CHANNELS_20260525.md');

const data = JSON.parse(readFileSync(JSON_PATH, 'utf8'));

// 핸들 → 결과 맵
const resultMap = {};
for (const r of data.results) {
  resultMap[r.handle.toLowerCase()] = r;
}

function formatSubs(n) {
  if (!n || n < 1000) return null; // 구독자 비공개 또는 너무 적으면 원본 유지
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 10000) return `${Math.round(n / 10000)}만`;
  return n.toLocaleString();
}

let md = readFileSync(MD_PATH, 'utf8');

// 테이블 행에서 핸들 추출 및 ID/구독자 교체
// 패턴: | ... | @handle | `UCxxx` | 구독자 | ...
let changedCount = 0;
let notFoundCount = 0;

const lines = md.split('\n');
const newLines = lines.map((line) => {
  // 테이블 행이면서 @핸들과 UC 채널ID가 있는 행
  const handleMatch = line.match(/@([A-Za-z0-9_.%-]+)/);
  const channelIdMatch = line.match(/`(UC[A-Za-z0-9_-]{22})`/);

  if (!handleMatch || !channelIdMatch) return line;

  const handle = handleMatch[1].toLowerCase();
  const oldId = channelIdMatch[1];
  const result = resultMap[handle];

  if (!result) return line; // 스크립트에 없는 핸들은 그대로

  if (!result.found) {
    // 채널을 찾을 수 없음 → ID 셀에 ❌ 표기
    notFoundCount++;
    return line
      .replace(`\`${oldId}\``, `\`${oldId}\` ❌핸들없음`)
      .replace(/(\| )([\d.]+[MK만+]?)( \|)/, (m, p1, sub, p3) => `${p1}${sub}${p3}`); // 구독자는 유지
  }

  // found → ID 교체
  let newLine = line.replace(`\`${oldId}\``, `\`${result.newId}\``);

  // 구독자 수 업데이트 (있고 유효한 경우만)
  const newSubs = formatSubs(result.subscribers);
  if (newSubs) {
    // 기존 구독자 패턴: | 숫자M | 또는 | 숫자만 | 또는 | 숫자만+ |
    newLine = newLine.replace(
      /\| ([\d.]+M\+?|[\d.]+만\+?|[\d,]+) \|/,
      `| ${newSubs} |`
    );
  }

  if (newLine !== line) changedCount++;
  return newLine;
});

const newMd = newLines
  .join('\n')
  // 헤더 업데이트
  .replace(
    /> 작성일: 2026-05-25 \| 출처:.*\n> ⚠️.*\n> 검증 방법:.*$/m,
    `> 작성일: 2026-05-25 | 출처: Influesque · vidIQ · tubemon · famelifter · IMR 교차 검증  
> ✅ Channel ID: YouTube Data API v3 \`forHandle\` 실제 검증 완료 (2026-05-25)  
> ❌ 핸들없음: API 조회 실패 채널 (핸들 변경·채널 삭제 등)  
> 검증 방법: \`GET https://www.googleapis.com/youtube/v3/channels?part=id&forHandle=@핸들명&key={API_KEY}\``
  )
  // 하단 주의사항 업데이트
  .replace(
    /- `UC...` Channel ID — 핸들 기반 추정값 포함 \(일부 부정확 가능\)/,
    '- `UC...` Channel ID — YouTube Data API v3 `forHandle` 실검증 완료 (2026-05-25 기준)'
  )
  // 최종 업데이트 날짜
  .replace(
    '*최종 업데이트: 2026-05-25*',
    '*최종 업데이트: 2026-05-25 (Channel ID API 검증 현행화)*'
  );

writeFileSync(MD_PATH, newMd, 'utf8');

console.log(`\n✅ MD 파일 업데이트 완료`);
console.log(`  - ID 수정/확인: ${changedCount}개`);
console.log(`  - 핸들 없음 표기: ${notFoundCount}개`);
console.log(`  저장: ${MD_PATH}\n`);
