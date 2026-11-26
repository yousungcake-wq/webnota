/**
 * Default labels for ui components. `ui` cannot import `core/i18n` (spec/01 §3), so the
 * app passes translated strings in at boot with `configureUi`.
 */
export const uiStrings = { ok: 'OK', cancel: 'Cancel', close: 'Close', dismiss: 'Dismiss' }

export function configureUi(strings: Partial<typeof uiStrings>) {
  Object.assign(uiStrings, strings)
}
