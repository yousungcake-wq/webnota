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
- [ ] M0-18 IndexedDB 이름 공간 `wn:<wsId>:` (SY-05 대비)
- [ ] M0-19 문서 레지스트리 LRU 언로드 (SY-01)
- [ ] M0-20 `unknown` 노드 보존 처리 (ED-B23)

### 동기화 보강
- [ ] M0-21 스케줄: 최대 대기 60초, 백오프, rate-limit 대기 (SY-02b,c)
- [ ] M0-22 ETag 조건부 요청 (SY-02h)
- [ ] M0-23 탭 간 리더 선출 (SY-02e)
- [ ] M0-24 동기화 로그 + 설정 화면 표시 (SY-02d, ST-04)

### 마무리
- [ ] M0-25 PoC 기능 회귀 e2e 전부 통과, 성능 기준선 측정 → `docs/perf-history.md`
- [ ] M0-26 PWA 아이콘 PNG(192/512/maskable/apple 180), manifest shortcuts (MB-42, MB-44)

---

## M1 워크스페이스와 탐색
- [ ] M1-01 뷰 모델 API (`core/model/views.ts`): create/update/move/trash/restore/delete/duplicate + 테스트
- [ ] M1-02 사이드바 재작성: 가상 스크롤 트리 + 셀렉터 구독 (WS-03)
- [ ] M1-03 트리 DnD (dnd-kit, 마우스·터치·키보드, 위/아래/안으로) (WS-03)
- [ ] M1-04 인라인 이름 바꾸기, F2, 더보기 메뉴 전체 항목 (WS-03)
- [ ] M1-05 스페이스: 생성/수정/삭제/전환/정렬 (WS-02)
- [ ] M1-06 즐겨찾기 사용자별 + 정렬 (WS-04)
- [ ] M1-07 최근 항목 (WS-05)
- [ ] M1-08 휴지통 완성: 모두 복원/비우기, 삭제된 페이지 배너 (WS-06)
- [ ] M1-09 검색 워커 (MiniSearch, 한글 bigram, 증분 인덱스, IndexedDB 저장) (WS-07)
- [ ] M1-10 명령 팔레트 UI (⌘K, 결과 강조, 경로, 키보드) + 폰 검색 탭 (WS-07, MB-04)
- [ ] M1-11 브레드크럼 생략, 상단 바 정리 (WS-09)
- [ ] M1-12 사이드바 폭 조절·접기·호버 펼치기, 태블릿 드로어 (WS-10)
- [ ] M1-13 이동 대화상자 (WS-12)
- [ ] M1-14 EmojiPicker(전체, 검색, 최근) + IconPicker (ED-F12)
- [ ] M1-15 다중 워크스페이스: 목록·추가·전환·공유받은 저장소 열기 (WS-01, SY-05, ST-02)
- [ ] M1-16 폰 홈 개편: 워크스페이스 전환, 스페이스 탭, 최근 항목 (MB-02)
- [ ] M1-17 라우팅 v2 (`#/w/:ws/v/:id`) + 구 경로 리디렉션
- [ ] M1-18 전역 단축키 (WS-14)
- [ ] M1-19 e2e + 실기기 QA

## M2 에디터 완성 (텍스트) — 시작 시 세부화
- [ ] M2-01 블록 레지스트리 리팩터링 (슬래시·모바일 패널·바꾸기 메뉴 단일 출처)
- [ ] M2-02 제목 4~6, 번호 목록 스타일, 토글/토글 제목, 콜아웃, 코드 블록(하이라이트 지연 로드)
- [ ] M2-03 표(simple table), 다단, 목차, 하위 페이지 블록
- [ ] M2-04 링크 팝오버, 글자/배경색, 페이지·날짜 멘션, 이모지 제안
- [ ] M2-05 블록 메뉴, 다중 블록 선택, 블록 링크
- [ ] M2-06 붙여넣기(HTML/Markdown), 찾기/바꾸기, 실행 취소 묶음 조정
- [ ] M2-07 페이지 스타일, 커버(색/그라디언트/URL), 잠금
- [ ] M2-08 모바일 도구 모음 v3, 떠 있는 선택 도구 모음, 블록 길게 누르기, 자동 스크롤
- [ ] M2-09 IME 회귀 테스트 전 블록 + 실기기 QA

## M3 미디어와 임베드 — 시작 시 세부화
- [ ] M3-01 파일 저장소 (업로드, 중복 제거, 대기열, 캐시) (SY-04)
- [ ] M3-02 이미지 블록 (리사이즈, 정렬, 캡션, 붙여넣기 업로드)
- [ ] M3-03 파일 블록, 동영상 임베드, 임베드 허용 목록
- [ ] M3-04 수식 블록 + 인라인 수식 (KaTeX 지연 로드)
- [ ] M3-05 Worker `/unfurl` + 링크 미리보기 블록
- [ ] M3-06 커버·아이콘 이미지 업로드

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
