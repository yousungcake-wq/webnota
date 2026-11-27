import { NodeViewWrapper, ReactNodeViewRenderer, type ReactNodeViewProps } from '@tiptap/react'
import { lazy, Suspense } from 'react'
import { FileAttachment } from './nodes/file'

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    fileBlock: {
      /** Inserts a file block; without attrs an empty one that asks for a file (ED-B14). */
      insertFileBlock: (attrs?: { fileId: string; name: string; size: number; mime: string }) => ReturnType
    }
  }
}

const FileView = lazy(() => import('./FileView'))

function FileNodeView(props: ReactNodeViewProps) {
  return (
    <NodeViewWrapper className={`file-block${props.selected ? ' is-selected' : ''}`} data-drag-handle="">
      <Suspense fallback={<div className="file-row is-loading">{props.node.attrs.name as string}</div>}>
        <FileView {...props} />
      </Suspense>
    </NodeViewWrapper>
  )
}

export const FileWithView = FileAttachment.extend({
  addNodeView() {
    return ReactNodeViewRenderer(FileNodeView)
  },
  addCommands() {
    return {
      insertFileBlock:
        (attrs) =>
        ({ commands }) =>
          commands.insertContent({ type: this.name, attrs: attrs ?? {} }),
    }
  },
})
