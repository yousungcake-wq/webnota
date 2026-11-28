/**
 * A CSV picked for a database that was just created for it (M6-06): the new database view
 * opens, finds its file here and shows the import preview. Taking it clears it.
 */
let pending: { viewId: string; file: File } | null = null

export const setPendingCsv = (viewId: string, file: File) => {
  pending = { viewId, file }
}

export function takePendingCsv(viewId: string): File | null {
  if (pending?.viewId !== viewId) return null
  const f = pending.file
  pending = null
  return f
}
