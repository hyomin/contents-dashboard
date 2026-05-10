# Supabase 설정 가이드

## 1. Supabase 프로젝트 생성

1. https://supabase.com 접속
2. "Start your project" 클릭
3. 프로젝트 생성:
   - Name: `content-dashboard`
   - Database Password: 안전한 비밀번호 설정
   - Region: `Northeast Asia (Seoul)` 선택 ✅

## 2. 연결 정보 가져오기

프로젝트 생성 후:
1. Settings → API 메뉴
2. 다음 정보 복사:
   - `Project URL`
   - `anon public` API Key
   - `service_role` API Key (서버용)

## 3. 환경변수 설정

`.env.local` 파일에 추가:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# 기존 DATABASE_URL은 삭제 가능
# DATABASE_URL="postgresql://..."
```

## 4. 테이블 생성 (SQL Editor)

Supabase Dashboard → SQL Editor에서 실행:

```sql
-- Users 테이블
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Videos 테이블 (YouTube 분석용)
CREATE TABLE videos (
  id SERIAL PRIMARY KEY,
  platform TEXT NOT NULL, -- 'youtube', 'instagram', 'tiktok'
  video_id TEXT UNIQUE NOT NULL,
  channel_name TEXT,
  title TEXT NOT NULL,
  thumbnail_url TEXT,
  views INTEGER DEFAULT 0,
  likes INTEGER DEFAULT 0,
  comments INTEGER DEFAULT 0,
  duration INTEGER, -- 초 단위
  published_at TIMESTAMPTZ,
  avg_views INTEGER, -- 채널 평균 조회수
  vs_avg DECIMAL, -- 평균 대비 배율 (outlier 지표)
  tier TEXT, -- 'S', 'A', 'B', 'C'
  score INTEGER, -- 0-100
  scraped_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 채널 정보 테이블
CREATE TABLE channels (
  id SERIAL PRIMARY KEY,
  platform TEXT NOT NULL,
  channel_id TEXT UNIQUE NOT NULL,
  channel_name TEXT NOT NULL,
  subscriber_count INTEGER,
  total_videos INTEGER,
  avg_views INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 인덱스 추가 (성능 최적화)
CREATE INDEX idx_videos_platform ON videos(platform);
CREATE INDEX idx_videos_vs_avg ON videos(vs_avg DESC);
CREATE INDEX idx_videos_published_at ON videos(published_at DESC);
```

## 5. n8n에서 Supabase 연동

n8n 워크플로우:
1. Apify 노드로 데이터 스크래핑
2. Supabase 노드로 `videos` 테이블에 INSERT
3. Function 노드로 `vs_avg` 계산

## 6. Next.js에서 Supabase 사용

```typescript
// lib/supabase.ts
import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// Server Component에서 사용
// app/dashboard/page.tsx
import { supabase } from '@/lib/supabase'

export default async function Dashboard() {
  const { data: videos } = await supabase
    .from('videos')
    .select('*')
    .order('vs_avg', { ascending: false })
    .limit(20)
  
  return <VideoTable videos={videos} />
}
```

## 7. DBeaver 연결 (선택사항)

Settings → Database → Connection Info에서:
- Host: `db.xxx.supabase.co`
- Port: `5432`
- Database: `postgres`
- User: `postgres`
- Password: 프로젝트 생성 시 설정한 비밀번호

## 무료 플랜 제한

- Database: 500MB (충분함)
- API Requests: 무제한
- Realtime: 200 동시 연결
- Storage: 1GB
- Auth Users: 50,000명

## 로컬 PostgreSQL은?

- 학습/테스트용으로만 사용
- 실제 프로젝트는 Supabase 사용
- 로컬 DB는 필요 시 삭제 가능:
  ```bash
  brew services stop postgresql@16
  ```
