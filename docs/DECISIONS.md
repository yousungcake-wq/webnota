# 결정 기록 (ADR)

새 결정은 아래에 추가합니다. 형식: 번호, 날짜, 결정, 이유, 대안.

| # | 날짜 | 결정 | 이유 | 검토한 대안 |
|---|---|---|---|---|
| 001 | 2026-11-26 | Flutter 대신 React + Tiptap으로 재작성 | Flutter Web은 캔버스 렌더링이라 무겁고(수 MB) 모바일 IME가 불안정 | AppFlowy Web 개조 |
| 002 | 2026-11-26 | 데이터는 사용자 GitHub 비공개 저장소, 앱은 GitHub Pages | 무료, 데이터 소유권, 기록(커밋) 무료 제공 | Firebase, Supabase (무료 한도·잠김) |
| 003 | 2026-11-26 | Yjs CRDT + 로컬 우선 | 오프라인·다중 기기 병합, 실시간 확장 | 자체 병합, Automerge (번들 큼) |
| 004 | 2026-11-26 | Cloudflare Worker 1개 허용 (토큰 교환, 이후 미리보기·실시간·푸시) | GitHub 토큰 엔드포인트 CORS 미지원 | PAT만 사용 (UX 나쁨) |
| 005 | 2026-11-26 | 커밋 1개로 묶는 배치 동기화 (Git Data API) | API 한도, 원자성 | 파일별 Contents API (요청 많고 원자성 없음) |
| 006 | 2026-11-26 | 해시 라우팅 | GitHub Pages에 SPA 폴백 없음 | 404.html 트릭 (불안정) |
| 007 | 2026-11-26 | DB 행을 8개 샤드 문서로 분리 | 큰 DB에서 커밋당 업로드 크기 제한 | 단일 문서, 행별 파일 (파일 수 폭증) |
| 008 | 2026-11-26 | 전역 상태 라이브러리 없음, Yjs + useSyncExternalStore 셀렉터 | 이중 상태 제거, 번들 절약 | Zustand, Redux |
| 009 | 2026-11-26 | 노드 타입 추가 시 schemaVersion 증가, 구버전 읽기 전용 | y-prosemirror가 모르는 노드를 지울 위험 | 미지원 노드 플레이스홀더만 (데이터 손실 위험 남음) |
| 010 | 2026-11-26 | TypeScript 6.0.x 고정 (7.x 미사용) | typescript-eslint가 TS < 6.1만 지원 | TS 7 네이티브 + 린트 생략 |
| 011 | 2026-11-26 | 번들 크기는 Vite 매니페스트 그래프로 측정, 수동 청크(manualChunks) 미사용 | 수동 청크가 공유 의존성을 끌어와 지연 청크가 초기 로드에 섞임 | 파일 이름 기반 측정 |
| 012 | 2026-11-26 | `@/` import 별칭 + 라우터 상태를 `core/store/router.ts`에 둠 | 상대 경로로는 lint가 모듈 경계를 판별할 수 없음. feature가 `app/`을 import하지 않고도 navigate/href를 쓸 수 있어야 함 | 상대 경로 유지(경계 검사 불가), 라우터를 `app/`에 둠(feature→app 의존) |
