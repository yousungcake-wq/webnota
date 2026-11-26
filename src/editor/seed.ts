import { prosemirrorJSONToYXmlFragment } from '@tiptap/y-tiptap'
import type * as Y from 'yjs'
import { docSchema } from './extensions'

const p = (text: string) => ({ type: 'paragraph', content: text ? [{ type: 'text', text }] : [] })
const h = (level: number, text: string) => ({ type: 'heading', attrs: { level }, content: [{ type: 'text', text }] })
const task = (text: string, checked = false) => ({
  type: 'taskItem',
  attrs: { checked },
  content: [p(text)],
})

const WELCOME = {
  type: 'doc',
  content: [
    p(
      'WebNota는 브라우저에서 바로 쓰는 노트 앱입니다. 모든 내용은 이 기기에 즉시 저장되고, GitHub를 연결하면 내 비공개 저장소에 자동으로 동기화됩니다.',
    ),
    h(2, '기본 사용법'),
    {
      type: 'taskList',
      content: [
        task("빈 줄에서 '/'를 입력해 블록 메뉴 열기"),
        task('왼쪽 사이드바의 + 버튼으로 하위 페이지 만들기'),
        task('설정에서 GitHub 연결하기'),
        task('이 할 일을 눌러서 완료 표시하기', true),
      ],
    },
    h(2, '모바일에서'),
    {
      type: 'bulletList',
      content: [
        { type: 'listItem', content: [p('키보드 위 도구 모음으로 서식, 들여쓰기, 블록 이동을 할 수 있습니다.')] },
        { type: 'listItem', content: [p('브라우저 메뉴의 "홈 화면에 추가"로 설치하면 앱처럼 쓸 수 있습니다.')] },
      ],
    },
    { type: 'blockquote', content: [p('오프라인에서도 동작합니다. 다시 연결되면 자동으로 동기화됩니다.')] },
  ],
}

export function seedWelcome(doc: Y.Doc) {
  const fragment = doc.getXmlFragment('default')
  if (fragment.length > 0) return
  prosemirrorJSONToYXmlFragment(docSchema(), WELCOME, fragment)
}
