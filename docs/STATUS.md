# 진행 상태 (세션 인계 문서)

> 새 세션은 이 파일부터 읽으세요. 작업 단위가 끝날 때마다 갱신합니다.

## 현재 위치

- **마일스톤**: M7 모바일 완성 패스 (M6 완료 — 실기기 확인은 docs/QA.md "M6"·"M5"(와 M4·M3·M2·2차 피드백), 사용자 확인 대기)
- **진행 상황**: M0 26/26, M1 21/21, M2 21/21, M3 12/12, M4 16/16, M5 13/13, M6 11/11 완료. M7 1/14 (체크리스트 세부화 완료). 사용자 피드백 1·2차 반영 완료
- **진행 중 항목**: (없음)
- **다음 할 일**: M7-01 (M5·M6 실기기 확인은 사용자 대기)
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
- 에디터 스키마 (M2-08): 문서 스키마는 `features/editor/schema.ts`(`schemaExtensions`/`docSchema`, React 없음 — 단위 테스트·시드용), UI 확장은 `extensions.ts`. React 노드 뷰가 필요한 노드는 스키마에는 순수 노드를 두고 `editorExtensions`에서 뷰 달린 버전으로 바꿔 끼움 (예: `mention` → `MentionWithView`). `features/editor/` 하위 폴더는 상위 파일을 import할 수 없음(lint) — 순수 로직만 하위 폴더에.
- **초기 번들 122.0/125KB (M3-00).** 동기화 연결·실행은 `core/sync/session.ts`(지연 sync 청크, `remote.ts`가 내보냄) — 컨트롤러에는 상태·스케줄만. 남은 앱 코드는 대부분 작아서(react-dom·yjs가 대부분) 더 줄이기 어려움 → **M3 기능은 전부 지연 청크**로 (업로드·이미지 처리·파일 캐시는 쓸 때 import). 초기 청크 코드를 늘릴 때는 클릭해야 보이는 UI를 지연 로드할 것 (예: `PageCover`·`pageStyleViews`).
- 파일 (M3-01~04): 바이너리는 `core/files`(`addFile`/`ingestFile`/`loadFile`), 표시 훅은 `@/features/files`의 `useFile`. 업로드 코드(`core/files/ingest.ts`)·캐시(`cache.ts`)·이미지 UI(`ImageView.tsx`)는 각각 지연 청크(`check-size.mjs` 등록) — 에디터·초기 청크에서 정적 import 금지. 붙여넣기·끌어 놓기는 `fileDrop.ts`의 `insertFiles(editor, files, pos)`(자리 표시 데코레이션). 노드 선택일 때 글자 서식 버블은 숨김.
- **에디터 청크 204.3/210KB (M3-07 후).** 찾기 바·블록 메뉴는 지연 청크. 폰 키보드 도구 모음(`KeyboardToolbar`)을 지연 로드하면 폰 선택 도구 e2e(MB-22, 링크)가 깨짐(원인 미확인) → 정적 import 유지. 남은 M3 노드는 정의만 에디터 청크에, UI는 별도 청크.
- 저장소 정리 (M3-10): 파일을 참조하는 새 위치를 만들면 **`core/files/refs.ts`에 반드시 추가** (빠지면 정리가 파일을 지움). 동기화·파일 e2e는 `tests/e2e/fakeGithub.ts`(메모리 GitHub, `connectFake`).
- 데코레이션 (M3-00): 에디터 데코레이션 플러그인은 바뀐 부분만 다시 계산 — `code/changed.ts`의 `changedRanges`/`blocksInRanges` 사용 (spec/10 §2).
- 표 (M2-11): 노드 정의는 `nodes/table.ts`(prosemirror-tables 없이), 편집 플러그인·명령은 `table/kit.ts` 지연 로드 후 `registerPlugin`. 단, `@tiptap/extension-bubble-menu`가 prosemirror-tables를 정적으로 import해서 라이브러리 코드 자체는 에디터 청크에 들어감(+8KB, 에디터 187.8/210KB). 에디터 예산 여유가 줄었으니 다음 무거운 확장은 별도 청크로.
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

