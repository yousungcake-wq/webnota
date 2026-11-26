/**
 * Write guard for `core/model` mutations. `core/schema` installs it so that a
 * read-only app (data newer than this build, spec/02 §6) cannot change anything;
 * the model itself stays free of schema/store imports (spec/01 §3).
 */
export class ReadOnlyError extends Error {
  constructor() {
    super('webnota: read-only (schema)')
    this.name = 'ReadOnlyError'
  }
}

let canWrite: () => boolean = () => true

export function setWriteGuard(fn: () => boolean) {
  canWrite = fn
}

export function assertWritable() {
  if (!canWrite()) throw new ReadOnlyError()
}
