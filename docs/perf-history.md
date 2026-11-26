# 성능 기록

spec/10 §3. 마일스톤마다 `npm run build && npm run perf`(`tests/perf/baseline.mjs`) 결과와 번들 크기(`npm run size`)를 기록합니다. **이전 기록보다 20% 이상 나빠지면 마일스톤을 완료할 수 없습니다.**

측정 조건: `vite preview`, Playwright Chromium, CPU 4배 감속(CDP), 5회 중앙값. 폰 항목은 Pixel 7 에뮬레이션, 페이지 전환은 데스크탑 1280×720. 네트워크 감속 없음(로컬) — 실제 4G LCP는 실기기에서 별도 확인합니다. 작업 환경(클라우드 컨테이너) 기준이라 절대값보다 마일스톤 간 비교에 씁니다.

| 지표 | 정의 | 목표 (spec/10 §1.2) |
|---|---|---|
| firstRunEditorMs | 빈 브라우저에서 첫 방문 → 환영 페이지 에디터 표시 (시드 포함) | LCP < 2.0s (4G) |
| revisitShellMs | 재방문 새로고침 → 폰 하단 탭 표시 | < 400ms |
| openPageFromHomeMs | 재방문 직후 홈에서 페이지 열기 → 에디터 표시 (에디터 청크 로드 포함) | — |
| pageSwitchDesktopMs | IndexedDB에 있는 두 페이지 사이 전환 → 제목·에디터 표시 | < 150ms |
| typingToPaintMs | 문자 입력 → DOM 반영 후 다음 프레임 | INP < 50ms |

## 기록

| 마일스톤 | 커밋 | 초기 번들 | 에디터 | CSS | firstRunEditorMs | revisitShellMs | openPageFromHomeMs | pageSwitchDesktopMs | typingToPaintMs | 메모 |
|---|---|---|---|---|---|---|---|---|---|---|
| M0 기준선 | 6695af5 | 120.6 KB | 166.3 KB | 6.3 KB | 1380 | 252 | 549 | 187 | 15.2 | 두 번 측정 평균. 페이지 전환이 목표(150ms)보다 느림 → M1에서 원인 분석 (에디터 재생성 비용 추정). 첫 실행은 에디터 청크를 기다리는 환영 시드 포함 |
