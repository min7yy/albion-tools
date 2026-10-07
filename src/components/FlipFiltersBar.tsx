import { ENCHANTMENTS, TIERS } from '../api/items'
import { CATEGORIES, CATEGORY_LABELS, subLabel } from '../crafting/data'
import type { FlipFilters, FlipSortKey } from '../flips/flips'
import { FLIP_MARKETS } from '../flips/markets'

interface Props {
  filters: FlipFilters
  /** Main filters sit in the toolbar; the rest fold away under Options. */
  part: 'main' | 'more'
  onChange: (f: FlipFilters) => void
}

const AGE_OPTIONS: { label: string; value: number | null }[] = [
  { label: '1 hour', value: 1 },
  { label: '6 hours', value: 6 },
  { label: '24 hours', value: 24 },
  { label: 'Any age', value: null },
]
const MARGIN_OPTIONS = [0, 0.05, 0.1, 0.2, 0.5]
const SALES_OPTIONS: { label: string; value: number | null }[] = [
  { label: 'Any', value: null },
  { label: '1+', value: 1 },
  { label: '10+', value: 10 },
  { label: '50+', value: 50 },
  { label: '200+', value: 200 },
]

const numOrAll = (v: string): number | 'all' => (v === 'all' ? 'all' : Number(v))

export function FlipFiltersBar({ filters, onChange, part }: Props) {
  const set = <K extends keyof FlipFilters>(key: K, value: FlipFilters[K]) => onChange({ ...filters, [key]: value })
  const subs = CATEGORIES.find((c) => c.id === filters.category)?.subs ?? []

  const main = (
    <>
      <label>
        Items
        <select
          value={filters.category}
          onChange={(e) => {
            const category = e.target.value
            const first = CATEGORIES.find((c) => c.id === category)?.subs[0] ?? 'all'
            onChange({ ...filters, category, sub: category === 'resources' ? 'all' : first })
          }}
        >
          <option value="resources">Resources</option>
          {CATEGORIES.map((c) => (
            <option key={c.id} value={c.id}>
              {CATEGORY_LABELS[c.id]}
            </option>
          ))}
        </select>
      </label>
      {filters.category !== 'resources' && (
        <label>
          Type
          <select value={filters.sub} onChange={(e) => set('sub', e.target.value)}>
            {subs.map((s) => (
              <option key={s} value={s}>
                {subLabel(s)}
              </option>
            ))}
            <option value="all">All (slower)</option>
          </select>
        </label>
      )}
      <label>
        Tier
        <select value={filters.tier} onChange={(e) => set('tier', numOrAll(e.target.value))}>
          <option value="all">All</option>
          {TIERS.map((t) => (
            <option key={t} value={t}>
              T{t}
            </option>
          ))}
        </select>
      </label>
      <label>
        Buy in
        <select value={filters.buyMarket} onChange={(e) => set('buyMarket', e.target.value)}>
          <option value="all">Anywhere</option>
          {FLIP_MARKETS.filter((m) => m !== 'Black Market').map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
      </label>
      <label>
        Sell in
        <select value={filters.sellMarket} onChange={(e) => set('sellMarket', e.target.value)}>
          <option value="all">Anywhere</option>
          {FLIP_MARKETS.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
      </label>
      <label>
        Sort by
        <select value={filters.sortBy} onChange={(e) => set('sortBy', e.target.value as FlipSortKey)}>
          <option value="profit">Profit per item</option>
          <option value="margin">Margin</option>
          <option value="volume">Sold per day</option>
        </select>
      </label>
    </>
  )
  const more = (
    <>
      <label>
        Enchant
        <select value={filters.enchantment} onChange={(e) => set('enchantment', numOrAll(e.target.value))}>
          <option value="all">All</option>
          {ENCHANTMENTS.map((n) => (
            <option key={n} value={n}>
              .{n}
            </option>
          ))}
        </select>
      </label>
      <label>
        Min margin
        <select value={filters.minMargin} onChange={(e) => set('minMargin', Number(e.target.value))}>
          {MARGIN_OPTIONS.map((m) => (
            <option key={m} value={m}>
              {m === 0 ? 'Any profit' : `${m * 100}%`}
            </option>
          ))}
        </select>
      </label>
      <label>
        Prices newer than
        <select
          value={filters.maxAgeHours ?? 'any'}
          onChange={(e) => set('maxAgeHours', e.target.value === 'any' ? null : Number(e.target.value))}
        >
          {AGE_OPTIONS.map((o) => (
            <option key={o.label} value={o.value ?? 'any'}>
              {o.label}
            </option>
          ))}
        </select>
      </label>
      <label>
        Sold per day
        <select
          value={filters.minDailySales ?? 'any'}
          onChange={(e) => set('minDailySales', e.target.value === 'any' ? null : Number(e.target.value))}
        >
          {SALES_OPTIONS.map((o) => (
            <option key={o.label} value={o.value ?? 'any'}>
              {o.label}
            </option>
          ))}
        </select>
      </label>
      <label className="check">
        <input type="checkbox" checked={filters.bestRouteOnly} onChange={(e) => set('bestRouteOnly', e.target.checked)} />
        Best route per item only
      </label>
    </>
  )
  return <div className="filters">{part === 'main' ? main : more}</div>
}
