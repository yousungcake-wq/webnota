import { NodeViewWrapper, ReactNodeViewRenderer, type ReactNodeViewProps } from '@tiptap/react'
import { lazy, Suspense } from 'react'
import { Image } from './nodes/image'

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    image: {
      /** Inserts an image block; without attrs an empty one that asks for a file or link (ED-B12). */
      insertImage: (attrs?: { src?: string; naturalWidth?: number; naturalHeight?: number }) => ReturnType
    }
  }
}

// The image UI (upload, resize, toolbar, caption) loads with the first image block.
const ImageView = lazy(() => import('./ImageView'))

/** Box with the image's aspect ratio, so nothing jumps while the view or the bytes load. */
export function imageBoxStyle(attrs: Record<string, unknown>) {
  const w = attrs.naturalWidth as number | null
  const h = attrs.naturalHeight as number | null
  const width = attrs.width as number | null
  return {
    width: width ? `${width}%` : w ? `min(100%, ${w}px)` : '100%',
    aspectRatio: w && h ? `${w} / ${h}` : undefined,
  }
}

function ImageNodeView(props: ReactNodeViewProps) {
  const align = props.node.attrs.align as string
  return (
    <NodeViewWrapper
      className={`image-block${props.selected ? ' is-selected' : ''}`}
      data-align={align}
      data-drag-handle=""
    >
      <Suspense
        fallback={
          props.node.attrs.src ? (
            <div className="image-frame is-loading" style={imageBoxStyle(props.node.attrs)} />
          ) : null
        }
      >
        <ImageView {...props} />
      </Suspense>
    </NodeViewWrapper>
  )
}

/** Image block with its UI (the schema-only `Image` stays usable without React). */
export const ImageWithView = Image.extend({
  addNodeView() {
    return ReactNodeViewRenderer(ImageNodeView)
  },
  addCommands() {
    return {
      insertImage:
        (attrs = {}) =>
        ({ commands }) =>
          commands.insertContent({ type: this.name, attrs }),
    }
  },
})
