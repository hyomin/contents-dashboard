/**
 * 국내 대형주 검색용 큐레이션 디렉토리 (지수 제외).
 * KIS Open API에는 "회사명 → 종목코드" 검색이 없어 정적 목록 + 6자리 코드 직접 입력 폴백으로 대체한다.
 * 코드가 부정확해도 KIS 호출은 graceful하게 빈 데이터를 반환하므로 운영에 영향 없음 — 필요 시
 * 네이버페이증권/KRX에서 종목코드를 확인해 직접 입력해도 된다.
 */
export interface KrStockDirectoryEntry {
  ticker: string
  name: string
}

export const KR_STOCK_DIRECTORY: KrStockDirectoryEntry[] = [
  // 반도체·전자
  { ticker: '005930', name: '삼성전자' },
  { ticker: '000660', name: 'SK하이닉스' },
  { ticker: '009150', name: '삼성전기' },
  { ticker: '011070', name: 'LG이노텍' },
  { ticker: '000990', name: 'DB하이텍' },
  { ticker: '042700', name: '한미반도체' },
  { ticker: '066570', name: 'LG전자' },
  { ticker: '034220', name: 'LG디스플레이' },
  { ticker: '018260', name: '삼성에스디에스' },
  // 이차전지·화학
  { ticker: '373220', name: 'LG에너지솔루션' },
  { ticker: '006400', name: '삼성SDI' },
  { ticker: '051910', name: 'LG화학' },
  { ticker: '247540', name: '에코프로비엠' },
  { ticker: '086520', name: '에코프로' },
  { ticker: '066970', name: '엘앤에프' },
  { ticker: '010130', name: '고려아연' },
  { ticker: '011170', name: '롯데케미칼' },
  // 바이오·헬스케어
  { ticker: '207940', name: '삼성바이오로직스' },
  { ticker: '068270', name: '셀트리온' },
  { ticker: '326030', name: 'SK바이오팜' },
  { ticker: '128940', name: '한미약품' },
  { ticker: '000100', name: '유한양행' },
  { ticker: '196170', name: '알테오젠' },
  // 인터넷·플랫폼·게임
  { ticker: '035420', name: 'NAVER' },
  { ticker: '035720', name: '카카오' },
  { ticker: '323410', name: '카카오뱅크' },
  { ticker: '036570', name: '엔씨소프트' },
  { ticker: '251270', name: '넷마블' },
  { ticker: '259960', name: '크래프톤' },
  { ticker: '263750', name: '펄어비스' },
  // 자동차·모빌리티
  { ticker: '005380', name: '현대차' },
  { ticker: '000270', name: '기아' },
  { ticker: '012330', name: '현대모비스' },
  // 금융
  { ticker: '105560', name: 'KB금융' },
  { ticker: '055550', name: '신한지주' },
  { ticker: '086790', name: '하나금융지주' },
  { ticker: '316140', name: '우리금융지주' },
  { ticker: '029780', name: '삼성카드' },
  { ticker: '032830', name: '삼성생명' },
  // 조선·방산·기계
  { ticker: '012450', name: '한화에어로스페이스' },
  { ticker: '042660', name: '한화오션' },
  { ticker: '329180', name: 'HD현대중공업' },
  { ticker: '034020', name: '두산에너빌리티' },
  // 에너지·소재·필수소비재
  { ticker: '005490', name: 'POSCO홀딩스' },
  { ticker: '010950', name: 'S-Oil' },
  { ticker: '015760', name: '한국전력' },
  { ticker: '033780', name: 'KT&G' },
  { ticker: '051900', name: 'LG생활건강' },
  { ticker: '090430', name: '아모레퍼시픽' },
  // 통신·운송
  { ticker: '017670', name: 'SK텔레콤' },
  { ticker: '030200', name: 'KT' },
  { ticker: '003490', name: '대한항공' },
]

/** 종목명 부분 일치 검색 (대소문자·공백 무시), 최대 limit개 */
export function searchKrStockDirectory(query: string, limit = 8): KrStockDirectoryEntry[] {
  const q = query.trim().toLowerCase().replace(/\s+/g, '')
  if (!q) return []
  return KR_STOCK_DIRECTORY.filter((entry) =>
    entry.name.toLowerCase().replace(/\s+/g, '').includes(q) || entry.ticker.includes(q),
  ).slice(0, limit)
}