- **데이터베이스 (M4-00, M5-11 플래그 제거)**: 코드는 `features/database`(지연 청크, 예산 120KB; Board·Calendar는 `dbBoard`·`dbCalendar` 청크, 인라인 블록은 `loadInlineDatabase`). 새 뷰 메뉴에 Grid·Board·Calendar. **e2e에서 사이드바 `+`로 문서를 만들 때는 `newPageFromSidebar(page)`** (+가 레이아웃 메뉴를 엶). **DB 문자열은 `features/database/i18n/{ko,en}.ts`에 두고 `dt('db.…')`** — 부팅 사전(i18n 7.9/8KB)에 넣지 말 것.

- DB 모델 (M4-01): `core/model/database`(순수, `DbDocs = {schema, shards}`), 열기는 `core/docs/database.ts`의 `openDatabase(dbId)` → `{docs, release}`. 생성은 `@/features/database`의 `createDatabaseView`(지연). core/model/database는 상위 폴더(`../guard`, `../views`)만 import 가능(lint). **초기 번들 123.2/125KB** — 페이지·사이드바 코드에 DB 로직 추가 금지.

- DB 화면 상태 (M4-04): `useDbSession(dbId, viewId)` → `{session, state}` (`state.result.rowIds`, `fields`, `view`, 셀은 `session.row(id)`). 행 변경은 `rowsVersion`으로 다시 그림. **DB 변경은 `state.docs`에 core/model/database 함수로만.**

- DB 화면 구조 (M4-05): `features/database`는 **평평하게**(하위 폴더는 상위를 import할 수 없음 — `query/`, `i18n/`처럼 잎 모듈만). 그리드 `Grid.tsx`, 셀 표시 `CellView.tsx`, 편집기 `CellEditor.tsx`, 입력 해석 `cellEdit.ts`. e2e는 `openQaDatabase(page)`·`gridCell(page, row, '열 이름')`(helpers). 편집을 시작하는 pointerdown은 preventDefault해야 포커스가 그리드로 돌아가지 않음.

- **DB 성능 과제 (M4-14)**: 4× 감속에서 10k행 열기 2.3s(목표 800ms) — 대부분 IndexedDB에서 Yjs 문서를 적용하는 시간(행당 Y.Map 2개). 후보: 첫 화면용 행 스냅샷 캐시(IndexedDB에 쿼리 결과·보이는 행 저장 후 문서 로드와 병행), 샤드를 점진 적용. 스크롤 31fps는 헤드리스 소프트웨어 렌더링 영향이 커서 실기기 확인 필요. 행 컴포넌트는 메모되어 있으니 **GridRow에 새 객체 prop을 넘기지 말 것**(콜백은 `rowActions`).

- **e2e 새 페이지 버튼**: 사이드바 `.sidebar [data-new-page] >> nth=0` (피드백 12로 하단 '새 페이지' 제거). **뒤로가기**: `goBack()`은 `core/store/router.ts`의 trail(sessionStorage `webnota:trail`, 기록마다 `wnSeq`)을 따름. 오버레이가 열린 채 이동하면 그 오버레이 기록은 되돌리지 않음(`platform/history.ts`).

- 미디어 도구 문자열은 지연 사전 `features/editor/mediaI18n`(`mt()`) — 부팅 사전 8KB 예산. 이미지·동영상은 `MediaToolbar`/`MediaCaption`(`MediaToolbar.tsx`, `media.css`) 공유.

- **초기 번들 (피드백 7)**: 페이지 화면(`loadPageView`, 앱 시작 시 바로 받음)과 폰 홈(`loadHome`)은 지연 청크 — 122.4/125KB. 에디터 예산은 `after: 'pageView'`. 사이드바는 `SpaceSections`(스페이스마다 `PageTree`), 목록 끌기는 `beginListDrag(e, list, onDrop, 'space-id')`.

- **DB 탭·행 페이지·인라인 (M5-01~10)**: 탭 = 첫 뷰의 하위 뷰(같은 databaseId, `databaseTabs`). 행 페이지는 라우트 `…/v/<page>/r/<row>`(`openRow`/`useOpenRow`, 인라인은 `RowRouteContext`로 문서 id), 본문 `row/<db>/<row>`는 내용이 생길 때 `hasDoc`. 인라인 DB 블록의 뷰는 `embedded: true`(사이드바·`listViews`에 없음, `getView`로는 나옴). 데스크탑 `MainContent`는 행 라우트가 바뀌어도 다시 마운트하지 않음(App.tsx key). 에디터 청크 199.3/210KB (M7-00: bubble-menu의 `@tiptap/pm/tables` import를 `vite.config.ts` 플러그인이 `table/cellSelectionShim.ts`로 바꿈 — prosemirror-tables는 표 키트에서만).

