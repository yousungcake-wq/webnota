import { Extension, type Editor } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'
import { t } from '@/core/i18n'
import { toast } from '@/ui'

/**
 * Files into the document (ED-F06, SY-04): pasted or dropped images become image blocks.
 * While a file is processed and stored, a placeholder widget marks where it goes; the
 * placeholder moves with edits around it, and the block is inserted where it ends up.
 * The upload code (`core/files/ingest.ts`) loads on the first file.
 */
const uploadKey = new PluginKey<DecorationSet>('fileUploads')
type Meta = { add: { id: string; pos: number; name: string } } | { remove: string }

const loadIngest = () => import('@/core/files/ingest')

function findPlaceholder(editor: Editor, id: string): number | null {
  const set = uploadKey.getState(editor.state)
  const found = set?.find(undefined, undefined, (spec: { id?: string }) => spec.id === id)
  return found?.length ? found[0]!.from : null
}

function placeholder(name: string) {
  const el = document.createElement('div')
  el.className = 'upload-placeholder'
  el.setAttribute('contenteditable', 'false')
  el.setAttribute('role', 'status')
  el.textContent = t('upload.processing', { name })
  return el
}

let seq = 0

/** Stores `files` and inserts an image block for each at `pos` (default: the selection). */
export function insertFiles(editor: Editor, files: File[], pos = editor.state.selection.from) {
  for (const file of files) {
    const id = `u${++seq}`
    editor.view.dispatch(editor.state.tr.setMeta(uploadKey, { add: { id, pos, name: file.name } } satisfies Meta))
    void loadIngest()
      .then(async (m) => {
        try {
          return await m.ingestFile(file)
        } catch (e) {
          toast(e instanceof m.FileTooLargeError ? t('files.tooLarge', { max: m.MAX_FILE_MB }) : t('files.error'), {
            tone: 'error',
          })
          return null
        }
      })
      .then((ref) => {
        if (editor.isDestroyed) return
        const at = findPlaceholder(editor, id)
        editor.view.dispatch(editor.state.tr.setMeta(uploadKey, { remove: id } satisfies Meta))
        if (!ref || at === null || !editor.isEditable) return
        editor
          .chain()
          .insertContentAt(at, {
            type: 'image',
            attrs: { src: ref.id, naturalWidth: ref.width ?? null, naturalHeight: ref.height ?? null },
          })
          .run()
      })
  }
}

const imagesOf = (list: FileList | null | undefined) => [...(list ?? [])].filter((f) => f.type.startsWith('image/'))

export const FileDrop = Extension.create({
  name: 'fileDrop',
  addProseMirrorPlugins() {
    const editor = this.editor
    return [
      new Plugin<DecorationSet>({
        key: uploadKey,
        state: {
          init: () => DecorationSet.empty,
          apply: (tr, set) => {
            set = set.map(tr.mapping, tr.doc)
            const meta = tr.getMeta(uploadKey) as Meta | undefined
            if (meta && 'add' in meta) {
              const pos = Math.min(meta.add.pos, tr.doc.content.size)
              const deco = Decoration.widget(pos, () => placeholder(meta.add.name), { id: meta.add.id, side: -1 })
              set = set.add(tr.doc, [deco])
            } else if (meta) {
              set = set.remove(set.find(undefined, undefined, (spec: { id?: string }) => spec.id === meta.remove))
            }
            return set
          },
        },
        props: {
          decorations: (state) => uploadKey.getState(state),
          handlePaste: (_view, event) => {
            if (!editor.isEditable) return false
            const files = imagesOf(event.clipboardData?.files)
            // an image copied from a web page also carries text/html; a file is still better
            if (!files.length || event.clipboardData?.getData('text/plain')) return false
            insertFiles(editor, files)
            return true
          },
          handleDrop: (view, event) => {
            if (!editor.isEditable) return false
            const files = imagesOf(event.dataTransfer?.files)
            if (!files.length) return false
            const at = view.posAtCoords({ left: event.clientX, top: event.clientY })?.pos
            event.preventDefault()
            insertFiles(editor, files, at ?? editor.state.selection.from)
            return true
          },
        },
      }),
    ]
  },
})
