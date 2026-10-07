import { useMemo, useState } from 'react'
import type { ServerId } from '../api/servers'
import { MARKET_CITIES } from '../api/cities'
import { budgetRange, evaluateWeapons, indexQualityPrices, QUALITIES, QUALITY_NAMES, rankForBudget, type WeaponOption } from '../buildguide/value'
import { WEAPONS, weaponItemIds } from '../buildguide/weapons'
import { WEAPON_TYPES, weaponTypeLabel } from '../buildguide/types'
import { SLIDER_STEPS, budgetToSlider, sliderToBudget } from '../buildguide/slider'
import { FIGHT_FILTERS, SORT_MODES, rankWithMeta, weaponMeta, type FightFilter, type SortMode } from '../buildguide/meta'
import { useMeta } from '../useMeta'
import { ItemIcon } from '../components/ItemIcon'
import { usePrices } from '../usePrices'
import { useStoredState, withDefaults } from '../useStoredState'
import { formatAge, formatPercent, formatSilver, tierLabel } from '../format'

interface BuildGuideSettings {
  budget: number
  sub: string
  hands: 'any' | '1h' | '2h'
  cities: string[]
  maxAgeHours: number
  fight: FightFilter
  sort: SortMode
}

const DEFAULTS: BuildGuideSettings = {
  budget: 100_000,
  sub: 'sword',
  hands: 'any',
  cities: [...MARKET_CITIES],
  maxAgeHours: 48,
  fight: 'all',
  sort: 'recommended',
}
const AGE_OPTIONS = [6, 24, 48, 168]

function Version({ o }: { o: WeaponOption }) {
  return (
    <>
      <span className={`ench e${o.ench}`}>
        {tierLabel(o.tier, o.ench)}
      </span>
      {o.quality > 1 && <span className={`quality q${o.quality}`}>{QUALITY_NAMES[o.quality]}</span>}
    </>
  )
}

