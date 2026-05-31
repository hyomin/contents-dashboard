# Archive

Agent·Cursor가 생성·수정한 파일의 **타임스탬프 스냅샷** 보관소입니다.  
정본은 `components/`, `lib/`, `app/` 아래 소스이며, 이 폴더는 **참고·롤백용**입니다.

## 구조

```
archive/
└── agent-snapshots/
    └── YYYYMMDDHHMMSS/   # 예: 20260531111541/
        └── (해당 시점에 복사된 파일들)
```

## 규칙

- 새 스냅샷은 **항상** `archive/agent-snapshots/YYYYMMDDHHMMSS/` 에만 둡니다.
- 프로젝트 루트에 `20260*` 폴더를 만들지 않습니다.
- Git에는 커밋하지 않습니다 (`.gitignore`에 `archive/` 포함).

## 정리

오래된 스냅샷은 로컬에서 직접 삭제해도 됩니다. 최근 2~3개만 남겨도 충분한 경우가 많습니다.
