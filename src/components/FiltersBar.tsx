import { ROYAL_CITIES } from '../api/cities'
import { RESOURCES, TIERS, ENCHANTMENTS, type ResourceKind } from '../api/items'
import type { RefiningFilters, SortKey } from '../refining/rank'

interface Props {
  filters: RefiningFilters
  onChange: (f: RefiningFilters) => void
}

const AGE_OPTIONS: { label: string; value: number | null }[] = [
  { label: '1 hour', value: 1 },
  { label: '6 hours', value: 6 },
  { label: '24 hours', value: 24 },
  { label: '3 days', value: 72 },
  { label: 'Any age', value: null },
]

function numOrAll(v: string): number | 'all' {
  return v === 'all' ? 'all' : Number(v)
}

export function FiltersBar({ filters, onChange }: Props) {
  const set = <K extends keyof RefiningFilters>(key: K, value: RefiningFilters[K]) =>
    onChange({ ...filters, [key]: value })

  return (
    <div className="filters">
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
        Sort by
        <select value={filters.sortBy} onChange={(e) => set('sortBy', e.target.value as SortKey)}>
          <option value="profit">Profit per item</option>
          <option value="margin">Margin</option>
        </select>
      </label>
      <label className="check">
        <input
          type="checkbox"
          checked={filters.hideIncomplete}
          onChange={(e) => set('hideIncomplete', e.target.checked)}
        />
        Hide rows with missing prices
      </label>
    </div>
  )
}