export default function BuildGuidePage({ server }: { server: ServerId }) {
  const [settings, setSettings] = useStoredState<BuildGuideSettings>(
    'albion-tools.buildguide.settings',
    DEFAULTS,
    withDefaults(DEFAULTS),
  )
  const set = (patch: Partial<BuildGuideSettings>) => setSettings({ ...settings, ...patch })
  const [selected, setSelected] = useState<string | null>(null)

  // Prices are fetched one weapon type at a time: every version and quality of every weapon is a lot of rows.
  const weapons = useMemo(
    () =>
      WEAPONS.filter((w) => w.sub === settings.sub).filter(
        (w) => settings.hands === 'any' || w.twoHanded === (settings.hands === '2h'),
      ),
    [settings.sub, settings.hands],
  )
  const itemIds = useMemo(() => weaponItemIds(weapons), [weapons])
  const { prices, loading, error, fetchedAt, reload } = usePrices(server, itemIds, [...MARKET_CITIES], QUALITIES)

  const values = useMemo(
    () =>
      evaluateWeapons(weapons, indexQualityPrices(prices), {
        cities: settings.cities,
        maxAgeHours: settings.maxAgeHours,
        // Ages are measured from when the prices were loaded; with no prices there is nothing to age.
        now: fetchedAt?.getTime() ?? 0,
      }),
    [weapons, prices, settings.cities, settings.maxAgeHours, fetchedAt],
  )
  const range = useMemo(() => budgetRange(values), [values])
  const { summary, error: metaError } = useMeta(server)
  const meta = useMemo(() => (summary ? weaponMeta(summary, settings.fight) : null), [summary, settings.fight])
  const rows = useMemo(
    () => rankWithMeta(rankForBudget(values, settings.budget), meta, settings.sort),
    [values, settings.budget, meta, settings.sort],
  )
  const detail = rows.find((r) => r.weapon.base === selected) ?? values.find((v) => v.weapon.base === selected)

  const toggleCity = (city: string) =>
    set({
      cities: settings.cities.includes(city) ? settings.cities.filter((c) => c !== city) : [...settings.cities, city],
    })

  return (
    <div className="layout">
      <aside className="settings">
        <fieldset className="panel">
          <legend>Budget</legend>
          <strong className="budget">
            {formatSilver(settings.budget)}
            <small>silver</small>
          </strong>
          {range && (
            <input
              type="range"
              aria-label="Budget"
              min={0}
              max={SLIDER_STEPS}
              value={budgetToSlider(settings.budget, range.min, range.max)}
              onChange={(e) => set({ budget: sliderToBudget(Number(e.target.value), range.min, range.max) })}
            />
          )}
          <label>
            Exact amount
            <input
              type="number"
              min={0}
              step={1000}
              value={settings.budget}
              onChange={(e) => set({ budget: Math.max(0, Number(e.target.value) || 0) })}
            />
          </label>
        </fieldset>

        <fieldset className="panel">
          <legend>Buy in</legend>
          {MARKET_CITIES.map((city) => (
            <label key={city} className="check">
              <input type="checkbox" checked={settings.cities.includes(city)} onChange={() => toggleCity(city)} />
              {city}
            </label>
          ))}
          <label>
            Ignore prices older than
            <select value={settings.maxAgeHours} onChange={(e) => set({ maxAgeHours: Number(e.target.value) })}>
              {AGE_OPTIONS.map((h) => (
                <option key={h} value={h}>
                  {h < 48 ? `${h} hours` : `${h / 24} days`}
                </option>
              ))}
            </select>
          </label>
        </fieldset>
      </aside>

      <main className="panel">
        <div className="toolbar">
          <div className="filters">
            <label>
              Weapon type
              <select value={settings.sub} onChange={(e) => set({ sub: e.target.value })}>
                {WEAPON_TYPES.map((s) => (
                  <option key={s} value={s}>
                    {weaponTypeLabel(s)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Hands
              <select value={settings.hands} onChange={(e) => set({ hands: e.target.value as BuildGuideSettings['hands'] })}>
                <option value="any">Any</option>
                <option value="1h">One-handed</option>
                <option value="2h">Two-handed</option>
              </select>
            </label>
            <label>
              Fight size
              <select value={settings.fight} onChange={(e) => set({ fight: e.target.value as FightFilter })}>
                {FIGHT_FILTERS.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Sort by
              <select value={settings.sort} onChange={(e) => set({ sort: e.target.value as SortMode })}>
                {SORT_MODES.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="refresh">
            <span className="hint">
              {loading ? 'Loading prices…' : fetchedAt ? `Prices loaded ${formatAge(fetchedAt)}` : ''}
            </span>
            <button onClick={reload} disabled={loading}>
              Refresh
            </button>
          </div>
        </div>
        {error && <p className="error">{error}</p>}
        {metaError && <p className="hint">{metaError}. Ranking by item power only.</p>}

        <div className={`results${detail ? ' with-detail' : ''}`}>
          {loading && !prices.length ? (
            <p className="hint">Loading prices for {weapons.length} weapons…</p>
          ) : !rows.length ? (
            <p className="hint">
              {values.length
                ? 'Nothing fits this budget. Move the slider up.'
                : 'No recent prices for these weapons. Try more cities or allow older prices.'}
            </p>
          ) : (
            <div className="table-wrap">
              <table className="ranked">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Weapon</th>
                    <th>Version</th>
                    <th className="num">Item power</th>
                    <th className="num" title="Share of all weapons seen in recent kills for this fight size">Popularity</th>
                    <th className="num" title="Kills as a share of kills plus deaths">Kill share</th>
                    <th className="num">Price</th>
                    <th>City</th>
                    <th className="num">Price age</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr
                      key={r.weapon.base}
                      className={selected === r.weapon.base ? 'selected' : ''}
                      onClick={() => setSelected(selected === r.weapon.base ? null : r.weapon.base)}
                    >
                      <td className="muted">{i + 1}</td>
                      <td className="item">
                        <span className="item-cell">
                          <ItemIcon id={r.best.itemId} size={28} />
                          {r.weapon.name}
                          {r.weapon.twoHanded && <span className="tag-2h">2H</span>}
                        </span>
                      </td>
                      <td>
                        <Version o={r.best} />
                      </td>
                      <td className="num strong">{r.best.itemPower}</td>
                      <td className="num">{r.meta ? formatPercent(r.meta.popularity) : <span className="muted">–</span>}</td>
                      <td className="num muted">{r.meta ? formatPercent(r.meta.killRatio, 0) : '–'}</td>
                      <td className="num">{formatSilver(r.best.price)}</td>
                      <td>{r.best.city}</td>
                      <td className="num muted">{formatAge(r.best.date)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {detail && (
            <aside className="panel detail">
              <div className="detail-head">
                <h2>{detail.weapon.name}</h2>
                <button className="link" onClick={() => setSelected(null)}>
                  Close
                </button>
              </div>
              <p className="hint">
                Versions worth buying: each one adds item power over every cheaper version.
              </p>
              <table className="breakdown">
                <tbody>
                  {detail.frontier.map((o) => (
                    <tr key={`${o.itemId}|${o.quality}`} className={o.price > settings.budget ? 'muted' : ''}>
                      <td>
                        <Version o={o} />
                      </td>
                      <td className="num">{o.itemPower} IP</td>
                      <td className="num">{formatSilver(o.price)}</td>
                      <td className="city">{o.city}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </aside>
          )}
        </div>
        <p className="hint footer">
          Each weapon shows the most item power your budget buys, at any quality, from the cheapest recent sell order in
          the cities you picked. Popularity and kill share come from a sample of recent kills
          {summary ? ` (${summary.events.toLocaleString()} kills since ${summary.from}, updated ${formatAge(new Date(summary.updatedAt))})` : ''}
          . Recommended weighs item power and popularity equally. Group kills credit every attacker, so compare kill share
          within one fight size. Mastery and spec bonuses aren't included, and one-handed weapons also need an off-hand.
        </p>
      </main>
    </div>
  )
}
