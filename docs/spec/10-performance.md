# 10. 성능

성능은 기능과 같은 수준의 요구 사항입니다. 예산을 넘는 변경은 CI에서 실패합니다.

## 1. 성능 예산

### 1.1 번들 (gzip 기준, CI `scripts/check-size.mjs`로 강제)

측정 방식: Vite 빌드 매니페스트의 정적 import 그래프. 초기 모듈은 `vite.config.ts`의 `$initial` 그룹으로 한 청크에 모읍니다 (DECISIONS 018). "초기 진입"은 엔트리의 정적 import 전체이고, 지연 청크는 동적 import 대상 모듈의 정적 import 전체에서 초기 진입분을 뺀 값입니다. 새 지연 기능을 추가하면 `BUDGETS`에 `entry`(동적 import되는 소스 경로)를 등록합니다.

| 청크 | 예산 | 현재 (PoC) | 로드 시점 |
|---|---|---|---|
| 초기 진입 (셸 + 사이드바 + core) | **≤ 125 KB** | 122.0 KB (M3-00. M2 끝 123.0KB에서 동기화 연결·실행 코드를 sync 청크로 옮김) | 즉시 |
| GitHub 동기화 (엔진 + 클라이언트) | ≤ 12 KB | 4.1 KB (M3-00: 연결·실행 `session.ts` 포함) | 계정 연결 후 첫 동기화 |
| CSS 전체 | ≤ 25 KB | 6.3 KB | 즉시 |
| 에디터 코어 | ≤ 210 KB | 199.3 KB (M3-00. M2-15 192.9KB. 표의 prosemirror-tables는 bubble-menu가 정적으로 가져와 여기에 포함) | 페이지 열 때 (유휴 시간 프리로드) |
| 데이터베이스 | ≤ 120 KB | 0.4 KB (M4-00 골격. `db.*` 문자열 사전 포함 — 부팅 사전 i18n 8KB 예산이 거의 차서 기능 사전은 그 기능 청크와 함께 로드, `addMessages`) | DB 뷰 열 때 |
| 수식 (KaTeX + CSS) | ≤ 120 KB | 75.0 KB + CSS 1.5 KB (M3-07, 폰트 제외 — 프리캐시하지 않고 쓸 때 캐시) | 수식이 보이거나 편집할 때 |
| 코드 하이라이트 | 코어 ≤ 15 KB + 언어당 ≤ 5 KB | 8.6 KB (lowlight 코어, `lowlight` 진입점 대신 lib/index.js 별칭) | 코드 블록이 있을 때 |
| Markdown 붙여넣기 (`marked`) | ≤ 15 KB | 11.5 KB | Markdown 텍스트를 붙여넣을 때 |
| 가져오기·내보내기 | ≤ 80 KB | — | 사용할 때 |

### 1.2 런타임 (중간 사양 Android, Chrome 기준)

| 지표 | 목표 |
|---|---|
| 첫 실행 LCP (4G, 캐시 없음) | < 2.0s |
| 재방문 (PWA 캐시) 사이드바 표시 | < 400ms |
| 페이지 전환 (IndexedDB에 있는 문서) | < 150ms |
| 타이핑 입력 지연 (INP) | < 50ms, p75 |
| 1,000뷰 사이드바 스크롤 | 60fps |
| 10,000행 Grid | [05-database.md](05-database.md) §11 |
| 메모리 (문서 10개 열람 후) | < 150MB |

## 2. 기법 (필수 적용)

### 로딩
- 라우트·기능 단위 `React.lazy` + 동적 import를 씁니다. 사용자가 다음에 열 가능성이 높은 청크는 유휴 시간에 `import()`로 프리로드합니다 (예: 홈 화면에서 에디터).
- 무거운 블록·필드는 레지스트리에 `load: () => import(...)` 형태로 등록합니다.
- 폰트는 시스템 폰트를 기본으로 씁니다. 사용자 지정 글꼴만 지연 로드합니다.
- 서비스 워커가 앱 셸을 프리캐시하고, 청크는 런타임 캐시(Stale-While-Revalidate)로 둡니다.

### 렌더링
- React 셀렉터 구독(`useY`)은 필요한 값만, 얕은 비교로 다시 렌더링합니다. Y.Doc 전체 구독은 금지입니다.
- 목록(트리, Grid, Board 열, 검색 결과)은 50개를 넘으면 가상 스크롤을 씁니다.
- 큰 목록 항목은 `memo`, 안정적인 콜백(`useCallback`)을 씁니다. 렌더링 중 객체·배열 리터럴로 props를 만들지 않습니다.
- 애니메이션은 `transform`/`opacity`만 씁니다. 레이아웃을 유발하는 속성 애니메이션은 금지입니다.
- `content-visibility: auto`를 긴 문서의 화면 밖 블록 그룹에 적용합니다 (측정 후).
- 에디터 데코레이션 플러그인은 입력마다 문서 전체를 다시 훑지 않습니다 (M3-00 점검): 꺼져 있으면 `null`을 바로 돌려주고, 바뀐 부분만 다시 계산하며(코드 하이라이트: `code/changed.ts`의 `changedRanges`로 건드린 코드 블록만, 나머지는 `map`), 상태가 같으면 같은 `DecorationSet`을 돌려줍니다(찾기). 새 데코레이션 플러그인(M3 이후)도 이 규칙을 따릅니다.

### 데이터
- Y.Doc LRU 언로드 (SY-01).
- 계산(쿼리, 검색 인덱싱, 가져오기 파싱, Markdown 변환)은 메인 스레드에서 50ms를 넘으면 워커로 옮깁니다.
- IndexedDB 쓰기는 y-indexeddb가 배치 처리합니다. 앱 코드에서 동기 localStorage 쓰기를 입력 경로에 두지 않습니다 (더티 표시는 `requestIdleCallback`으로 묶어서 기록).
- 동기화 인코딩(`encodeStateAsUpdate`)은 문서가 1MB를 넘으면 유휴 시간에 실행합니다.

## 3. 측정

- `tests/perf/`에 Playwright 기반 벤치마크를 둡니다 (M0: `baseline.mjs` — 첫 실행, 재방문, 페이지 전환, 타이핑. `npm run perf`): 대형 문서 열기, 10k Grid 스크롤 FPS, 사이드바 1k 스크롤, 타이핑 지연. CPU 4배 감속(CDP `Emulation.setCPUThrottlingRate`)으로 중간 사양 Android를 흉내 냅니다.
- 결과는 `docs/perf-history.md`에 마일스톤마다 기록합니다.
- 회귀 기준: 이전 기록보다 20% 이상 나빠지면 마일스톤을 완료할 수 없습니다.
- 개발 모드에서 `?debug=perf`를 붙이면 렌더링 횟수와 Y 업데이트 크기를 오버레이로 보여줍니다 (P2).
