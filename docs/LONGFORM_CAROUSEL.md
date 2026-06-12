# 롱폼 · 캐러셀 파이프라인 현황

**갱신:** 2026-06-12  
**대상:** `dashboard-app/`

---

## 숏폼 (기준선)

```
Outlier·레퍼런스 → script-guide → n8n W08(Gemini)
  → flowPasteBlock(Google Flow) + fullContent
  → polish → Supabase 히스토리 → 발행 편집·발행 확장
```

**완성 상태.** 수집(cron) → 생성 → 저장 → 재사용 연결됨.

- 숏폼 영상 생성: **Google AI Pro · Google Flow (Veo)** — Higgsfield 아님 (`guidelines/contents_guideline.md`)
- `flowPasteBlock`: Flow에 붙여넣는 영문 프롬프트 — 수동 복붙 단계 (어떤 영상 툴든 자동 API 연동 없음)

---

## 롱폼

| 항목 | 상태 |
|------|------|
| 타입·intent `longform_video` | ✅ |
| n8n 페이로드 `durationMinutes: 8` | ✅ |
| UI 롱폼 선택·롱폼 vs.Avg 토글 | ✅ (2026-06) |
| 챕터 마커 생성 | ✅ (프롬프트·마이그레이션 14) |
| `vs_avg_longform` DB 컬럼 | ⚠️ 마이그레이션 14 — **Supabase 적용 확인 필요** |
| W08 롱폼 전용 프롬프트 분기 | ⚠️ 숏폼과 공유 |
| YouTube Analytics (평균 시청시간) | ❌ Data API v3만 |

**선행 작업:** `14-longform-carousel-metrics.sql` Supabase 적용 → 롱폼 Outlier 기준선 정합성 확인

---

## 캐러셀 (Instagram)

| 항목 | 상태 |
|------|------|
| 타입·intent `carousel` | ✅ |
| `CAROUSEL_RULES` 프롬프트 | ✅ |
| `content-generate` carousel 분기 | ✅ |
| n8n 캐러셀 전용 워크플로 | ❌ |
| Instagram 캐러셀 수집·도달 | ❌ (Business 계정 필수) |
| 슬라이드 이미지 자동 생성 | ❌ |

**현실적 다음 단계:** Gemini로 슬라이드 텍스트·배경 키워드 생성 → Canva 수동 적용 (Higgsfield/이미지 API 없이 가능)

---

## 영상 생성 도구 비교 (2026)

| 도구 | 자동화 | 비고 |
|------|--------|------|
| **Google Flow (Veo)** | 수동 복붙 | 가이드라인 기본. Google AI Pro 구독 |
| Higgsfield | ❌ API 베타 제한 | 결제해도 n8n 연동 불가 |
| Runway / Kling / Pika | ✅ 공개 API | n8n 파이프라인 확장 시 대안 |

**권장:** Flow로 샘플 1편 먼저 → 품질 부족 시에만 다른 툴 비교 검토

---

## 관련 파일

| 파일 | 역할 |
|------|------|
| `lib/dashboard/content-creation-guide.ts` | intent·포맷 타입 |
| `lib/dashboard/direct-publish-generate.ts` | CAROUSEL_RULES |
| `lib/dashboard/gemini-flow-paste.ts` | Flow 붙여넣기 블록 |
| `docs/migrations/14-longform-carousel-metrics.sql` | 롱폼 메트릭 |
| `docs/migrations/15-channel-content-style.sql` | 채널 콘텐츠 스타일 |
