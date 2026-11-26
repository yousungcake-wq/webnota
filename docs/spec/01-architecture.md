# 01. 아키텍처

## 1. 전체 구성

```
┌──────────────────────── 브라우저 / PWA (GitHub Pages) ────────────────────────┐
│  UI 셸 (React)                                                              │
│   ├─ features/*  (sidebar, editor, database, search, settings, share …)     │
│   └─ ui/*        (디자인 시스템 컴포넌트)                                       │
│  core/                                                                       │
│   ├─ docs        Y.Doc 레지스트리 (지연 로드, LRU 언로드)                         │
│   ├─ persistence IndexedDB (y-indexeddb)                                     │
│   ├─ sync        GitHub 동기화 엔진 (Git Data API, 배치 커밋)                     │
│   ├─ realtime    (M10) Durable Object 중계 연결                                │
│   └─ schema      스키마 버전, 마이그레이션                                         │
│  workers/        Web Worker: 검색 인덱스, 대용량 DB 쿼리, 가져오기 파싱             │
└──────────────────────────────────────────────────────────────────────────────┘
          │ HTTPS (토큰)                          │ (선택)
          ▼                                       ▼
   api.github.com                       Cloudflare Worker (무료)
   └ 사용자 데이터 저장소                    ├ /token     OAuth 토큰 교환
     data/*.yjs, files/*                  ├ /unfurl    링크 미리보기 (OG 메타)
                                          ├ /rt/*      실시간 협업 (Durable Objects)
                                          └ cron       리마인더 Web Push
```

원칙:
1. **로컬 우선**: UI는 항상 로컬 Y.Doc만 읽고 씁니다. 네트워크는 백그라운드 작업입니다.
2. **단일 진실 원천**: 영속 데이터는 전부 Yjs 문서에 있습니다. React 상태에는 화면 전용 상태만 둡니다.
3. **서버 무저장**: Worker는 중계만 하고 사용자 데이터를 저장하지 않습니다. 실시간 협업 중 메모리 버퍼는 예외입니다.

## 2. 기술 스택 (확정)

| 영역 | 선택 | 이유 |
|---|---|---|
| 언어 | TypeScript (strict) | 유지보수성 |
| 빌드 | Vite | 빠른 HMR, 코드 분할, PWA 플러그인 |
| UI | React 19 | 에디터 생태계, 동시성 기능 |
| 에디터 | Tiptap 3 (ProseMirror) | contenteditable 기반이라 모바일 IME 안정, 확장 구조가 좋음 |
| CRDT | Yjs + y-prosemirror (@tiptap/y-tiptap) | 오프라인 병합, 실시간 협업 확장 가능 |
| 로컬 저장 | y-indexeddb | Yjs 공식 |
| 가상 스크롤 | @tanstack/react-virtual | Grid, 긴 목록, 큰 트리 |
| 드래그 앤 드롭 | @dnd-kit/core (사이드바, 보드, 그리드 행) + ProseMirror 내장 (에디터 블록) | 터치 지원, 접근성 |
| 검색 | MiniSearch (Web Worker) + 한국어 bigram 토크나이저 | 작고 빠름 |
| 수식 | KaTeX (지연 로드) | |
| 코드 하이라이트 | lowlight (언어별 지연 로드) | |
| 순서 키 | fractional-indexing | Yjs 배열 move 문제 회피 |
| 아이콘 | lucide-react (트리 셰이킹) | |
| 날짜 | 자체 유틸 + `Intl` | date-fns 없이 번들 절약 |
| 테스트 | Vitest (단위), Playwright (e2e) | |
| 서버리스 | Cloudflare Workers (+ Durable Objects, KV, Cron) | 무료 플랜 |

새 의존성 추가 기준: 압축 후 크기, 트리 셰이킹 지원, 유지보수 상태를 확인하고 [DECISIONS.md](../DECISIONS.md)에 기록합니다.

## 3. 디렉터리 구조 (목표)

```
src/
  app/              앱 셸: 부트, 라우트 → 화면 매핑, 레이아웃(데스크탑/태블릿/폰), 전역 단축키
  core/
    docs/           Y.Doc 레지스트리, 더티 추적, LRU
    persistence/    IndexedDB 어댑터
    sync/           엔진(순수 로직), GitHub 어댑터, 컨트롤러(스케줄링)
    schema/         스키마 버전, 마이그레이션 레지스트리
    model/          워크스페이스, 뷰, 데이터베이스 모델 (순수 함수, React 비의존)
    store/          React 바인딩 (useY 셀렉터 훅), 라우터 상태(router.ts), 기기별 설정(prefs.ts)
    auth/
    i18n/
  features/
    sidebar/  editor/  database/  search/  trash/  favorites/  settings/
    share/    import-export/  notifications/  templates/
  ui/               디자인 시스템 (Button, Menu, Sheet, Popover, Dialog, Toast, Tooltip …)
  platform/         뷰포트, 가상 키보드, 제스처, 햅틱, 클립보드, 파일 선택
  workers/          search.worker.ts, query.worker.ts, import.worker.ts
  styles/           tokens.css, base.css
worker/             Cloudflare Worker
docs/               기획서, 로드맵, 체크리스트, 진행 상태
tests/
  e2e/              Playwright 시나리오 (기능별 파일)
  perf/             성능 벤치마크
```

### 모듈 경계 규칙 (lint로 강제)

