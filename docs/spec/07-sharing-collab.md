# 07. 공유, 게시, 실시간 협업, 멤버 (`SH`)

AppFlowy `features/share_tab`, `plugins/shared/share/{share_tab,publish_tab,export_tab}`, `settings/widgets/members`, `settings/pages/sites`에 해당합니다.

## SH-01 공유 버튼과 공유 패널 (M9)

상단 바 "공유" 버튼 → 탭 3개 (AppFlowy와 같은 구성):
1. **공유**: 워크스페이스 멤버 목록과 권한, 링크 복사 (멤버만 열 수 있음).
2. **게시**: 웹에 공개 (SH-03).
3. **내보내기**: Markdown, HTML, PDF(인쇄), CSV(DB) (IO 문서 참고).

## SH-02 워크스페이스 멤버 (M9)

- 멤버 = 데이터 저장소의 GitHub 협업자입니다.
- 초대: GitHub 사용자 이름 입력 → `PUT /repos/{o}/{r}/collaborators/{user}` (권한 `push` 또는 `pull`). 상대는 GitHub 초대를 수락한 뒤 WebNota에서 "공유받은 워크스페이스 열기"로 엽니다.
- 역할 매핑:

| WebNota | GitHub 권한 | 가능한 작업 |
|---|---|---|
| 소유자 | admin | 전부, 멤버 관리, 기록 정리 |
| 멤버 | push (write) | 편집 |
| 게스트(읽기) | pull (read) | 읽기 전용 (앱에서 편집 UI 비활성화, 동기화는 풀만) |

- 멤버 목록: `GET /repos/{o}/{r}/collaborators` + 대기 중 초대 `GET .../invitations`.
- 개인 계정 저장소는 협업자 권한이 write 하나뿐입니다 (읽기 전용 게스트는 조직 저장소에서만 가능). UI에서 이 점을 안내합니다.

## SH-03 웹에 게시 (M9)

목표: 로그인 없이 볼 수 있는 공개 URL.

방식: 사용자 계정에 **공개 저장소 `webnota-sites`**를 만들고 GitHub Pages를 켭니다. 게시할 때 페이지를 정적 데이터로 변환해 커밋합니다.

```
webnota-sites/
  index.html                 (WebNota 뷰어 셸 — 앱 뷰어 번들을 가리키는 작은 HTML)
  p/<slug>/index.json        (게시된 페이지: ProseMirror JSON + 메타, 이미지 경로)
  p/<slug>/index.html        (SEO용 정적 HTML 미리 렌더링 + 뷰어 로더)
  files/<sha>.<ext>          (게시 페이지에 쓰인 이미지)
```

- 공개 URL: `https://<user>.github.io/webnota-sites/p/<slug>/` 또는 앱 뷰어 `#/p/<user>/webnota-sites/<slug>`.
- 게시 옵션: 이름(slug) 지정(AppFlowy `publish_name_generator`), 하위 페이지 포함, 게시 취소(파일 삭제), 업데이트(다시 게시).
- 데이터베이스 게시: Grid/Board/Calendar 읽기 전용 스냅샷 (M9 P1).
- 설정 → "사이트": 게시된 페이지 목록, 열기, 취소 (AppFlowy `settings/pages/sites`).
- 개인정보 경고: 게시 전에 "공개 저장소에 저장되어 누구나 볼 수 있습니다"를 확인받습니다.

## SH-04 실시간 공동 편집 (M10)

GitHub만으로는 실시간이 불가능해서 Cloudflare Durable Objects로 중계합니다.

```
클라이언트 A ─┐  WebSocket (y-protocols sync + awareness)
클라이언트 B ─┼──▶  Durable Object "room:<owner>/<repo>/<docName>"
클라이언트 C ─┘       ├ 메모리에 Y.Doc 유지 (연결이 있는 동안만)
                      ├ 연결 시 인증: 클라이언트 GitHub 토큰으로 GET /repos/{o}/{r} → 권한 확인 (결과 10분 캐시)
                      └ 마지막 연결 종료 후 문서 폐기 (저장 안 함)
```

- 영구 저장은 여전히 각 클라이언트의 GitHub 동기화가 담당합니다. 중계 서버가 죽어도 데이터는 안전합니다.
- 연결 정책: 문서를 열면 연결하고 닫으면 끊습니다. 워크스페이스 문서는 항상 연결합니다 (사이드바 실시간 갱신).
- 실시간 연결 중에는 GitHub 풀 주기를 5분으로 늘립니다.
- 인지(awareness): 커서와 선택 영역(이름 + 색상), 상단 바 아바타 목록 (AppFlowy collaborators).
- 무료 플랜 한도: Durable Objects 무료 플랜은 요청·실행 시간 한도가 있습니다. 방 단위 연결 수를 제한하고(예: 20), 한도 초과 시 GitHub 동기화만으로 자동 폴백합니다.
- Worker 미배포 환경에서는 이 기능이 자동으로 꺼집니다 (설정에 상태 표시).

## SH-05 버전 기록 (M9)

GitHub 커밋 기록을 그대로 활용합니다.
- 페이지 더보기 → "기록": 이 페이지 파일을 바꾼 커밋 목록 (`GET /repos/{o}/{r}/commits?path=...`), 시각과 작성자(기기).
- 선택하면 해당 시점의 블롭을 불러와 읽기 전용으로 미리보기 → "이 버전으로 복원"합니다. 복원은 현재 문서 내용을 교체하는 새 변경이라 CRDT상 안전합니다.
- 기록 정리(SY-03)를 하면 그 이전 기록은 사라진다는 점을 안내합니다.

## SH-06 댓글 (P2, M11 이후 검토)

AppFlowy에는 아직 본격적인 댓글 기능이 없으므로 후순위입니다. 필요하면 `doc/<id>`에 `comments: Y.Map`을 추가하는 형태로 설계합니다.
