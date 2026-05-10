# GitHub 계정 생성 및 프로젝트 연동 가이드

## 1단계: GitHub 계정 만들기 (5분)

### 1.1 회원가입
1. https://github.com 접속
2. 우측 상단 **"Sign up"** 클릭
3. 정보 입력:
   - **Email**: 본인 이메일 (Gmail 추천)
   - **Password**: 안전한 비밀번호 (최소 15자 또는 8자+숫자+특수문자)
   - **Username**: 원하는 사용자명 (예: `hyomin-dev`, `hyomin2026`)
     - 영문 소문자, 숫자, 하이픈(-) 사용 가능
     - 한번 정하면 변경이 어려우므로 신중하게!

4. **"Continue"** 클릭

### 1.2 이메일 인증
1. 입력한 이메일로 인증 코드 수신
2. 코드 입력하여 인증 완료

### 1.3 개인화 설정 (선택사항)
- 학생/직장인/취미 등 선택
- 관심 분야 선택
- Skip 가능

### 1.4 플랜 선택
- **Free 플랜 선택** ✅ (충분함)
  - 무제한 Public 레포지토리
  - 무제한 Private 레포지토리
  - GitHub Actions 2,000분/월 무료

---

## 2단계: Git 설치 확인

Mac에는 기본적으로 Git이 설치되어 있습니다.

```bash
# Git 버전 확인
git --version

# 설치 안 되어 있다면
xcode-select --install
```

---

## 3단계: Git 초기 설정

```bash
# 사용자 이름 설정 (GitHub 사용자명과 동일하게)
git config --global user.name "YourUsername"

# 이메일 설정 (GitHub 가입 이메일과 동일하게)
git config --global user.email "your-email@example.com"

# 기본 브랜치 이름을 main으로 설정
git config --global init.defaultBranch main

# 설정 확인
git config --list
```

---

## 4단계: GitHub Personal Access Token 생성

### 4.1 왜 필요한가?
- 2021년부터 비밀번호 대신 Token으로 인증
- 더 안전하고 권한 제어 가능

### 4.2 Token 생성 방법
1. GitHub 로그인 후 우측 상단 프로필 아이콘 클릭
2. **Settings** 선택
3. 왼쪽 메뉴 맨 아래 **Developer settings** 클릭
4. **Personal access tokens** → **Tokens (classic)** 선택
5. **Generate new token** → **Generate new token (classic)** 클릭
6. 설정:
   - **Note**: `Dashboard Project` (토큰 용도 메모)
   - **Expiration**: `90 days` (또는 `No expiration`)
   - **Select scopes**: 
     - ✅ `repo` (전체 체크) ← 필수!
     - ✅ `workflow` (GitHub Actions용)
7. **Generate token** 클릭
8. **생성된 토큰 복사** (한 번만 보이므로 안전한 곳에 저장!)
   - 예: `ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`

### 4.3 토큰 안전하게 저장
```bash
# Mac Keychain에 저장 (추천)
git config --global credential.helper osxkeychain
```

---

## 5단계: 현재 프로젝트를 GitHub에 연동

### 5.1 GitHub에서 새 레포지토리 생성
1. GitHub 로그인
2. 우측 상단 **"+"** 클릭 → **New repository**
3. 설정:
   - **Repository name**: `content-dashboard`
   - **Description**: `AI-powered content analysis dashboard`
   - **Visibility**: 
     - **Private** ✅ (추천 - 비공개)
     - Public (공개 가능)
   - **Initialize this repository**: 
     - ❌ 모두 체크 해제! (이미 로컬에 코드 있음)
4. **Create repository** 클릭

### 5.2 로컬 프로젝트를 GitHub에 푸시

생성 완료 후 나오는 명령어 중 **"...or push an existing repository from the command line"** 부분 복사:

```bash
cd /Users/hyomin/Desktop/test/dashboard/dashboard-app

# 원격 레포지토리 추가
git remote add origin https://github.com/YOUR-USERNAME/content-dashboard.git

# 기본 브랜치를 main으로 변경 (이미 main이면 생략)
git branch -M main

# GitHub에 푸시
git push -u origin main
```

**비밀번호 입력 시**: Personal Access Token 입력 (위에서 생성한 토큰)

---

## 6단계: 일상적인 Git 사용법

### 6.1 변경사항 확인
```bash
# 상태 확인
git status

# 변경 내용 확인
git diff
```

### 6.2 변경사항 커밋
```bash
# 모든 변경 파일 추가
git add .

# 특정 파일만 추가
git add app/page.tsx

# 커밋 메시지와 함께 저장
git commit -m "Add Supabase integration"

# GitHub에 푸시
git push
```

### 6.3 자주 사용하는 명령어
```bash
# 이전 커밋 기록 보기
git log --oneline

# 최근 변경사항 되돌리기 (저장 전)
git checkout -- filename

# GitHub에서 최신 코드 받기
git pull

# 브랜치 목록 보기
git branch

# 새 브랜치 만들기
git checkout -b feature/new-feature
```

---

## 7단계: .gitignore 확인

민감한 정보가 GitHub에 올라가지 않도록 확인:

```bash
# .gitignore 파일 확인
cat .gitignore
```

다음 내용이 포함되어 있어야 함:
- `.env*` (환경변수)
- `node_modules/` (패키지)
- `.next/` (빌드 파일)

---

## 8단계: GitHub Desktop (선택사항)

터미널이 불편하다면 GUI 도구 사용:

1. https://desktop.github.com 에서 다운로드
2. GitHub 계정으로 로그인
3. 드래그 앤 드롭으로 간편하게 커밋/푸시

---

## 트러블슈팅

### 문제 1: Permission denied
```bash
# SSH 키 생성 (선택)
ssh-keygen -t ed25519 -C "your-email@example.com"

# SSH 키 복사
cat ~/.ssh/id_ed25519.pub

# GitHub Settings → SSH Keys에서 추가
```

### 문제 2: 이미 git 레포지토리가 있음
```bash
# 기존 .git 폴더 삭제
rm -rf .git

# 새로 초기화
git init
```

### 문제 3: 커밋 실패
```bash
# 사용자 정보 재설정
git config user.name "YourName"
git config user.email "your-email@example.com"
```

---

## 다음 단계

1. ✅ GitHub 계정 생성
2. ✅ Git 설정
3. ✅ Personal Access Token 생성
4. ✅ 레포지토리 생성 및 푸시
5. → Supabase 설정으로 이동

---

## 유용한 링크

- GitHub Docs: https://docs.github.com
- Git 치트시트: https://education.github.com/git-cheat-sheet-education.pdf
- GitHub Student Pack: https://education.github.com/pack (학생이라면 무료 혜택)
