import { useState } from 'react'

interface Props {
  /** Builds the link at click time, so it reflects the current view. */
  getUrl: () => string
}

/** Copies a link to the current view, for pasting into guild chat. */
export function ShareButton({ getUrl }: Props) {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    const url = getUrl()
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard blocked (e.g. not https); let the person copy it by hand.
      window.prompt('Copy this link', url)
    }
  }
  return (
    <button type="button" onClick={copy} title="Copy a link to this view with these filters and server">
      {copied ? 'Link copied' : 'Copy link'}
    </button>
  )
}
