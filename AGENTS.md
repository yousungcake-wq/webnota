# AGENTS.md — WebNota 작업 규약

이 파일은 이 저장소에서 일하는 모든 코딩 에이전트(Claude Code, Leyley 등)와 사람이 매번 먼저 읽는 계약서다.
새 규칙이 생기면 코드보다 이 파일을 먼저 고친다.

## 1. 제품 정의 (바뀌면 여기부터 고친다)

브라우저에서 바로 쓰는 경량 노트 앱. **서버가 없다.**
사용자 데이터는 사용자 자신의 GitHub 비공개 저장소에 들어가고, 앱은 정적 페이지(GitHub Pages)일 뿐이다.

지키는 선:
- 계정·구독·서버 DB를 만들지 않는다. 신원은 GitHub OAuth 하나.
- 오프라인이 기본값이다. 네트워크는 동기화에만 쓴다.
- 데이터는 사용자 소유여야 한다. 해석 불가능한 형식만 저장하는 변경은 반려한다(§5 참고).

## 2. 명령

```bash
npm ci                    # 최초 1회
npm run dev               # 개발 서버
npm test                  # vitest (동기화 엔진 단위 테스트) — 커밋 전 필수
npm run typecheck         # tsc -b
npm run build             # 프로덕션 빌드
npx vite preview --port 4173
NODE_PATH=$(npm root -g) node tests/e2e.mjs http://localhost:4173/    # Playwright 스모크
cd worker && npx wrangler dev --local    # OAuth worker (선택)
```

CI(`.github/workflows/deploy.yml`)는 `npm test` → `npm run build`가 통과해야만 배포한다.
**테스트를 느슨하게 만들어 통과시키지 않는다.** 실패하는 테스트는 코드 버그로 취급한다.

## 3. 구조

```
src/store/    Y.Doc + IndexedDB 영속화, 페이지 트리 조작 (순수 함수 위주)
src/sync/     Git Data API 동기화 엔진 — 이 저장소의 핵심 자산
src/auth/     OAuth(Worker 경유) / PAT
src/editor/   Tiptap 블록, 슬래시 메뉴, 모바일 키보드 툴바
src/ui/       라우팅, 사이드바, 페이지 화면, 모바일 탭
worker/       Cloudflare Worker: code → token 교환만 담당 (토큰 저장 금지)
```

데이터 레이아웃(원격): `data/workspace.yjs` (페이지 트리·메타), `data/pages/<id>.yjs` (본문).
**레이아웃 변경은 파괴적 변경이다.** §5를 먼저 읽는다.

## 4. 동기화 엔진 불변식 (깨면 데이터 손실이다)

`src/sync/engine.ts`의 6단계 루프와 아래 성질은 테스트로 잠겨 있다. 하나라도 깨면 머지 금지.

1. 원격 → 로컬 병합은 항상 `Y.applyUpdate(doc, bytes, REMOTE_ORIGIN)`으로만. 원격 적용이 dirty를 만들면 안 된다.
2. dirty는 **세대 번호**로 관리한다. 동기화 중에 들어온 편집을 clear하지 않는다(`clearDirty(name, gen)` 계약 유지).
3. 삭제된 페이지의 원격 파일은 지우고, 낡은 기기가 그 페이지를 편집해도 **부활시키지 않는다**.
4. ref 갱신이 거부되면(422) 처음부터 다시. 강제 push(`force: true`) 금지.
5. 원격 head 트리 전체를 매번 신뢰한다. "내가 아는 파일 목록"을 캐시해 덮어쓰지 않는다.
6. 쓰기는 read-modify-write. 오래된 스냅샷을 원격에 덮어쓰는 코드는 반려한다.

실제 GitHub을 상대로 검증하려면 임시 비공개 저장소를 만들고 `syncOnce`를 두 기기(별도 `LocalStore`)로 돌린 뒤 저장소를 지운다.
공개 저장소·실사용 데이터로 실험하지 않는다.

## 5. 데이터 형식 변경 (가장 비싼 실수)

`.yjs`는 정본이고 사용자 레포에 이미 들어가 있다. 형식을 바꿀 때는:

- `data/version` 파일(정수)과 마이그레이션 함수를 함께 넣는다. 마이그레이션 없이 스키마를 바꾸지 않는다.
- 마이그레이션은 **되돌릴 수 있게** 쓴다. 이전 앱 버전이 새 데이터를 읽고 저장하면 데이터가 깨진다.
- 사람이 읽을 수 있는 미러(`data/pages/<id>.md`)를 추가할 때는 **쓰기 전용**으로 시작한다. 미러를 정본으로 승격하는 건 별도 결정이다.

## 6. 리뷰 계약

- PR은 한 번에 한 가지. 400줄을 넘으면 쪼갠다. 리뷰가 형식적이 되는 순간 유지보수가 죽는다.
- PR 본문에 (a) 무엇을 (b) 왜 (c) 어떻게 검증했는지 적는다. "테스트 통과"만으로는 부족하고, 손으로 확인한 경로를 적는다.
- 새 기능에는 최소 1개의 테스트. 버그 수정에는 그 버그를 재현하는 테스트.
- UI 변경은 375px(폰)과 1280px(데스크탑) 스크린샷을 남긴다.
- 커밋 메시지: `feat|fix|chore|docs|refactor: 한국어 요약` (예: `fix: 두 탭이 서로의 편집을 못 보는 문제`).

## 7. 하지 않는 것

- 데이터베이스 뷰(Grid/Board/Calendar)를 "곧" 붙이지 않는다. 붙일 거면 설계 문서를 먼저 쓰고 별도 브랜치에서 몇 주 단위로 한다.
- 실시간 공동편집(WebSocket relay)을 넣지 않는다. 서버 0 원칙이 깨진다.
- `repo` 전체 권한을 요구하는 OAuth를 기본값으로 두지 않는다(GitHub App + device flow가 목표).
- 사용자 데이터를 분석·전송하는 코드, 텔레메트리, 외부 CDN 스크립트.
- 라이브러리 메이저 업그레이드와 기능 개발을 한 PR에 섞지 않는다.

## 8. 자주 물리는 함정

- `minis://`·정적 배포 캐시: HTML만 새로 읽고 JS/CSS는 캐시된다. 확인은 항상 하드 리로드로.
- `y-indexeddb@9`에는 BroadcastChannel이 없다 → **탭 간 실시간 동기화는 앱이 직접 구현해야 한다.**
- localStorage의 `webnota:dirty`는 탭끼리 공유된다. `storage` 이벤트 없이 쓰면 다른 탭의 dirty를 날린다.
- Pages 빌드 캐시: `VITE_*` 변수는 빌드 타임에 박힌다. 변수만 바꾸고 재배포를 안 하면 아무 일도 안 일어난다.
- `getTree`는 recursive 1회 호출이다. 페이지가 수천 개가 되면 응답이 커진다(truncated 경고 로그 확인).
