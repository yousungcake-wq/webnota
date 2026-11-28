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
| SY-02b | 스케줄: 입력 후 4초 디바운스, 최대 대기 60초(계속 입력 중이어도 푸시), 자동 동기화끼리 최소 8초 간격(수동 버튼은 예외), 화면 숨김 시 즉시, 20초 주기 풀 (화면 표시 중), 온라인 복귀 시 — ✅ M0-21 (`core/sync/schedule.ts`). 2026-11-27 사용자 요청으로 8초/60초 → 4초/20초(기기 간 반영 최악 약 1분 → 약 30초) | M0 |
| SY-02c | 백오프: 실패 시 지수 백오프 (10s → 5분), 403 rate limit은 `x-ratelimit-reset`까지 대기 — ✅ M0-21: 403/429의 `retry-after` 또는 `x-ratelimit-remaining: 0` + reset까지 아무 동기화도 하지 않음. 일반 백오프 중에도 온라인 복귀·화면 숨김/표시·수동 버튼은 즉시 시도, 주기 풀은 대기. 로그인 만료(401)는 자동 재시도 안 함 | M0 |
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
| 1시간 계속 편집 시 대략 | 180(풀, 대부분 304) + 60×~6(푸시) ≈ 540 / 시간당 한도 5,000 |

콘텐츠 생성 보조 한도(분당 약 80건)를 넘지 않도록, 자동 동기화는 최소 8초 간격을 둡니다(`MIN_PUSH_GAP_MS`).

## SY-03 저장소 크기 관리 (M6)

- 매 커밋이 전체 상태 스냅샷이라 기록이 쌓입니다. Git 팩 델타 압축 덕분에 실제 증가량은 작지만, 상한 관리가 필요합니다.
- 설정 → "저장소 기록 정리": 현재 트리로 새 루트 커밋을 만들고 브랜치를 강제 갱신합니다 (기록 삭제). 실행 전 다른 기기들이 최신 상태인지 확인하는 안내를 보여줍니다.
- 저장소 크기(`GET /repos` 의 `size`)가 500MB를 넘으면 정리를 권장합니다.
- 구현 (M6-09, `core/files/history.ts` + `session.ts`의 `squashHistory`): 설정 → 파일 영역에 저장소 크기(GitHub가 늦게 갱신할 수 있음)와 500MB 초과 경고, "저장소 기록 정리". 확인 대화상자(되돌릴 수 없음, 다른 기기 먼저 동기화) → 먼저 이 기기를 동기화 → 현재 트리로 부모 없는 커밋 → **강제 갱신 직전에 head를 다시 읽어** 그 사이 다른 기기가 올렸으면 아무것도 바꾸지 않고 "다시 시도" 안내. 엔진은 기록이 아니라 파일 내용(blob sha)을 비교하므로 다른 기기도 그대로 이어서 동기화. 문자열은 설정의 지연 사전(`features/settings/historyI18n`). 메모리 GitHub e2e(강제 갱신 지원).

## SY-04 파일·이미지 저장 (M3)

- 업로드: 파일 → SHA-256 → `files/<sha256>.<ext>`. 이미 있으면 업로드를 건너뜁니다 (중복 제거).
- 업로드는 다음 동기화 커밋에 포함합니다. 오프라인이면 IndexedDB `pendingFiles`에 보관합니다.
  - ✅ M3-01 구현: `core/files/upload.ts`의 `addFile(blob, name)` → `FileRef {id, name, size, mime}` (`id` = `<sha256 hex>.<ext>`, 확장자는 이름 → MIME → `bin`). 파일 바이트는 워크스페이스별 IndexedDB `wn:<wsId>:$files`(`core/files/db.ts`)의 `pending` 저장소(업로드 대기)와 `cache` 저장소(표시용, M3-02)에 넣고, 더티 집합에 `files` 항목(`FILES_DIRTY`, 문서가 아님)을 올려 동기화를 예약합니다. 엔진은 `files` 더티가 있으면 `LocalStore.pendingFiles()`를 읽어 트리에 없는 것만 블롭으로 올리고 같은 커밋에 `files/<id>`로 넣습니다. 커밋이 성공하면 `filesUploaded(ids)`로 대기열에서 지웁니다(읽기 전용·재시도 중에는 유지). 형식이 잘못된 id는 올리지 않고 대기열에서 버립니다. `files/` 경로는 문서로 풀(pull)하지 않습니다.
