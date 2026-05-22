/**
 * Docker n8n 운영(릴리즈) 워크플로 ID — 중복 정리·재임포트 시 이 ID를 유지합니다.
 * 변경 시 scripts/n8n-setup.sh 강제 임포트 로직과 함께 맞춥니다.
 */
export const N8N_PRODUCTION_WORKFLOW_IDS: Record<string, string> = {
  'YouTube 채널 데이터 수집': 'TE4OiflhH61VewdG',
  '아웃라이어 자동 태깅': 'hlkX7Uy2RvbX6McM',
  'RSS → 주제 후보 자동 수집': 's9XoNNisqbyCz2lv',
  '네이버 블로그 글 목록 수집 (검색 Open API)': 'edrNNU8gdnaENGag',
  '네이버 블로그 조회수·vs.Avg 갱신': 'qP363EgP6qTbKRYq',
}
