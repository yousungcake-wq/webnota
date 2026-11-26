import { AlertTriangle } from 'lucide-react'
import { Component, type ErrorInfo, type ReactNode } from 'react'
import { Button } from './Button'
import { EmptyState } from './controls'
import { uiStrings } from './strings'

interface Props {
  /** Shown in the fallback's title area, e.g. which part failed. */
  title?: string
  /** Compact fallback for small regions (sidebar). */
  compact?: boolean
  onError?: (error: unknown, info: ErrorInfo) => void
  children: ReactNode
}

/**
 * Screen-level error boundary (spec/01 §7): a crash in one region (e.g. the editor)
 * shows a retry message there while the rest of the app keeps working. Data lives in
 * Yjs/IndexedDB, so retrying re-renders from the same document.
 * Give it a `key` that changes with the content (route, page id) to reset on navigation.
 */
export class ErrorBoundary extends Component<Props, { error: unknown }> {
  state = { error: null as unknown }

  static getDerivedStateFromError(error: unknown) {
    return { error }
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    console.error('[webnota] screen crashed', error, info.componentStack)
    this.props.onError?.(error, info)
  }

  render() {
    const { error } = this.state
    if (error == null) return this.props.children
    const message = error instanceof Error ? error.message : String(error)
    const retry = (
      <Button size={this.props.compact ? 'sm' : 'md'} onClick={() => this.setState({ error: null })}>
        {uiStrings.retry}
      </Button>
    )
    return (
      <div className={`error-boundary${this.props.compact ? ' compact' : ''}`} role="alert">
        <EmptyState
          icon={this.props.compact ? undefined : AlertTriangle}
          title={this.props.title ?? uiStrings.errorTitle}
          description={message}
          action={retry}
        />
      </div>
    )
  }
}
