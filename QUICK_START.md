# 빠른 시작 가이드

## 현재 상태 ✅

- ✅ Git 설정 완료
  - 사용자: `hyomin0712`
  - 이메일: `rlaytm@Naver.com`
- ✅ Next.js 프로젝트 생성
- ✅ PostgreSQL 로컬 설치
- ✅ Supabase 준비 완료
- ⏳ GitHub 레포지토리 연동 대기

---

## 지금 해야 할 일 (10분)

### 1. GitHub 계정 확인/생성 (3분)

이미 GitHub 계정이 있다면 **2단계로 이동**

없다면:
1. https://github.com 접속
2. Sign up 클릭
3. 이메일/비밀번호/사용자명 입력
4. 이메일 인증

**자세한 내용**: `SETUP_GITHUB.md` 참고

---

### 2. Personal Access Token 생성 (2분)

1. GitHub 로그인
2. 우측 상단 프로필 → **Settings**
3. 왼쪽 맨 아래 **Developer settings**
4. **Personal access tokens** → **Tokens (classic)**
5. **Generate new token (classic)** 클릭
6. 설정:
   - Note: `Dashboard Project`
   - Expiration: `90 days`
   - Scopes: ✅ **repo** (전체 체크)
7. **Generate token** 클릭
8. **토큰 복사** (ghp_xxxxx...) → 안전한 곳에 저장!

---

### 3. GitHub 레포지토리 생성 (2분)

1. GitHub 우측 상단 **"+"** → **New repository**
2. 설정:
   - Repository name: `content-dashboard`
   - Description: `AI-powered content analysis dashboard`
   - **Private** ✅ (비공개 추천)
   - **아무것도 체크하지 않기!** (README, .gitignore 등)
3. **Create repository** 클릭
4. 생성 완료 후 **나오는 페이지 그대로 두기**

---

### 4. 로컬 프로젝트를 GitHub에 푸시 (3분)

터미널에서 다음 명령어 실행:

```bash
cd /Users/hyomin/Desktop/test/dashboard/dashboard-app

# 변경사항 확인
git status

# 모든 변경사항 추가
git add .

# 커밋
git commit -m "Initial commit: Next.js + Supabase setup"

# GitHub 레포지토리 연결 (YOUR-USERNAME을 본인 GitHub 사용자명으로 변경!)
git remote add origin https://github.com/YOUR-USERNAME/content-dashboard.git

# 푸시
git push -u origin main
```

**비밀번호 입력 창이 뜨면**: Personal Access Token 붙여넣기

---

## 다음 단계: Supabase 설정

GitHub 연동이 완료되면:

1. https://supabase.com 에서 프로젝트 생성
2. `.env.local` 파일에 URL/Key 입력
3. 개발 서버 재시작
4. http://localhost:3000 에서 테스트

**자세한 내용**: `SETUP_SUPABASE.md` 참고

---

## 일상적인 작업 흐름

### 코드 변경 후 저장:
```bash
git add .
git commit -m "Add new feature"
git push
```

### GitHub에서 코드 보기:
https://github.com/YOUR-USERNAME/content-dashboard

---

## 도움이 필요하면

- GitHub 가이드: `SETUP_GITHUB.md`
- Supabase 가이드: `SETUP_SUPABASE.md`
- Git 명령어 모음: `SETUP_GITHUB.md` 6단계 참고
