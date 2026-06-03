# 콘텐츠 가이드라인 (편집용)

## 파일

| 파일 | 용도 |
|------|------|
| [`contents_guideline.md`](./contents_guideline.md) | 블로그·숏폼 Agent 프롬프트 원본 (직접 수정) |
| [`platform_shortform_specs.md`](./platform_shortform_specs.md) | **숏폼 최우선** 플랫폼 스펙 (YouTube/Reels/TikTok) |

## 수정 방법

1. `contents_guideline.md`를 에디터로 엽니다.
2. `<!-- agent:섹션명 -->` 주석 **아래 본문**을 수정합니다. 주석 줄 자체는 지우지 마세요.
3. 저장 후 대시보드에서 «내 콘텐츠 생성»을 다시 실행합니다. (**dev 서버 재시작 불필요**)

## 섹션 ID

| ID | Agent에 붙는 시점 |
|----|------------------|
| `common` | 모든 포맷 |
| `blog` | 글쓰기 / blog |
| `blog-image` | 글쓰기 / blog (이미지·표 가이드) |
| `platform-shortform-spec` | 숏폼 시 요약 (상세는 `platform_shortform_specs.md`) |
| `shortform` | 영상 / shortform |
| `shortform-categories` | 숏폼 + 선택한 `category-id` 블록 |

숏폼 생성 결과 **맨 위**에 씬별 Flow 붙여넣기 블록이 고정됩니다. 씬마다 `---` 구간 전체를 Flow에 복사하고, 발행 스크립트에는 Flow 영문이 중복되지 않습니다.

## 설정 (파일 맨 위)

```yaml
---
blog_image_guide_count: 3
---
```

`blog-image` 섹션의 `{{imageGuideCount}}` 자리에 숫자가 들어갑니다.

## 숏폼 카테고리 추가

1. MD에 `### category-id: my-new-id` 블록 추가 (label / description / **flow_hint**)
2. 대시보드 UI에서 «숏폼 카테고리» 직접 추가 시 id가 맞는지 확인
