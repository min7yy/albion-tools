import { Component, type ReactNode } from 'react'

interface Props {
  children: ReactNode
  /** Changing this clears the error, e.g. when switching tabs. */
  resetKey: string
}

interface State {
  error: Error | null
  resetKey: string
}

/** Shows a message and a reload button instead of a blank page when a tab fails. */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null, resetKey: this.props.resetKey }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error }
  }

  static getDerivedStateFromProps(props: Props, state: State): Partial<State> | null {
    return props.resetKey !== state.resetKey ? { error: null, resetKey: props.resetKey } : null
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <div className="panel">
        <p className="error">This tab failed to load: {this.state.error.message}</p>
        <button type="button" onClick={() => window.location.reload()}>
          Reload
        </button>
      </div>
    )
  }
}
