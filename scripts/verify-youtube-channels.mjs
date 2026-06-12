/**
 * YouTube 채널 ID 검증 스크립트
 * YOUTUBE_BENCHMARK_CHANNELS.md의 핸들을 YouTube Data API로 실제 조회
 * 실행: node scripts/verify-youtube-channels.mjs
 */

import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const API_KEY = 'AIzaSyDjX2r_nCfM3LSMhBX623G-MJ4ZsAU3W_w';
const MD_PATH = join(__dirname, '../docs/guides/YOUTUBE_BENCHMARK_CHANNELS.md');

// 채널 목록 (핸들 → 기존 ID)
const CHANNELS = [
  // 1. 한국 구독자 상위 50개 종합 채널
  { handle: 'kimpro828', oldId: 'UCsJ6RuBimsG-xAKXOCE0d6g', name: '김프로 KIMPRO' },
  { handle: 'blackpink', oldId: 'UCOmHUn--16B90oW2L6FRR3A', name: 'BLACKPINK' },
  { handle: 'hybelabels', oldId: 'UCWwWOFpCfYqX3GKGcCfGDCg', name: 'HYBE LABELS' },
  { handle: 'kkubi99', oldId: 'UCHfglRjS3bklI0kl-bRDm7g', name: '유백합 kkubi99' },
  { handle: 'cure0721', oldId: 'UC4A5a3-5Bfwmk_f9O_mA-Ow', name: 'CuRe 구래' },
  { handle: 'toypudding', oldId: 'UCEMMmCKMbS_-3pkBUSQXf_Q', name: 'ToyPuddingTV' },
  { handle: 'gh.s', oldId: 'UC3s7gQmleR0L9vDpxvkL5JQ', name: "GH'S" },
  { handle: '1milliondance_official', oldId: 'UCka5K5iDsKABGWY43J3w37A', name: '1MILLION Dance Studio' },
  { handle: 'kbsworldtv', oldId: 'UCH_YoGZJGBDGP_RzXNhyXhQ', name: 'KBS WORLD TV' },
  { handle: 'roses_are_rosie', oldId: 'UCvpr7FnIHhXb0L2YKrR6K4A', name: 'ROSÉ' },
  { handle: 'janeasmr', oldId: 'UCaBf1a-dpIsw8OxqH4ki2Lg', name: 'Jane ASMR 제인' },
  { handle: 'bokyemtv', oldId: 'UCFi3-qnFxOPbzjpWD9qGbHw', name: '보겸TV' },
  { handle: 'jflamusic', oldId: 'UCnfGQCm1RsQrPkNKkPBSV-A', name: 'JFlaMusic' },
  { handle: 'pledis17', oldId: 'UC4Q4Z9KCFHMXkDOGMjOxBkQ', name: 'SEVENTEEN' },
  { handle: 'hongyuasmr', oldId: 'UCdKmAGr_oJAcIL_ZzqCq04A', name: 'Hongyu ASMR 홍유' },
  { handle: 'pinkfongkids', oldId: 'UCcdwLMPsaU2ezNSJU1nFoBQ', name: '핑크퐁' },
  { handle: 'sulgi', oldId: 'UCDdk_J3Ye6ixX9tXXKBWbXg', name: '설기양 SULGI' },
  { handle: 'bibotoys', oldId: 'UC-7hMm2eOBmZt7SxI7gvjXQ', name: 'BIBO와 장난감' },
  { handle: 'gongsam', oldId: 'UCxqWMzcVUKV0v7pPD7MCOXA', name: 'GONGSAM TABLE 이공삼' },
  { handle: 'boramtubetoysreview', oldId: 'UCKiKBvMb7VFSvFoC7LQXWXA', name: 'Boram Tube ToysReview 보람튜브' },
  { handle: 'youchangjo', oldId: 'UCbCBBSZWFOd6BJ7sEHxV0pw', name: '유창조 You Chang Jo' },
  { handle: 'hamzy', oldId: 'UCgFv5NKMcD2CKAl0V4SRVSA', name: '[햄지] Hamzy' },
  { handle: 'byungari0904', oldId: 'UCn0ESiSzKkLe_qnRH95GKPQ', name: 'Byungari 병아리언니' },
  { handle: 'enhypenofficial', oldId: 'UCCuHFdAH9DMCRnV1ZGTEPYw', name: 'ENHYPEN' },
  { handle: 'txt_bighit', oldId: 'UCt6U-pub0NUeXt_EOPV_2Eg', name: 'TOMORROW X TOGETHER' },
  { handle: 'babymonster', oldId: 'UCpVL23rKm9P0Yhe5LJ-XLPQ', name: 'BABYMONSTER' },
  { handle: 'mbckpop', oldId: 'UCXMiT3XBqQGFvHiR0R8RQNQ', name: 'MBCkpop' },
  { handle: 'mnetm2', oldId: 'UCp9_jFNX8s7TzB1sPTR_xmA', name: 'M2 (Mnet)' },
  { handle: 'chadabin', oldId: 'UCdIzXg9WrxzwdEzBMBE1IhQ', name: 'Cha Dabin' },
  { handle: 'joy_bamm', oldId: 'UCqAiNb7A12RZLrJZGVpRK4A', name: '조이밤 Joy_Bamm' },
  { handle: 'naofunfun', oldId: 'UCqxkuNlVCEGILMqhpVTCiCQ', name: 'Nao FunFun' },
  { handle: 'kbskpop', oldId: 'UCJy4cMoI9_3t7mRE10K5vYw', name: 'KBS Kpop' },
  { handle: 'samsung', oldId: 'UCr3NChwHhT7NQPK6aNMSwBA', name: 'Samsung' },
  { handle: 'weareoneexo', oldId: 'UCfFNbON0g2C_u7yF88F8_1w', name: 'EXO' },
  { handle: 'itzy', oldId: 'UCdVIb2RZuFfvuqr_BPHfbWw', name: 'ITZY' },
  { handle: 'team1llusion', oldId: 'UCGDKm_0RO89R5_r5j2A-6Qw', name: '팀일루션 노성율' },
  { handle: 'sooyaaa__', oldId: 'UCIznL5gbLOFDKTYxgTn6uNg', name: 'JISOO' },
  { handle: 'yummyboys', oldId: 'UCuaMFbZJSNHaUMVtGfzGj9A', name: '야미보이 Yummyboy' },
  { handle: 'treasure', oldId: 'UC3PjyKfW2M_4zoCLKKEJkjA', name: 'TREASURE 트레저' },
  { handle: 'lesserafim_official', oldId: 'UCP4bf6IHJJfGGVlLSGR4oUg', name: 'LE SSERAFIM' },
  { handle: '15ya', oldId: 'UCJnBaHPt_XJeGMPVoFBKYog', name: '채널십오야' },
  { handle: 'tvndrama', oldId: 'UCZgQnqh-mMnKVBXRJFMnmHg', name: 'tvN DRAMA' },
  { handle: 'paik_jongwon', oldId: 'UCHuCkRoXWjJDFCEVdZ4MtMg', name: '백종원 PAIK JONG WON' },
  { handle: 'officialmnet', oldId: 'UCpjRpOFCH1SqLl5m5bkXj3A', name: 'STUDIO CHOOM 스튜디오 춤' },
  { handle: 'stonemusicent', oldId: 'UC7VlrEGx4gNFzQAWXoJnJog', name: 'Stone Music Entertainment' },
  { handle: 'mbcent', oldId: 'UCDIFwqzqKrM_v9T4BxPz7Tg', name: 'MBCentertainment' },
  { handle: 'ssoyoung', oldId: 'UCH8ZGk1LbMGjhxwFVRpQMbQ', name: '쏘영 Ssoyoung' },
  { handle: 'seoeunstory', oldId: 'UCgZE_lTw_6CJNg5k_BOy9bg', name: '서은이야기 SeoeunStory' },
  { handle: 'hiu', oldId: 'UCvxbO-qDf7kd1JZfPKV5TDw', name: 'HIU 하이유' },
  { handle: 'sbsnews8', oldId: 'UCkinYTS9IHqOEFnfPa2OXKA', name: 'SBS 뉴스' },

  // 2. 재테크 / 경제 채널
  { handle: 'syukaworld', oldId: 'UCsJ6RuBiTVWRX156FVbeaGg', name: '슈카월드' },
  { handle: 'sampro3protv', oldId: 'UChlv4GSd7OQl3js-jkLOnFA', name: '삼프로TV' },
  { handle: 'thesinsaimdang', oldId: 'UCR4wd9-X73B3qKGUBhYMbkg', name: '신사임당' },
  { handle: 'booiknam', oldId: 'UC_ONRL3aRE2HbM8KHHvbFmQ', name: '부읽남TV' },
  { handle: 'kimwriter', oldId: 'UCeFc5bJQYXMiLSEFnlRPGWg', name: '김작가TV' },
  { handle: 'smartmoney_mirae', oldId: 'UCZS9wEZ4itPbBZk_sqccXfw', name: '미래에셋 스마트머니' },
  { handle: 'mtntv', oldId: 'UC4-Ck9YHFdMaXN5rmXHl59A', name: 'MTN 머니투데이방송' },
  { handle: 'wowtv', oldId: 'UCC8f6d5VZHHJpXBnWlmIo3g', name: '한국경제TV' },

  // 3. IT / 테크 채널
  { handle: 'itsub', oldId: 'UC5_GHAd01XgVGbgTNvbZvdg', name: '잇섭 ITSub' },
  { handle: 'sanago', oldId: 'UC9QNgfMgqnimMWS4XcOxCig', name: '사나고 Sanago' },
  { handle: 'sodproduction', oldId: 'UCjQGC3TKjlNf9K6bKlAFmGg', name: '에스오디 SOD' },
  { handle: 'jocoding', oldId: 'UCPmMcbMHEQVKXHEZQqIKBcA', name: '조코딩 JoCoding' },
  { handle: 'techmong', oldId: 'UCxnkEHAGnLbJaXGsRMG_xJw', name: '테크몽 Techmong' },
  { handle: 'theeditkor', oldId: 'UC0j5LnvGbLd7KR4sS9K0kEA', name: '디에디트 THE EDIT' },
  { handle: 'reviewroom', oldId: 'UCdPSCCmhBSj2I9pnqnS0D1g', name: '방구석 리뷰룸' },

  // 4. 국뽕 / 역사 채널
  { handle: 'chistory', oldId: 'UCB7JbGbCsHtFGEWTEOYN3eg', name: '최태성의 별별한국사' },
  { handle: 'kbs5474', oldId: 'UC4rlkBnyCxh_UJl_4gv8VFg', name: 'KBS 역사저널 그날' },
  { handle: 'joseon_annals', oldId: 'UCsj96LSQN6pUCHdpUi7hRBg', name: '조선왕조실록' },
  { handle: 'dusun_history', oldId: 'UC9JrTOkuLwzpyudwQqavXGg', name: '두선생의 역사공장' },
  { handle: 'hwang_history', oldId: 'UCLnJ3VBxHQgOL4M-5rRfCkQ', name: '황현필 한국사' },

  // 5. 게임 채널 (bokyemtv, gh.s 이미 위에 있음)
  { handle: 'nurituber', oldId: 'UC2nkKMAvdUMrFJBEOqcMKWg', name: 'NURItuber 누리튜버' },
  { handle: 'bumsuktv', oldId: 'UCo0RvMNJiSRLQW3bPaYiB3A', name: '범석TV' },
  { handle: 'howcow', oldId: 'UCDknqMF6WHHzBf3kG1OqvnA', name: 'HOWCOW uuu' },
  { handle: 'kimblue', oldId: 'UCgfRMYMaS3XJMBUyOSxciTQ', name: '김블루' },
  { handle: 'gunrimbo', oldId: 'UCXu7DgkABqMfHMfbHDGEMqA', name: '군림보' },
  { handle: 'testerhoon', oldId: 'UCgCFJFmMCR8qTrYq-FkYSpA', name: '테스터훈 TesterHoon' },
  { handle: 'gsibaek', oldId: 'UCJKoKU4EYqEMFQFBHIME2RQ', name: '김성회의 G식백과' },
  { handle: 'quintol', oldId: 'UCBdJMcTw_5OxRmhHmqjV6bA', name: '퀸톨TV' },

  // 6. 국내사 (한국사) — 일부 중복 (hwang_history, chistory, kbs5474, dusun_history 이미 위에)
  { handle: 'seolminseok', oldId: 'UCfyNHTzKTiXAbV5tNHJcqiw', name: '설민석 Seol Min Seok' },
  { handle: 'robin_history', oldId: 'UCmPeKRCnYVmf4Qvn1L7cjLg', name: '로빈의 역사기록' },
  { handle: 'Dr.J-history', oldId: 'UC3bRKrGn7PsEhVJbN4GVAUA', name: '역TV' },
  { handle: 'hanna-tv', oldId: 'UCkiddy42815xHrQnBdm9Dcg', name: '한나TV' },
  { handle: 'gojunghun_history', oldId: 'UC6PNTFVQeJgQbeTktrzk9Ng', name: '고종훈 한국사' },
  { handle: 'historyjoin', oldId: 'UCH3k2qLvVGJjMmAeQ7a9tQA', name: '역사탐정 조인선' },

  // 7. 세계사 채널
  { handle: 'studio_pirates', oldId: 'UCFXHJoIxBQFqJTEbTqMCckw', name: '지식해적단' },
  { handle: 'official_hyogisim', oldId: 'UCdtdZSvfvBH8TcJOjXqJl6A', name: '효기심' },
  { handle: 'jisikdrink', oldId: 'UCqJA4R9xZwOYaZEPm4mXBGg', name: '지식한잔' },
  { handle: 'starstarhistory', oldId: 'UC7vRJtKqMjQ9bP_OA7g5fFA', name: '별별역사' },
  { handle: 'aceshow_history', oldId: 'UCHv4pRjM1bLXITIWVfR3a-Q', name: '써에이스쇼' },
  { handle: 'military_history', oldId: 'UCjfZo5XGjuJQRuQpJCW06Og', name: '건들건들' },
  { handle: '5minworldhistory', oldId: 'UCTLPzJCHiGxoNFxIFXA9mdg', name: '5분 상식 세계사' },
  { handle: 'nunsyong_history', oldId: 'UCtjAJ3tVrotx0d7VPJk9dyA', name: '눈숑눈숑 스캔들 세계사' },
  { handle: 'historyfacts_kr', oldId: 'UCKiJMlDrEbzaByD5CgtjQsA', name: '역사왜곡' },
  { handle: 'historyn', oldId: 'UCWt8bY4ZR0g7bGW6MjpP9kQ', name: '히스토리앤' },

  // 8. 우주 / 천문
  { handle: 'ScienceDream', oldId: 'UCUwDTBPpBEYlAqj1oe1MTBQ', name: '과학드림 ScienceDream' },
  { handle: 'unreachablescience', oldId: 'UC5CgFDhQPJHKYUKLgJNalVA', name: '안될과학' },
  { handle: 'kurzgesagt_kr', oldId: 'UC8rKCy_tipwTEY3RdkNCKmw', name: '한눈에 보는 세상 (Kurzgesagt 한국어)' },
  { handle: 'orbit_science', oldId: 'UCAbBbQHmNfFJg5ioM0o5ZCg', name: '궤도 (과학커뮤니케이터)' },
  { handle: 'ytnscience', oldId: 'UCzORJV8l3MBZn4IeSB0QVHQ', name: 'YTN Science' },
  { handle: 'spacedust_kr', oldId: 'UCgV8A3TbBFGP7P5E2-9vZwA', name: '우주먼지' },
  { handle: 'kaos_foundation', oldId: 'UCvnGwZKfwUpMSbMrFGXoIJA', name: '카오스사이언스 KAOS' },
  { handle: 'hondong_science', oldId: 'UCp5rDVSBRiJeL4x9mMJsJIA', name: '혼동의 과학' },
  { handle: 'ebsscience', oldId: 'UCBcRF18a7Qf58cCRy5xuWwQ', name: 'EBS Science' },
  { handle: 'brainlist', oldId: 'UCsymfMhK7e7oI4Wt9kNP3PQ', name: '브레인리스트' },

  // 9. 물리 (일부 중복)
  { handle: 'leekvahyung', oldId: 'UCNsMhRKTg5R4E4F3m9RXUjg', name: '이과형' },
  { handle: 'megastudy_physics', oldId: 'UCpJq9Kj0zY5YJkM7n3M6O7g', name: '메가스터디 물리' },
  { handle: 'ebs_physics', oldId: 'UC-q4BXXsXeGLHCExXBm8Irg', name: 'EBS 물리' },
  { handle: 'physicsking_kr', oldId: 'UCKoJu6aBH5a6Ew1B3E2qKdg', name: '물리왕 Physics King' },
  { handle: 'strangerphysics', oldId: 'UC3mXzg7GVdj_ZfC5mHvKyxQ', name: '이상한 물리' },
  { handle: 'gangnam_physics', oldId: 'UCHq_kFJKlJbqNhUqGBjLdLg', name: '강남인강 물리' },
  { handle: 'physicsgirl_kr', oldId: 'UCY7rNGRFwC6zJOHGZxvhB_Q', name: 'Physics Girl 한국어' },

  // 10. 화학
  { handle: 'chemking_kr', oldId: 'UCYBhO_f3qPHkMWKpVrj4BZA', name: '화학왕' },
  { handle: 'periodictable_kr', oldId: 'UCdFnCJgT4Z6VKqPk7G9fvKA', name: '원소 주기율표' },
  { handle: 'ewha_chem', oldId: 'UCg9AbB1RH3X1C8Xwn7v0pZA', name: '이화여대 화학과' },
  { handle: 'megastudy_chem', oldId: 'UCxL5kXnBCPkLGn4Kgj7hbKg', name: '메가스터디 화학' },
  { handle: 'ebs_chemistry', oldId: 'UCBnFJKKTVf3EqXk8JvRpD-g', name: 'EBS 화학' },
  { handle: 'chemgeek_kr', oldId: 'UCG7M3RKz8Q5J0n4VjRd7JeA', name: '케미덕후' },
  { handle: 'strangechemistry', oldId: 'UC8nPQv1K7GbGnJ9mXRZ9kSA', name: '이상한 화학' },
  { handle: 'gangnam_chemistry', oldId: 'UCqH5BrFQVnEKj5tT9x0WZnA', name: '강남인강 화학' },
  { handle: 'chem_lab_kr', oldId: 'UCtLBwkPqnpZSQ9mNf1cT0Bw', name: '화학실험실' },

  // 11. 지구과학 (일부 중복)
  { handle: 'megastudy_earth', oldId: 'UC9TrW8bBqBiV3P5bXp9p0oA', name: '메가스터디 지구과학' },
  { handle: 'earthscienceking', oldId: 'UCeGPq5jR0M7WNxAQ2EjdOuA', name: '지구과학왕' },
  { handle: 'gangnam_earth', oldId: 'UCKPLJoZm8T3Q6oZ7WZ7HzQA', name: '강남인강 지구과학' },
  { handle: 'weatheron_kma', oldId: 'UCLq2XxuX7zqKq4VPgFaYnwA', name: '기상청 날씨ON' },
  { handle: 'kigam_official', oldId: 'UC1GkT6kM5fNJq8zK3LpXvhA', name: '한국지질자원연구원 KIGAM' },
  { handle: 'our_earth_kr', oldId: 'UCHRmCpJqz1pJ0oTVcWMnT0A', name: '우리가 사는 지구' },
  { handle: 'nasa_korea', oldId: 'UCVhq6uaGr1kqM8O6ZoApzxQ', name: 'NASA 코리아' },
  { handle: 'earth_story_kr', oldId: 'UCmHJN1KpFqHmJ3A9QcGqoBA', name: '지구 이야기' },
];

