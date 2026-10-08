import { useEffect, useRef, type ReactNode } from 'react'
import type { ProfitResult, TradeMode } from '../lib/profit'
import { formatAge, formatPercent, formatSilver } from '../lib/format'

interface Props {
  result: ProfitResult
  title: string
  subtitle: ReactNode
  buyMode: TradeMode
  sellMode: TradeMode
  /** Readable name for an ingredient or output id. */
  nameOf: (id: string) => string
  onClose: () => void
}

/** Cost breakdown panel shared by the refining and crafting pages. */
export function ProfitBreakdown({ result: r, title, subtitle, buyMode, sellMode, nameOf, onClose }: Props) {
  const ref = useRef<HTMLElement>(null)

  // On narrow screens the breakdown sits above the table, so bring it into view.
  useEffect(() => {
    if (window.matchMedia('(max-width: 960px)').matches) {
      ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [title, subtitle])

  return (
    <aside className="panel detail" aria-label="Cost breakdown" ref={ref}>
      <div className="detail-head">
        <h2>{title}</h2>
        <button type="button" className="link" onClick={onClose} aria-label="Close breakdown">
          Close
        </button>
      </div>
      <p className="hint">{subtitle}</p>

      <h3>Materials ({buyMode === 'instant' ? 'instant buy' : 'buy order'})</h3>
      <table className="breakdown">
        <tbody>
          {r.ingredients.map((i) => (
            <tr key={i.itemId}>
              <td>
                {i.count} × {nameOf(i.itemId)}
                {i.noReturn && <span className="muted"> (not returned)</span>}
              </td>
              <td className="num muted">{i.unitPrice === null ? 'no price' : `@ ${formatSilver(i.unitPrice)}`}</td>
              <td className="num">{formatSilver(i.total)}</td>
            </tr>
          ))}
          <tr>
            <td colSpan={2}>Returned resources ({formatPercent(r.returnRate)})</td>
            <td className="num pos">{r.returnedValue === null ? '–' : `−${formatSilver(r.returnedValue)}`}</td>
          </tr>
          {r.buyFee > 0 && (
            <tr>
              <td colSpan={2}>Buy order setup fee (2.5%)</td>
              <td className="num">{formatSilver(r.buyFee)}</td>
            </tr>
          )}
          <tr>
            <td colSpan={2}>Station fee</td>
            <td className="num">{formatSilver(r.stationFee)}</td>
          </tr>
          <tr className="total">
            <td colSpan={2}>Total cost</td>
            <td className="num">{formatSilver(r.totalCost)}</td>
          </tr>
        </tbody>
      </table>

      <h3>
        Sale in {r.sellCity} ({sellMode === 'instant' ? 'instant sell' : 'sell order'})
      </h3>
      <table className="breakdown">
        <tbody>
          <tr>
            <td colSpan={2}>Price{r.amount > 1 ? ` × ${r.amount}` : ''}</td>
            <td className="num">{r.sellPrice === null ? 'no price' : formatSilver(r.sellPrice * r.amount)}</td>
          </tr>
          <tr>
            <td colSpan={2}>Tax{sellMode === 'order' ? ' and setup fee' : ''}</td>
            <td className="num neg">−{formatSilver(r.sellFees)}</td>
          </tr>
          <tr className="total">
            <td colSpan={2}>You receive</td>
            <td className="num">{formatSilver(r.netRevenue)}</td>
          </tr>
        </tbody>
      </table>

      <div className="profit-line">
        <span>Profit{r.amount > 1 ? ' per craft' : ' per item'}</span>
        <strong className={r.profit === null ? '' : r.profit >= 0 ? 'pos' : 'neg'}>
          {formatSilver(r.profit)} <small>({formatPercent(r.margin)})</small>
        </strong>
      </div>
      {r.missing.length > 0 && <p className="error">Missing prices: {r.missing.map(nameOf).join(', ')}</p>}
      <p className="hint">Oldest price used: {formatAge(r.oldestPriceDate)}.</p>
    </aside>
  )
}
