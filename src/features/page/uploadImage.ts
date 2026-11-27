import { t } from '@/core/i18n'
import { toast } from '@/ui'

/**
 * Stores a picked image as a workspace file (SY-04) for a cover (ED-F11) or page icon
 * (ED-F12, `maxSide` 256). Returns the file id, or null after telling the user why not.
 * The upload code loads here, on first use.
 */
export async function uploadImage(file: File, opts: { maxSide?: number } = {}): Promise<string | null> {
  const m = await import('@/core/files/ingest')
  if (!file.type.startsWith('image/')) {
    toast(t('files.notImage'), { tone: 'error' })
    return null
  }
  try {
    return (await m.ingestFile(file, file.name, opts)).id
  } catch (e) {
    toast(e instanceof m.FileTooLargeError ? t('files.tooLarge', { max: m.MAX_FILE_MB }) : t('files.error'), {
      tone: 'error',
    })
    return null
  }
}
