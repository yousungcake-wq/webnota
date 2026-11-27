import { NodeViewWrapper, ReactNodeViewRenderer, type ReactNodeViewProps } from '@tiptap/react'
import { lazy, Suspense } from 'react'
import { LinkPreview } from './nodes/linkPreview'

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    linkPreview: {
      /** Inserts a link preview card for `url` (ED-B21); without a url, one that asks for it. */
      insertLinkPreview: (url?: string) => ReturnType
    }
  }
}

const LinkPreviewView = lazy(() => import('./LinkPreviewView'))

function LinkPreviewNodeView(props: ReactNodeViewProps) {
  return (
    <NodeViewWrapper className={`link-preview-block${props.selected ? ' is-selected' : ''}`} data-drag-handle="">
      <Suspense fallback={<div className="link-card is-loading">{props.node.attrs.url as string}</div>}>
        <LinkPreviewView {...props} />
      </Suspense>
    </NodeViewWrapper>
  )
}

export const LinkPreviewWithView = LinkPreview.extend({
  addNodeView() {
    return ReactNodeViewRenderer(LinkPreviewNodeView)
  },
  addCommands() {
    return {
      insertLinkPreview:
        (url) =>
        ({ commands }) =>
          commands.insertContent({ type: this.name, attrs: { url: url ?? null } }),
    }
  },
})
