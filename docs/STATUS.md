# 진행 상태 (세션 인계 문서)

> 새 세션은 이 파일부터 읽으세요. 작업 단위가 끝날 때마다 갱신합니다.

## 현재 위치

- **마일스톤**: M1 워크스페이스와 탐색 (M0 완료, 실기기 확인은 사용자 선택)
- **진행 상황**: M0 26개 모두 완료 (M0-01~26: 도구·품질 게이트, 구조 이전, useY/createStore, 토큰 CSS, i18n, ui 컴포넌트, useLayout, ErrorBoundary, 기능 플래그, 스키마 게이트, 마이그레이션 v2, 동기화 경로 v2, IndexedDB 이름 공간, 문서 LRU, 모르는 노드 보존, 동기화 스케줄, ETag, 탭 리더, 동기화 로그, PWA 아이콘, 회귀 e2e·성능 기준선)
- **진행 중 항목**: (없음)
- **다음 할 일**: M1-17 라우팅 v2 (#/w/:ws/v/:id) + 구 경로 리디렉션
- **CI**: https://github.com/yousungcake-wq/webnota/actions (main 푸시 시 verify + e2e + 배포)
- **배포 주소**: https://yousungcake-wq.github.io/webnota/
- **저장소**: https://github.com/yousungcake-wq/webnota

## 완료된 것 (요약)

- PoC (v0.1.0): Tiptap 에디터, 슬래시 메뉴, 모바일 키보드 도구 모음, 페이지 트리, 즐겨찾기, 휴지통, 검색(제목), 테마, IndexedDB, GitHub 동기화 엔진(테스트 6개), Cloudflare Worker(토큰 교환), Pages 배포
- 기획서 (`docs/spec/00~12`), 로드맵, 체크리스트

## 알려진 문제·주의

- 구조 (M0-07): 다른 최상위 모듈은 `@/` 경로로 import (lint 강제). feature 공개 API는 `index.ts`만. 에디터는 `@/features/editor`의 `loadEditor()`/`loadSeed()`로만 접근 (정적 import 금지 — 초기 번들에 섞임). 라우터는 `core/store/router.ts`, 테마·펼침 상태는 `core/store/prefs.ts` (DECISIONS 012).
- 문서 수명 (M0-19): `openDoc`으로 연 문서는 LRU로 언로드될 수 있음 (최대 30개, 최근 10초 사용분은 보호). **비동기 작업 동안 문서를 붙잡고 있어야 하면 `retainDoc(name)`을 호출하고 끝나면 release** (PageView·동기화·복제가 그렇게 함). 언로드된 문서 객체에 쓰면 IndexedDB에 저장되지 않음.
- 에디터 (M0-20): `editorExtensions(doc, { onInvalidContent })` — Collaboration의 `ySyncOptions.onInvalidContent`를 **절대 빼지 말 것** (빼면 y-tiptap이 모르는 노드를 Y에서 삭제). 모르는 내용이 있으면 그 페이지만 읽기 전용 + 안내.
- 동기화 스케줄 (M0-21): 동기화는 `core/sync/controller.ts`의 `scheduler`를 통해서만 시작 (`syncNow()`=수동 요청). 타이밍 규칙은 `core/sync/schedule.ts` (순수, 테스트 있음).
- 탭 (M0-23): 동기화는 리더 탭만 (`electLeader`). 다른 탭에서 동기화를 시작하려면 `requestSync`/`syncNow` 사용 (직접 `scheduler.request` 금지). 문서 업데이트는 `tabs` 중계로 실시간 공유되며, 받은 업데이트 origin은 `TAB_ORIGIN`.
- 지연 로드 패턴 (M1): 클릭해야 보이는 UI(더보기 메뉴 `LazyPageMenu`, 아이콘 선택·정보 `overlayViews`, 트리 드래그 `drag.ts`)는 지연 청크. 메뉴 항목에서 시트·대화상자를 열 때는 `afterMenuClosed()`(`features/page/rename.ts`)를 기다린 뒤 열 것 — 폰에서 메뉴 시트의 history pop과 겹치면 앱 밖으로 나감.
- 워크스페이스 (M1-15): 워크스페이스마다 다른 localStorage 상태는 반드시 `wsKey('이름')`(`core/docs/slots.ts`)으로 저장. 기기 공통(테마, 사이드바 폭, 토큰, 언어, 플래그)만 `webnota:` 고정 키.
- 상태 구독: Yjs는 `useY(doc, 고정 셀렉터, 비교 함수)`, 그 외는 `createStore` + `useStore`. 새 리스너 Set을 직접 만들지 말 것.
- 스타일: 색은 `styles/tokens.css`에만 (테스트 강제). 기능 CSS는 그 기능 컴포넌트에서 import. 간격·반경 px는 아직 토큰으로 바꾸지 않음 (화면을 고칠 때 점진적으로).
- CSS 리팩터링 시 회귀 확인: 스크래치 스크립트로 `vite preview` 화면 19장을 찍어 바이트 비교했음 (데스크탑·Pixel 7·iPhone 14·iPad, 라이트·다크). 필요하면 `tests/perf`나 e2e 스크린샷 테스트로 정식화 검토.
- i18n: 문자열은 `t('key')`, 키는 `core/i18n/ko.ts`에 먼저 추가 후 `en.ts`. 사전은 부팅 시 `initI18n()`이 현재 언어 것만 로드하므로 **모듈 최상위에서 `t()` 호출 금지** (지연 청크 안은 괜찮음, 예: editor/blocks.ts). e2e는 `locale: 'ko-KR'` 고정, 영어는 `desktop.i18n.spec.ts`.
- ui (M0-11): `@/ui` index에서 import. 오버레이는 레이어 스택(`ui/overlay/stack.ts`)에 등록되고, 시트·대화상자는 history 항목을 씀 → **오버레이를 닫은 직후 `history.back()`/`location.hash`를 직접 건드리지 말고 router의 `navigate`/`goBack`을 쓸 것** (정리 대기). `confirm()`/`alert()` 금지 → `confirmDialog()`/`toast()`. 아이콘 버튼은 `IconButton`(label 필수).
- 성능 기준선 (M0-25): `npm run build && npm run perf` → `docs/perf-history.md`에 마일스톤마다 기록. 20% 이상 나빠지면 마일스톤 완료 불가.
- 번들: 초기 121.6KB / 125KB (M1-15 후; 설정·휴지통·즐겨찾기 화면 지연 로드). 남은 여유 3.4KB. 초기 모듈은 한 청크($initial 그룹, DECISIONS 018)라 화면 단위 지연 로드가 효과 있음 — 새 기능은 지연 로드 필수. 더 줄여야 하면 마이그레이션 `up`을 지연 로드하는 방안(게이트의 버전 판단은 동기 유지).
- 레이아웃 분기는 `useLayout()`(`@/platform/layout`)만 사용. 태블릿은 아직 데스크탑 셸 (드로어는 M1-12).
- 오류 처리: 새 화면/지연 로드 영역은 `ErrorBoundary`로 감싸고 key로 리셋. QA 플래그 `webnota:debug` (docs/QA.md).
- 미완성 기능은 `core/flags.ts`의 `FLAGS`에 `kind: 'feature'`로 추가하고 `useFlag`/`isEnabled`로 가림. 완성 시 플래그 제거.
- IndexedDB (M0-18): DB 이름은 `idbName(docName)` = `wn:<wsId>:<docName>` (`core/docs/slots.ts`, wsId는 기기 로컬, DECISIONS 016). 옛 `webnota:*` DB는 부팅 시 `core/docs/legacy.ts`가 한 번 이전 (marker `webnota:idb-ns`). 더티 표시(`webnota:dirty`)·동기화 상태 키는 아직 워크스페이스별이 아님 → SY-05(M1). `core/persistence` 폴더는 만들지 않았음 (registry가 y-indexeddb 직접 사용, 필요해지면 분리).
- 스키마 (M0-15, spec/02 §6 구현 규칙): `SCHEMA_VERSION`은 `core/schema/version.ts`. 새 마이그레이션은 `core/schema/migrations/NNN-name.ts` + 테스트, `MIGRATIONS`에 등록하고 `SCHEMA_VERSION`을 올림. 마이그레이션은 `core/model`을 쓰지 말고 raw Y 코드로, 결정적·멱등(고정 ID). 부팅 순서: `initWorkspace` → `initSchema` → `seedIfEmpty`(읽기 전용이면 생략). 모델 변경 함수에는 `assertWritable()`를 넣음 (`core/model/guard.ts`).
- 데이터 모델 v2 (M0-16, M1-01): workspace는 `views`/`spaces`/`users`. 모델은 `core/model/views.ts`(`ViewMeta`: `parentId`는 부모 뷰 또는 null, `spaceId`는 조상으로 계산, `icon`은 IconValue — 표시는 `features/page`의 `ViewIcon`). 스페이스 API(create/update/move/delete), 즐겨찾기 순서(`listFavoriteIds`/`moveFavorite`), `adoptFavorites`. React는 `core/store/views.ts`의 `useViews`/`useAliveViews`/`useSpaces`. 현재 사용자는 `getCurrentUser()`=`local` (DECISIONS 015). v1 `pages`는 **동결 사본으로 남아 있음 — 지우지 말 것** (구버전 앱이 원격 파일을 지움). 영구 삭제 시 `pages` 항목도 함께 지움.
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
| 2026-11-26 | M0-18: IndexedDB 이름 공간 wn:<wsId>: (기기 로컬 슬롯 ID), 옛 webnota:* DB 일괄 이전 | b672776 |
| 2026-11-26 | M0-19: 문서 레지스트리 LRU 언로드 + retainDoc (페이지·동기화·복제) | e2a1b3b |
| 2026-11-26 | M0-20: 모르는 노드·마크 보존(onInvalidContent) + 페이지 읽기 전용 안내, QA 플래그 seed-unknown | e666598 |
| 2026-11-26 | M0-21: 동기화 스케줄러(60초 최대 대기, 지수 백오프, rate-limit 대기, 401 재시도 안 함) | 7229244 |
| 2026-11-26 | M0-22: ETag 조건부 GET (304 캐시 응답, blob·tree 제외) | a21cb35 |
| 2026-11-26 | M0-23: 탭 간 리더 선출(Web Locks) + BroadcastChannel 문서 업데이트 중계, 더티·계정·상태 공유 | bceedce |
| 2026-11-26 | M0-24: 동기화 로그(최근 50건, 반복 접기, 탭 공유) + 설정 화면 표시 | fc9254b |
| 2026-11-26 | M0-26: PWA PNG 아이콘(생성 스크립트) + manifest 바로가기(새 페이지·검색) | 85511df |
| 2026-11-26 | M0-25: PoC 회귀 e2e 5개 + 성능 기준선(tests/perf, perf-history). M0 마무리: M1 체크리스트 보강, QA.md M0 실기기 항목 | 6695af5 |
| 2026-11-26 | M1-01: 뷰 모델 API 정리(views.ts, 스페이스·즐겨찾기 순서·IconValue) | e530a72 |
| 2026-11-26 | M1-02: 가상 스크롤 트리(flatten + useWindow), 뷰 객체 안정화, QA seed-many | c35f052 |
| 2026-11-26 | M1-03: 트리 DnD(마우스·터치·키보드), 초기 청크 통합(DECISIONS 018) | 2fbedea |
| 2026-11-26 | M1-04: 인라인 이름 바꾸기·F2, 더보기 메뉴 전체(링크·새 탭·잠금·정보), promptDialog, 메뉴 지연 로드 | de81ac0 |
| 2026-11-26 | M1-05: 스페이스 UI(전환·생성·설정·삭제·순서), 현재 스페이스 기기별 저장 | 73c2501 |
| 2026-11-26 | M1-06: 즐겨찾기 순서·드래그 정렬, 로그인 사용자 추적·local 즐겨찾기 합치기 | 4a10188 |
| 2026-11-26 | M1-07: 최근 항목(기기별 30개, 폰 홈·검색), 드래그 로드 경쟁 수정 | ac734fe |
| 2026-11-26 | M1-08: 휴지통 완성(모두 복원·비우기, 배너, 30일 자동 비우기) | def48d5 |
| 2026-11-26 | M1-09: 본문 전문 검색 워커(MiniSearch·한글 bigram·증분·IndexedDB 저장) | 82acec9 |
| 2026-11-26 | M1-10: 명령 팔레트(⌘K, 키보드, 명령), 폰 검색 탭과 결과 로직 공유 | 01674b3 |
| 2026-11-26 | M1-11: 브레드크럼 생략·숨긴 상위 메뉴, 드래그 시작 경쟁 수정 | 73f4dfe |
| 2026-11-26 | M1-12: 사이드바 폭 조절·접기·호버 펼치기, 태블릿 드로어 | 1e03cb9 |
| 2026-11-26 | M1-13: 이동 대화상자(검색, 자기·하위 제외, 스페이스 간 이동) | 00042ab |
| 2026-11-26 | M1-14: EmojiPicker·IconPicker(전체 이모지·한/영 검색·최근·피부색, 아이콘+색) | 5c82c28 |
| 2026-11-26 | M1-15: 다중 워크스페이스(전환·저장소 열기·제거, wsKey 분리) | 9d10f35 |
| 2026-11-26 | M1-16: 폰 홈 개편(워크스페이스 전환, 스페이스 탭, 최근 가로 카드) | aa64f38 |
