import { NodeViewWrapper, ReactNodeViewRenderer, type ReactNodeViewProps } from '@tiptap/react'
import { lazy, Suspense } from 'react'
import { Embed, Video } from './nodes/video'

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    media: {
      /** Inserts a video block (ED-B13); without `src` an empty one that asks for a link. */
      insertVideo: (src?: string) => ReturnType
      /** Inserts an embed block (ED-B22); without `src` an empty one that asks for a link. */
      insertEmbed: (src?: string) => ReturnType
    }
  }
}

// Players and iframes (and their toolbar) load with the first video/embed block.
const EmbedView = lazy(() => import('./EmbedView'))

function MediaNodeView(props: ReactNodeViewProps) {
  const kind = props.node.type.name
  return (
    <NodeViewWrapper className={`${kind}-block media-block${props.selected ? ' is-selected' : ''}`} data-drag-handle="">
      <Suspense fallback={<div className="media-frame is-loading" />}>
        <EmbedView {...props} />
      </Suspense>
    </NodeViewWrapper>
  )
}

export const VideoWithView = Video.extend({
  addNodeView() {
    return ReactNodeViewRenderer(MediaNodeView)
  },
  addCommands() {
    return {
      insertVideo:
        (src) =>
        ({ commands }) =>
          commands.insertContent({ type: 'video', attrs: { src: src ?? null } }),
      insertEmbed:
        (src) =>
        ({ commands }) =>
          commands.insertContent({ type: 'embed', attrs: { src: src ?? null } }),
    }
  },
})

export const EmbedWithView = Embed.extend({
  addNodeView() {
    return ReactNodeViewRenderer(MediaNodeView)
  },
})
