# 개발 체크리스트

- 항목 형식: `- [ ] M<마일스톤>-<번호> 설명 (관련 spec ID)`
- 완료하면 `[x]`로 바꾸고 끝에 커밋 해시 7자리를 적습니다: `- [x] M0-01 … — a1b2c3d`
- 진행 중인 항목은 `[~]`로 표시합니다 (세션이 끊겨도 다음 세션이 알 수 있도록).
- 앞으로의 마일스톤은 개략 항목만 있습니다. **마일스톤을 시작할 때 spec을 읽고 세부 항목으로 펼칩니다** (첫 작업).
- 완료 정의: [spec/11-engineering.md](spec/11-engineering.md) §8

---

## M0 기반 정비

### 도구와 품질 게이트
- [x] M0-01 ESLint(flat config, typescript-eslint, react-hooks, import 경계 규칙) + Prettier + `npm run lint` — 615ec5c
- [x] M0-02 `tsconfig` 강화 (`noUncheckedIndexedAccess`), 위반 수정 — 615ec5c
- [x] M0-03 `scripts/check-size.mjs` 번들 예산 검사 (spec/10 §1.1) — 615ec5c
- [x] M0-04 `npm run verify` (lint + typecheck + test + build + size) — 615ec5c
- [x] M0-05 CI: PR/main에서 verify + e2e (Playwright), main은 배포. 배포 워크플로 액션 버전 갱신 (Node 20 경고) — 3396cb1
- [x] M0-06 e2e를 `tests/e2e/*.spec.ts`(Playwright Test)로 이전, 기능별 파일 분리 — 3396cb1

### 구조 이전 (spec/01 §3)
- [x] M0-07 `src/core/{docs,persistence,sync,schema,model,store,auth}`로 이동, `src/features/*`, `src/ui/*`, `src/platform/*`, `src/app/*`로 분리 — d1f4ea1 (persistence·schema는 M0-15/18에서 생성)
- [x] M0-08 `useY` 셀렉터 훅 + `createStore` 유틸, 기존 `usePages` 대체 — 083bdf8
- [x] M0-09 `styles/tokens.css` + 기능별 CSS 분리, 하드코딩 색 제거 — 262d388
- [x] M0-10 i18n: `t()` + `ko.ts`/`en.ts` 사전, 기존 문자열 이전, 언어 감지 — b1f2a1e
- [x] M0-11 `ui/` 기본 컴포넌트: Button, IconButton, Menu(확장), Popover, Sheet, Dialog/Confirm, Toast(실행 취소), Tooltip, Input, Switch, Segmented, Skeleton, EmptyState, OverlayHost — f94a195, 252555f (TextArea/Select/Checkbox/Spinner는 필요할 때)
- [x] M0-12 `useLayout()` (phone/tablet/desktop + isTouch) — e1b0aef
- [x] M0-13 ErrorBoundary (화면 단위), 전역 오류 토스트 — 7962653
- [x] M0-14 기능 플래그 `core/flags.ts` + 설정 → 고급 (ST-12) — f29e395

### 데이터
- [x] M0-15 스키마 버전 + 마이그레이션 레지스트리 + 읽기 전용 게이트 (spec/02 §6) — 68fa08a
- [x] M0-16 마이그레이션 v2: pages→views, FracKey, 즐겨찾기 사용자별, 기본 스페이스, `page/`→`doc/` IndexedDB 복사 (spec/02 §7) — e71fe99
- [x] M0-17 동기화 경로 v2 + 구 경로 이전 (SY-02a), FakeRemote 테스트 — 087a184
- [x] M0-18 IndexedDB 이름 공간 `wn:<wsId>:` (SY-05 대비) — b672776
- [x] M0-19 문서 레지스트리 LRU 언로드 (SY-01) — e2a1b3b
- [x] M0-20 `unknown` 노드 보존 처리 (ED-B23) — e666598

### 동기화 보강
- [x] M0-21 스케줄: 최대 대기 60초, 백오프, rate-limit 대기 (SY-02b,c) — 7229244
- [x] M0-22 ETag 조건부 요청 (SY-02h) — a21cb35
- [x] M0-23 탭 간 리더 선출 (SY-02e) — bceedce
- [x] M0-24 동기화 로그 + 설정 화면 표시 (SY-02d, ST-04) — fc9254b

