# 00. 제품 개요

## 1. 한 줄 정의

**WebNota**는 AppFlowy의 기능(AI 제외)을 웹 기술로 다시 만든, 설치 없이 쓰는 노트·데이터베이스 웹앱입니다. GitHub Pages에서 무료로 호스팅되고, 사용자 데이터는 **각자의 GitHub 비공개 저장소**에 저장됩니다.

## 2. 목표

| # | 목표 | 측정 기준 |
|---|---|---|
| G1 | AppFlowy의 AI 외 모든 사용자 기능 제공 | [기능 인벤토리](#5-기능-인벤토리-요약)의 포함 항목 100% |
| G2 | 모든 기기에서 앱 수준의 사용성 | 데스크탑, 태블릿, Android, iOS 실기기 체크리스트 통과 |
| G3 | 빠름 | [10-performance.md](10-performance.md)의 성능 예산 준수 |
| G4 | 운영비 0원 | GitHub Pages + GitHub API + Cloudflare 무료 플랜만 사용 |
| G5 | 데이터 소유권 | 데이터는 사용자 저장소에만 존재하고, 서버(Worker)는 데이터를 저장하지 않음 |
| G6 | 유지보수성 | [11-engineering.md](11-engineering.md)의 규칙과 CI 게이트 준수 |

## 3. 비목표 (하지 않는 것)

| 항목 | 이유 |
|---|---|
| AI 기능 전부 (AI 채팅, AI 글쓰기, AI 요약·번역 필드, 로컬 AI) | 요구사항에서 제외 |
| 요금제, 결제, 구독 | 무료 서비스 |
| AppFlowy Cloud, 자체 호스팅 서버 설정 | GitHub 저장소가 백엔드 역할을 대신함 |
| 데스크탑 네이티브 기능 (데이터 폴더 위치, 창 관리) | 웹앱 |
| AppFlowy 데이터 포맷과의 바이너리 호환 | 가져오기(Markdown, CSV, Notion)로 대체 |

## 4. 사용자와 핵심 시나리오

- **개인 사용자**: 휴대폰과 PC를 오가며 메모, 할 일, 문서, 간단한 DB(독서 목록, 가계부)를 관리합니다.
- **소규모 팀 (2~10명)**: 워크스페이스 저장소를 공유하고, 회의록과 칸반으로 협업합니다.
- **공개 게시자**: 문서를 웹에 공개합니다 (블로그, 가이드).

핵심 시나리오:
1. 휴대폰에서 빠르게 메모 → PC에서 이어서 정리 (동기화 지연 1분 이내)
2. 칸반 보드로 할 일을 관리하고, 캘린더에서 일정 확인
3. 오프라인(지하철)에서 편집 → 온라인 복귀 시 자동 병합
4. 팀원 초대 → 같은 문서를 실시간 공동 편집
5. 문서를 공개 링크로 게시

## 5. 기능 인벤토리 요약

AppFlowy 소스(`frontend/appflowy_flutter/lib`)의 플러그인 구성을 기준으로 정리했습니다. 상세 명세는 각 문서에 있습니다.

| 영역 | ID 접두사 | 문서 | AppFlowy 기준 출처 |
|---|---|---|---|
| 워크스페이스, 사이드바, 탐색 | `WS` | [03-workspace.md](03-workspace.md) | `workspace/presentation/home/menu`, `command_palette`, `sidebar/space` |
| 문서 에디터 | `ED` | [04-editor.md](04-editor.md) | `plugins/document/presentation/editor_plugins/*` |
| 데이터베이스 | `DB` | [05-database.md](05-database.md) | `plugins/database/{grid,board,calendar,tab_bar}`, `type_option_editor/*` |
| 동기화, 저장소, 파일 | `SY` | [06-sync-storage.md](06-sync-storage.md) | (AppFlowy Cloud 대체) |
| 공유, 게시, 실시간 협업, 멤버 | `SH` | [07-sharing-collab.md](07-sharing-collab.md) | `features/share_tab`, `plugins/shared/share/*`, `settings/widgets/members` |
| 모바일 UX | `MB` | [08-mobile.md](08-mobile.md) | `mobile/presentation/*` |
| 설정, 알림, 가져오기·내보내기, 템플릿 | `ST` `NT` `IO` | [09-settings-io.md](09-settings-io.md) | `settings/pages/*`, `notifications/*`, `sidebar/import/*` |

AppFlowy에서 **제외**하는 디렉터리: `plugins/ai_chat`, `editor_plugins/ai`, `type_option_editor/{summary,translate}`, `settings/pages/setting_ai_view`, `settings_billing_view`, `settings_plan_*`, `setting_appflowy_cloud`, `setting_local_cloud`.

## 6. 문서 구성

| 문서 | 내용 |
|---|---|
| [01-architecture.md](01-architecture.md) | 전체 구조, 모듈 경계, 기술 선택 |
| [02-data-model.md](02-data-model.md) | Yjs 문서 구조, 스키마 버전, 마이그레이션 |
| [03-workspace.md](03-workspace.md) ~ [09-settings-io.md](09-settings-io.md) | 기능 명세 |
| [10-performance.md](10-performance.md) | 성능 예산과 기법 |
| [11-engineering.md](11-engineering.md) | 코드 규칙, 테스트, CI, 릴리스 |
| [12-design-system.md](12-design-system.md) | 디자인 토큰, 컴포넌트, 반응형 규칙 |

## 7. 용어

| 용어 | 뜻 |
|---|---|
| 워크스페이스 | 하나의 GitHub 데이터 저장소. 사용자는 여러 개를 가질 수 있음 |
| 스페이스 | 워크스페이스 안의 최상위 그룹 (예: 개인, 업무) |
| 뷰(View) | 사이드바에 표시되는 항목. 문서 또는 데이터베이스 뷰(Grid/Board/Calendar) |
| 페이지 | 문서 타입의 뷰 |
| 데이터베이스 | 필드와 행의 집합. 여러 뷰(레이아웃)를 가짐 |
| 행 페이지 | 데이터베이스 행을 열었을 때 보이는 속성 + 문서 |
| 블록 | 에디터의 최상위 단위 (문단, 제목, 목록, 이미지 등) |
| 더티(dirty) | 로컬에서 바뀌었지만 아직 GitHub에 푸시되지 않은 문서 |
