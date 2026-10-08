import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'

/** Touch screens fire mouse events after a tap (and when the page moves under the last tap), so they rely on focus. */
const canHover = () => typeof window === 'undefined' || !window.matchMedia?.('(hover: none)').matches

/**
 * A hover card for its child: shows on hover or keyboard focus, and on tap for touch screens.
 * It's placed in the viewport (fixed), so a card near the edge of a scrolling table isn't clipped.
 */
export function Tooltip({ label, content, children }: { label: string; content: ReactNode; children: ReactNode }) {
  const anchor = useRef<HTMLButtonElement>(null)
  const card = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null)

  useLayoutEffect(() => {
    if (!open || !anchor.current || !card.current) return
    const a = anchor.current.getBoundingClientRect()
    const c = card.current.getBoundingClientRect()
    const margin = 8
    const left = Math.min(Math.max(margin, a.left + a.width / 2 - c.width / 2), window.innerWidth - c.width - margin)
    // Above the icon when there's room, otherwise below it.
    const top = a.top - c.height - 6 >= margin ? a.top - c.height - 6 : a.bottom + 6
    setPos({ left, top })
  }, [open])

  return (
    <span className="tip-anchor">
      <button
        ref={anchor}
        type="button"
        className="tip-button"
        aria-label={label}
        aria-expanded={open}
        onMouseEnter={() => canHover() && setOpen(true)}
        onMouseLeave={() => canHover() && setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onClick={() => setOpen(true)}
      >
        {children}
      </button>
      {open && (
        <div
          ref={card}
          role="tooltip"
          className="tip-card"
          style={pos ? { left: pos.left, top: pos.top } : { visibility: 'hidden', left: 0, top: 0 }}
        >
          {content}
        </div>
      )}
    </span>
  )
}