### 마무리
- [x] M0-25 PoC 기능 회귀 e2e 전부 통과, 성능 기준선 측정 → `docs/perf-history.md` — 6695af5
- [x] M0-26 PWA 아이콘 PNG(192/512/maskable/apple 180), manifest shortcuts (MB-42, MB-44) — 85511df

---

## M1 워크스페이스와 탐색
> M0에서 넘어온 사항: 모델은 이미 v2(`views`/`spaces`/`users`)이고 `core/model/pages.ts`가 UI용 `PageMeta`로 감쌈 (스페이스 부모는 `parentId: null`로 숨김). 현재 사용자는 `local` (DECISIONS 015). 페이지 전환 187ms로 목표(150ms) 초과 (perf-history). 초기 번들 여유 4.4KB — M1 기능은 지연 로드 기본.
- [x] M1-01 뷰 모델 API (`core/model/views.ts`): `pages.ts`를 views/spaces 모델로 정리(스페이스 부모 노출, IconValue 전체), create/update/move/trash/restore/delete/duplicate + 테스트. 기존 `PageMeta` 사용처 이전 — e530a72
- [x] M1-02 사이드바 재작성: 가상 스크롤 트리 + 셀렉터 구독 (WS-03) — c35f052
- [x] M1-03 트리 DnD (마우스·터치·키보드, 위/아래/안으로) (WS-03) — 2fbedea
- [x] M1-04 인라인 이름 바꾸기, F2, 더보기 메뉴 전체 항목 (WS-03) — de81ac0
- [x] M1-05 스페이스: 생성/수정/삭제/전환/정렬 (WS-02) — 73c2501
- [x] M1-06 즐겨찾기 정렬(FracKey DnD) + 로그인 사용자 추적: 연결 시 `users.local` 상태를 로그인 사용자로 합치기 (WS-04, spec/02 §8, DECISIONS 015) — 4a10188
- [x] M1-07 최근 항목 (WS-05) — ac734fe
- [x] M1-08 휴지통 완성: 모두 복원/비우기, 삭제된 페이지 배너 (WS-06) — def48d5
- [x] M1-09 검색 워커 (MiniSearch, 한글 bigram, 증분 인덱스, IndexedDB 저장) (WS-07) — 82acec9
- [x] M1-10 명령 팔레트 UI (⌘K, 결과 강조, 경로, 키보드) + 폰 검색 탭 (WS-07, MB-04) — 01674b3
- [x] M1-11 브레드크럼 생략, 상단 바 정리 (WS-09) — 73f4dfe
- [x] M1-12 사이드바 폭 조절·접기·호버 펼치기, 태블릿 드로어 (WS-10) — 1e03cb9
- [x] M1-13 이동 대화상자 (WS-12) — 00042ab
- [x] M1-14 EmojiPicker(전체, 검색, 최근) + IconPicker (ED-F12) — 5c82c28
- [x] M1-15 다중 워크스페이스: 목록·추가·전환·공유받은 저장소 열기 (WS-01, SY-05, ST-01, ST-02). 슬롯(`core/docs/slots.ts`) 확장, 더티 표시·동기화 상태·동기화 로그 키를 워크스페이스별로 분리, 전환 시 문서 전부 언로드 — 9d10f35
- [x] M1-16 폰 홈 개편: 워크스페이스 전환, 스페이스 탭, 최근 항목 (MB-02) — aa64f38
- [x] M1-17 라우팅 v2 (`#/w/:ws/v/:id`) + 구 경로 리디렉션 — 3d0010e
- [x] M1-18 전역 단축키 (WS-14) — 40094b7
- [x] M1-20 새 뷰 만들기 메뉴: 문서 (Grid/Board/Calendar는 M4~5에서 활성화), 폰 FAB (WS-11) — ed16886
- [x] M1-21 페이지 전환 150ms 이내 (에디터 재생성 비용 분석·개선), `npm run perf` 기록 — 6dff226
- [x] M1-19 e2e + 실기기 QA — 항목별 e2e(데스크탑·폰) 추가 완료, 실기기 QA는 docs/QA.md "M1"로 사용자 확인 요청