| 모듈 | import 가능 | 금지 |
|---|---|---|
| `core/model`, `core/sync/engine` | `yjs`, 자기 자신 | React, DOM, `features/*` |
| `core/*` | `core/*` | `features/*`, `ui/*` |
| `ui/*` | `ui/*`, `platform/*` | `core/*`, `features/*` |
| `features/X` | `core/*`, `ui/*`, `platform/*`, 다른 feature의 `index.ts` 공개 API만 | 다른 feature의 내부 파일 |
| `platform/*` | 외부 패키지만 | `core/*`, `ui/*`, `features/*`, `app/*` |
| `app/*` | 전부 | |

각 feature는 `index.ts`로 공개 API(컴포넌트, 명령)만 내보냅니다. 지연 로드할 feature(에디터 등)는 `index.ts`에서 `() => import('./X')` 형태의 로더만 내보내서 정적 import가 무거운 청크를 끌어오지 않게 합니다.

**import 경로 규칙**: 같은 최상위 모듈(같은 feature, 같은 `core/<하위>` 등) 안에서는 상대 경로, 그 밖은 `@/` 별칭(`@/core/model/pages`, `@/features/page`)을 씁니다. lint가 `../../`로 모듈 밖에 나가는 import와 `../<다른 feature>/` import를 막으므로, feature 안에서는 하위 폴더를 한 단계까지만 둡니다.

**라우터 위치**: 경로 상태(`navigate`, `href`, `useRoute`)는 feature가 직접 쓰므로 `core/store/router.ts`에 둡니다. `app/`은 라우트를 화면으로 연결만 합니다 (feature는 `app/`을 import할 수 없음).

## 4. 런타임 흐름

### 부팅
1. 셸 HTML과 CSS 표시 (스켈레톤)
2. `workspace` Y.Doc을 IndexedDB에서 로드 (목표 < 50ms)
3. 사이드바 렌더링 → 마지막 페이지 라우팅
4. 페이지 Y.Doc 로드 → 에디터 청크 지연 로드 (프리로드 힌트)
5. 유휴 시간에: 동기화 시작, 검색 인덱스 워커 시작, 서비스 워커 업데이트 확인

### 쓰기 경로
사용자 입력 → Y.Doc 변경 → (동기) React 셀렉터 갱신 → (비동기) IndexedDB 저장 → 더티 표시 → 디바운스 → 동기화 엔진 → GitHub 커밋

### 읽기 경로 (원격 변경)
동기화(풀) 또는 실시간 수신 → `Y.applyUpdate(doc, u, REMOTE)` → 옵저버 → 화면 갱신. 더티로 표시하지 않음.

## 5. 라우팅

해시 라우팅입니다. GitHub Pages는 SPA 폴백이 없어서 해시 방식을 씁니다.

| 경로 | 화면 |
|---|---|
| `#/` | 홈 (폰: 탭 화면 / 데스크탑: 마지막 페이지) |
| `#/w/:workspaceId/v/:viewId` | 뷰 열기 (M1에서 워크스페이스 포함 형식으로 이전) |
| `#/w/:ws/v/:viewId?row=:rowId` | 행 페이지 열기 |
| `#/w/:ws/v/:viewId#block=:blockId` | 블록으로 이동 |
| `#/search` `#/favorites` `#/recent` `#/trash` `#/settings/:section?` `#/notifications` | 화면 |
| `#/p/:owner/:repo/:slug` | 게시된 페이지 보기 (로그인 불필요) |

이전 형식 `#/page/:id`는 리디렉션을 유지합니다.

## 6. 상태 관리

- **영속 상태**: Yjs. React에서는 `useY(doc, selector, equalityFn)`로 구독합니다. `useSyncExternalStore`를 쓰고, 셀렉터 결과를 메모이즈해서 관련 없는 변경으로는 다시 렌더링하지 않습니다. 구현은 `core/store/useY.ts`(훅)와 `core/store/selectY.ts`(React 없는 메모이즈 로직, 단위 테스트 대상)입니다. 셀렉터는 모듈 수준 함수나 `useCallback`으로 고정해서 넘깁니다 (인라인 화살표는 렌더마다 구독을 새로 만듭니다). 비교 함수는 `core/store/equality.ts`의 `shallowEqual`, `shallowItemsEqual`.
- **기기별 설정** (테마, 펼침 상태, 사이드바 폭, 최근 항목): `core/store/prefs.ts`, localStorage. 모든 접근은 try/catch로 감쌉니다.
- **화면 일시 상태**: 컴포넌트 로컬 state 또는 작은 `createStore()` (외부 라이브러리 없이 약 30줄). `core/store/createStore.ts`(React 없음, `core/*`가 소유 가능) + `useStore(store, selector?)`. 동기화 상태, 테마, 트리 펼침, 현재 경로가 이 방식입니다.
- 전역 상태 라이브러리(Redux, Zustand)는 쓰지 않습니다.

## 7. 오류 처리 원칙

- 데이터 손실 방지가 최우선입니다. 동기화 실패 시 로컬 데이터를 유지하고 재시도합니다.
- 화면 단위 `ErrorBoundary`를 둡니다. 에디터가 실패해도 사이드바는 살아 있어야 합니다.
- 알 수 없는 블록이나 필드 타입은 **보존**하고 "지원되지 않는 블록"으로 표시합니다 (상위 호환, [02-data-model.md](02-data-model.md) §6).
- 사용자에게 보이는 오류는 토스트 + 설정 화면의 "동기화 로그"로 확인할 수 있습니다.
