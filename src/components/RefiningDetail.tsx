import { useEffect, useRef } from 'react'
import { itemName } from '../api/items'
import type { RefiningResult } from '../refining/profit'
import type { RefiningSettings } from '../refining/settings'
import { formatAge, formatPercent, formatSilver } from '../format'

interface Props {
  result: RefiningResult
  settings: RefiningSettings
  onClose: () => void
}

export function RefiningDetail({ result: r, settings, onClose }: Props) {
  const buyHow = settings.buyMode === 'instant' ? 'instant buy' : 'buy order'
  const sellHow = settings.sellMode === 'instant' ? 'instant sell' : 'sell order'
  const outputPrice = r.sellPrice
  const ref = useRef<HTMLElement>(null)
  const output = r.recipe.output
  const city = r.refineCity

  // On narrow screens the breakdown sits above the table, so bring it into view.
  useEffect(() => {
    if (window.matchMedia('(max-width: 960px)').matches) {
      ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [output, city])

  return (
    <aside className="panel detail" aria-label="Cost breakdown" ref={ref}>
      <div className="detail-head">
        <h2>{itemName(r.recipe.output)}</h2>
        <button type="button" className="link" onClick={onClose} aria-label="Close breakdown">
          Close
        </button>
      </div>
      <p className="hint">
        Buy, refine and sell in {r.refineCity}. Return rate {formatPercent(r.returnRate)}
        {settings.returnRateOverride !== null ? ' (your override)' : settings.useFocus ? ' with focus' : ''}.
      </p>

      <h3>Materials ({buyHow})</h3>
      <table className="breakdown">
        <tbody>
          {r.ingredients.map((i) => (
            <tr key={i.itemId}>
              <td>
                {i.count} × {itemName(i.itemId)}
              </td>
              <td className="num muted">{i.unitPrice === null ? 'no price' : `@ ${formatSilver(i.unitPrice)}`}</td>
              <td className="num">{formatSilver(i.total)}</td>
            </tr>
          ))}
          <tr>
            <td colSpan={2}>Returned resources</td>
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

      <h3>Sale ({sellHow})</h3>
      <table className="breakdown">
        <tbody>
          <tr>
            <td colSpan={2}>Price</td>
            <td className="num">{outputPrice === null ? 'no price' : formatSilver(outputPrice)}</td>
          </tr>
          <tr>
            <td colSpan={2}>Tax{settings.sellMode === 'order' ? ' and setup fee' : ''}</td>
            <td className="num neg">−{formatSilver(r.sellFees)}</td>
          </tr>
          <tr className="total">
            <td colSpan={2}>You receive</td>
            <td className="num">{formatSilver(r.netRevenue)}</td>
          </tr>
        </tbody>
      </table>

      <div className="profit-line">
        <span>Profit per item</span>
        <strong className={r.profit === null ? '' : r.profit >= 0 ? 'pos' : 'neg'}>
          {formatSilver(r.profit)} <small>({formatPercent(r.margin)})</small>
        </strong>
      </div>
      {r.missing.length > 0 && (
        <p className="error">Missing prices: {r.missing.map(itemName).join(', ')}</p>
      )}
      <p className="hint">Oldest price used: {formatAge(r.oldestPriceDate)}.</p>
    </aside>
  )
}