## M2 에디터 완성 (텍스트)
> 규칙: 새 노드·마크 타입을 푸시하는 커밋마다 schemaVersion을 올리고(빈 `up` 마이그레이션 + 테스트) 구버전을 읽기 전용으로 만든다 (spec/02 §6, DECISIONS 009). 에디터 청크 예산 210KB(현재 166.7KB) — 코드 하이라이트·표 등 무거운 확장은 별도 지연 로드.
- [x] M2-01 블록 레지스트리 (슬래시·모바일 블록 패널·블록 바꾸기 메뉴의 단일 출처, 한/영 키워드, 최근 사용 우선, 카테고리) (ED-F01) — 9effabd
- [x] M2-02 제목 4~6 + 번호 목록 스타일(1/a/i 순환, 시작 번호) (ED-B02, ED-B05) — schemaVersion 변경 없음(속성·레벨만) — e08b99f
- [x] M2-03 토글 목록·토글 제목 (펼침 상태 기기별) (ED-B06, ED-B07) — schema v3 — d02b828
- [x] M2-04 콜아웃 (아이콘·색) (ED-B09) — schema v4 (또는 03과 묶어 v3) — 5c77ccc
- [x] M2-05 코드 블록: 언어 선택, 줄 바꿈, 복사, 하이라이트 지연 로드 (ED-B10) — f46a2b8
- [x] M2-06 링크 팝오버(열기·복사·수정·제거) + 폰 링크 시트 (ED-I02, MB-25) — 83e746b
- [x] M2-07 글자 색·배경색 (10색 팔레트) (ED-I03) — 마크 추가 시 schema 증가 — ac56b11
- [x] M2-08 페이지 멘션 `@`/`[[` (제목 실시간, 삭제 표시) + 날짜 멘션 (ED-I04, ED-I05) — schema 증가 — eb1742f
- [x] M2-09 이모지 제안 `:` (ED-I07), 위·아래 첨자 (ED-I08) — cc802ca
- [x] M2-10 하위 페이지 블록 (생성 시 자식 뷰, 블록 삭제 시 휴지통) (ED-B19) — e13ee00
- [x] M2-11 표(simple table: 헤더, 열 너비, 셀 배경, 정렬) — 지연 로드 (ED-B16) — 6cb4c4e
- [x] M2-12 다단(2~5단, 비율) + 목차 (ED-B17, ED-B18) — ec64b60
- [x] M2-13 블록 메뉴(바꾸기·복제·삭제·색·블록 링크·정렬·이동) + 블록 링크 이동·강조 (ED-F02, ED-F03, ED-F15) — 16280ad
- [x] M2-14 다중 블록 선택 (드래그·Shift+클릭·Esc 블록 선택 모드, 일괄 작업) (ED-F04) — 7804fe8
- [x] M2-15 붙여넣기: HTML ↔ 블록, Markdown 감지 변환, URL → 링크 (ED-F06 텍스트 부분) — a46d39c
- [x] M2-16 찾기/바꾸기 ⌘F (대소문자, 모두 바꾸기) + 실행 취소 묶음 조정 (ED-F07, ED-F08) — 43e76b1
- [x] M2-17 들여쓰기 확장(토글 하위 등), 마크다운 단축키 보완, 텍스트 방향 (ED-F09, ED-F16, ED-F13) — 169b610
- [x] M2-18 페이지 스타일(글꼴·크기·줄 간격·전체 폭) + 커버(색·그라디언트·URL, 위치) + 잠금 표시 정리 (ED-F10, ED-F11, ED-F17) — 4443d0d
- [x] M2-19 모바일 도구 모음 v3 (`+` 블록 패널, `Aa` 텍스트 스타일 패널 — 위·아래 첨자·색 포함 …) (MB-21) — a1809ca
- [x] M2-20 선택 시 떠 있는 도구 모음(폰), 블록 길게 누르기 → 블록 메뉴 시트, 커서 자동 스크롤 (MB-22, MB-23, MB-24) — da9666f
- [x] M2-21 IME 회귀 e2e 전 블록 + 성능 기록 + 실기기 QA (MB-26) — a74c2d8

