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
import { t, type MessageKey } from '@/core/i18n'

export interface BlockItem {
  id: string
  title: string
  hint: string
  keywords: string[]
  icon: LucideIcon
  run: (chain: ChainedCommands) => ChainedCommands
  isActive?: (editor: Editor) => boolean
}

/** Extra search keywords from the current language (space-separated in the dictionary). */
const kw = (key: MessageKey) => t(key).split(' ').filter(Boolean)

// Built once per page load: the language only changes with a reload.
export const BLOCKS: BlockItem[] = [
  {
    id: 'text',
    title: t('block.paragraph'),
    hint: t('block.paragraph.hint'),
    keywords: ['text', 'paragraph', ...kw('block.paragraph.kw')],
    icon: Type,
    run: (c) => c.setParagraph(),
    isActive: (e) =>
      e.isActive('paragraph') && !e.isActive('bulletList') && !e.isActive('orderedList') && !e.isActive('taskList'),
  },
  {
    id: 'h1',
    title: t('block.h1'),
    hint: t('block.h1.hint'),
    keywords: ['h1', 'heading', 'title', ...kw('block.h1.kw')],
    icon: Heading1,
    run: (c) => c.setHeading({ level: 1 }),
    isActive: (e) => e.isActive('heading', { level: 1 }),
  },
  {
    id: 'h2',
    title: t('block.h2'),
    hint: t('block.h2.hint'),
    keywords: ['h2', 'heading', ...kw('block.h2.kw')],
    icon: Heading2,
    run: (c) => c.setHeading({ level: 2 }),
    isActive: (e) => e.isActive('heading', { level: 2 }),
  },
  {
    id: 'h3',
    title: t('block.h3'),
    hint: t('block.h3.hint'),
    keywords: ['h3', 'heading', ...kw('block.h3.kw')],
    icon: Heading3,
    run: (c) => c.setHeading({ level: 3 }),
    isActive: (e) => e.isActive('heading', { level: 3 }),
  },
  {
    id: 'todo',
    title: t('block.todo'),
    hint: t('block.todo.hint'),
    keywords: ['todo', 'task', 'check', 'checkbox', ...kw('block.todo.kw')],
    icon: CheckSquare,
    run: (c) => c.toggleTaskList(),
    isActive: (e) => e.isActive('taskList'),
  },
  {
    id: 'bullet',
    title: t('block.bullet'),
    hint: t('block.bullet.hint'),
    keywords: ['bullet', 'list', 'ul', ...kw('block.bullet.kw')],
    icon: List,
    run: (c) => c.toggleBulletList(),
    isActive: (e) => e.isActive('bulletList'),
  },
  {
    id: 'numbered',
    title: t('block.numbered'),
    hint: t('block.numbered.hint'),
    keywords: ['number', 'ordered', 'ol', ...kw('block.numbered.kw')],
    icon: ListOrdered,
    run: (c) => c.toggleOrderedList(),
    isActive: (e) => e.isActive('orderedList'),
  },
  {
    id: 'quote',
    title: t('block.quote'),
    hint: t('block.quote.hint'),
    keywords: ['quote', 'blockquote', ...kw('block.quote.kw')],
    icon: Quote,
    run: (c) => c.toggleBlockquote(),
    isActive: (e) => e.isActive('blockquote'),
  },
  {
    id: 'code',
    title: t('block.code'),
    hint: t('block.code.hint'),
    keywords: ['code', 'snippet', ...kw('block.code.kw')],
    icon: Code2,
    run: (c) => c.toggleCodeBlock(),
    isActive: (e) => e.isActive('codeBlock'),
  },
  {
    id: 'divider',
    title: t('block.divider'),
    hint: t('block.divider.hint'),
    keywords: ['divider', 'hr', 'line', 'separator', ...kw('block.divider.kw')],
    icon: Minus,
    run: (c) => c.setHorizontalRule(),
  },
]

export function filterBlocks(query: string): BlockItem[] {
  const q = query.trim().toLowerCase()
  if (!q) return BLOCKS
  return BLOCKS.filter((b) => b.title.toLowerCase().includes(q) || b.keywords.some((k) => k.includes(q)))
}
