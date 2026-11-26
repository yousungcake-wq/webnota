# 11. 엔지니어링 규칙 (유지보수성)

## 1. 코드 규칙

| 규칙 | 기준 |
|---|---|
| TypeScript | `strict`, `noUncheckedIndexedAccess`, `any` 금지 (불가피하면 `unknown` + 좁히기), `as` 단언은 경계(외부 데이터 파싱)에서만 |
| 파일 크기 | 400줄 이하 권장, 600줄 초과 금지 (lint 경고) |
| 함수 | 한 가지 일. 60줄을 넘으면 분리 검토 |
| 컴포넌트 | 표시 컴포넌트와 데이터 연결(훅)을 분리. 비즈니스 로직은 `core/model`의 순수 함수로 |
| 이름 | 파일: 컴포넌트 `PascalCase.tsx`, 그 외 `camelCase.ts`. 불리언 `isX/hasX/canX`. 이벤트 핸들러 `onX`, 내부 `handleX` |
| 주석 | "왜"를 씁니다. 외부 제약(GitHub API 한도, iOS 버그)은 출처와 함께 |
| 문자열 | 사용자에게 보이는 문자열은 전부 `t('key')` (i18n). 한국어가 기본, 영어 동시 작성 |
| 스타일 | 기능 폴더에 CSS 파일을 함께 둡니다 (`Sidebar.css`). 색·간격·반경은 토큰 변수만 사용 (하드코딩 금지, stylelint) |
| 의존성 | 추가 전 크기·유지보수 확인, [DECISIONS.md](../DECISIONS.md)에 기록 |
| 모듈 경계 | [01-architecture.md](01-architecture.md) §3 규칙 (eslint `import/no-restricted-paths`) |

## 2. 데이터 변경 규칙

- Y.Doc 변경은 `core/model`의 함수로만 합니다. 컴포넌트에서 `ymap.set()`을 직접 호출하지 않습니다.
- 여러 키를 바꾸는 작업은 `doc.transact()` 하나로 묶습니다.
- 트랜잭션 origin을 명시합니다: `'local'`(기본), `'remote'`, `'migration'`, `'import'`, `'undo'`.
- 스키마 변경은 [02-data-model.md](02-data-model.md) §6 절차를 따릅니다.

## 3. 테스트 전략

| 층 | 도구 | 대상 | 기준 |
|---|---|---|---|
| 단위 | Vitest | `core/*` 전부 (모델, 쿼리, 동기화, 마이그레이션, 변환기) | `core` 라인 커버리지 85% 이상 |
| 컴포넌트 | Vitest + Testing Library (jsdom) | 복잡한 UI 상태 (필터 편집기, 날짜 선택기) | 핵심 상태 전이 |
| e2e | Playwright | 기능별 시나리오 (`tests/e2e/<feature>.spec.ts`), 데스크탑·Pixel 7·iPhone 14·iPad | 마일스톤 기능마다 1개 이상 |
| IME | Playwright + CDP | 모든 텍스트 입력 지점 한글 조합 | 회귀 0 |
| 성능 | Playwright + CDP | [10-performance.md](10-performance.md) §3 | 예산 준수 |
| 다중 기기 동기화 | Vitest (FakeRemote) | 병합, 경합, 삭제, 마이그레이션 중 동기화 | 시나리오 추가 시 테스트 추가 |
| 실기기 | 사람 | [QA.md](../QA.md) 체크리스트 | 마일스톤 완료 조건 |

버그를 고칠 때는 재현 테스트를 먼저 작성합니다.

## 4. CI (GitHub Actions)

`main`과 PR에서 실행합니다:
1. `npm ci`
2. `npm run lint` (eslint + stylelint + prettier --check)
3. `npm run typecheck`
4. `npm test` (Vitest + 커버리지)
5. `npm run build` + `node scripts/check-size.mjs` (번들 예산)
6. `npm run e2e` (Playwright, 빌드 결과 대상, `--trace off`)
7. (main만) GitHub Pages 배포

Worker는 `worker/`가 바뀌었을 때 typecheck + 단위 테스트만 실행합니다. 배포는 수동입니다 (사용자 Cloudflare 계정).

## 5. 브랜치·커밋

- 기본 흐름: 작업 단위(체크리스트 항목 1~3개)마다 커밋합니다. 메시지는 `feat(editor): 토글 블록 (ED-B06)`처럼 체크리스트 ID를 포함합니다.
- 커밋 전 필수: `npm run verify` (lint + typecheck + test + build + size). e2e는 UI를 바꿨을 때 실행합니다.
- 브랜치 정책은 [../../CLAUDE.md](../../CLAUDE.md)의 "Git 작업 흐름"을 따릅니다.

## 6. 기능 플래그

- `core/flags.ts`: 미완성 기능을 플래그 뒤에 숨기고 `main`에 병합합니다. 설정 → 고급에서 켤 수 있습니다.
- 플래그는 기능이 완성되면 제거합니다 (체크리스트 항목에 "플래그 제거" 포함).

## 7. 문서화

- 각 feature 폴더에 `README.md`(책임, 공개 API, 주요 결정)를 둡니다.
- 공개 함수에는 TSDoc 한 줄을 답니다.
- 기획 변경은 `docs/spec/*`를 먼저 고치고 구현합니다. 구현이 기획과 달라지면 같은 커밋에서 기획을 갱신합니다.

## 8. 완료 정의 (Definition of Done) — 체크리스트 항목 하나

1. 기획(spec)의 요구 사항을 충족
2. 데스크탑·폰 레이아웃 모두 동작 (해당 시)
3. 라이트·다크 테마, 한국어·영어 문자열
4. 키보드 접근 가능, 포커스 표시, `aria-*` 레이블
5. 단위·e2e 테스트 추가, `npm run verify` 통과
6. 성능 예산 준수
7. `docs/CHECKLIST.md` 체크, `docs/STATUS.md` 갱신
