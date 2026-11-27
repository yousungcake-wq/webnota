import { t } from '@/core/i18n'
import { toast } from '@/ui'
import { fileStatusKey } from './useFile'

/** Downloads a workspace file (SY-04); explains when it is not available here. */
export async function downloadFile(id: string, name: string) {
  const { saveFile } = await import('@/core/files/cache')
  const status = await saveFile(id, name)
  if (status !== 'ready') toast(t(fileStatusKey(status)), { tone: 'error' })
}

/** Whether a file still waits for upload (shown on file blocks until the next sync). */
export async function isFilePending(id: string) {
  const { isPending } = await import('@/core/files/ingest')
  return isPending(id).catch(() => false)
}
