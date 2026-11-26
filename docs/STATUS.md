# 진행 상태 (세션 인계 문서)

> 새 세션은 이 파일부터 읽으세요. 작업 단위가 끝날 때마다 갱신합니다.

## 현재 위치

- **마일스톤**: M0 기반 정비
- **진행 상황**: M0 26개 중 9개 완료 (M0-01~09: 린트, tsconfig, 번들 예산, verify, CI, Playwright Test, 구조 이전, useY/createStore, 토큰 CSS)
- **진행 중 항목**: (없음)
- **다음 할 일**: M0-10 i18n — `core/i18n`에 `t()` + `ko.ts`/`en.ts` 사전, 기존 하드코딩 문자열(features/*, core/model `displayTitle`, 동기화 오류 메시지) 이전, `navigator.language` 감지 + 설정 화면 언어 선택
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
- `core/schema`, `core/persistence`는 아직 없음. IndexedDB는 `core/docs/registry.ts`가 y-indexeddb를 직접 씀 → M0-15/M0-18에서 분리.

- 실제 GitHub API로 동기화를 검증하지 못함 (작업 환경 프록시 제한). 사용자 확인 필요.
- 실기기 한글 IME 미검증 (에뮬레이션 CDP 테스트만 통과).
- Tiptap DragHandle/EditorContent가 DOM을 직접 옮겨서 React 재조정이 어긋난 적이 있음 → `page-body`를 `key={id}`로 감싸서 해결. 에디터 주변 구조를 바꿀 때 주의.
- 작업 환경에서는 `*.github.io`에 접속할 수 없어 배포본 e2e를 돌릴 수 없음. 로컬 `npm run e2e` (vite preview)로 테스트.
- 첫 실행 시 환영 페이지 시드가 에디터 청크를 기다려서 에디터 표시까지 약 1초 (재방문은 빠름). M0-25 성능 기준선에서 측정·개선 검토.
- 번들 초기 진입 109.6KB / 예산 125KB. 여유가 15KB뿐이므로 M1 기능은 지연 로드를 기본으로.
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
