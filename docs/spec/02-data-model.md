# 02. 데이터 모델

모든 영속 데이터는 Yjs 문서(Y.Doc)에 있습니다. 문서 하나가 IndexedDB 데이터베이스 하나이자 GitHub 파일 하나입니다.

## 1. 문서 종류와 파일 경로

| 문서 이름 (doc name) | 내용 | GitHub 경로 | 로드 시점 |
|---|---|---|---|
| `workspace` | 워크스페이스 메타, 스페이스, 뷰 트리, 사용자별 상태 | `data/workspace.yjs` | 부팅 시 (항상) |
| `doc/<viewId>` | 문서 본문 + 페이지 스타일 | `data/docs/<viewId>.yjs` | 페이지 열 때 |
| `db/<dbId>` | DB 스키마(필드) + 뷰 설정 | `data/dbs/<dbId>/schema.yjs` | DB 뷰 열 때 |
| `dbr/<dbId>/<shard>` | 행 데이터 (샤드) | `data/dbs/<dbId>/rows-<shard>.yjs` | DB 뷰 열 때 (전체 샤드) |
| `row/<dbId>/<rowId>` | 행 페이지 본문 | `data/dbs/<dbId>/rows/<rowId>.yjs` | 행 페이지 열 때 |
| (바이너리) | 이미지, 첨부 파일 | `files/<sha256>.<ext>` | 표시할 때 (캐시) |

- PoC 경로(`data/pages/<id>.yjs`, doc 이름 `page/<id>`)는 M0 마이그레이션에서 `doc/` 체계로 이전합니다 (§7). M0-16에서 doc 이름은 `doc/<id>`가 되었고, M0-17부터 GitHub 경로는 `data/docs/<id>.yjs`입니다. 엔진은 남아 있는 `data/pages/<id>.yjs`를 받아 병합한 뒤, 같은 커밋에서 새 경로에 쓰고 구 경로를 지웁니다 (살아 있지 않은 페이지의 구 파일은 병합 없이 지움). 구버전 앱은 이후 본문을 받지 못하지만 자동 업데이트로 곧 v2가 됩니다 (사용자 결정, 2026-11-26).
- 행을 **샤드**로 나누는 이유: 행 하나를 고쳐도 해당 샤드 파일만 업로드합니다. 10,000행 DB도 커밋당 수백 KB 이하로 유지됩니다. 샤드 수는 DB 생성 시 8개로 고정합니다. 샤드 번호는 `hash(rowId) % 8`입니다.

## 2. `workspace` 문서

```ts
workspace (Y.Doc)
├─ meta: Y.Map
│   schemaVersion: number          // §6
│   id: string                     // 워크스페이스 ID (저장소와 1:1)
│   name: string
│   icon: IconValue | null
│   createdAt: number
├─ spaces: Y.Map<spaceId, Y.Map>
│   name, icon: IconValue, color: string, order: FracKey,
│   visibility: 'shared' | 'private', ownerLogin: string | null, createdAt
├─ views: Y.Map<viewId, Y.Map>
│   kind: 'document' | 'database'
│   layout: 'document' | 'grid' | 'board' | 'calendar'
│   databaseId: string | null       // kind=database일 때
│   parentId: string                // spaceId 또는 viewId
│   order: FracKey                  // 형제 사이 순서
│   title: string
│   icon: IconValue | null
│   embedded: boolean               // 문서 안 인라인 DB 뷰 (사이드바에 숨김)
│   locked: boolean                 // 읽기 전용 잠금
│   createdAt, createdBy, updatedAt, updatedBy
│   deletedAt: number | null, deletedBy: string | null
├─ users: Y.Map<login, Y.Map>       // 사용자별 상태 (공유 워크스페이스 대비)
│   favorites: Y.Map<viewId, FracKey>
│   lastOpened: string | null
└─ pages: Y.Map<id, Y.Map>          // v1(PoC) 형식의 동결 사본 — 읽지도 고치지도 않음 (§7)
```

```ts
type IconValue =
  | { type: 'emoji'; value: string }            // "📄"
  | { type: 'icon'; value: string; color?: string } // lucide 아이콘 이름
  | { type: 'file'; value: string }             // files/<sha>.png
type FracKey = string // fractional-indexing 키 ("a0", "a0V" …)
```

