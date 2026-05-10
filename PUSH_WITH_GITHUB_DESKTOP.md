# GitHub Desktop으로 푸시하기

## GitHub Desktop 다운로드 및 설정

### 1. 다운로드
https://desktop.github.com

### 2. 설치 및 로그인
1. 다운로드한 파일 실행
2. GitHub 계정으로 로그인
3. Configure Git 화면에서 이름/이메일 확인

### 3. 현재 프로젝트 추가
1. GitHub Desktop 실행
2. **File → Add Local Repository**
3. `/Users/hyomin/Desktop/test/dashboard/dashboard-app` 선택
4. **Add Repository** 클릭

### 4. 푸시
1. 상단에 "Push origin" 버튼 클릭
2. 완료! 🎉

---

## 또는: 터미널에서 Token 사용

```bash
cd /Users/hyomin/Desktop/test/dashboard/dashboard-app

# Token을 URL에 포함
git push https://YOUR_TOKEN@github.com/hyomin/contents-dashboard.git main
```

Token 생성: https://github.com/settings/tokens/new
- repo 체크
- Generate token
- 복사한 토큰을 YOUR_TOKEN 자리에 입력
