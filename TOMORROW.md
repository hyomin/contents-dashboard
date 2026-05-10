# 내일 시작 가이드 (5분 안에 준비 완료)

## ⚡ 빠른 시작

### 1. 터미널 열기 (Cmd + Space → "터미널")

```bash
# 프로젝트 폴더로 이동
cd /Users/hyomin/Desktop/test/dashboard/dashboard-app

# 개발 서버 실행
npm run dev
```

### 2. 브라우저에서 확인
http://localhost:3000

### 3. 코드 에디터 열기
```bash
# VS Code 또는 Cursor로 프로젝트 열기
cursor .
# 또는
code .
```

---

## 🎨 첫 번째 작업: KPI 카드 만들기 (30분)

### Step 1: Supabase에서 데이터 가져오기

`app/dashboard/page.tsx` 파일 생성:

```typescript
import { supabase } from '@/lib/supabase'

export default async function Dashboard() {
  // 전체 비디오 수
  const { count: totalVideos } = await supabase
    .from('videos')
    .select('*', { count: 'exact', head: true })
  
  // 전체 조회수 합계
  const { data: viewsData } = await supabase
    .from('videos')
    .select('views')
  
  const totalViews = viewsData?.reduce((sum, v) => sum + v.views, 0) || 0
  
  // 평균 vs. Avg
  const { data: avgData } = await supabase
    .from('videos')
    .select('vs_avg')
  
  const avgVsAvg = avgData?.reduce((sum, v) => sum + (v.vs_avg || 0), 0) / (avgData?.length || 1)

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold mb-8">Dashboard</h1>
      
      <div className="grid grid-cols-4 gap-6">
        <KpiCard 
          title="Total Videos" 
          value={totalVideos || 0}
          trend="+12.3%"
        />
        <KpiCard 
          title="Total Views" 
          value={totalViews.toLocaleString()}
          trend="+8.5%"
        />
        <KpiCard 
          title="Active Channels" 
          value="5"
          trend="+2"
        />
        <KpiCard 
          title="Avg vs. Avg" 
          value={avgVsAvg.toFixed(1) + "x"}
          trend="+0.3"
        />
      </div>
    </div>
  )
}

function KpiCard({ title, value, trend }: { title: string, value: string | number, trend: string }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow">
      <p className="text-sm text-gray-500">{title}</p>
      <p className="text-3xl font-bold mt-2">{value}</p>
      <p className="text-sm text-green-500 mt-2">{trend}</p>
    </div>
  )
}
```

### Step 2: 라우트 설정

`app/page.tsx` 수정:

```typescript
import { redirect } from 'next/navigation'

export default function Home() {
  redirect('/dashboard')
}
```

---

## 📦 필요한 패키지 설치

내일 첫 작업으로:

```bash
# Shadcn UI 초기화
npx shadcn@latest init

# 필요한 컴포넌트 설치
npx shadcn@latest add card
npx shadcn@latest add table
npx shadcn@latest add badge
npx shadcn@latest add button

# 차트 라이브러리
npm install recharts
```

---

## 🎯 작업 우선순위

1. ✅ **30분**: KPI 카드 4개 (위 코드 참고)
2. ✅ **20분**: 네비게이션 사이드바
3. ✅ **40분**: Videos 테이블 페이지
4. ✅ **1시간**: 차트 추가

---

## 💡 참고할 템플릿

### Shadcn Dashboard Example
https://ui.shadcn.com/examples/dashboard

여기서 코드를 복사해서 수정하면 빠릅니다!

---

## 🔧 트러블슈팅

### 서버가 안 켜지면?
```bash
# Node modules 재설치
rm -rf node_modules package-lock.json
npm install
npm run dev
```

### Supabase 연결 실패?
```bash
# .env.local 파일 확인
cat .env.local

# 환경변수가 맞는지 확인
```

### Git 충돌?
```bash
# 최신 코드 받기
git pull origin main
```

---

## 📞 필요할 때

- Supabase Dashboard: https://supabase.com/dashboard/project/rxmqhkiepfqiaatopunb
- GitHub Repo: https://github.com/hyomin/contents-dashboard
- 가이드 문서: `PROGRESS.md` 참고

---

화이팅! 🚀