규칙:
- 필드 단위 병합을 위해 뷰 하나당 `Y.Map` 하나를 씁니다.
- `title`은 LWW 문자열입니다. 제목 동시 편집 충돌은 드물어서 Y.Text를 쓰지 않습니다.
- 정렬은 항상 `(order, id)`로 합니다. 같은 키가 생겨도 결정적입니다.
- 계층 순환(A→B→A)이 병합으로 생기면 렌더링 시 순환을 끊고 루트로 표시합니다 (`isAlive`처럼 방문 집합 사용).
- **휴지통**: `deletedAt` 설정. 하위 뷰는 조상이 삭제되면 숨겨집니다. **영구 삭제**는 뷰 항목을 제거하고 동기화 엔진이 고아 파일을 정리합니다.
- **즐겨찾기**를 사용자별로 두는 이유: 공유 워크스페이스에서 남의 즐겨찾기가 섞이면 안 됩니다. "최근 항목"은 기기별(localStorage)입니다.

## 3. `doc/<viewId>` 문서

```ts
doc (Y.Doc)
├─ default: Y.XmlFragment          // ProseMirror 문서 (y-prosemirror)
└─ page: Y.Map
    cover: CoverValue | null       // { type: 'color'|'gradient'|'file'|'url', value, offsetY }
    font: string | null            // 'default' | 'serif' | 'mono' | 구글 폰트 이름 (M2)
    fontSize: 'small' | 'normal' | 'large'
    lineHeight: 'compact' | 'normal' | 'relaxed'
    fullWidth: boolean
```

블록 스키마는 [04-editor.md](04-editor.md) §2에 정의합니다. 모든 블록 노드는 `id` 속성(블록 링크용, nanoid 10자)을 가집니다.

## 4. 데이터베이스 문서

### 4.1 `db/<dbId>` (스키마 + 뷰)

```ts
db (Y.Doc)
├─ meta: Y.Map    { schemaVersion, shardCount: 8, primaryFieldId, createdAt }
├─ fields: Y.Map<fieldId, Y.Map>
│   name: string
│   type: FieldType               // §4.3
│   options: Y.Map                // 타입별 설정 (§4.3)
│   createdAt
└─ views: Y.Map<viewId, Y.Map>    // viewId == workspace.views의 id
    layout: 'grid' | 'board' | 'calendar'
    fields: Y.Map<fieldId, Y.Map> { visible: boolean, width: number, order: FracKey, wrap: boolean }
    filter: FilterGroup | null    // JSON (§4.5)
    sorts: Sort[]                 // JSON
    group: { fieldId, hideEmpty: boolean, order: Record<groupKey, FracKey>, hidden: string[] } | null
    calcs: Y.Map<fieldId, CalcType>
    board: { cardFields?: string[], coverFieldId?: string | null }
    calendar: { dateFieldId, firstDayOfWeek: 0|1, showWeekends: boolean, showWeekNumbers: boolean }
    frozenColumns: number
```

필터, 정렬, 그룹 설정은 작은 JSON 값으로 통째로 교체합니다 (LWW). 동시 편집 빈도가 낮고, 단순할수록 버그가 적습니다.

### 4.2 `dbr/<dbId>/<shard>` (행)

```ts
rows: Y.Map<rowId, Y.Map>
  order: FracKey                   // 수동 정렬 순서 (정렬이 없는 뷰에서 사용)
  cells: Y.Map<fieldId, CellValue> // 셀 단위 LWW
  icon: IconValue | null
  cover: CoverValue | null
  hasDoc: boolean                  // 행 페이지 본문 존재 여부
  createdAt, createdBy, updatedAt, updatedBy
```

### 4.3 필드 타입과 셀 값

AppFlowy `type_option_editor`의 타입에서 AI 타입(summary, translate)만 뺀 목록입니다.

| FieldType | 셀 값 (JSON) | options | 비고 |
|---|---|---|---|
| `text` | `string` | — | 기본(primary) 필드는 항상 text |
| `number` | `number \| null` | `format`: number, percent, currency(KRW, USD, EUR, JPY …), `decimals`, `separator` | |
| `select` | `optionId \| null` | `choices: {id, name, color}[]` | 단일 선택 |
| `multiSelect` | `optionId[]` | 동일 | |
| `date` | `{ start: number, end?: number, includeTime: boolean, tz?: string } \| null` | `dateFormat`, `timeFormat`(12/24h) | 범위, 리마인더 연동 |
| `checkbox` | `boolean` | — | |
| `checklist` | `{ id, name, done }[]` | — | 진행률 표시 |
| `url` | `string` | — | 링크 미리보기 |
| `createdTime` | (자동) `row.createdAt` | `dateFormat`, `timeFormat`, `includeTime` | 읽기 전용 |
| `updatedTime` | (자동) `row.updatedAt` | 동일 | 읽기 전용 |
| `relation` | `rowId[]` | `targetDatabaseId`, `twoWay: boolean`, `pairedFieldId` | 양방향은 상대 DB에도 기록 |
| `rollup` | (계산) | `relationFieldId`, `targetFieldId`, `fn` | AppFlowy 확장 (M6, 선택) |
| `media` | `{ fileId, name, mime, size }[]` | `hideFileNames` | files/ 저장소 |
| `time` | `number \| null` (분) | `format` | 소요 시간 (AppFlowy time 필드) |
| `person` | `login[]` | — | 공유 워크스페이스용 (M9, 선택) |

