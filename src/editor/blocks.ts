import type { ChainedCommands, Editor } from '@tiptap/core'
import {
  CheckSquare,
  Code2,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Minus,
  Quote,
  Type,
  type LucideIcon,
} from 'lucide-react'

export interface BlockItem {
  id: string
  title: string
  hint: string
  keywords: string[]
  icon: LucideIcon
  run: (chain: ChainedCommands) => ChainedCommands
  isActive?: (editor: Editor) => boolean
}

export const BLOCKS: BlockItem[] = [
  {
    id: 'text',
    title: '텍스트',
    hint: '일반 텍스트',
    keywords: ['text', 'paragraph', '텍스트', '본문', '문단'],
    icon: Type,
    run: (c) => c.setParagraph(),
    isActive: (e) =>
      e.isActive('paragraph') && !e.isActive('bulletList') && !e.isActive('orderedList') && !e.isActive('taskList'),
  },
  {
    id: 'h1',
    title: '제목 1',
    hint: '큰 제목',
    keywords: ['h1', 'heading', 'title', '제목', '헤딩'],
    icon: Heading1,
    run: (c) => c.setHeading({ level: 1 }),
    isActive: (e) => e.isActive('heading', { level: 1 }),
  },
  {
    id: 'h2',
    title: '제목 2',
    hint: '중간 제목',
    keywords: ['h2', 'heading', '제목', '헤딩'],
    icon: Heading2,
    run: (c) => c.setHeading({ level: 2 }),
    isActive: (e) => e.isActive('heading', { level: 2 }),
  },
  {
    id: 'h3',
    title: '제목 3',
    hint: '작은 제목',
    keywords: ['h3', 'heading', '제목', '헤딩'],
    icon: Heading3,
    run: (c) => c.setHeading({ level: 3 }),
    isActive: (e) => e.isActive('heading', { level: 3 }),
  },
  {
    id: 'todo',
    title: '할 일 목록',
    hint: '체크박스로 할 일 관리',
    keywords: ['todo', 'task', 'check', 'checkbox', '할일', '체크', '투두'],
    icon: CheckSquare,
    run: (c) => c.toggleTaskList(),
    isActive: (e) => e.isActive('taskList'),
  },
  {
    id: 'bullet',
    title: '글머리 기호 목록',
    hint: '간단한 목록',
    keywords: ['bullet', 'list', 'ul', '목록', '리스트', '글머리'],
    icon: List,
    run: (c) => c.toggleBulletList(),
    isActive: (e) => e.isActive('bulletList'),
  },
  {
    id: 'numbered',
    title: '번호 목록',
    hint: '번호가 매겨진 목록',
    keywords: ['number', 'ordered', 'ol', '번호', '숫자'],
    icon: ListOrdered,
    run: (c) => c.toggleOrderedList(),
    isActive: (e) => e.isActive('orderedList'),
  },
  {
    id: 'quote',
    title: '인용',
    hint: '인용문',
    keywords: ['quote', 'blockquote', '인용'],
    icon: Quote,
    run: (c) => c.toggleBlockquote(),
    isActive: (e) => e.isActive('blockquote'),
  },
  {
    id: 'code',
    title: '코드 블록',
    hint: '코드 조각',
    keywords: ['code', 'snippet', '코드'],
    icon: Code2,
    run: (c) => c.toggleCodeBlock(),
    isActive: (e) => e.isActive('codeBlock'),
  },
  {
    id: 'divider',
    title: '구분선',
    hint: '블록을 나누는 선',
    keywords: ['divider', 'hr', 'line', 'separator', '구분선', '선'],
    icon: Minus,
    run: (c) => c.setHorizontalRule(),
  },
]

export function filterBlocks(query: string): BlockItem[] {
  const q = query.trim().toLowerCase()
  if (!q) return BLOCKS
  return BLOCKS.filter((b) => b.title.toLowerCase().includes(q) || b.keywords.some((k) => k.includes(q)))
}
