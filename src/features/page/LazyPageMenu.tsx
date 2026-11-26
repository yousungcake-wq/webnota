import { lazy, Suspense, type ComponentProps } from 'react'

const Impl = lazy(() => import('./PageMenu').then((m) => ({ default: m.PageMenu })))

/** The "more" menu, loaded on first open (spec/10: keep the initial bundle small). */
export function PageMenu(props: ComponentProps<typeof Impl>) {
  return (
    <Suspense fallback={null}>
      <Impl {...props} />
    </Suspense>
  )
}
