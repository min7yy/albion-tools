import { CRAFTING_CITIES } from './cities'
import { ENCHANTMENTS, TIERS } from '../api/items'
import { CATEGORIES, CATEGORY_LABELS, subLabel } from './data'
import { BLACK_MARKET } from './evaluate'
import { QUALITIES, type CraftingFilters, type SellLocation, type SortKey } from './rank'

interface Props {
  filters: CraftingFilters
  /** Main filters sit in the toolbar; the rest fold away under Options. */
  part: 'main' | 'more'
  onChange: (f: CraftingFilters) => void
}

const AGE_OPTIONS: { label: string; value: number | null }[] = [
  { label: '1 hour', value: 1 },
  { label: '6 hours', value: 6 },
  { label: '24 hours', value: 24 },
  { label: '3 days', value: 72 },
  { label: 'Any age', value: null },
]

const numOrAll = (v: string): number | 'all' => (v === 'all' ? 'all' : Number(v))

export function CraftingFiltersBar({ filters, onChange, part }: Props) {
  const set = <K extends keyof CraftingFilters>(key: K, value: CraftingFilters[K]) =>
    onChange({ ...filters, [key]: value })
  const subs = CATEGORIES.find((c) => c.id === filters.category)?.subs ?? []

  const main = (
    <>
      <label>
        Category
        <select
          value={filters.category}
          onChange={(e) => {
            const category = e.target.value
            const first = CATEGORIES.find((c) => c.id === category)?.subs[0] ?? 'all'
            onChange({ ...filters, category, sub: first })
          }}
        >
          {CATEGORIES.map((c) => (
            <option key={c.id} value={c.id}>
              {CATEGORY_LABELS[c.id]}
            </option>
          ))}
        </select>
      </label>
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
        Sort by
        <select value={filters.sortBy} onChange={(e) => set('sortBy', e.target.value as SortKey)}>
          <option value="profit">Profit per craft</option>
          <option value="margin">Margin</option>
        </select>
      </label>
    </>
  )
  const more = (
    <>
      <label>
        Craft in
        <select value={filters.city} onChange={(e) => set('city', e.target.value)}>
          <option value="all">All cities</option>
          {CRAFTING_CITIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </label>
      <label>
        Sell at
        <select value={filters.sellAt} onChange={(e) => set('sellAt', e.target.value as SellLocation)}>
          <option value="same">Same city</option>
          <option value={BLACK_MARKET}>Black Market</option>
          <option value="Caerleon">Caerleon</option>
        </select>
      </label>
      <label>
        Sell quality
        <select value={filters.quality} onChange={(e) => set('quality', Number(e.target.value))}>
          {QUALITIES.map((q) => (
            <option key={q.value} value={q.value}>
              {q.label}
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
    </>
  )
  return <div className="filters">{part === 'main' ? main : more}</div>
}
