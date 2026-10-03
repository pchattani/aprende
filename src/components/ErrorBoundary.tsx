import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props {
  children: ReactNode
}
interface State {
  error?: Error
}

/** Catches render and lazy-import failures so a broken content file shows a message instead of a blank page. */
export class ErrorBoundary extends Component<Props, State> {
  state: State = {}

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(error, info.componentStack)
  }

  render() {
    const { error } = this.state
    if (!error) return this.props.children
    return (
      <div role="alert" className="card m-4 p-5">
        <h1 className="text-xl font-extrabold">Something went wrong</h1>
        <p className="mt-2 text-sm text-muted">
          The app hit an error while loading this screen. Reloading usually fixes it. If it keeps happening, the content files may be invalid.
        </p>
        <pre className="mt-3 max-h-64 overflow-auto rounded-xl bg-surface-2 p-3 text-xs whitespace-pre-wrap">{error.name}: {error.message}</pre>
        <button type="button" className="btn btn-primary mt-4" onClick={() => window.location.reload()}>
          Reload
        </button>
      </div>
    )
  }
}
