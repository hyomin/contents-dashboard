/**
 * 섹터/카테고리 종합분석 모드용 큐레이션 디렉토리.
 * `lib/dashboard/kr-stock-directory.ts`의 그룹을 섹터로 승격 + 미국 보조 섹터 2종 추가.
 */
import type { StockMarket } from '@/lib/dashboard/stock-config'

export interface StockSectorConstituent {
  market: StockMarket
  ticker: string
  name: string
}

export interface StockSector {
  id: string
  label: string
  constituents: StockSectorConstituent[]
}

export const STOCK_SECTORS: StockSector[] = [
  {
    id: 'kr-semiconductor',
    label: '반도체·전자',
    constituents: [
      { market: 'KR', ticker: '005930', name: '삼성전자' },
      { market: 'KR', ticker: '000660', name: 'SK하이닉스' },
      { market: 'KR', ticker: '009150', name: '삼성전기' },
      { market: 'KR', ticker: '011070', name: 'LG이노텍' },
      { market: 'KR', ticker: '042700', name: '한미반도체' },
    ],
  },
  {
    id: 'kr-battery-chemical',
    label: '이차전지·화학',
    constituents: [
      { market: 'KR', ticker: '373220', name: 'LG에너지솔루션' },
      { market: 'KR', ticker: '006400', name: '삼성SDI' },
      { market: 'KR', ticker: '051910', name: 'LG화학' },
      { market: 'KR', ticker: '247540', name: '에코프로비엠' },
      { market: 'KR', ticker: '066970', name: '엘앤에프' },
    ],
  },
  {
    id: 'kr-bio-healthcare',
    label: '바이오·헬스케어',
    constituents: [
      { market: 'KR', ticker: '207940', name: '삼성바이오로직스' },
      { market: 'KR', ticker: '068270', name: '셀트리온' },
      { market: 'KR', ticker: '326030', name: 'SK바이오팜' },
      { market: 'KR', ticker: '128940', name: '한미약품' },
      { market: 'KR', ticker: '196170', name: '알테오젠' },
    ],
  },
  {
    id: 'kr-internet-platform-game',
    label: '인터넷·플랫폼·게임',
    constituents: [
      { market: 'KR', ticker: '035420', name: 'NAVER' },
      { market: 'KR', ticker: '035720', name: '카카오' },
      { market: 'KR', ticker: '036570', name: '엔씨소프트' },
      { market: 'KR', ticker: '259960', name: '크래프톤' },
      { market: 'KR', ticker: '263750', name: '펄어비스' },
    ],
  },
  {
    id: 'kr-auto-mobility',
    label: '자동차·모빌리티',
    constituents: [
      { market: 'KR', ticker: '005380', name: '현대차' },
      { market: 'KR', ticker: '000270', name: '기아' },
      { market: 'KR', ticker: '012330', name: '현대모비스' },
    ],
  },
  {
    id: 'kr-finance',
    label: '금융',
    constituents: [
      { market: 'KR', ticker: '105560', name: 'KB금융' },
      { market: 'KR', ticker: '055550', name: '신한지주' },
      { market: 'KR', ticker: '086790', name: '하나금융지주' },
      { market: 'KR', ticker: '316140', name: '우리금융지주' },
      { market: 'KR', ticker: '032830', name: '삼성생명' },
    ],
  },
  {
    id: 'kr-defense-shipbuilding',
    label: '조선·방산·기계',
    constituents: [
      { market: 'KR', ticker: '012450', name: '한화에어로스페이스' },
      { market: 'KR', ticker: '042660', name: '한화오션' },
      { market: 'KR', ticker: '329180', name: 'HD현대중공업' },
      { market: 'KR', ticker: '034020', name: '두산에너빌리티' },
    ],
  },
  {
    id: 'kr-energy-materials',
    label: '에너지·소재·필수소비재',
    constituents: [
      { market: 'KR', ticker: '005490', name: 'POSCO홀딩스' },
      { market: 'KR', ticker: '010950', name: 'S-Oil' },
      { market: 'KR', ticker: '015760', name: '한국전력' },
      { market: 'KR', ticker: '033780', name: 'KT&G' },
      { market: 'KR', ticker: '090430', name: '아모레퍼시픽' },
    ],
  },
  {
    id: 'kr-telecom-transport',
    label: '통신·운송',
    constituents: [
      { market: 'KR', ticker: '017670', name: 'SK텔레콤' },
      { market: 'KR', ticker: '030200', name: 'KT' },
      { market: 'KR', ticker: '003490', name: '대한항공' },
    ],
  },
  {
    id: 'us-semiconductor-ai',
    label: '반도체·AI (미국)',
    constituents: [
      { market: 'US', ticker: 'NVDA', name: 'NVIDIA' },
      { market: 'US', ticker: 'AMD', name: 'AMD' },
      { market: 'US', ticker: 'TSM', name: 'TSMC' },
    ],
  },
  {
    id: 'us-bigtech-platform',
    label: '빅테크 플랫폼 (미국)',
    constituents: [
      { market: 'US', ticker: 'AAPL', name: 'Apple' },
      { market: 'US', ticker: 'MSFT', name: 'Microsoft' },
      { market: 'US', ticker: 'GOOGL', name: 'Alphabet' },
    ],
  },
]

/** 섹터 ID → 구성종목 (최대 max개) */
export function getSectorConstituents(sectorId: string, max = 5): StockSectorConstituent[] {
  const sector = STOCK_SECTORS.find((s) => s.id === sectorId)
  if (!sector) return []
  return sector.constituents.slice(0, max)
}

/** UI 드롭다운용 — 섹터 목록 (id, label) */
export function listStockSectors(): { id: string; label: string }[] {
  return STOCK_SECTORS.map((s) => ({ id: s.id, label: s.label }))
}

/** 섹터 ID → 라벨 */
export function getSectorLabel(sectorId: string): string | undefined {
  return STOCK_SECTORS.find((s) => s.id === sectorId)?.label
}
