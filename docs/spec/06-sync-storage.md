# 06. 동기화, 저장소, 파일 (`SY`)

## SY-01 로컬 저장 (✅ PoC, M0 보강)

- Y.Doc마다 y-indexeddb 데이터베이스 하나를 씁니다 (`wn:<wsId>:<docName>`).
- **문서 레지스트리 LRU**: 열린 문서는 최대 30개까지 메모리에 둡니다. 화면에 없고 더티가 아닌 문서부터 언로드합니다 (destroy + persistence 연결 해제).
- 부팅 시 `navigator.storage.persist()`를 요청합니다 ✅. 설정 화면에 사용량을 표시합니다 (`navigator.storage.estimate()`).
- iOS Safari: 홈 화면 설치를 유도합니다. 설치하지 않은 사이트는 7일 미방문 시 데이터가 삭제될 수 있어서, GitHub 미연결 사용자에게 경고합니다.

## SY-02 GitHub 동기화 엔진 (✅ PoC, M0 보강)

현재 알고리즘: `src/sync/engine.ts` 주석 참고. 헤드 확인 → 변경된 파일만 풀 → 병합 → 더티 문서 업로드 → 커밋 1개 → fast-forward (실패 시 재시도).

보강 항목:

| ID | 항목 | 마일스톤 |
|---|---|---|
| SY-02a | 경로 체계 v2 (`data/docs/`, `data/dbs/`), 구 경로 이전 | M0 |
| SY-02b | 스케줄: 입력 후 8초 디바운스, 최대 대기 60초(계속 입력 중이어도 푸시), 화면 숨김 시 즉시, 1분 주기 풀 (화면 표시 중), 온라인 복귀 시 | M0 |
| SY-02c | 백오프: 실패 시 지수 백오프 (10s → 5분), 403 rate limit은 `x-ratelimit-reset`까지 대기 | M0 |
| SY-02d | 동기화 로그 (최근 50건: 시각, 결과, 파일 수, 오류) — 설정 화면 | M0 |
| SY-02e | 탭 간 조정: 같은 브라우저의 여러 탭 중 하나만 동기화 (`navigator.locks` 또는 BroadcastChannel 리더 선출) | M0 |
| SY-02f | 큰 파일 경고: 파일 50MB 초과 시 경고, 90MB 초과 시 업로드 중단 (GitHub 100MB 제한) | M4 |
| SY-02g | 트리 truncated 대응: 하위 트리 단위 조회 | M4 |
| SY-02h | 조건부 요청 (ETag, `If-None-Match`): 304는 rate limit을 소모하지 않음 | M0 |

### API 사용량 예산

| 상황 | 요청 수 |
|---|---|
| 변경 없음 (주기 확인) | 1 (ref 조회, 대부분 304) |
| 원격 변경 N개 파일 풀 | 3 + N |
| 로컬 변경 M개 파일 푸시 | 3 + M + 3 |
| 1시간 계속 편집 시 대략 | 60(풀) + 60×~6(푸시) ≈ 420 / 시간당 한도 5,000 |

콘텐츠 생성 보조 한도(분당 약 80건)를 넘지 않도록, 푸시는 최소 8초 간격을 둡니다.

## SY-03 저장소 크기 관리 (M6)

- 매 커밋이 전체 상태 스냅샷이라 기록이 쌓입니다. Git 팩 델타 압축 덕분에 실제 증가량은 작지만, 상한 관리가 필요합니다.
- 설정 → "저장소 기록 정리": 현재 트리로 새 루트 커밋을 만들고 브랜치를 강제 갱신합니다 (기록 삭제). 실행 전 다른 기기들이 최신 상태인지 확인하는 안내를 보여줍니다.
- 저장소 크기(`GET /repos` 의 `size`)가 500MB를 넘으면 정리를 권장합니다.

## SY-04 파일·이미지 저장 (M3)

- 업로드: 파일 → SHA-256 → `files/<sha256>.<ext>`. 이미 있으면 업로드를 건너뜁니다 (중복 제거).
- 업로드는 다음 동기화 커밋에 포함합니다. 오프라인이면 IndexedDB `pendingFiles`에 보관합니다.
- 표시: 비공개 저장소라 공개 URL이 없습니다. `GET /repos/.../git/blobs/:sha`(인증)로 받아 IndexedDB 캐시(`fileCache`, LRU 200MB) → `URL.createObjectURL`.
  - 대안: `raw.githubusercontent.com`은 비공개 저장소에서 토큰 헤더로 CORS가 안 되므로 쓰지 않습니다.
- 이미지 처리: 업로드 전 긴 변 2560px로 축소, WebP 변환(지원 시), EXIF 회전 반영. 원본 유지 옵션도 둡니다.
- 크기 제한: 파일당 25MB (Git Data API 블롭 업로드는 base64라 실제 요청은 약 33MB).
- 참조되지 않는 파일 정리: "저장소 정리" 작업에서 모든 문서를 스캔해 고아 파일을 삭제합니다 (수동 실행).

## SY-05 다중 워크스페이스 (M1)

- 계정 하나에 여러 워크스페이스(저장소)를 둡니다. 동기화 상태와 IndexedDB 이름 공간을 분리합니다.
- 협업자로 초대받은 저장소도 추가할 수 있습니다 (`owner/repo` 입력 또는 `GET /user/repos?affiliation=collaborator`에서 `webnota` 주제(topic)로 필터).

## SY-06 인증 (✅ PoC, M9 개선)

| 방식 | 상태 | 권한 |
|---|---|---|
| Fine-grained PAT | ✅ | 선택 저장소 Contents R/W |
| OAuth App + Worker | ✅ (Worker 배포 필요) | `repo` (넓음) |
| GitHub App + Worker | M9 | 사용자가 고른 저장소만, 사용자 토큰 8시간 + 갱신 토큰 (Worker가 갱신) |

- 토큰은 localStorage에 저장합니다. XSS 방지를 위해 CSP 메타 태그를 둡니다 (`script-src 'self'`, `connect-src` 허용 목록). 사용자 콘텐츠의 HTML은 렌더링 전에 정리합니다 (DOMPurify, 붙여넣기·가져오기 시).

## SY-07 내보내기 백업 (M8)

- 전체 워크스페이스를 zip으로 내보냅니다: `*.md`(문서), `*.csv`(DB), `files/`, `workspace.json`(트리), 그리고 원본 `.yjs`.
- zip에서 복원(가져오기)할 수 있습니다.