- 표시: 비공개 저장소라 공개 URL이 없습니다. `GET /repos/.../git/blobs/:sha`(인증)로 받아 IndexedDB 캐시(`fileCache`, LRU 200MB) → `URL.createObjectURL`.
  - 대안: `raw.githubusercontent.com`은 비공개 저장소에서 토큰 헤더로 CORS가 안 되므로 쓰지 않습니다.
  - ✅ M3-02 구현: 내려받기는 Git blob API 대신 **Contents API의 raw 미디어 타입**(`GET /repos/:o/:r/contents/files/<id>?ref=<branch>`, `Accept: application/vnd.github.raw+json`)을 씁니다. 경로로 바로 받으므로 파일별 blob sha를 기록할 필요가 없고, base64 JSON 없이 바이트가 오며 100MB까지 됩니다. `core/files/cache.ts`의 `loadFile(id)`: 메모리 objectURL → IndexedDB `cache` → 업로드 대기열 → GitHub 순서. 같은 파일 동시 요청은 하나로 합칩니다. LRU는 `meta` 저장소(크기·마지막 사용)만 읽어 200MB를 넘는 만큼 오래된 것부터 지웁니다. 상태: `ready`, `not-connected`(연결 전), `offline`, `missing`(저장소에 아직 없음 — 다른 기기 대기열), `error`. React는 `@/features/files`의 `useFile(id)` — 연결·동기화 완료·온라인 복귀 시 다시 시도, 자리 표시 문구는 `fileStatusKey(status)`.
- 이미지 처리: 업로드 전 긴 변 2560px로 축소, WebP 변환(지원 시), EXIF 회전 반영. 원본 유지 옵션도 둡니다.
  - ✅ M3-03 구현 (`core/files/image.ts`의 `prepareImage`, 업로드 코드와 함께 지연 로드): PNG·JPEG·WebP·AVIF·HEIC(디코딩 가능한 브라우저)만 처리하고 GIF(애니메이션)·SVG는 그대로. `createImageBitmap(…, { imageOrientation: 'from-image' })`로 EXIF 회전을 반영해 그립니다. 축소가 필요 없고 1MB 이하이며 회전 정보가 없으면 원본 그대로(화질 손실 없음), 다시 인코딩한 결과가 더 크면 원본을 씁니다. WebP 인코딩이 안 되면(구형 Safari) PNG는 PNG, 나머지는 JPEG(품질 0.85). 설정 → 파일과 이미지 → "이미지 원본 그대로 올리기"(기기별 `webnota:image-original`)를 켜면 처리하지 않습니다.
- 크기 제한: 파일당 25MB (Git Data API 블롭 업로드는 base64라 실제 요청은 약 33MB).
- 참조되지 않는 파일 정리: "저장소 정리" 작업에서 모든 문서를 스캔해 고아 파일을 삭제합니다 (수동 실행).
  - ✅ M3-10 구현: 설정 → 파일과 이미지 → "저장소 정리"(GitHub 연결 시, 확인 대화상자). 순서: 동기화 1회(실패하면 중단) → `core/files/refs.ts`로 참조 수집(모든 뷰의 문서 — 휴지통 포함 — 의 `src`/`fileId` 속성 중 파일 id, 페이지 커버, 뷰·스페이스 아이콘, 업로드 대기 파일) → `core/sync/cleanup.ts`의 `removeFiles`가 `files/` 아래 참조 없는 WebNota 파일(id 형식)만 한 커밋으로 삭제(다른 기기가 그사이 푸시하면 새 헤드에서 다시 판단). 형식이 다른 이름은 건드리지 않습니다. 지운 파일은 이 기기 캐시에서도 지웁니다. 같은 카드에 이 기기 파일 캐시 크기를 표시합니다. **M4 이후 파일을 참조하는 새 위치(DB `media` 필드, 행 커버 등)는 `refs.ts`에 추가해야 합니다** — 빠지면 정리가 그 파일을 지웁니다.
  - e2e는 `tests/e2e/fakeGithub.ts`(메모리 GitHub)로 업로드 → 다른 기기 내려받기 → 정리 전체를 검증합니다.

## SY-05 다중 워크스페이스 (M1)

- 계정 하나에 여러 워크스페이스(저장소)를 둡니다. 동기화 상태와 IndexedDB 이름 공간을 분리합니다.
- 협업자로 초대받은 저장소도 추가할 수 있습니다 (`owner/repo` 입력 또는 `GET /user/repos?affiliation=collaborator`에서 `webnota` 주제(topic)로 필터).

## SY-08 다중 저장소 동기화 (M9, 공유 스페이스 — spec/07 SH-00)

워크스페이스 하나가 **홈 저장소 + 공유 스페이스 저장소 N개**와 동기화합니다.