- **관계·롤업 (M6)**: 관계 쓰기는 반드시 `setLinks`(양방향이면 상대도), 셀 직접 `setCell` 금지(붙여넣기·범위 지우기는 관계 열 건너뜀) — 세션이 합집합 복구(`repairTwoWay`)를 하므로 한쪽만 지우면 되살아남. 대상 DB 문서는 세션이 열어 둠(`session.target`), 셀은 `RelationContext`. 필터·정렬·계산에 쓰이는 관계·롤업 값은 `QueryInput.derived`(세션이 계산). CSV는 `csvImport.ts`/`csvExport.ts`. 설정 지연 사전 `features/settings/historyI18n`.

- **DB 첫 화면 캐시 (M5-00)**: 뷰를 열면 `wn:<wsId>:$dbscreen`의 캐시로 먼저 읽기 전용 미리보기(`state.preview`, `.db-view[data-preview]`, docs는 빈 자리 표시)를 그림. 레이아웃 컴포넌트는 `LayoutProps.readOnly`를 따르면 됨(미리보기 포함). **e2e에서 새로 고침 뒤 DB 값을 확인·편집할 때는 `dbLive(page)`** 먼저(캐시만 보고 통과하지 않게). Board·Calendar는 `BoardView.tsx`·`CalendarView.tsx`(별도 청크 `dbBoard`·`dbCalendar`), 카드 내용은 `CardBody`.

- 기본 i18n 사전 6.9/8KB (M7-00: `settings.*`·`cleanup.*`를 설정 지연 사전 `features/settings/i18n`(`st`/`stParts`)으로). 새 문자열은 기능별 지연 사전(addMessages)에. CSS 예산은 시작 CSS 10KB + 전체 35KB(DECISIONS 022)

- 공유(M9)는 B안: 공유 스페이스마다 별도 저장소, 한 워크스페이스가 여러 저장소와 동기화(SY-08). M5~M8에서 새 문서·파일 경로를 만들 때 '어느 저장소(스페이스)에 속하는지'로 라우팅할 수 있게 스페이스 단위로 찾을 수 있도록 설계할 것 (spec/02 §2.1)

