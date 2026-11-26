# 진행 상태 (세션 인계 문서)

> 새 세션은 이 파일부터 읽으세요. 작업 단위가 끝날 때마다 갱신합니다.

## 현재 위치

- **마일스톤**: M0 기반 정비
- **진행 상황**: M0 26개 중 17개 완료 (M0-01~17: 도구·품질 게이트, 구조 이전, useY/createStore, 토큰 CSS, i18n, ui 컴포넌트, useLayout, ErrorBoundary, 기능 플래그, 스키마 게이트, 마이그레이션 v2, 동기화 경로 v2)
- **진행 중 항목**: (없음)
- **다음 할 일**: M0-18 IndexedDB 이름 공간 `wn:<wsId>:` (SY-05 대비). `meta.id`(워크스페이스 ID)가 아직 없으므로 생성 규칙부터 정할 것 (기기마다 다른 ID가 생기지 않게 — 저장소 연결 전 로컬 ID와 원격 병합 시 LWW 문제). 이름 변경은 M0-16의 `core/docs/legacy.ts` 복사 방식 재사용 가능.
- **CI**: https://github.com/yousungcake-wq/webnota/actions (main 푸시 시 verify + e2e + 배포)
- **배포 주소**: https://yousungcake-wq.github.io/webnota/
- **저장소**: https://github.com/yousungcake-wq/webnota

## 완료된 것 (요약)

- PoC (v0.1.0): Tiptap 에디터, 슬래시 메뉴, 모바일 키보드 도구 모음, 페이지 트리, 즐겨찾기, 휴지통, 검색(제목), 테마, IndexedDB, GitHub 동기화 엔진(테스트 6개), Cloudflare Worker(토큰 교환), Pages 배포
- 기획서 (`docs/spec/00~12`), 로드맵, 체크리스트

## 알려진 문제·주의

- 구조 (M0-07): 다른 최상위 모듈은 `@/` 경로로 import (lint 강제). feature 공개 API는 `index.ts`만. 에디터는 `@/features/editor`의 `loadEditor()`/`loadSeed()`로만 접근 (정적 import 금지 — 초기 번들에 섞임). 라우터는 `core/store/router.ts`, 테마·펼침 상태는 `core/store/prefs.ts` (DECISIONS 012).
- 상태 구독: Yjs는 `useY(doc, 고정 셀렉터, 비교 함수)`, 그 외는 `createStore` + `useStore`. 새 리스너 Set을 직접 만들지 말 것.
- 스타일: 색은 `styles/tokens.css`에만 (테스트 강제). 기능 CSS는 그 기능 컴포넌트에서 import. 간격·반경 px는 아직 토큰으로 바꾸지 않음 (화면을 고칠 때 점진적으로).
- CSS 리팩터링 시 회귀 확인: 스크래치 스크립트로 `vite preview` 화면 19장을 찍어 바이트 비교했음 (데스크탑·Pixel 7·iPhone 14·iPad, 라이트·다크). 필요하면 `tests/perf`나 e2e 스크린샷 테스트로 정식화 검토.
- i18n: 문자열은 `t('key')`, 키는 `core/i18n/ko.ts`에 먼저 추가 후 `en.ts`. 사전은 부팅 시 `initI18n()`이 현재 언어 것만 로드하므로 **모듈 최상위에서 `t()` 호출 금지** (지연 청크 안은 괜찮음, 예: editor/blocks.ts). e2e는 `locale: 'ko-KR'` 고정, 영어는 `desktop.i18n.spec.ts`.
- ui (M0-11): `@/ui` index에서 import. 오버레이는 레이어 스택(`ui/overlay/stack.ts`)에 등록되고, 시트·대화상자는 history 항목을 씀 → **오버레이를 닫은 직후 `history.back()`/`location.hash`를 직접 건드리지 말고 router의 `navigate`/`goBack`을 쓸 것** (정리 대기). `confirm()`/`alert()` 금지 → `confirmDialog()`/`toast()`. 아이콘 버튼은 `IconButton`(label 필수).
- 번들: 초기 118.0KB / 125KB (M0-15 게이트 +1KB, M0-16 fractional-indexing·마이그레이션 v2 +2.8KB). 남은 여유 7KB — 새 기능은 지연 로드 필수. 더 줄여야 하면 마이그레이션 `up`을 지연 로드하는 방안(게이트의 버전 판단은 동기 유지).
- 레이아웃 분기는 `useLayout()`(`@/platform/layout`)만 사용. 태블릿은 아직 데스크탑 셸 (드로어는 M1-12).
- 오류 처리: 새 화면/지연 로드 영역은 `ErrorBoundary`로 감싸고 key로 리셋. QA 플래그 `webnota:debug` (docs/QA.md).
- 미완성 기능은 `core/flags.ts`의 `FLAGS`에 `kind: 'feature'`로 추가하고 `useFlag`/`isEnabled`로 가림. 완성 시 플래그 제거.
- `core/persistence`는 아직 없음. IndexedDB는 `core/docs/registry.ts`가 y-indexeddb를 직접 씀 → M0-18에서 분리.
- 스키마 (M0-15, spec/02 §6 구현 규칙): `SCHEMA_VERSION`은 `core/schema/version.ts`. 새 마이그레이션은 `core/schema/migrations/NNN-name.ts` + 테스트, `MIGRATIONS`에 등록하고 `SCHEMA_VERSION`을 올림. 마이그레이션은 `core/model`을 쓰지 말고 raw Y 코드로, 결정적·멱등(고정 ID). 부팅 순서: `initWorkspace` → `initSchema` → `seedIfEmpty`(읽기 전용이면 생략). 모델 변경 함수에는 `assertWritable()`를 넣음 (`core/model/guard.ts`).
- 데이터 모델 v2 (M0-16): workspace는 `views`/`spaces`/`users`. UI용 `PageMeta`(`core/model/pages.ts`)는 그대로지만 `order`는 FracKey 문자열, 스페이스가 부모면 `parentId: null`, `icon`은 이모지 값. 현재 사용자는 `getCurrentUser()`=`local` (DECISIONS 015). v1 `pages`는 **동결 사본으로 남아 있음 — 지우지 말 것** (구버전 앱이 원격 파일을 지움). 영구 삭제 시 `pages` 항목도 함께 지움.
- 동기화 경로 v2 (M0-17): `doc/<id>` ↔ `data/docs/<id>.yjs`, DB 경로 매핑도 있음(엔진은 아직 DB 파일을 지우지 않음). 구 `data/pages/` 파일은 첫 동기화에서 이동·삭제 — 구버전 앱은 이후 본문을 못 받음 (사용자 결정).