- **동기화 대상(target) = 저장소.** target마다 헤드 sha, 더티 집합, ETag 캐시, 백오프, 동기화 기록을 따로 둡니다. 스케줄(SY-02b)은 공통이고, 한 번의 실행에서 더티가 있는 target만 차례로 처리합니다(커밋도 저장소별 1개).
- **문서 → 저장소 라우팅**: 문서 이름에 저장소를 넣지 않고, 어느 스페이스의 문서인지로 정합니다. 공유 스페이스의 문서는 로컬 이름 공간 `wn:<wsId>:sp:<spaceId>:<docName>`(IndexedDB)와 그 저장소의 `data/…` 경로를 씁니다. 홈 저장소 문서는 지금 그대로.
- **API 한도**: 토큰 하나의 한도(5000/시)를 모든 target이 나눠 씁니다. 화면에 보이는 스페이스 우선, 나머지는 풀 주기를 늘립니다(접힌 공유 스페이스 2분). 304(ETag)는 한도를 쓰지 않으므로 대부분 공짜입니다.
- **권한 오류**: 저장소 접근이 끊기면(404/403, 협업자에서 제외됨) 그 스페이스만 "접근할 수 없음"으로 표시하고 로컬 사본은 읽기 전용으로 남깁니다(사용자가 지울 때까지).
- **파일 정리(SY-04)·휴지통·검색 색인**은 저장소별로 동작합니다. `refs.ts`의 참조 수집도 target 단위.
- **스페이스 간 이동**(SH-00): 복사 → 대상 저장소 푸시 성공 확인 → 원본 삭제의 2단계. 중간에 끊기면 다음 실행에서 이어서 하거나(복사본 있음) 되돌립니다. 이동 작업은 로컬 작업 로그에 남겨 재시도합니다.
- 구현(M9-01): 엔진(`syncOnce`)은 그대로 쓰고 target마다 한 번씩 돌립니다 — 홈 다음에 `workspace.spaces[].repo`가 있는 스페이스 순서. 공유 스페이스 target은 `scopeStore`(`core/sync/targets.ts`)가 로컬 이름 `sp:<id>:<이름>` ↔ 저장소 이름 `<이름>`을 바꿔 보여 주고, 그 스페이스의 `space` 문서가 루트(`rootPath: data/space.yjs`, 홈은 `data/workspace.yjs`) — 살아 있는 뷰·DB 판단도 그 문서 기준. 동기화 상태는 target별 키(`webnota:sync-state:<owner/repo@branch>`), 기본 브랜치는 처음 한 번 묻고 기억. 공유 스페이스 저장소에는 그 스페이스의 수정된 문서가 쓰는 파일도 올림(그 저장소만 받은 멤버가 열 수 있게; 업로드 대기열은 홈이 비움 — 홈 저장소에도 올라가는 것은 M9-06에서 정리). 저장소에 닿지 않으면(404/403) 그 스페이스만 `deniedSpaces`에 넣고 나머지는 계속. 보이는 스페이스 우선·접힌 스페이스 주기 늘리기는 아직 아님(스페이스가 몇 개뿐인 동안 필요 없음).

## SY-06 인증 (✅ PoC, M9 개선)

| 방식 | 상태 | 권한 |
|---|---|---|
| Fine-grained PAT | ✅ | 선택 저장소 Contents R/W |
| OAuth App + Worker | ✅ (Worker 배포 필요) | `repo` (넓음) |
| GitHub App + Worker | M9 | 사용자가 고른 저장소만, 사용자 토큰 8시간 + 갱신 토큰 (Worker가 갱신) |

- 구현(M9-02): GitHub App 로그인은 OAuth와 같은 화면(`login/oauth/authorize`, App의 client id)이고, Worker `/token`이 App 응답의 `refresh_token`·`expires_in`을 그대로 넘깁니다. 앱은 만료 시각과 갱신 토큰을 저장하고(`saveGrant`), 동기화 직전 만료 5분 전이면 Worker `/refresh`로 새 쌍을 받습니다(`freshToken`, 실패하면 옛 토큰 → 401이면 연결 해제 안내). 설정의 GitHub 카드에 로그인 종류별 안내: App이면 "고른 저장소만 씀 + 저장소 선택 바꾸기" 링크(`VITE_GITHUB_APP_SLUG`), 토큰(PAT)이면 "공유 스페이스 저장소마다 권한 추가 — App 권장". 공유 스페이스 저장소에 닿지 않으면(`deniedSpaces`) 개수와 이유를 표시. Worker 배포: GitHub App을 만들고(사용자 토큰 만료 켜기, Contents·Administration·Metadata 권한) client id/secret을 Worker 비밀로, `VITE_GITHUB_CLIENT_ID`에 App의 client id.
- 토큰은 localStorage에 저장합니다. XSS 방지를 위해 CSP 메타 태그를 둡니다 (`script-src 'self'`, `connect-src` 허용 목록). 사용자 콘텐츠의 HTML은 렌더링 전에 정리합니다 (DOMPurify, 붙여넣기·가져오기 시).

## SY-07 내보내기 백업 (M8)

- 전체 워크스페이스를 zip으로 내보냅니다: `*.md`(문서), `*.csv`(DB), `files/`, `workspace.json`(트리), 그리고 원본 `.yjs`.
- zip에서 복원(가져오기)할 수 있습니다.
- 구현(M8-08): 설정 → 가져오기·내보내기 → "모두 내보내기"의 zip = Notion 형식 `.md`/`.csv` + 첨부 + `webnota.json`(뷰 트리·페이지 JSON·DB 스냅샷·행 페이지·파일 경로) + `_yjs/`(워크스페이스·페이지·DB 스키마·행 샤드·행 페이지의 Yjs 상태 원본 — 복구 도구용 보관본). 복원은 `webnota.json`으로 **새 스페이스에** 무손실: 뷰·DB id를 새로 만들고 문서 안 멘션·하위 페이지·인라인 DB·**관계 필드의 대상 DB**까지 바꿈(롤업은 관계를 따라감), 파일은 내용 해시 id라 그대로. 큰 백업은 내보내기·가져오기 버튼에 진행 수(`n/전체`) 표시.
