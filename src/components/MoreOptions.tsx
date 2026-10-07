import type { ReactNode } from 'react'

interface Props {
  /** Defaults to "Options". */
  title?: string
  /** What's set right now, shown while the options are closed. */
  summary: string
  children: ReactNode
}

/** Settings people rarely change, folded away under one line that says what they're set to. */
export function MoreOptions({ title = 'Options', summary, children }: Props) {
  return (
    <details className="more-options">
      <summary>
        <span className="more-title">{title}</span>
        <span className="more-summary">{summary}</span>
      </summary>
      <div className="more-body">{children}</div>
    </details>
  )
}

/** "How this works" notes under a table, closed by default. */
export function HowItWorks({ children }: { children: ReactNode }) {
  return (
    <details className="how">
      <summary>How this works</summary>
      <div className="hint">{children}</div>
    </details>
  )
}
