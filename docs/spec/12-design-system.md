# 12. 디자인 시스템

AppFlowy의 정돈된 느낌(밝은 회색 사이드바, 둥근 모서리, 절제된 강조색)을 따르되, 브랜드 자산(로고, 일러스트, 고유 아이콘)은 쓰지 않습니다.

## 1. 토큰 (`src/styles/tokens.css`)

| 그룹 | 토큰 | 비고 |
|---|---|---|
| 배경 | `--bg`, `--bg-side`, `--bg-hover`, `--bg-active`, `--bg-elev`, `--bg-code`, `--bg-overlay` | |
| 글자 | `--text`, `--text-2`, `--text-3`, `--text-on-accent` | 대비: 본문 4.5:1 이상 |
| 선 | `--border`, `--border-strong` | |
| 강조 | `--accent`, `--accent-soft`, `--accent-hover` | 사용자 지정 가능 (ST-05) |
| 상태 | `--ok`, `--warn`, `--danger`, `--info`, `--star`(즐겨찾기 별) | |
| 블록 색 | `--c-<name>-text`, `--c-<name>-bg` (gray, brown, orange, yellow, green, blue, purple, pink, red) | 에디터 글자/배경색, select 옵션 |
| 간격 | `--sp-1`(4) `--sp-2`(8) `--sp-3`(12) `--sp-4`(16) `--sp-6`(24) `--sp-8`(32) | 4px 단위 |
| 반경 | `--r-sm`(4) `--r`(8) `--r-lg`(12) `--r-xl`(16) | |
| 그림자 | `--shadow-sm`, `--shadow`, `--shadow-lg` | |
| 글꼴 | `--font`, `--font-serif`, `--mono`, 크기 `--fs-xs`(12) ~ `--fs-3xl`(36) | 사용자 배율 `--scale` 반영 |
| z-index | `--z-sticky`(10) `--z-toolbar`(50) `--z-popover`(70) `--z-sheet`(80) `--z-toast`(90) | |
| 모션 | `--ease`, `--dur-fast`(120ms) `--dur`(200ms) | `prefers-reduced-motion` 시 0 |

다크 테마는 같은 토큰을 다시 정의합니다 (`prefers-color-scheme` + `[data-theme]`) ✅. 두 다크 블록은 같아야 하며 테스트로 검사합니다.

CSS 파일 배치 (M0-09 ✅):

| 파일 | 내용 |
|---|---|
| `styles/tokens.css`, `styles/base.css` | 토큰, 리셋·유틸리티 (`styles/index.css`가 묶어 `app/main.tsx`에서 한 번 로드) |
| `ui/button.css`, `ui/list.css`, `ui/view.css`, `ui/menu.css` | 공용 컴포넌트 |
| `app/shell.css` | 데스크탑 그리드, 폰 셸, 탭 바 |
| `features/<기능>/<이름>.css` | 기능 전용. 폰·태블릿 재정의(`.phone .x`, `@media`)도 그 기능 파일에 둡니다 |

## 2. 컴포넌트 (`src/ui/`)

| 컴포넌트 | 비고 | 상태 |
|---|---|---|
| `Button` (primary, secondary, ghost, danger / sm, md), `LinkButton` | | ✅ M0 |
| `IconButton` | 툴팁 + aria-label 필수 (`label` prop 하나로 둘 다) | ✅ M0 |
| `Menu` (데스크탑 팝오버 ↔ 폰 시트 자동 전환) | 키보드 탐색, 하위 메뉴, 구분선, 단축키 표시, 체크 | ✅ M0 |
| `Popover`, `Sheet`, `Dialog`, `confirmDialog()` | 포커스 트랩, Esc, 뒤로 가기 연동 (MB-14, 시트·대화상자만), 시트 끌어서 닫기 | ✅ M0 (시트 높이 단계는 이후) |
| `toast()` | 실행 취소 버튼 지원 ("휴지통으로 이동함 [실행 취소]"), 최대 3개, 호버 시 멈춤 | ✅ M0 |
| Tooltip | 데스크탑만. `data-tooltip` 속성 하나로 (OverlayHost의 전역 리스너) | ✅ M0 |
| `Input`, `Switch`, `Segmented` ✅ / `TextArea`, `Select`, `Checkbox` | 필요해지는 마일스톤에서 추가 | M0 일부 |
| `EmojiPicker` | 전체 이모지 데이터(지연 로드), 검색(한/영), 최근, 피부색 | M1 |
| `IconPicker` | lucide 아이콘 + 색 | M1 |
| `ColorPicker` | 블록 색 팔레트 | M2 |
| `DatePicker` | 월 달력, 시간, 범위 | M4 |
| `VirtualList` | @tanstack/react-virtual 래퍼 | M1 |
| `Sortable` | dnd-kit 래퍼 (마우스·터치·키보드) | M1 |
| `Skeleton`, `EmptyState` ✅ / `Spinner` | | M0 |

규칙:
- 모든 오버레이는 `ui/overlay/stack.ts` 레이어 스택에 등록됩니다 (쌓임 순서, Esc는 최상위만, 뒤로 가기, 스크롤 잠금). `OverlayHost`(앱에 한 번 마운트)는 명령형 오버레이(`confirmDialog`, `toast`)와 툴팁을 그립니다.
- 뒤로 가기 연동: 시트·대화상자는 열 때 history 항목을 추가하고, 다른 방법으로 닫히면 그 항목을 되돌립니다 (`platform/history.ts`). router의 `navigate`/`goBack`은 이 정리가 끝난 뒤 실행되므로 메뉴 항목에서 바로 이동해도 됩니다.
- `ui`는 `core/i18n`을 못 쓰므로 기본 문구(확인/취소/닫기)는 부팅 시 `configureUi()`로 받습니다. 그 외 문구는 props로 받습니다.
- `window.confirm`/`alert`는 쓰지 않습니다.
- 터치 크기 44px 이상, 데스크탑 밀도는 32px 행 높이를 기준으로 합니다.
- 아이콘 크기는 16(데스크탑 밀집), 18(기본), 20~22(폰)입니다.

## 3. 반응형 원칙

- 레이아웃 분기는 `useLayout()` 하나로 합니다: `'phone' | 'tablet' | 'desktop'` + `isTouch`.
- 같은 기능을 두 번 구현하지 않습니다. 데이터·로직 훅은 공유하고, 표시 컴포넌트만 레이아웃별로 둡니다 (예: `GridDesktop`, `GridPhone`가 `useGridModel()` 공유).

## 4. 접근성

- WCAG 2.1 AA: 색 대비, 키보드 전용 조작, 포커스 표시, 스크린 리더 레이블.
- 트리는 `role="tree"`, Grid는 `role="grid"` + `aria-rowindex`, 메뉴는 `role="menu"`.
- `prefers-reduced-motion`, `prefers-contrast`를 지원합니다.
