import type { ReactNode } from 'react'

export function ViewHeader({ title, right }: { title: string; right?: ReactNode }) {
  return (
    <header className="view-header">
      <h1>{title}</h1>
      {right}
    </header>
  )
}
