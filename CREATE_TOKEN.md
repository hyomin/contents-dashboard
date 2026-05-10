# Personal Access Token 생성 가이드 (3분)

## 왜 필요한가?

Private 레포지토리를 클론하려면 Token이 필요합니다.
비밀번호는 더 이상 사용되지 않습니다.

---

## Token 생성 단계

### 1. GitHub Settings 이동
1. GitHub 로그인
2. 우측 상단 프로필 아이콘 클릭
3. **Settings** 선택

### 2. Developer settings
1. 왼쪽 메뉴 **맨 아래** 스크롤
2. **Developer settings** 클릭

### 3. Personal access tokens
1. **Personal access tokens** 클릭
2. **Tokens (classic)** 선택
3. **Generate new token** 버튼
4. **Generate new token (classic)** 선택

### 4. Token 설정
- **Note**: `Contents Dashboard Clone` (용도 메모)
- **Expiration**: `90 days` 선택
- **Select scopes**:
  - ✅ **repo** (전체 체크박스 클릭) ← 필수!

### 5. Token 생성
1. 맨 아래 **Generate token** 클릭
2. **생성된 Token 복사**
   - `ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx` 형태
   - ⚠️ 한 번만 보이므로 반드시 복사!

---

## Token 사용법

### 방법 1: URL에 포함
```bash
git clone https://ghp_YOUR_TOKEN@github.com/hyomin/contents-dashboard.git
```

### 방법 2: 클론 시 Username/Password 입력
```bash
git clone https://github.com/hyomin/contents-dashboard.git
# Username: hyomin
# Password: ghp_YOUR_TOKEN (복사한 토큰 붙여넣기)
```

### 방법 3: Keychain에 저장 (Mac)
```bash
# 클론 시도
git clone https://github.com/hyomin/contents-dashboard.git

# Username 입력: hyomin
# Password 입력: ghp_YOUR_TOKEN

# 자동으로 Keychain에 저장됨
```

---

## 빠른 링크

Token 생성 페이지 직접 이동:
https://github.com/settings/tokens/new

필요한 권한: **repo** 만 체크!

---

## 트러블슈팅

### Token이 작동하지 않음
- Expiration이 만료되지 않았는지 확인
- `repo` 권한이 체크되어 있는지 확인
- Token을 정확히 복사했는지 확인 (공백 없이)

### Token을 잃어버림
- 새로 생성하세요 (이전 것 삭제하고)
- Settings → Developer settings → Tokens → Delete old token