필드 타입 변환 시 값 변환 규칙은 [05-database.md](05-database.md) §3.4에 있습니다.

### 4.4 계산 (CalcType)

`count`, `countEmpty`, `countNotEmpty`, `percentEmpty`, `percentNotEmpty`, `sum`, `average`, `median`, `min`, `max`, `range`, `countChecked`, `countUnchecked`, `percentChecked`.

### 4.5 필터 구조

```ts
type FilterGroup = { op: 'and' | 'or'; items: (Filter | FilterGroup)[] }  // 중첩은 2단계까지
type Filter = { id: string; fieldId: string; cond: FilterCond; value?: unknown }
```

조건(`FilterCond`)은 필드 타입별로 [05-database.md](05-database.md) §4.2에 정의합니다.

## 5. 정렬 키 (FracKey)

- `fractional-indexing`의 `generateKeyBetween(a, b)`를 씁니다.
- 동시에 같은 위치에 삽입하면 키가 같아질 수 있어서, 정렬은 `(key, id)`로 합니다.
- 키 길이가 64자를 넘으면 해당 형제 그룹 전체를 재조정합니다 (드문 작업).

## 6. 스키마 버전과 호환성

| 상황 | 동작 |
|---|---|
| 문서 버전 < 앱 버전 | 마이그레이션을 순서대로 실행 (origin `'migration'`), 버전 갱신 |
| 문서 버전 = 앱 버전 | 정상 |
| 문서 버전 > 앱 버전 | **읽기 전용 모드** + "앱을 업데이트하세요" 배너, 서비스 워커 업데이트 확인 |

**y-prosemirror 주의**: 구버전 클라이언트가 모르는 노드 타입이 담긴 문서를 열면, 해당 내용이 삭제될 수 있습니다. 그래서 다음 규칙을 반드시 지킵니다.
1. 새 블록·마크 타입을 추가하면 **반드시 schemaVersion을 올립니다.** 구버전은 읽기 전용이 되어 데이터를 지우지 못합니다.
2. 노드·마크 타입 이름은 **절대 바꾸거나 지우지 않습니다** (추가만 허용, deprecated 노드도 렌더러 유지).
3. 속성(attrs)을 추가할 때는 항상 기본값을 둡니다.

마이그레이션은 `core/schema/migrations/NNN-name.ts`에 순수 함수로 작성하고, 각각 단위 테스트를 둡니다. 노드·마크 이름 목록은 `features/editor/schema.test.ts`가 버전별로 고정해서, 버전을 올리지 않고 타입을 추가하거나 이름을 지우면 테스트가 실패합니다.

구현 규칙 (M0-15, `core/schema`):
- 앱 버전은 `SCHEMA_VERSION`(`core/schema/version.ts`). 버전을 판단하는 문서는 `workspace`이고, 이 게이트가 앱 전체(문서 본문 포함)를 읽기 전용으로 만듭니다.
- `meta.schemaVersion`이 없으면 버전 1(PoC)로 봅니다. 양의 정수가 아닌 값은 "더 새로운 버전"으로 보고 읽기 전용입니다.
- 레지스트리(`migrations/index.ts`)는 버전 2부터 앱 버전까지 하나씩, 순서대로 있어야 합니다 (`checkRegistry`, 단위 테스트로 강제).
- 마이그레이션 한 단계는 **원자적**입니다: 문서 사본에서 실행해 성공하면 차이만 원본에 한 트랜잭션(origin `'migration'`)으로 적용하고, 같은 트랜잭션에서 `schemaVersion`을 올립니다. 실패하면 원본은 직전 단계 상태 그대로이고 앱은 읽기 전용("데이터를 새 형식으로 바꾸지 못함" 배너)이 됩니다.
- 마이그레이션은 `core/model`을 쓰지 않습니다 (모델은 최신 스키마를 따라 바뀌므로). 여러 기기가 동시에 실행해도 병합 결과가 같도록 **결정적·멱등**으로 씁니다 (고정 ID, 존재 확인 후 생성).
- 마이그레이션 변경은 사용자 편집처럼 더티로 표시되어 동기화됩니다.
- 게이트는 부팅 후에도 `meta`를 관찰합니다. 다른 기기의 더 새로운 버전이 병합되면 **동기적으로** 읽기 전용이 되고, 동기화 엔진은 pull 직후 `canPush`를 확인해 그 회차의 push를 건너뜁니다 (더티는 유지). 낮은 버전이 병합되면 마이그레이션을 다시 실행합니다.
- 읽기 전용일 때: 에디터 `editable=false`, 제목·아이콘 편집 불가, `core/model` 변경 함수는 `ReadOnlyError`를 던지고 토스트로 안내, 로컬 변경은 더티로 표시하지 않음, 동기화는 pull만 합니다. 배너의 "앱 업데이트"는 서비스 워커 업데이트를 확인하고 새로고침합니다.

