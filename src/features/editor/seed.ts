import { prosemirrorJSONToYXmlFragment } from '@tiptap/y-tiptap'
import type * as Y from 'yjs'
import { getLang, type Lang } from '@/core/i18n'
import { docSchema } from './extensions'

const p = (text: string) => ({ type: 'paragraph', content: text ? [{ type: 'text', text }] : [] })
const h = (level: number, text: string) => ({ type: 'heading', attrs: { level }, content: [{ type: 'text', text }] })
const task = (text: string, checked = false) => ({
  type: 'taskItem',
  attrs: { checked },
  content: [p(text)],
})

const TEXT = {
  ko: {
    intro:
      'WebNota는 브라우저에서 바로 쓰는 노트 앱입니다. 모든 내용은 이 기기에 즉시 저장되고, GitHub를 연결하면 내 비공개 저장소에 자동으로 동기화됩니다.',
    basics: '기본 사용법',
    tasks: [
      "빈 줄에서 '/'를 입력해 블록 메뉴 열기",
      '왼쪽 사이드바의 + 버튼으로 하위 페이지 만들기',
      '설정에서 GitHub 연결하기',
      '이 할 일을 눌러서 완료 표시하기',
    ],
    mobile: '모바일에서',
    tips: [
      '키보드 위 도구 모음으로 서식, 들여쓰기, 블록 이동을 할 수 있습니다.',
      '브라우저 메뉴의 "홈 화면에 추가"로 설치하면 앱처럼 쓸 수 있습니다.',
    ],
    offline: '오프라인에서도 동작합니다. 다시 연결되면 자동으로 동기화됩니다.',
  },
  en: {
    intro:
      'WebNota is a notes app that runs right in your browser. Everything is saved on this device instantly, and once you connect GitHub it syncs to your own private repository.',
    basics: 'Basics',
    tasks: [
      "Type '/' on an empty line to open the block menu",
      'Create a subpage with the + button in the sidebar',
      'Connect GitHub in Settings',
      'Tap this to-do to mark it done',
    ],
    mobile: 'On mobile',
    tips: [
      'Use the toolbar above the keyboard for formatting, indenting and moving blocks.',
      'Install it with "Add to Home Screen" in your browser menu to use it like an app.',
    ],
    offline: 'Works offline. Changes sync automatically when you reconnect.',
  },
}

function welcome(lang: Lang) {
  const x = TEXT[lang]
  return {
    type: 'doc',
    content: [
      p(x.intro),
      h(2, x.basics),
      { type: 'taskList', content: x.tasks.map((s, i) => task(s, i === x.tasks.length - 1)) },
      h(2, x.mobile),
      { type: 'bulletList', content: x.tips.map((s) => ({ type: 'listItem', content: [p(s)] })) },
      { type: 'blockquote', content: [p(x.offline)] },
    ],
  }
}

export function seedWelcome(doc: Y.Doc) {
  const fragment = doc.getXmlFragment('default')
  if (fragment.length > 0) return
  prosemirrorJSONToYXmlFragment(docSchema(), welcome(getLang()), fragment)
}
