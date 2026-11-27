# 06. 동기화, 저장소, 파일 (`SY`)

## SY-01 로컬 저장 (✅ PoC, M0 보강)

- Y.Doc마다 y-indexeddb 데이터베이스 하나를 씁니다 (`wn:<wsId>:<docName>`). `wsId`는 **기기 로컬 워크스페이스 슬롯 ID**(`core/docs/slots.ts`, localStorage `webnota:workspaces`)이며 Y 문서에 저장하지 않습니다 (DECISIONS 016). PoC의 `webnota:<docName>` DB는 첫 실행 시 한 번 옮깁니다 (M0-18). 더티 표시·동기화 상태(localStorage)의 워크스페이스별 분리는 SY-05(M1)에서 합니다.
- **문서 레지스트리 LRU**: 열린 문서는 최대 30개까지 메모리에 둡니다. 화면에 없고 더티가 아닌 문서부터 언로드합니다 (destroy + persistence 연결 해제). ✅ M0-19: 오래 쓰는 쪽은 `retainDoc(name)`으로 붙잡습니다 (보이는 페이지, 진행 중인 동기화, 복제). 붙잡히지 않았고 더티가 아니며 최근 10초 안에 쓰이지 않은 문서만, 가장 오래전에 쓴 것부터 언로드합니다. `workspace`는 언로드하지 않습니다.
- 부팅 시 `navigator.storage.persist()`를 요청합니다 ✅. 설정 화면에 사용량을 표시합니다 (`navigator.storage.estimate()`).
- iOS Safari: 홈 화면 설치를 유도합니다. 설치하지 않은 사이트는 7일 미방문 시 데이터가 삭제될 수 있어서, GitHub 미연결 사용자에게 경고합니다.

## SY-02 GitHub 동기화 엔진 (✅ PoC, M0 보강)

현재 알고리즘: `src/sync/engine.ts` 주석 참고. 헤드 확인 → 변경된 파일만 풀 → 병합 → 더티 문서 업로드 → 커밋 1개 → fast-forward (실패 시 재시도).

보강 항목:

| ID | 항목 | 마일스톤 |
|---|---|---|
| SY-02a | 경로 체계 v2 (`data/docs/`, `data/dbs/`), 구 경로 이전 — ✅ M0-17: `pathForDoc`/`docForPath`(spec/02 §1 전체), 구 `data/pages/` 파일은 병합 후 같은 커밋에서 이동·삭제 | M0 |
| SY-02b | 스케줄: 입력 후 8초 디바운스, 최대 대기 60초(계속 입력 중이어도 푸시), 화면 숨김 시 즉시, 1분 주기 풀 (화면 표시 중), 온라인 복귀 시 — ✅ M0-21 (`core/sync/schedule.ts`) | M0 |
| SY-02c | 백오프: 실패 시 지수 백오프 (10s → 5분), 403 rate limit은 `x-ratelimit-reset`까지 대기 — ✅ M0-21: 403/429의 `retry-after` 또는 `x-ratelimit-remaining: 0` + reset까지 아무 동기화도 하지 않음. 일반 백오프 중에도 온라인 복귀·화면 숨김/표시·수동 버튼은 즉시 시도, 1분 주기 풀은 대기. 로그인 만료(401)는 자동 재시도 안 함 | M0 |
| SY-02d | 동기화 로그 (최근 50건: 시각, 결과, 파일 수, 오류) — 설정 화면 — ✅ M0-24: `core/sync/log.ts`, localStorage `webnota:sync-log`(모든 탭 공유). 변경 없는 실행과 같은 오류의 연속은 한 항목으로 접고 횟수·기간 표시. 설정 → GitHub 동기화 카드의 "동기화 기록" | M0 |
| SY-02e | 탭 간 조정: 같은 브라우저의 여러 탭 중 하나만 동기화 (`navigator.locks` 또는 BroadcastChannel 리더 선출) — ✅ M0-23: Web Lock `webnota:sync-leader:<wsId>`를 가진 탭만 동기화(미지원 브라우저는 모든 탭). 탭마다 Y.Doc이 따로라서 BroadcastChannel `webnota:<wsId>`로 열린 문서의 업데이트를 실시간 중계(`core/docs/tabs.ts`), 더티 표시는 `storage` 이벤트로 공유, 다른 탭의 동기화 요청은 리더에게 전달, 리더의 상태는 다른 탭에 표시 | M0 |
| SY-02f | 큰 파일 경고: 파일 50MB 초과 시 경고, 90MB 초과 시 업로드 중단 (GitHub 100MB 제한) | M4 |
| SY-02g | 트리 truncated 대응: 하위 트리 단위 조회 | M4 |
| SY-02h | 조건부 요청 (ETag, `If-None-Match`): 304는 rate limit을 소모하지 않음 — ✅ M0-22: blob·tree(sha 주소, 불변) 외 GET에 적용, 캐시는 모듈 수준(메모리, 최대 50개, 토큰별). 앱 재시작 후 첫 요청은 일반 요청 | M0 |

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
  - ✅ M3-01 구현: `core/files/upload.ts`의 `addFile(blob, name)` → `FileRef {id, name, size, mime}` (`id` = `<sha256 hex>.<ext>`, 확장자는 이름 → MIME → `bin`). 파일 바이트는 워크스페이스별 IndexedDB `wn:<wsId>:$files`(`core/files/db.ts`)의 `pending` 저장소(업로드 대기)와 `cache` 저장소(표시용, M3-02)에 넣고, 더티 집합에 `files` 항목(`FILES_DIRTY`, 문서가 아님)을 올려 동기화를 예약합니다. 엔진은 `files` 더티가 있으면 `LocalStore.pendingFiles()`를 읽어 트리에 없는 것만 블롭으로 올리고 같은 커밋에 `files/<id>`로 넣습니다. 커밋이 성공하면 `filesUploaded(ids)`로 대기열에서 지웁니다(읽기 전용·재시도 중에는 유지). 형식이 잘못된 id는 올리지 않고 대기열에서 버립니다. `files/` 경로는 문서로 풀(pull)하지 않습니다.
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
