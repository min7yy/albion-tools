import { ROYAL_CITIES } from '../api/cities'
import { RESOURCES, TIERS, ENCHANTMENTS, type ResourceKind } from '../api/items'
import type { RefiningFilters, SortKey } from '../refining/rank'

interface Props {
  filters: RefiningFilters
  /** Main filters sit in the toolbar; the rest fold away under Options. */
  part: 'main' | 'more'
  onChange: (f: RefiningFilters) => void
}

const AGE_OPTIONS: { label: string; value: number | null }[] = [
  { label: '1 hour', value: 1 },
  { label: '6 hours', value: 6 },
  { label: '24 hours', value: 24 },
  { label: '3 days', value: 72 },
  { label: 'Any age', value: null },
]

const SALES_OPTIONS: { label: string; value: number | null }[] = [
  { label: 'Any', value: null },
  { label: '10+', value: 10 },
  { label: '50+', value: 50 },
  { label: '200+', value: 200 },
  { label: '1,000+', value: 1000 },
]

function numOrAll(v: string): number | 'all' {
  return v === 'all' ? 'all' : Number(v)
}

export function FiltersBar({ filters, onChange, part }: Props) {
  const set = <K extends keyof RefiningFilters>(key: K, value: RefiningFilters[K]) =>
    onChange({ ...filters, [key]: value })

  const main = (
    <>
      <label>
        Resource
        <select value={filters.resource} onChange={(e) => set('resource', e.target.value as ResourceKind | 'all')}>
          <option value="all">All</option>
          {Object.entries(RESOURCES).map(([k, r]) => (
            <option key={k} value={k}>
              {r.label}
            </option>
          ))}
        </select>
      </label>
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
        City
        <select value={filters.city} onChange={(e) => set('city', e.target.value)}>
          <option value="all">All</option>
          {ROYAL_CITIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </label>
      <label>
        Sort by
        <select value={filters.sortBy} onChange={(e) => set('sortBy', e.target.value as SortKey)}>
          <option value="profit">Profit per item</option>
          <option value="margin">Margin</option>
          <option value="focus">Silver per focus</option>
          <option value="volume">Sold per day</option>
        </select>
      </label>
    </>
  )
  const more = (
    <>
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
    </>
  )
  return <div className="filters">{part === 'main' ? main : more}</div>
}