## M3 미디어와 임베드
> 규칙: M2와 같음 — 새 노드·마크 타입마다 schemaVersion 증가(빈 `up` + 테스트, `schema.test.ts` 목록 갱신). **초기 번들 123.6/125KB**: M3 기능은 전부 지연 청크로(KaTeX ≤120KB, 파일 저장소·이미지 처리는 업로드할 때). 에디터 청크 197/210KB — 새 노드 정의는 가볍게, 무거운 UI·라이브러리는 별도 청크(`check-size.mjs`에 등록).
- [x] M3-00 사전 정리: 초기 번들 여유 확보(사이드바·홈의 클릭 전용 UI 지연 로드 검토), 데코레이션 플러그인이 필요할 때만 계산하는지 점검 (spec/10) — 7541b62
- [x] M3-01 파일 저장소 코어: SHA-256 → `files/<sha256>.<ext>`(중복 제거), IndexedDB `pendingFiles`(오프라인 대기), 다음 동기화 커밋에 포함, 25MB 제한 (SY-04) — 6028f0a
- [x] M3-02 파일 표시 캐시: Git blob API로 받아 IndexedDB `fileCache`(LRU 200MB) → objectURL, 연결 전·오프라인 자리 표시 (SY-04) — f79077b
- [x] M3-03 이미지 전처리: 긴 변 2560px, WebP(지원 시), EXIF 회전, "원본 유지" 옵션 (SY-04) — 717ad59
- [x] M3-04 이미지 블록 `image`(src=fileId|url, width, align, caption) — 업로드(선택·붙여넣기·끌어 놓기), URL, 크기 조절, 정렬, 캡션, lazy + 비율 예약, 폰 사진 선택 (ED-B12, ED-F06 이미지) — schema 증가 — b904ab2
- [x] M3-05 파일 블록 `file`(fileId, name, size) — 업로드 진행 표시, 내려받기 (ED-B14) — schema 증가 — b1ced84
- [x] M3-06 동영상 `video`(YouTube/Vimeo/직접 URL) + 임베드 `embed`(iframe 허용 목록) (ED-B13, ED-B22) — schema 증가 — 4571767
- [x] M3-07 수식 블록 `mathBlock` + 인라인 수식 `inlineMath` (KaTeX 지연 로드, `$$`·`$…$`, 편집 팝오버/폰 시트) (ED-B15, ED-I06) — schema 증가 — 78c1a68
- [x] M3-08 Worker `/unfurl`(OG 메타, 허용 출처, 캐시) + 링크 미리보기 블록 `linkPreview` + URL 붙여넣기 시 링크/미리보기/임베드 선택 (ED-B21, ED-F06) — schema 증가 — 84d5e11
- [x] M3-09 커버·페이지 아이콘 이미지 업로드 (ED-F11, ED-F12) — 2208956
- [x] M3-10 저장소 정리: 참조되지 않는 `files/` 스캔·삭제(설정에서 수동 실행) (SY-04) — d591045
- [x] M3-11 e2e(데스크탑·폰) + 성능 기록 + 실기기 QA — 9521ac0

