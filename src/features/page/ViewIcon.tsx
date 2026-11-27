import { FileText } from 'lucide-react'
import { lazy, Suspense } from 'react'
import type { IconValue } from '@/core/model/views'
import { loadNamedIcon } from '@/features/emoji'
import { useImageSrc } from '@/features/files'

const NamedIcon = lazy(loadNamedIcon)

/**
 * Renders a view or space icon (spec/02 IconValue). Emoji and files render directly;
 * named icons (`type: 'icon'`) come from the lazy icon set (features/emoji).
 */
export function ViewIcon({ icon, size = 16 }: { icon: IconValue | null; size?: number }) {
  if (icon?.type === 'emoji') return <>{icon.value}</>
  if (icon?.type === 'file') return <FileIcon value={icon.value} size={size} />
  if (icon?.type === 'icon')
    return (
      <Suspense fallback={<FileText size={size} />}>
        <NamedIcon name={icon.value} color={icon.color} size={size} />
      </Suspense>
    )
  return <FileText size={size} />
}

/** Uploaded icon image (ED-F12): a workspace file id, shown from the file cache. */
function FileIcon({ value, size }: { value: string; size: number }) {
  const src = useImageSrc(value)
  if (!src) return <span className="view-icon-file is-loading" style={{ width: size, height: size }} aria-hidden />
  return (
    <img
      className="view-icon-file"
      src={src}
      alt=""
      width={size}
      height={size}
      style={{ objectFit: 'cover', borderRadius: size >= 32 ? 6 : 3 }}
    />
  )
}

export const emoji = (value: string): IconValue | null => (value ? { type: 'emoji', value } : null)