async function fetchChannelByHandle(handle) {
  const url = `https://www.googleapis.com/youtube/v3/channels?part=id,snippet,statistics&forHandle=@${handle}&key=${API_KEY}`;
  try {
    const res = await fetch(url);
    const data = await res.json();
    if (data.items && data.items.length > 0) {
      const ch = data.items[0];
      return {
        id: ch.id,
        title: ch.snippet.title,
        subscribers: ch.statistics?.subscriberCount
          ? parseInt(ch.statistics.subscriberCount)
          : null,
      };
    }
    return null;
  } catch (e) {
    return null;
  }
}

function formatSubs(n) {
  if (!n) return '?';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 10000) return `${Math.round(n / 10000)}만`;
  return n.toLocaleString();
}

async function main() {
  console.log(`\n🔍 YouTube 채널 ID 검증 시작 (총 ${CHANNELS.length}개 핸들)\n`);

  const results = [];
  const changed = [];
  const notFound = [];

  // 중복 제거 (핸들 기준)
  const unique = [...new Map(CHANNELS.map((c) => [c.handle, c])).values()];
  console.log(`📋 중복 제거 후 ${unique.length}개 핸들 조회\n`);

  for (let i = 0; i < unique.length; i++) {
    const ch = unique[i];
    process.stdout.write(`[${i + 1}/${unique.length}] @${ch.handle} (${ch.name})... `);

    const result = await fetchChannelByHandle(ch.handle);

    if (!result) {
      console.log(`❌ 채널 없음`);
      notFound.push(ch);
      results.push({ ...ch, newId: null, found: false, apiTitle: null, subscribers: null });
    } else {
      const match = result.id === ch.oldId;
      const subStr = formatSubs(result.subscribers);
      if (match) {
        console.log(`✅ ID 일치 (${subStr})`);
      } else {
        console.log(`⚠️  ID 변경: ${ch.oldId} → ${result.id} (${subStr})`);
        changed.push({ ...ch, newId: result.id, apiTitle: result.title, subscribers: result.subscribers });
      }
      results.push({ ...ch, newId: result.id, found: true, apiTitle: result.title, subscribers: result.subscribers });
    }

    // API 속도 제한 대응 (100ms 대기)
    await new Promise((r) => setTimeout(r, 100));
  }

  console.log('\n' + '='.repeat(60));
  console.log(`\n📊 검증 결과 요약`);
  console.log(`  - 총 고유 핸들: ${unique.length}개`);
  console.log(`  - ✅ ID 일치: ${unique.length - changed.length - notFound.length}개`);
  console.log(`  - ⚠️  ID 수정 필요: ${changed.length}개`);
  console.log(`  - ❌ 채널 없음: ${notFound.length}개`);

  if (changed.length > 0) {
    console.log(`\n⚠️  수정된 채널 ID 목록:`);
    changed.forEach((c) =>
      console.log(`  - [${c.name}] @${c.handle}\n    기존: ${c.oldId}\n    변경: ${c.newId}`)
    );
  }

  if (notFound.length > 0) {
    console.log(`\n❌ 채널을 찾을 수 없음 (핸들 변경 또는 삭제됨):`);
    notFound.forEach((c) => console.log(`  - [${c.name}] @${c.handle} (기존 ID: ${c.oldId})`));
  }

  // 결과를 JSON으로 저장
  const outputPath = join(__dirname, '../docs/channel-verify-result.json');
  writeFileSync(
    outputPath,
    JSON.stringify(
      {
        verifiedAt: new Date().toISOString(),
        total: unique.length,
        matched: unique.length - changed.length - notFound.length,
        changed: changed.length,
        notFound: notFound.length,
        results,
      },
      null,
      2
    )
  );
  console.log(`\n💾 결과 저장: ${outputPath}`);
  console.log('\n✅ 검증 완료\n');
}

main().catch(console.error);
