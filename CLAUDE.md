# WebNota — AI 개발 가이드

AppFlowy(AI 제외)를 웹 기술로 다시 만드는 프로젝트입니다. React + Tiptap + Yjs, GitHub Pages 호스팅, 사용자 GitHub 저장소에 데이터를 저장합니다. 사용자와는 **한국어**로 소통합니다.

## 세션 시작 절차 (반드시)

1. `docs/STATUS.md`를 읽습니다. 현재 마일스톤, 진행 중 항목, 주의 사항이 있습니다.
2. `docs/CHECKLIST.md`에서 현재 마일스톤의 `[~]`(진행 중) 항목, 없으면 첫 `[ ]` 항목을 고릅니다.
3. 그 항목과 관련된 `docs/spec/*` 절을 읽습니다 (항목 끝 괄호의 ID로 찾기).
4. `git log --oneline -10`으로 최근 작업을 확인하고, `npm ci` 후 `npm run verify`가 통과하는지 봅니다.

## 작업 단위 절차

1. 체크리스트 항목을 `[~]`로 바꿉니다.
2. 구현 → 테스트 작성 → `npm run verify` 통과 (UI 변경 시 e2e도 실행).
3. 체크리스트를 `[x] … — <커밋 해시>`로 바꾸고, `docs/STATUS.md`의 "현재 위치"와 "작업 기록"을 갱신합니다.
4. 커밋하고 `main`에 푸시합니다 (아래 Git 흐름).
5. 마일스톤의 마지막 항목이면: 다음 마일스톤 체크리스트를 spec 기준 세부 항목으로 펼치고, `docs/QA.md`에 마일스톤별 실기기 항목을 추가한 뒤 사용자에게 실기기 확인을 요청합니다.

컨텍스트가 길어지면 작업 단위를 끝까지 마무리(커밋·STATUS 갱신)한 뒤 다음 단위로 넘어갑니다. 중간 상태로 세션이 끝날 것 같으면 STATUS.md "진행 중 항목"에 어디까지 했는지 적고 WIP 커밋을 남깁니다.

## Git 흐름 (사용자 승인됨, 2026-11-26)

- **`main`에 직접 커밋·푸시합니다.** 푸시하면 GitHub Pages에 자동 배포되므로, 푸시 전에 반드시 `npm run verify`를 통과시킵니다.
- 커밋 메시지: `feat(editor): 토글 블록 (ED-B06, M2-02)` 형식. 체크리스트·spec ID를 포함합니다.
- 미완성 기능은 기능 플래그(`core/flags.ts`) 뒤에 숨깁니다. main은 항상 배포 가능해야 합니다.
- 푸시: `git push origin main` (네트워크 오류 시 최대 4번 재시도).

## 명령어

```bash
npm ci                     # 의존성
npm run dev                # 개발 서버 http://localhost:5173
npm test                   # 단위 테스트 (Vitest)
npm run typecheck
npm run build              # 프로덕션 빌드 (dist/)
npm run verify             # 커밋 전 필수: lint + typecheck + test + build + 번들 예산
npm run lint:fix           # eslint --fix + prettier --write
npm run e2e                # Playwright Test (tests/e2e, 데스크탑·Pixel 7·iPhone 14), 빌드 후 실행
```

작업 환경 참고: Chromium이 `/opt/pw-browsers`에 미리 설치되어 있고 `@playwright/test`는 같은 버전(1.63.0)으로 고정했습니다. `playwright install`은 실행하지 마세요 (CI에서만 실행). `*.github.io`는 작업 환경에서 접속할 수 없습니다.

## 문서 지도

| 문서 | 용도 |
|---|---|
| `docs/STATUS.md` | 현재 위치, 주의 사항, 작업 기록 (인계) |
| `docs/CHECKLIST.md` | 세부 작업 목록 |
| `docs/ROADMAP.md` | 마일스톤 개요와 완료 조건 |
| `docs/spec/00-overview.md` | 제품 정의, 기능 인벤토리, 용어 |
| `docs/spec/01-architecture.md` | 구조, 모듈 경계, 기술 스택 |
| `docs/spec/02-data-model.md` | Yjs 문서 구조, 스키마 버전 규칙 (**데이터 변경 전 필독**) |
| `docs/spec/03~09` | 기능 명세 (WS, ED, DB, SY, SH, MB, ST/NT/IO) |
| `docs/spec/10-performance.md` | 성능 예산 |
| `docs/spec/11-engineering.md` | 코드 규칙, 테스트, 완료 정의 |
| `docs/spec/12-design-system.md` | 토큰, 컴포넌트, 반응형 |
| `docs/DECISIONS.md` | 결정 기록 — 큰 결정은 여기에 추가 |
| `docs/QA.md` | 실기기 체크리스트 |

## 절대 규칙

1. **데이터 손실 금지.** 스키마를 바꾸면 schemaVersion을 올리고 마이그레이션 + 테스트를 작성합니다. ProseMirror 노드·마크 이름은 바꾸거나 지우지 않습니다 (spec/02 §6).
2. **성능 예산 준수** (spec/10). 새 무거운 의존성은 지연 로드합니다.
3. **모듈 경계 준수** (spec/01 §3). `core`는 React를 모릅니다. Y.Doc 변경은 `core/model` 함수로만 합니다.
4. **모든 UI는 데스크탑과 폰 둘 다** 확인합니다. 터치 영역 44px, 메뉴는 폰에서 하단 시트입니다.
5. 사용자에게 보이는 문자열은 `t()`로 씁니다 (M0-10 이후).
6. AI 기능은 만들지 않습니다.
7. 기획과 구현이 달라지면 같은 커밋에서 `docs/spec`을 고칩니다.

## 참고: AppFlowy 원본

기능 동작을 확인할 때 AppFlowy 소스를 참조합니다 (코드 복사 금지 — AGPL. 동작과 UX만 참고).
```bash
git clone --depth 1 --filter=blob:none --sparse https://github.com/AppFlowy-IO/AppFlowy <스크래치 폴더>/appflowy
# 주요 경로: frontend/appflowy_flutter/lib/{plugins,workspace,mobile}
```