- 실제 GitHub API로 동기화를 검증하지 못함 (작업 환경 프록시 제한). 사용자 확인 필요.
- 실기기 한글 IME 미검증 (에뮬레이션 CDP 테스트만 통과).
- Tiptap DragHandle/EditorContent가 DOM을 직접 옮겨서 React 재조정이 어긋난 적이 있음 → `page-body`를 `key={id}`로 감싸서 해결. 에디터 주변 구조를 바꿀 때 주의.
- 작업 환경에서는 `*.github.io`에 접속할 수 없어 배포본 e2e를 돌릴 수 없음. 로컬 `npm run e2e` (vite preview)로 테스트.
- 첫 실행 시 환영 페이지 시드가 에디터 청크를 기다려서 에디터 표시까지 약 1초 (재방문은 빠름). M0-25 성능 기준선에서 측정·개선 검토.
- React Compiler 린트 규칙(react-hooks 7)이 수동 메모이제이션을 엄격하게 검사함. 간단한 계산은 useMemo 없이 `core` 순수 함수로.
- 작업 환경의 `gh`는 이 저장소 범위 API만 허용됨 (Pages 설정 API 등은 불가).

## 작업 기록

| 날짜 | 세션 요약 | 커밋 |
|---|---|---|
| 2026-11-26 | PoC 구현, 타당성 검증, 배포 | 9f8e405 |
| 2026-11-26 | 기획서·로드맵·체크리스트·인계 체계 작성 | d301cee |
| 2026-11-26 | M0-01~06: 린트·타입·번들 예산(에디터 지연 로드로 초기 269→110KB)·verify·CI·Playwright Test | 615ec5c, 3396cb1 |
| 2026-11-26 | M0-07: 구조 이전 (core/features/ui/platform/app), `@/` 별칭, 경계 lint 강화 | d1f4ea1 |
| 2026-11-26 | M0-08: useY(selectY) + createStore/useStore, usePages·동기화·테마·펼침·라우터 이전 | 083bdf8 |
| 2026-11-26 | M0-09: tokens.css(spec/12 전체) + CSS 13개 파일 분리, 색 토큰화, 스타일 가드 테스트 | 262d388 |
| 2026-11-26 | M0-10: i18n (t/tParts, ko/en 사전 지연 로드, 언어 감지·설정, 문자열 165개 이전, 가드 테스트) | b1f2a1e |
| 2026-11-26 | M0-11: 오버레이 스택(뒤로 가기·Esc·포커스 트랩), Popover/Sheet/Dialog/confirm/toast/툴팁, Menu 확장, 기본 컨트롤, 마크업 교체 | f94a195, 252555f |
| 2026-11-26 | M0-12: useLayout (phone/tablet/desktop + isTouch), useMedia 대체 | e1b0aef |
| 2026-11-26 | M0-13: ErrorBoundary(앱·사이드바·본문·에디터) + 전역 오류 토스트, QA 디버그 플래그 | 7962653 |
| 2026-11-26 | M0-14: 기능 플래그 레지스트리 + 설정 → 고급(디버그 로그) | f29e395 |
| 2026-11-26 | M0-15: 스키마 버전·마이그레이션 레지스트리(원자적 단계)·읽기 전용 게이트(배너, 에디터 잠금, push 차단), QA 플래그 schema-newer | 68fa08a |
| 2026-11-26 | M0-16: 마이그레이션 v2(pages→views·FracKey·사용자별 즐겨찾기·기본 스페이스, leftover 재변환, v1 pages 동결 유지), 모델 재작성, IndexedDB page/→doc/ 복사, QA 플래그 seed-v1 + e2e | e71fe99 |
| 2026-11-26 | M0-17: 동기화 경로 v2(data/docs, data/dbs 매핑), 구 data/pages 파일 병합 후 같은 커밋에서 이동·삭제 | 087a184 |
