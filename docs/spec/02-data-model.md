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

- 현재 PoC 경로(`data/pages/<id>.yjs`, doc 이름 `page/<id>`)는 M0 마이그레이션에서 `doc/` 체계로 이전합니다 (§7).
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
└─ users: Y.Map<login, Y.Map>       // 사용자별 상태 (공유 워크스페이스 대비)
    favorites: Y.Map<viewId, FracKey>
    lastOpened: string | null
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

마이그레이션은 `core/schema/migrations/NNN-name.ts`에 순수 함수로 작성하고, 각각 단위 테스트를 둡니다.

## 7. 예정된 마이그레이션

| 버전 | 내용 | 마일스톤 |
|---|---|---|
| 1 | PoC 형식: `workspace.pages` (숫자 order), `page/<id>` 문서 | (현재) |
| 2 | `pages` → `views`(kind=document, layout=document), order → FracKey, `favorite` → `users[login].favorites`, 기본 스페이스 생성, 문서 이름 `page/<id>` → `doc/<id>`, 파일 경로 `data/pages/` → `data/docs/` | M0 |

v2 문서 이름 변경은 IndexedDB 데이터베이스 복사가 필요합니다. 첫 실행 시 복사하고, 성공하면 구 DB를 삭제합니다. 동기화 엔진은 구 경로 파일을 읽어서 새 경로로 쓰고, 구 경로는 삭제합니다.

## 8. 사용자 식별

- 로그인 사용자: GitHub `login`
- 로그인 전: `local` (연결 시 `local`로 기록된 값을 실제 login으로 바꾸지 않음. 표시만 "나")
- `createdBy`/`updatedBy`는 표시용입니다. 권한 판단은 GitHub 저장소 권한이 합니다.