## M4 데이터베이스 I: 엔진 + Grid
> 규칙: 스키마는 spec/02 §4. DB 코드는 전부 지연 청크 `features/database`(예산 120KB, `check-size.mjs` 등록), 초기 번들 122.9/125KB·에디터 204.9/210KB라 정적 import 금지. 미완성 UI는 기능 플래그 `database` 뒤에. 쿼리 엔진은 React 없는 `core/model/database`. **파일을 참조하는 새 위치(media 필드, 행 커버)는 `core/files/refs.ts`에 추가** (빠지면 저장소 정리가 지움, M3-10).
- [x] M4-00 사전 정리: 기능 플래그 `database`, `features/database` 지연 청크 골격 + 예산 등록, `fast-check` 추가, 새 뷰 메뉴의 Grid 항목을 플래그로 노출 (spec/10 §1.1) — DB 문자열은 지연 사전(`features/database/i18n`, `dt()`) — aa8712d
- [x] M4-01 DB 데이터 모델: `db/<id>`(meta·fields·views), `dbr/<id>/<shard>`(샤드 8개, `hash(rowId) % 8`), `createDatabase`(workspace 뷰 kind=database·layout=grid, 기본 필드 text), 필드·행·셀 CRUD(셀 LWW, 행 order FracKey) — workspace에 새 뷰 종류가 생기므로 **schema 증가**(구버전은 읽기 전용) (spec/02 §4, DB-F05) — `core/model/database`, `core/docs/database.ts`(openDatabase) — 97ebd2c
- [x] M4-02 DB 문서 수명·동기화: 레지스트리 LRU/retain(DB 열람 중 스키마+샤드 8개 유지), 탭 중계, 영구 삭제 시 `data/dbs/<id>/` 파일 삭제(엔진), 첫 연결 시 DB 문서 더티 표시, 엔진 테스트 (SY-02a) — 행 페이지 `row/` 문서의 첫 연결 더티 표시는 M5-04에서 — a4535c9
- [x] M4-03 쿼리 엔진 `runQuery`: 필터(타입별 조건 전부, AND/OR 2단계, 상대 날짜), 정렬(여러 조건, `Intl.Collator('ko', {numeric})`, 빈 값 마지막, 안정 정렬), 계산 14종 — 조건 × 타입 전수 단위 테스트 + fast-check 속성 테스트 (spec/05 §2, §4.1~4.2, spec/02 §4.4) — 5c73b31
- [x] M4-04 증분 갱신 + 워커: 행 변경 키만 다시 평가(이진 탐색 삽입), 설정 변경 시 전체 재계산, 5,000행 이상은 `query.worker.ts`(변경분만 전송) — 증분 결과 = 전체 재계산 결과 속성 테스트 (spec/05 §2) — `openDbSession`/`useDbSession` — ddf9ef0
- [x] M4-05 필드 타입 1: text(줄 바꿈), number(서식·소수점·통화 KRW/USD/EUR/JPY, `inputmode=decimal`), checkbox, url(열기·복사), createdTime/updatedTime(읽기 전용), time(`1h 30m`) — 셀 표시·편집 (spec/05 §3.2) — 기본 Grid(행 가상 스크롤·고정 헤더·첫 열 고정)·QA 시드 `seed-db`/`seed-db-10k` 포함 — 11320c5
- [x] M4-06 필드 타입 2: select/multiSelect(옵션 팝오버: 검색·새 옵션·이름·색·삭제·순서, 10색 토큰 라이트·다크), date(달력 팝오버: 시간·종료일·형식·지우기), checklist(진행률, 항목 편집) — 폰은 하단 시트 (spec/05 §3.2~3.3) — 10a45d2
- [x] M4-07 필드 타입 3 + 변환: media(files/ 업로드·썸네일·순서·삭제, `refs.ts`에 추가), 타입 변환 규칙 §3.4 전수 테스트, 값이 사라지면 확인 대화상자("N개 셀"), 변환 30초 실행 취소(DB 범위 UndoManager) (spec/05 §3.4) — 타입 변경 메뉴 연결은 M4-11 (`changeFieldType`) — 9a04567
- [x] M4-08 Grid 렌더링: 행·열 가상 스크롤, 고정 헤더, 첫 열 고정(frozenColumns), 줄 바꿈 필드 자동 행 높이(측정) (DB-G01, DB-G08, DB-F06) — 줄 바꿈 e2e는 M4-11(필드 메뉴) — 6d684e0
- [x] M4-09 Grid 행 조작: 하단 `+ 새 행`, 행 호버 `+`(아래 삽입), 위/아래 삽입·복제·삭제, 다중 선택 삭제, 드래그 순서 변경(정렬 중이면 안내), 필터가 있으면 새 행에 조건 값 채우기, 행 열기 버튼(M5-04 전까지 속성 시트) (DB-G02, DB-G03, DB-G05) — 정렬 안내·필터 채우기 e2e는 M4-12 — 3941003
- [x] M4-10 셀 키보드·클립보드: 방향키·Tab·Enter 편집·Esc 취소, 범위 선택, TSV 복사/붙여넣기(엑셀·구글 시트 호환, 행 자동 추가, 타입별 파싱) (DB-G04) — 250aef7
- [x] M4-11 필드 UI: 헤더 끝 `+`(타입 선택), 필드 메뉴(이름·타입 변경·타입별 옵션·숨기기·복제·삭제·왼쪽/오른쪽 삽입·줄 바꿈), 헤더 드래그 순서·폭 조절, primary 필드 삭제·타입 변경 불가 (DB-F01~F05) — 열 고정 메뉴 포함 — ba24b41
- [x] M4-12 설정 바: 필터 UI(조건·AND/OR 그룹), 정렬 UI(드래그 우선순위), 속성 표시/숨김 목록, 행 텍스트 검색, 계산 행(열 하단 CalcType 선택) (DB-G06, DB-G07, DB-F04) — 8ee824c
- [x] M4-13 폰 Grid: 가로 스크롤 + 첫 열 고정, 셀 탭 → 편집 시트, "카드 목록 보기" 전환, 필터·정렬·속성은 전체 높이 시트, 44px 터치 영역 (MB-30, MB-34) — 47b92fc
- [x] M4-14 성능 벤치(`tests/perf`): 10,000행 × 20필드 열기 < 800ms, 스크롤 fps, 셀 편집 반영 < 16ms, 필터 변경 < 100ms(워커) → perf-history 기록 (spec/05 §11, spec/10) — 4× 감속에서 열기 2.3s·스크롤 31fps는 목표 미달(감속 없이는 641ms·60fps), 개선 과제는 STATUS — 6ba0d78
- [x] M4-15 e2e(데스크탑·폰: 필드 추가·편집, 셀 편집·키보드, 필터·정렬, TSV, 폰 시트) + 성능 기록 + 실기기 QA — e2e 데스크탑 11·폰 1(×2)·영어 1, 실기기 QA는 docs/QA.md "M4"로 사용자 확인 요청 — 22636c3

