import { craftingKey } from '../crafting/rank'
import type { CraftingResult } from '../crafting/evaluate'
import { formatAge, formatPercent, formatSilver, tierLabel } from '../format'
import { ItemIcon } from './ItemIcon'

interface Props {
  rows: CraftingResult[]
  selectedKey: string | null
  onSelect: (key: string) => void
  limit: number
  showSellCity: boolean
}

export function CraftingTable({ rows, selectedKey, onSelect, limit, showSellCity }: Props) {
  if (!rows.length) return <p className="hint">No rows match these filters.</p>
  return (
    <div className="table-wrap">
      <table className="ranked">
        <thead>
          <tr>
            <th>#</th>
            <th>Item</th>
            <th>Craft in</th>
            {showSellCity && <th>Sell at</th>}
            <th className="num">Cost</th>
            <th className="num">Sells for</th>
            <th className="num">Profit</th>
            <th className="num">Margin</th>
            <th className="num">Prices</th>
          </tr>
        </thead>
        <tbody>
          {rows.slice(0, limit).map((r, i) => {
            const key = craftingKey(r)
            const { tier, ench, name, id } = r.recipe
            return (
              <tr
                key={key}
                className={key === selectedKey ? 'selected' : ''}
                onClick={() => onSelect(key)}
                tabIndex={0}
                onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onSelect(key)}
                aria-selected={key === selectedKey}
              >
                <td className="muted">{i + 1}</td>
                <td className="item">
                  <span className="item-cell">
                    <ItemIcon id={id} size={28} />
                    <span className={`ench e${ench}`}>{tierLabel(tier, ench)}</span> {name}
                  </span>
                </td>
                <td>{r.craftCity}</td>
                {showSellCity && <td>{r.sellCity}</td>}
                <td className="num">{formatSilver(r.totalCost)}</td>
                <td className="num">{formatSilver(r.netRevenue)}</td>
                <td className={`num strong ${r.profit === null ? '' : r.profit >= 0 ? 'pos' : 'neg'}`}>
                  {r.profit === null ? 'missing price' : formatSilver(r.profit)}
                </td>
                <td className="num">{formatPercent(r.margin)}</td>
                <td className="num muted">{formatAge(r.oldestPriceDate)}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
      {rows.length > limit && (
        <p className="hint">
          Showing the top {limit} of {rows.length}. Narrow the filters to see more.
        </p>
      )}
    </div>
  )
}
