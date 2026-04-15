import { Component, type ErrorInfo, type ReactNode } from 'react'

/** Catches render errors so a white screen becomes a visible message + reload. */
export class RootErrorBoundary extends Component<
  { children: ReactNode },
  { error: Error | null }
> {
  state: { error: Error | null } = { error: null }

  static getDerivedStateFromError(error: Error): { error: Error } {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('[ScrumTracker]', error, info.componentStack)
  }

  render(): ReactNode {
    if (this.state.error) {
      return (
        <div className="min-h-svh bg-slate-50 p-6 font-sans text-slate-900 dark:bg-slate-950 dark:text-slate-100">
          <h1 className="text-lg font-bold">Something went wrong</h1>
          <pre className="mt-4 max-w-full overflow-auto rounded border border-slate-200 bg-white p-3 text-xs whitespace-pre-wrap dark:border-slate-700 dark:bg-slate-900">
            {this.state.error.message}
          </pre>
          <button
            type="button"
            className="mt-4 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
            onClick={() => window.location.reload()}
          >
            Reload page
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