## M5 데이터베이스 II: Board, Calendar, 행 페이지, 인라인 DB
> 규칙: M4와 같음 — DB 코드는 지연 청크 `features/database`(32.6/120KB), 초기 번들 123.8/125KB라 페이지·사이드바 쪽 추가는 최소로. 새 뷰 종류·새 블록 타입(`database`)·행 페이지 문서 `row/<db>/<row>`는 **schema 증가**(spec/02 §6). 행 페이지 본문은 에디터 청크 재사용(`loadEditor`), 행 페이지·커버의 파일 참조는 `core/files/refs.ts`(행 커버는 M4-07에 이미 있음, `row/` 문서 본문 추가). 행 컴포넌트는 메모되므로 새 객체 prop 금지(STATUS). Board·Calendar가 끝나면 **기능 플래그 `database` 제거**.
- [x] M5-00 사전 정리: DB 첫 화면 속도(M4-14 과제: 행 스냅샷 캐시 또는 샤드 점진 적용 검토, 4× 감속 10k 열기 목표 접근), `GridRow`·카드 공통 셀 표시 정리, 뷰 레이아웃 전환 골격(`DatabaseView`가 layout별 지연 컴포넌트) (spec/10, spec/05 §11) — a5a8101
- [x] M5-01 탭 바와 다중 뷰: 탭 추가(레이아웃 선택 → `addDbView` + workspace 뷰 `embedded`/형제), 이름 바꾸기, 복제(설정 복사), 삭제(마지막 뷰는 불가), 순서 끌기, 뷰마다 필터·정렬·속성 독립. 사이드바의 DB 아래 "연결된 뷰" — workspace 뷰 구조 결정 + **schema 증가**(필요 시) (spec/05 §1, DB-L) — 5b18082
- [x] M5-02 Board 데이터: 그룹 키 계산(select·multi·checkbox·date 일/주/월/년·url), `runQuery`의 `groups`, 그룹 순서·숨김(`group.order`/`hidden`), "값 없음" 그룹 — 전수 테스트 + 증분 갱신 속성 테스트 (DB-K01, DB-K05, spec/05 §2) — 5b18082
- [x] M5-03 Board UI: 열 가로 스크롤 + 열 안 세로 가상 스크롤, 카드(표시 필드 선택·커버 이미지/media), 카드 클릭 → 행 페이지, 카드 제목 인라인 편집, 열에 카드 추가 (DB-K02, DB-K06, DB-K07) — 7791560
- [x] M5-04 Board 드래그: 같은 열 순서·다른 열 이동(셀 값 변경, multi는 옮긴 그룹 값만 교체), 열 순서 끌기, 마우스·터치(길게 누른 뒤), 가장자리 자동 스크롤, 1,000카드 끊김 없음 (DB-K03, DB-K04, MB-32) — b842c3e
- [x] M5-05 Board 열 관리: 이름 바꾸기(= 옵션 이름), 색, 숨기기·숨긴 그룹 패널, 새 그룹(옵션) 추가, 필터·정렬(열 안 정렬) (DB-K04, DB-K05, DB-K08) — 2799a51
- [x] M5-06 Calendar: 월 보기(주 시작 요일·주말·주 번호), 날짜 필드 선택·없으면 생성 안내, 범위 이벤트 여러 날 막대, 오늘·이전/다음·월 선택기, 날짜 칸 더블클릭(폰 탭) → 새 행 (DB-C01~C03, DB-C06, DB-C07) — 0e578e7
- [x] M5-07 Calendar 드래그·일정 없음: 이벤트 끌어 날짜 변경(범위 유지), "일정 없음" 패널에서 끌어 배치, 폰: 월 그리드 + 선택 날짜 목록 (DB-C04, DB-C05, DB-C08, MB-33) — fe68ca6
- [x] M5-08 행 페이지: `row/<db>/<row>` 문서(첫 입력 때 생성, `hasDoc`), 상단 아이콘·커버·제목(primary), 속성 목록(숨긴 필드 접기 "N개 숨김", 필드 추가, 끌어 순서), 본문 에디터 — **schema 증가**, 동기화 경로·영구 삭제·첫 연결 더티·`refs.ts`(행 본문) (DB-R01~R03, spec/02 §1) — 30ba3db
- [x] M5-09 행 페이지 탐색: 데스크탑 가운데 모달(전체 화면 전환), 폰 전체 화면(MB-31), 이전/다음 행, 링크 복사(라우트 `#/w/:ws/v/:id/r/:row`), 복제, 삭제, 뒤로 가기. Grid의 "열기"·Board 카드·Calendar 이벤트가 행 페이지로 (DB-R04, DB-G05, MB-31) — e4397ac
- [x] M5-10 인라인 DB 블록 `database`(databaseId, viewId, layout): 슬래시 메뉴 새로 만들기(Grid/Board/Calendar)·기존 DB 연결, 높이 제한(기본 400px, 조절), "전체 페이지로 열기", 노드 뷰는 지연 청크 — **schema 증가**(노드 타입) (ED-B20, DB-L, spec/05 §8) — a03700b
- [x] M5-11 기능 플래그 `database` 제거, 새 뷰 메뉴 Board·Calendar 활성화, 사이드바 아이콘(보드·캘린더), 빈 DB 안내 (WS-11) — 47afbe2
- [x] M5-12 e2e(데스크탑·폰: 탭 바, Board 드래그 마우스·터치, Calendar 드래그, 행 페이지, 인라인 DB) + 성능 기록(`perf:db` + Board 1,000카드) + 실기기 QA — ac59d57