- CI에서 가끔 실패하던 e2e `mobile.image.spec.ts`(폰 이미지 손잡이 끌기): M6-10에서 끌기 재시도(`toPass`)로 안정화
- 성능 측정 시 `vite preview`가 남아 있으면 다른 빌드를 잴 수 있음 → 측정 전 `pkill -f 'vite preview'`
- 실제 GitHub API로 동기화를 검증하지 못함 (작업 환경 프록시 제한). 사용자 확인 필요.
- GitHub 로그인 (2026-11-27 설정 완료, 사용자가 실기기 로그인 확인): Worker `https://webnota-auth.yousungcake.workers.dev`(Actions가 배포, `/token`·`/unfurl` 동작 확인), 저장소 Variables `WEBNOTA_GITHUB_CLIENT_ID`·`WEBNOTA_AUTH_PROXY_URL`, Secrets `CLOUDFLARE_API_TOKEN`·`CLOUDFLARE_ACCOUNT_ID`·`WEBNOTA_GITHUB_CLIENT_SECRET`. 작업 환경의 `gh`로 Actions 변수·비밀은 읽고 쓸 수 없음(403) — `gh workflow run`은 가능. Cloudflare 토큰이 만료되면 worker 작업이 실패해 Pages 배포도 멈춤.
- 실기기 한글 IME 미검증 (에뮬레이션 CDP 테스트만 통과).
- Tiptap DragHandle/EditorContent가 DOM을 직접 옮겨서 React 재조정이 어긋난 적이 있음 → `page-body`를 `key={id}`로 감싸서 해결. 에디터 주변 구조를 바꿀 때 주의.
- 작업 환경에서는 `*.github.io`에 접속할 수 없어 배포본 e2e를 돌릴 수 없음. 로컬 `npm run e2e` (vite preview)로 테스트.
- 첫 실행 시 환영 페이지 시드가 에디터 청크를 기다려서 에디터 표시까지 약 1초 (재방문은 빠름). M0-25 성능 기준선에서 측정·개선 검토.
- React Compiler 린트 규칙(react-hooks 7)이 수동 메모이제이션을 엄격하게 검사함. 간단한 계산은 useMemo 없이 `core` 순수 함수로.
- 작업 환경의 `gh`는 이 저장소 범위 API만 허용됨 (Pages 설정 API 등은 불가).
- e2e 선택 후 동작: DOM 선택이 바뀌어도 ProseMirror 선택은 selectionchange 뒤에 따라옴 → 선택에 의존하는 붙여넣기 등은 `.wn-editor`의 `editor.state.selection`을 poll한 뒤 실행 (desktop.paste 참고).
- e2e 새로 고침은 `reload(page)`(helpers) — IndexedDB 쓰기 커밋을 기다린 뒤 새로 고침. `page.reload()`를 바로 쓰면 느린 CI에서 마지막 변경이 사라져 실패함 (M3 CI 실패 원인). 메뉴를 닫은 직후 키 입력은 에디터로 포커스가 돌아온 것을 확인한 뒤.
- e2e 드래그 테스트는 드래그 시작(`.tree-ghost`)과 드롭 선(`.tree-drop-line`)이 보일 때까지 기다린 뒤 놓을 것 — 부하 중에는 포인터 이벤트 처리보다 테스트가 앞서서 드래그가 무시될 수 있음 (M2-15에서 favorites 테스트 수정).

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
| 2026-11-26 | M1-17: 라우팅 v2(#/w/:ws/v/:id), 구 경로·다른 기기 링크 처리 | 3d0010e |
| 2026-11-26 | M1-18: 전역 단축키(새 페이지·테마·뒤로/앞으로·도움말) | 40094b7 |
| 2026-11-26 | M1-20: 새 뷰 만들기(레이아웃 목록, 하나뿐이면 즉시 생성) | ed16886 |
| 2026-11-26 | M1-21: 페이지 전환 75ms 확인(측정 보정), M1 성능 기록 | 6dff226 |
| 2026-11-26 | M2-01: 블록 레지스트리(카테고리·최근·검색 점수·바꾸기 대상) | 9effabd |
| 2026-11-26 | M2-02: 제목 4~6, 번호 목록 중첩 스타일 | e08b99f |
| 2026-11-26 | M2-03: 토글 목록·토글 제목, schema v3, 노드 이름 가드 테스트 | d02b828 |
| 2026-11-26 | M2-04: 콜아웃(아이콘·배경색), schema v4 | 5c77ccc |
| 2026-11-26 | M2-05: 코드 블록(언어·줄 바꿈·복사·지연 하이라이트) | f46a2b8 |
| 2026-11-26 | M2-06: M2-06 링크 팝오버·폰 링크 시트 (e2e 82 통과) | 83e746b |
| 2026-11-26 | M2-07: M2-07 글자 색·배경색, schema v5 | ac56b11 |
| 2026-11-26 | M2-08: M2-08 페이지·날짜 멘션, schema v6 | eb1742f |
| 2026-11-26 | M2-09: M2-09 이모지 제안·위/아래 첨자, schema v7 | cc802ca |
| 2026-11-26 | M2-10: M2-10 하위 페이지 블록, schema v8 | e13ee00 |
| 2026-11-26 | M2-11: M2-11 표, schema v9 | 6cb4c4e |
| 2026-11-26 | M2-12: M2-12 다단·목차, schema v10 | ec64b60 |
| 2026-11-26 | M2-13: M2-13 블록 메뉴·블록 링크, schema v11 | 16280ad |
| 2026-11-26 | M2-14: M2-14 다중 블록 선택 | 7804fe8 |
| 2026-11-26 | M2-15: M2-15 붙여넣기 Markdown/URL, favorites e2e 안정화 | a46d39c |
| 2026-11-26 | M2-16: M2-16 찾기/바꾸기·실행 취소 묶음 | 43e76b1 |
| 2026-11-26 | M2-17: M2-17 들여쓰기 확장·마크다운 링크·텍스트 방향, schema v12 | 169b610 |
| 2026-11-26 | M2-18: M2-18 페이지 스타일·커버·잠금 배너 | 4443d0d |
| 2026-11-26 | M2-19: M2-19 모바일 도구 모음 v3 | a1809ca |
| 2026-11-26 | M2-20: M2-20 폰 선택 도구 모음·블록 길게 누르기·자동 스크롤 | da9666f |
| 2026-11-26 | M2-21: M2-21 IME 회귀 e2e·성능 기록·QA 항목, M2 완료 | a74c2d8 |
| 2026-11-27 | 설정 UI: 세그먼트 선택 상태 강조 + 현재 적용 값 표시 (사용자 피드백 4) | 163ee62 |
| 2026-11-27 | 표 위치(왼쪽·가운데·오른쪽·전체 채우기), schema v13 (사용자 피드백 1) | 867db68 |
| 2026-11-27 | 링크 적용 후 선택 해제·커서를 링크 뒤로 (사용자 피드백 2) | d6204c4 |
| 2026-11-27 | 한글 검색(es-hangul: 초성·입력 중 글자) 전체 적용 + 표 플러그인/IME·오버레이 포커스 버그 수정 (사용자 피드백 3) | 43202c6 |
| 2026-11-27 | M3-00: 사전 정리: 동기화 연결·실행 지연 청크(초기 122.0KB), 코드 하이라이트 증분·찾기 데코 캐시 | 7541b62 |
| 2026-11-27 | M3-01: 파일 저장소 코어(SHA-256 주소·중복 제거·pendingFiles·같은 커밋 업로드·25MB 제한) | 6028f0a |
| 2026-11-27 | M3-02: 파일 표시 캐시(raw 내려받기·LRU 200MB·useFile·자리 표시 상태) | f79077b |
| 2026-11-27 | M3-03: 이미지 전처리(2560px·WebP·EXIF 회전·작은 이미지 원본 유지) + 원본 유지 설정 | 717ad59 |
| 2026-11-27 | M3-04: 이미지 블록(업로드·붙여넣기·끌어 놓기·크기·정렬·캡션·폰 사진 선택), schema v14 | b904ab2 |
| 2026-11-27 | M3-05: 파일 블록(첨부·업로드 대기 표시·내려받기·끌어 놓기), schema v15 | b1ced84 |
| 2026-11-27 | M3-06: 동영상·임베드 블록(YouTube nocookie·Vimeo·파일, 허용 목록 iframe), schema v16 | 4571767 |
| 2026-11-27 | M3-07: 수식 블록·인라인 수식(KaTeX 지연 로드, 편집 팝오버/시트, 입력 규칙), schema v17 | 78c1a68 |
| 2026-11-27 | M3-08: 링크 미리보기(Worker /unfurl·SSRF 차단·블록에 캐시) + URL 붙여넣기 선택 메뉴, schema v18 | 84d5e11 |
| 2026-11-27 | M3-09: 커버·페이지 아이콘 이미지 업로드(아이콘 256px, 파일 캐시 표시) | 2208956 |
| 2026-11-27 | M3-10: 저장소 정리(참조 수집·한 커밋 삭제) + 메모리 GitHub e2e로 업로드·내려받기·정리 검증 | d591045 |
| 2026-11-27 | M3-11: M3 e2e(194개)·성능 기록·QA 항목, M3 완료, M4 체크리스트 세부화 | 9521ac0 |
| 2026-11-27 | CI e2e 안정화: 새로 고침 전 IndexedDB 쓰기 대기(`reload` 헬퍼, 29개 파일), 블록 메뉴 후 포커스 대기 — M3-08 이후 CI 실패로 배포가 멈췄던 문제 | fb9c0b8 |
| 2026-11-27 | GitHub 로그인 준비: Actions가 Cloudflare Worker 자동 배포(Secrets 있을 때만, 허용 출처 자동), README를 브라우저만으로 하는 설정 안내로 교체 | 2d1f6d0 |
| 2026-11-27 | GitHub 로그인 설정 완료: OAuth 앱·Cloudflare 토큰·저장소 값 입력(사용자), Worker 배포·동작 확인, 로그인 버튼이 들어간 빌드 배포 | f3540b9 |
| 2026-11-27 | 동기화 주기 단축(사용자 요청): 입력 후 4초 푸시(자동 동기화 최소 8초 간격), 20초 주기 풀 | 8859453 |
| 2026-11-27 | M4-00: database 플래그·features/database 지연 청크·DB 지연 문자열 사전(dt)·fast-check, 새 뷰 메뉴 Grid(플래그) | aa8712d |
| 2026-11-27 | M4-01: DB 데이터 모델(db/dbr 샤드 8개·FNV-1a·필드/행/셀 CRUD·뷰 설정), openDatabase, schema v19 | 97ebd2c |
| 2026-11-27 | M4-02: DB 문서 retain·영구 삭제 시 로컬 DB 정리, 엔진이 참조 없는 data/dbs/<id>/ 삭제, 첫 연결 시 DB 더티 | a4535c9 |
| 2026-11-27 | M4-03: 쿼리 엔진 runQuery/compileQuery(필터 전 조건·AND/OR·상대 날짜, 다중 정렬·ko 콜레이터·빈 값 마지막, 계산 14종) + 전수·fast-check 속성 테스트 | 5c73b31 |
| 2026-11-27 | M4-04: 증분 쿼리(createLiveQuery·observeRows)·워커(5,000행 이상)·DB 세션(useDbSession) + 증분=전체 재계산 속성 테스트 | ddf9ef0 |
| 2026-11-27 | M4-05: 기본 Grid + text·number(서식·통화)·checkbox·url·만든/수정 시각·소요 시간 셀 표시·편집, DB 뷰 아이콘, QA seed-db | 11320c5 |
| 2026-11-27 | M4-06: select/multiSelect 옵션 팝오버(검색·생성·이름·색·삭제·순서), 날짜 달력(종료일·시간·형식), 체크리스트, 선택 색 토큰 10색, 폰 시트 | 10a45d2 |
| 2026-11-27 | M4-07: media 필드(업로드·썸네일·순서·삭제, refs.ts fileRefsInRows), 타입 변환 규칙 전수 테스트 + convertField/undo, changeFieldType(확인·30초 실행 취소) | 9a04567 |
| 2026-11-27 | M4-08: Grid 열 가상 스크롤·고정 열·줄 바꿈 자동 행 높이(측정), Grid를 GridHeader/GridRow로 분리 | 6d684e0 |
| 2026-11-27 | M4-09: 행 조작(새 행·아래 추가·행 메뉴·복제·삭제+실행 취소·다중 선택 삭제·드래그 순서·필터 값 채우기·속성 대화상자) | 3941003 |
| 2026-11-27 | M4-10: 범위 선택(Shift·끌기)·Ctrl+방향키·Home/End, TSV 복사·잘라내기·붙여넣기(행 자동 추가·타입별 해석·범위 채우기) | 250aef7 |
| 2026-11-27 | M4-11: 필드 UI(헤더 + 추가, 필드 메뉴: 이름·유형 변환·유형별 옵션·줄 바꿈·삽입·고정·숨기기·복제·삭제, 헤더 드래그 이동·폭 조절) | ba24b41 |
| 2026-11-27 | M4-12: 설정 바(필터 AND/OR 그룹·정렬 우선순위·속성 표시·행 검색)와 계산 행 | 8ee824c |
| 2026-11-27 | M4-13: 폰 Grid(44px 행, 탭 → 편집 시트, 고정 열 140px 제한, 카드 목록 보기, 전체 높이 설정 시트) | 47b92fc |
| 2026-11-27 | M4-14: DB 성능 벤치(perf:db) + 행 스냅샷 캐시·메모 행·containment(4×: 열기 2.3s·31fps·편집 16ms·필터 111ms / 1×: 641ms·60fps) | 6ba0d78 |
| 2026-11-27 | M4-15: DB e2e(데스크탑 11·폰·영어)·성능 기록·QA M4 항목, M4 완료, M5 체크리스트 세부화 | 22636c3 |
| 2026-11-27 | 피드백 12·9·8·10: 설정을 휴지통 위로(새 페이지 버튼 제거), 무채색 위주 색(링크·인용·활성 표시 회색), 한글 검색 깜빡임 제거(이전 결과 유지), 폰 뒤로가기(방문 기록 trail, 시트에서 이동 후 되돌림 방지) | 53cc120 |
| 2026-11-27 | 피드백 1·2·13: 블록 핸들 호버 영역 확장(왼쪽 여백), 폰 전용 핸들(+ 없음, 페이지 안쪽), 잡은 블록 강조 유지·다른 곳 클릭 시 해제 | 7d50bc2 |
| 2026-11-27 | 피드백 4·5: 이미지·동영상 공통 도구 모음(왼쪽 위, 정렬+크기·캡션·캡션 정렬·다운로드·비우기·복제·삭제), 캡션 정렬 분리, 동영상 정렬·캡션 — schema v20 | 1f07e97 |
| 2026-11-27 | 피드백 3: 다단 → 열(이름), 열 안 블록 핸들·열 사이/밖 이동·옆에 놓아 열 만들기, 빈 열 정리, 폰에서도 나란히 | f5d6d37 |
| 2026-11-27 | 피드백 6·7: 사이드바 — 로고 복원, 스페이스 전부 나열·접기·끌어서 순서, 워크스페이스 전환 아래로, 깊은 하위 페이지(들여쓰기 상한 + ·), 접기 애니메이션·열기 버튼·넓은 호버 영역·이중 사이드바 버그, 폰 스페이스 순서. 초기 번들 122.4KB(페이지 화면·폰 홈 지연 청크) | 05c7e8b |
| 2026-11-27 | 피드백 11: Notion 가져오기(Markdown & CSV zip, 중첩 zip, _all.csv, 첨부·멘션·콜아웃) / 내보내기(Notion 형식 + 무손실 webnota.json) / 다시 가져오기 복원, 설정 섹션(지연 청크 features/io, fflate) | adf0eaa |
| 2026-11-27 | 2차 피드백 1·9·10: 스페이스 메뉴에서 바로 삭제, 마우스 창은 480px 미만에서만 폰 화면(480~767은 태블릿 레이아웃), Notion 가져오기 — id 없는 하위 폴더·평면 내보내기(링크로 부모 찾기)·링크만 감싼 aside 풀기·하위 페이지 블록 | c1105b6 |
| 2026-11-27 | 2차 피드백 7·8: 슬래시·멘션·이모지 메뉴 바깥 클릭 시 닫힘(블록 선택 오류·파란 칠 없음), 마지막 블록 아래 클릭은 커서만 끝으로, 안내 문구 절대 위치(폰 커서), 좁은 마우스 창 손잡이 영역 36px(둘째 줄에서도 손잡이), 폰 손잡이 메뉴에 '아래에 블록 추가', 폰 본문 좌우 여백 36px 균형 | d819854 |
| 2026-11-27 | 2차 피드백 3: 열 안 블록 손잡이 — 가장자리 감지(열 묶음 전체로 바뀜) 제거, 블록→손잡이 이동 중 손잡이 고정, 열 안 블록 메뉴에 열 추가·합치기 | 08fa115 |
| 2026-11-27 | 2차 피드백 4·5: 이미지·동영상 도구 모음 오른쪽 위, 정렬 메뉴의 크기 프리셋 제거, 캡션 버튼→캡션 정렬 전환, 새 캡션 자동 커서·빈 캡션 Backspace 제거, 다운로드 버튼 수정(JS 저장), 폰 이미지·동영상 양쪽 손잡이 크기 조절(포인터 캡처), 크기 표시 왼쪽 아래, 좁은 이미지에서 도구 모음 위치 | 96d8983 |
| 2026-11-27 | 2차 피드백 6: 콜아웃 선택기 — 열어 두기 핀(기본 꺼짐), 검색·무작위 제거, 비우기(아이콘 없음), 이름 있는 아이콘 지원(icon:<이름>[:<색>]), 색 선택 표시 갱신, 팝오버 열린 채 휠 스크롤·아이콘 따라감, 이모지 격자 오른쪽 빈 공간 제거 | b77e8e6 |
| 2026-11-27 | 2차 피드백 2: 임베드 — 알려진 서비스 약 30개를 공식 embed 주소로, 그 밖의 https 페이지도 그대로 iframe(새 탭에서 열기 링크), http→https, 퍼가기 코드·scheme 없는 주소, 동영상 블록도 같은 규칙, 붙여넣기 메뉴에 임베드 항상 | 73d0236 |
| 2026-11-27 | 계획 조정: 공유 = B안(스페이스 = 저장소, Notion 팀스페이스식) — spec/07 SH-00·01·02 재작성, spec/06 SY-08(다중 저장소 동기화), spec/02 §2.1(space 문서, M9 계획), ROADMAP M9, DECISIONS 021 | c2e484b |
| 2026-11-27 | M5-00: DB 첫 화면 캐시(읽기 전용 미리보기, 4× 10k 첫 화면 205ms)·CardBody·Board/Calendar 지연 청크 골격 | a5a8101 |
| 2026-11-27 | M5-01: 탭 바·다중 뷰(추가 뷰 = 첫 뷰의 하위 뷰, 복제·이름·삭제·끌기), schema v21 | 5b18082 |
| 2026-11-27 | M5-02: Board 그룹 데이터(group.ts: 그룹 키·열 순서·숨김·카드 값), runQuery/증분 groups + 속성 테스트 | 5b18082 |
| 2026-11-27 | M5-03: Board 화면(열 가로 스크롤·카드 가상 스크롤·커버·인라인 제목·열에 카드 추가·보드 설정) | 7791560 |
| 2026-11-27 | M5-04: Board 드래그(카드 열 안·열 사이 값 변경, 열 순서, 터치 길게 누르기, 가장자리 자동 스크롤) | b842c3e |
| 2026-11-27 | M5-05: Board 열 관리(열 메뉴: 이름·색·숨기기·옵션 삭제, 숨긴 그룹 패널·새 그룹) | 2799a51 |
| 2026-11-27 | M5-06: Calendar 월 보기(calendar.ts 레이아웃, 범위 막대·+N·설정·더블클릭 새 행·이동) | 0e578e7 |
| 2026-11-27 | M5-07: Calendar 드래그(날짜 이동, 일정 없음 패널에서 놓기), 폰 월 격자(점)+선택한 날 목록 | fe68ca6 |
| 2026-11-27 | M5-08: 행 페이지(아이콘·커버·제목·속성·본문 row/<db>/<row>, hasDoc), schema v22 | 30ba3db |
| 2026-11-27 | M5-09: 행 페이지 탐색(라우트 /r/<row>, 가운데 창·전체 화면·폰 전체, 이전/다음, 링크·복제·삭제, 모든 보기에서 열기) | e4397ac |
| 2026-11-27 | M5-10: 인라인 DB 블록(슬래시 새로 만들기·기존 연결·높이 조절·전체 페이지, embedded 뷰, 문서 라우트 행 페이지), schema v23 | a03700b |
| 2026-11-27 | M5-11: database 플래그 제거, 새 뷰 메뉴 Board·Calendar, 사이드바 아이콘, 빈 DB 안내(폰 FAB는 문서 바로) | 47afbe2 |
| 2026-11-27 | M5-12: M5 e2e(데스크탑·폰 26개)·성능 기록·QA M5, M5 완료, M6 체크리스트 세부화 | ac59d57 |
| 2026-11-28 | M6-00: 사전 정리(지운 행 본문은 저장소 정리 때 삭제, 인라인 DB 블록 삭제 → 뷰 휴지통·복원, 인라인 탭 바 없음 결정) | e2363db |
| 2026-11-28 | M6-01: 관계 필드 데이터(relation.ts: rowId[] 셀·대상 DB·링크/해제·제목·지운 대상·databaseSpaceId), schema v24 | 1220703 |
| 2026-11-28 | M6-02: 관계 UI(칩·검색 선택기·칩→대상 행 페이지·대상 DB 선택, 세션 대상 DB) | f07a260 |
| 2026-11-28 | M6-03: 양방향 관계(짝 필드·setLinks 양쪽 쓰기·병합 후 합집합 복구·속성 테스트) | 751d5d8 |
| 2026-11-28 | M6-04: 롤업(관계→속성→원래 값·고유 값·계산 14종, 그릴 때 계산·읽기 전용), schema v25 | 127b968 |
| 2026-11-28 | M6-05: 관계·롤업 필터·정렬·검색(QueryInput.derived), 관계→텍스트·선택 변환(제목 유지) | f287511 |
| 2026-11-28 | M6-06: CSV 가져오기(새 뷰 메뉴·DB 메뉴, 워커 파싱, 미리보기: 머리글·열 대상·유형, 기존 필드 매핑) | 562fd18 |
| 2026-11-28 | M6-07: CSV 내보내기(현재 보기/전체, 표시 값, 공유 시트/내려받기) | da9cab2 |
| 2026-11-28 | M6-08: 계산 보강(롤업 계산 행, Board 열 머리 계산, 폰 계산 행) | ba9b921 |
| 2026-11-28 | M6-09: 저장소 크기·500MB 경고·기록 정리(새 루트 커밋, head 재확인 후 강제 갱신), 메모리 GitHub e2e | a3fbb5c |
| 2026-11-28 | M6-10: M6 e2e(관계·양방향·롤업·CSV·기록 정리, 폰)·성능 기록·QA M6, M6 완료, M7 체크리스트 세부화 | d99973e |
| 2026-11-28 | M7-00: 예산 정리(에디터 199.3KB: bubble-menu CellSelection shim, 설정 문자열 지연 사전 → 부팅 6.9KB, CSS 예산 시작 10KB/전체 35KB) | 464130f |
