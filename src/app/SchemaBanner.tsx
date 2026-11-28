import { TriangleAlert } from 'lucide-react'
import { useState } from 'react'
import { t } from '@/core/i18n'
import { schemaStore } from '@/core/schema'
import { useStore } from '@/core/store/useStore'
import { applyUpdate } from '@/platform/sw'
import { Button } from '@/ui'

/** Read-only gate banner (spec/02 §6): data newer than this build, or a failed migration. */
export function SchemaBanner() {
  const { status, readOnly } = useStore(schemaStore)
  const [busy, setBusy] = useState(false)
  if (!readOnly) return null
  return (
    <div className="schema-banner" role="alert">
      <TriangleAlert size={18} aria-hidden />
      <span className="schema-banner-text">{t(status === 'failed' ? 'schema.failed' : 'schema.newer')}</span>
      {status === 'newer' && (
        <Button
          size="sm"
          disabled={busy}
          onClick={() => {
            setBusy(true)
            void applyUpdate()
          }}
        >
          {t('schema.update')}
        </Button>
      )}
    </div>
  )
}