## M6 데이터베이스 III: 관계, 롤업, CSV, 저장소 크기
> 규칙: M5와 같음 — DB 코드는 지연 청크(`database` 41/120KB, `dbBoard`·`dbCalendar`), 에디터 청크 208.9/210KB·초기 123.3/125KB·부팅 i18n 7.9/8KB는 거의 꽉 참(새 문자열은 `features/database/i18n`). 새 필드 타입·셀 형식은 **schema 증가**(spec/02 §6) + 테스트 먼저. 두 DB에 걸친 쓰기(양방향 관계)는 두 Y.Doc이라 원자적이지 않음 → 동기화 후 정합성 검사·복구. 공유 B안(M9)을 위해 관계 대상은 `databaseId`로만 가리키고, 다른 스페이스(저장소)의 DB를 가리킬 수 있는지 표시(`targetSpaceId` 계산 가능하게).
- [x] M6-00 사전 정리: Board 열·카드 메모(끌기 중 다시 그리기 줄이기), 행 삭제 후 일정 기간 지난 본문 문서(`row/`) 정리 정책, 문서에서 지운 인라인 DB 블록의 embedded 뷰 정리(휴지통으로), 인라인 DB 탭 바 검토 (spec/05 §8, §11) — e2363db
- [x] M6-01 관계 필드 데이터: `relation` 셀 `rowId[]`, 옵션 `targetDatabaseId`·`twoWay`·`pairedFieldId`, 대상 행 스냅샷 읽기(대상 DB 세션), 지워진 대상 행은 빈 값 — **schema 증가** + 단위 테스트 (DB-X, spec/02 §4.3) — 1220703
- [x] M6-02 관계 UI: 셀 칩(대상 행 제목), 대상 DB 행 검색 선택기(데스크탑 팝오버·폰 시트), 칩 누르면 대상 행 페이지(DB-R05, 뒤로 가기), 행 페이지 속성, 필드 메뉴에서 대상 DB 고르기 (spec/05 §3.2, §7) — f07a260
- [x] M6-03 양방향 관계: 짝 필드 자동 생성·이름, 한쪽 변경 시 반대쪽 셀 갱신, 동기화·병합 후 불일치 검사 및 복구, 한쪽 필드/DB 삭제 처리 — 정합성 속성 테스트(fast-check, 두 DB 무작위 편집·병합) (spec/05 §10) — 751d5d8
- [x] M6-04 롤업(P2): 관계 필드 → 대상 필드 → 함수(count·sum·avg·min·max·고유 값·체크 비율), 읽기 전용 셀, 대상 DB 변경 시 다시 계산(증분), 필터·정렬·계산 행 지원 (spec/05 §10, spec/02 §4.4)
- [ ] M6-05 관계·롤업 쿼리와 변환: 필터(포함·비어 있음), 정렬(대상 제목), 계산, 타입 변환 규칙(관계 ↔ 텍스트 등) 전수 테스트, Notion 가져오기의 관계 열 연결 (spec/05 §3.4, §4.2)
- [ ] M6-06 CSV 가져오기(DB-IO, IO-03): 워커 파싱(따옴표·CRLF·BOM·큰 파일), 타입 추론(`inferColumn` 재사용), 미리보기 대화상자(열 타입 바꾸기·첫 행 헤더), 새 DB로 / 기존 DB에 행 추가 (spec/05 §9, spec/09)
- [ ] M6-07 CSV 내보내기(IO-13): 현재 보기(필터·정렬·보이는 필드) 또는 전체, 값은 표시 문자열(선택 이름·날짜 형식), 다운로드(폰 공유 시트) (spec/05 §9)
- [ ] M6-08 계산 보강(DB-G06): 폰 계산 행, Board 열 머리 계산(개수 외 합계 등 선택), 롤업 계산 (spec/05 §4)
- [ ] M6-09 저장소 크기 관리(SY-03): 설정에 저장소 크기 표시, 500MB 넘으면 정리 권장, "저장소 기록 정리"(현재 트리로 새 루트 커밋 + 강제 갱신, 다른 기기 최신 확인 안내) — 메모리 GitHub e2e (spec/06 SY-03)
- [ ] M6-10 e2e(데스크탑·폰: 관계 선택·칩 이동·양방향, 롤업, CSV 왕복) + 성능 기록 + 실기기 QA

## M7 ~ M11
[ROADMAP.md](ROADMAP.md)의 주요 ID를 마일스톤 시작 시 세부 항목으로 펼칩니다.
