# 진행 상태 (세션 인계 문서)

> 새 세션은 이 파일부터 읽으세요. 작업 단위가 끝날 때마다 갱신합니다.

## 현재 위치

- **마일스톤**: M0 기반 정비
- **진행 상황**: M0 26개 중 6개 완료 (M0-01~06: 린트, tsconfig, 번들 예산, verify, CI, Playwright Test)
- **진행 중 항목**: (없음)
- **다음 할 일**: M0-07 구조 이전 (`src/core`, `src/features`, `src/ui`, `src/platform`, `src/app`). 큰 리팩터링이므로 파일 이동 → import 수정 → verify → e2e 순서로, 기능 변경 없이 진행
- **CI**: https://github.com/yousungcake-wq/webnota/actions (main 푸시 시 verify + e2e + 배포)
- **배포 주소**: https://yousungcake-wq.github.io/webnota/
- **저장소**: https://github.com/yousungcake-wq/webnota

## 완료된 것 (요약)

- PoC (v0.1.0): Tiptap 에디터, 슬래시 메뉴, 모바일 키보드 도구 모음, 페이지 트리, 즐겨찾기, 휴지통, 검색(제목), 테마, IndexedDB, GitHub 동기화 엔진(테스트 6개), Cloudflare Worker(토큰 교환), Pages 배포
- 기획서 (`docs/spec/00~12`), 로드맵, 체크리스트

## 알려진 문제·주의

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
