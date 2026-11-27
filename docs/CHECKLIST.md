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
- [ ] M3-11 e2e(데스크탑·폰) + 성능 기록 + 실기기 QA

## M4 데이터베이스 I — 시작 시 세부화
- [ ] M4-01 DB 데이터 모델 + 샤딩 + 동기화 경로
- [ ] M4-02 쿼리 엔진 (필터·정렬·계산, 증분, 워커 전환) + 속성 기반 테스트
- [ ] M4-03 필드 타입 구현 (관계·롤업 제외) + 타입 변환
- [ ] M4-04 Grid 가상화, 셀 편집, 키보드, TSV 복사/붙여넣기
- [ ] M4-05 필터/정렬/속성 UI, 계산 행
- [ ] M4-06 폰 Grid + 설정 시트
- [ ] M4-07 성능 벤치마크 10k행

## M5 데이터베이스 II — 시작 시 세부화
- [ ] M5-01 탭 바와 다중 뷰, 연결된 뷰
- [ ] M5-02 Board (그룹, 드래그, 열 관리, 카드 설정)
- [ ] M5-03 Calendar (월/주, 드래그, 일정 없음 패널)
- [ ] M5-04 행 페이지
- [ ] M5-05 인라인 DB 블록

## M6 ~ M11
[ROADMAP.md](ROADMAP.md)의 주요 ID를 마일스톤 시작 시 세부 항목으로 펼칩니다.
