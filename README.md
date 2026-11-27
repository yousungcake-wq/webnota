# WebNota

설치 없이 브라우저에서 쓰는 빠른 노트 웹앱입니다. GitHub Pages에서 무료로 호스팅되고, 노트는 **각 사용자의 GitHub 비공개 저장소**에 동기화됩니다.

- **로컬 우선**: 모든 편집은 즉시 IndexedDB에 저장되고 오프라인에서도 동작합니다.
- **GitHub 동기화**: 변경 사항을 모아 커밋 1개로 푸시합니다. 여러 기기에서 동시에 수정해도 Yjs(CRDT)로 자동 병합됩니다.
- **모든 기기 지원**: 데스크탑, 태블릿, Android, iOS. 홈 화면에 추가하면(PWA) 앱처럼 동작합니다.

## 개발 문서

- 기획서: [docs/spec](docs/spec/00-overview.md)
- 로드맵: [docs/ROADMAP.md](docs/ROADMAP.md) · 체크리스트: [docs/CHECKLIST.md](docs/CHECKLIST.md) · 진행 상태: [docs/STATUS.md](docs/STATUS.md)
- AI 개발 가이드: [CLAUDE.md](CLAUDE.md)

## 구조

```
src/
  app/        앱 셸: 부트(main.tsx), 라우트 → 화면 매핑(App.tsx)
  core/       React를 모르는 로직 (docs, model, sync, auth) + React 바인딩(store)
  features/   기능별 화면 (editor, page, sidebar, home, search, favorites, trash, settings, sync)
  ui/         디자인 시스템 컴포넌트 (Menu, ViewHeader …)
  platform/   브라우저 기능 래퍼 (미디어 쿼리 …)
  styles/     CSS
worker/       Cloudflare Worker: OAuth code → token 교환 (무료 플랜)
tests/e2e/    Playwright Test (데스크탑, Android, iPhone 에뮬레이션)
```

모듈 경계는 [spec/01 §3](docs/spec/01-architecture.md)과 `eslint.config.js`에 있습니다. 다른 최상위 모듈은 `@/` 경로로 import합니다.

GitHub 저장소 안의 데이터 구조:

```
data/workspace.yjs        페이지 트리와 메타데이터
data/pages/<id>.yjs       각 페이지 본문
```

## 개발

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # 동기화 엔진 단위 테스트
npm run build && npx vite preview --port 4173
NODE_PATH=$(npm root -g) node tests/e2e.mjs http://localhost:4173/
```

## 배포

### 1. GitHub Pages

1. 이 저장소를 GitHub에 푸시합니다.
2. Settings → Pages → Source를 **GitHub Actions**로 설정합니다.
3. `main`에 푸시할 때마다 `.github/workflows/ci.yml`이 테스트, 빌드, 배포를 실행합니다.

여기까지만 해도 앱은 동작합니다. 사용자는 설정 화면에서 **개인 액세스 토큰**으로 GitHub를 연결할 수 있습니다.

### 2. "GitHub로 로그인" 버튼 켜기 (선택, 브라우저만으로)

Worker(Cloudflare 무료)는 GitHub Actions가 자동으로 배포합니다. 터미널은 필요 없습니다.

1. **GitHub OAuth App 만들기**: GitHub → Settings → Developer settings → OAuth Apps → New OAuth App
   - Application name: `WebNota`
   - Homepage URL과 Authorization callback URL: `https://<아이디>.github.io/<저장소>/` (끝의 `/` 포함)
   - 만든 뒤 **Client ID**를 복사하고, **Generate a new client secret**으로 비밀 값을 만들어 복사합니다 (다시 볼 수 없음).
2. **Cloudflare 준비**: dash.cloudflare.com
   - 왼쪽 메뉴 **Workers & Pages**를 한 번 엽니다 (처음이면 `workers.dev` 하위 도메인을 정하라고 나오면 정합니다).
   - **Account ID** 복사: Workers & Pages 화면 오른쪽, 또는 계정 홈의 계정 이름 옆 메뉴 → Copy account ID.
   - **API 토큰**: 오른쪽 위 프로필 → My Profile → API Tokens → Create Token → **Edit Cloudflare Workers** 템플릿 → Continue → Create → 토큰 복사.
3. **이 저장소에 넣기**: Settings → Secrets and variables → Actions
   - **Secrets** 탭(New repository secret): `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `WEBNOTA_GITHUB_CLIENT_SECRET`
   - **Variables** 탭(New repository variable): `WEBNOTA_GITHUB_CLIENT_ID`
4. **Actions → CI & Deploy → Run workflow**(main). `worker` 작업이 Worker를 배포하고, 실행 요약(Summary)에 Worker 주소(`https://webnota-auth.<하위 도메인>.workers.dev`)를 보여줍니다.
5. 그 주소를 **Variables**에 `WEBNOTA_AUTH_PROXY_URL`로 추가하고, **Run workflow**를 한 번 더 실행합니다. 이제 설정 화면에 "GitHub로 로그인" 버튼이 나옵니다.

Worker 허용 출처(`ALLOWED_ORIGINS`)는 `https://<아이디>.github.io`와 `http://localhost:5173`로 자동 설정됩니다. 같은 Worker가 링크 미리보기(`/unfurl`)도 처리합니다.

## 알려진 제한 (PoC)

- OAuth App은 `repo` 권한이 필요합니다. 추후 저장소 하나만 허용하는 GitHub App 방식으로 바꿀 예정입니다.
- 실시간 공동편집, 리마인더 푸시는 아직 없습니다. Worker(Durable Objects, Cron)로 추가할 예정입니다.
- 데이터베이스 보기(Grid, Board, Calendar)는 다음 단계입니다.