## 7. 예정된 마이그레이션

| 버전 | 내용 | 마일스톤 |
|---|---|---|
| 1 | PoC 형식: `workspace.pages` (숫자 order), `page/<id>` 문서 | (현재) |
| 2 | `pages` → `views`(kind=document, layout=document), order → FracKey, `favorite` → `users[login].favorites`, 기본 스페이스 생성, 문서 이름 `page/<id>` → `doc/<id>`, 파일 경로 `data/pages/` → `data/docs/` | M0 |
| 3 | 노드 타입 `toggle`·`toggleSummary`·`toggleContent` 추가 (데이터 변환 없음, 버전만) | M2-03 |
| 4 | 노드 타입 `callout`(icon, color) 추가 (버전만) | M2-04 |

v2 문서 이름 변경은 IndexedDB 데이터베이스 복사가 필요합니다. 첫 실행 시 복사하고, 성공하면 구 DB를 삭제합니다. 동기화 엔진은 구 경로 파일을 읽어서 새 경로로 쓰고, 구 경로는 삭제합니다 (M0-17).

v2 구현 세부 (M0-16, `core/schema/migrations/002-views.ts`):
- 뷰 ID = 페이지 ID. 루트 페이지와 부모가 없는 페이지는 기본 스페이스(ID `default`, 이름은 기기 언어의 "일반"/"General")로 갑니다.
- 형제 순서는 v1의 `(order, createdAt)` 순서대로 FracKey를 새로 매깁니다. 아이콘 문자열은 `{type:'emoji'}`(빈 문자열은 `null`), 휴지통 상태는 유지(`deletedBy='local'`).
- 즐겨찾기는 `users.local.favorites`로 옮깁니다 (마이그레이션은 로그인을 모름, §8). 앱도 로그인 추적 전까지는 `local`을 현재 사용자로 씁니다.
- **`pages`는 비우지 않고 동결 사본으로 남깁니다.** 아직 업데이트되지 않은 v1 앱(다른 기기의 캐시된 PWA)은 스키마 게이트가 없고, 동기화할 때 `pages`에 없는 페이지의 저장소 파일을 삭제하기 때문입니다. v2의 영구 삭제는 `pages`의 같은 항목도 지웁니다.
- **남은 데이터(leftover)**: 이미 v2인 문서에 뷰가 없는 `pages` 항목이 병합되면(첫 동기화 전에 빈 워크스페이스를 마이그레이션한 새 기기, 또는 v1 앱이 만든 페이지) 게이트가 v2를 다시 실행해 기존 형제 뒤에 붙입니다. 이미 있는 뷰는 덮어쓰지 않습니다.
- 두 기기가 동시에 마이그레이션해도 ID·순서 키가 결정적이라 병합 결과가 같습니다 (테스트). 다만 같은 뷰의 `Y.Map`이 기기마다 따로 만들어져 하나만 남으므로, 동시 마이그레이션 직후 양쪽에서 한 같은 뷰 편집 중 하나는 사라질 수 있습니다 (드묾, 수용).
- IndexedDB 복사는 `core/docs/legacy.ts` (기기당 한 번, 지연 로드). M0-18부터는 `webnota:page/<id>`·`webnota:doc/<id>`·`webnota:workspace`를 `wn:<wsId>:` 이름 공간으로 한 번에 옮깁니다. 실패하면 구 DB를 남기고 다음 부팅에 다시 시도합니다. QA: `webnota:debug=seed-v1`로 v1 데이터를 심어 확인 (docs/QA.md).

## 8. 사용자 식별

- 로그인 사용자: GitHub `login`
- 로그인 전: `local` (연결 시 `local`로 기록된 값을 실제 login으로 바꾸지 않음. 표시만 "나")
- `createdBy`/`updatedBy`는 표시용입니다. 권한 판단은 GitHub 저장소 권한이 합니다.
