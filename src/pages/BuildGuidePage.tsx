import { useMemo, useState } from 'react'
import type { ServerId } from '../api/servers'
import { MARKET_CITIES } from '../api/cities'
import { budgetRange, evaluateWeapons, indexQualityPrices, QUALITIES, QUALITY_NAMES, rankForBudget, type WeaponOption } from '../buildguide/value'
import { WEAPONS, weaponItemIds, type Weapon } from '../buildguide/weapons'
import { WEAPON_TYPES, weaponTypeLabel } from '../buildguide/types'
import { SLIDER_STEPS, budgetToSlider, sliderToBudget } from '../buildguide/slider'
import { FIGHT_FILTERS, SORT_MODES, rankWithMeta, weaponMeta, type FightFilter, type SortMode } from '../buildguide/meta'
import { useMeta } from '../useMeta'
import { GEAR, SLOT_LABELS, gearItemIds, type Gear } from '../buildguide/gear'
import { bestSet, cheapestSet, dearestSet, setPieces, usualGear, type SetChoice } from '../buildguide/sets'
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
  /** Spend the budget on the weapon alone or on a full set built around it. */
  mode: 'weapon' | 'set'
}

const DEFAULTS: BuildGuideSettings = {
  budget: 100_000,
  sub: 'sword',
  hands: 'any',
  cities: [...MARKET_CITIES],
  maxAgeHours: 48,
  fight: 'all',
  sort: 'recommended',
  mode: 'weapon',
}
const AGE_OPTIONS = [6, 24, 48, 168]

interface Row {
  weapon: Weapon
  itemPower: number
  price: number
  /** The weapon version bought. */
  best: WeaponOption
  /** Weapon mode: every version worth buying. */
  frontier?: WeaponOption[]
  /** Set mode: the version bought for each slot. */
  set?: SetChoice
}

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
  const { summary, error: metaError } = useMeta(server)
  const meta = useMemo(() => (summary ? weaponMeta(summary, settings.fight) : null), [summary, settings.fight])
  const setMode = settings.mode === 'set' && summary !== null

  // In set mode each weapon is paired with the gear most often seen with it in recent kills.
  const gearFor = useMemo(() => {
    const map = new Map<string, Gear[]>()
    if (setMode && summary) for (const w of weapons) map.set(w.base, usualGear(w, summary))
    return map
  }, [setMode, weapons, summary])
  const itemIds = useMemo(() => {
    const gear = new Map<string, Gear>()
    for (const list of gearFor.values()) for (const g of list) gear.set(g.base, g)
    return [...weaponItemIds(weapons), ...gearItemIds([...gear.values()])]
  }, [weapons, gearFor])
  const { prices, loading, error, fetchedAt, reload } = usePrices(server, itemIds, [...MARKET_CITIES], QUALITIES)

  const offerSettings = useMemo(
    () => ({
      cities: settings.cities,
      maxAgeHours: settings.maxAgeHours,
      // Ages are measured from when the prices were loaded; with no prices there is nothing to age.
      now: fetchedAt?.getTime() ?? 0,
    }),
    [settings.cities, settings.maxAgeHours, fetchedAt],
  )
  const lookup = useMemo(() => indexQualityPrices(prices), [prices])
  const values = useMemo(() => evaluateWeapons(weapons, lookup, offerSettings), [weapons, lookup, offerSettings])
  const sets = useMemo(
    () =>
      setMode
        ? values.map((v) => ({ weapon: v.weapon, pieces: setPieces(v.weapon, gearFor.get(v.weapon.base) ?? [], lookup, offerSettings) }))
        : [],
    [setMode, values, gearFor, lookup, offerSettings],
  )

  const range = useMemo(() => {
    if (!setMode) return budgetRange(values)
    if (!sets.length) return null
    return {
      min: Math.min(...sets.map((s) => cheapestSet(s.pieces))),
      max: Math.max(...sets.map((s) => dearestSet(s.pieces))),
    }
  }, [setMode, values, sets])

  const rows = useMemo(() => {
    const list: Row[] = setMode
      ? sets.flatMap(({ weapon, pieces }) => {
          const choice = bestSet(weapon, pieces, settings.budget)
          return choice ? [{ weapon, itemPower: choice.itemPower, price: choice.price, best: choice.picks[0].option, set: choice }] : []
        })
      : rankForBudget(values, settings.budget).map((r) => ({
          weapon: r.weapon,
          itemPower: r.best.itemPower,
          price: r.best.price,
          best: r.best,
          frontier: r.frontier,
        }))
    return rankWithMeta(list, meta, settings.sort)
  }, [setMode, sets, values, settings.budget, meta, settings.sort])
  const detail = rows.find((r) => r.weapon.base === selected)

  const toggleCity = (city: string) =>
    set({
      cities: settings.cities.includes(city) ? settings.cities.filter((c) => c !== city) : [...settings.cities, city],
    })

  return (
    <div className="layout">
      <aside className="settings">
        <fieldset className="panel">
          <legend>Budget</legend>
          <div className="segmented" role="radiogroup" aria-label="Spend on">
            {(['weapon', 'set'] as const).map((m) => (
              <button key={m} role="radio" aria-checked={settings.mode === m} className={settings.mode === m ? 'active' : ''} onClick={() => set({ mode: m })}>
                {m === 'weapon' ? 'Weapon only' : 'Full set'}
              </button>
            ))}
          </div>
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
        {metaError && (
          <p className="hint">
            {metaError}. Ranking by item power only{settings.mode === 'set' ? ', and full sets need kill data, so showing weapons only' : ''}.
          </p>
        )}

        <div className={`results${detail ? ' with-detail' : ''}`}>
          {loading && !prices.length ? (
            <p className="hint">Loading prices for {weapons.length} weapons…</p>
          ) : !rows.length ? (
            <p className="hint">
              {values.length
                ? `Nothing fits this budget. Move the slider up${setMode ? ' or switch to weapon only' : ''}.`
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
                    <th className="num">{setMode ? 'Average IP' : 'Item power'}</th>
                    <th className="num" title="Share of all weapons seen in recent kills for this fight size">Popularity</th>
                    <th className="num" title="Kills as a share of kills plus deaths">Kill share</th>
                    <th className="num">{setMode ? 'Set price' : 'Price'}</th>
                    {!setMode && <th>City</th>}
                    {!setMode && <th className="num">Price age</th>}
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
                      <td className="num strong">{r.itemPower}</td>
                      <td className="num">{r.meta ? formatPercent(r.meta.popularity) : <span className="muted">–</span>}</td>
                      <td className="num muted">{r.meta ? formatPercent(r.meta.killRatio, 0) : '–'}</td>
                      <td className="num">
                        {formatSilver(r.price)}
                        {r.set?.missing.length ? (
                          <span className="tag-2h" title={`No recent price for: ${r.set.missing.map((m) => SLOT_LABELS[m]).join(', ')}`}>
                            −{r.set.missing.length}
                          </span>
                        ) : null}
                      </td>
                      {!setMode && <td>{r.best.city}</td>}
                      {!setMode && <td className="num muted">{formatAge(r.best.date)}</td>}
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
              {detail.set ? (
                <>
                  <p className="hint">
                    {formatSilver(detail.price)} silver for {detail.itemPower} average item power, using the gear most often
                    seen with this weapon.
                  </p>
                  <table className="breakdown set">
                    <tbody>
                      {detail.set.picks.map(({ piece, option }) => (
                        <tr key={piece.slot}>
                          <td>
                            <span className="slot">{SLOT_LABELS[piece.slot]}</span>
                            <span className="item-cell">
                              <ItemIcon id={option.itemId} size={24} />
                              {piece.slot === 'MainHand' ? detail.weapon.name : (GEAR.get(piece.base)?.name ?? piece.name)}
                            </span>
                          </td>
                          <td>
                            <Version o={option} />
                          </td>
                          <td className="num">{formatSilver(option.price)}</td>
                          <td className="city">{option.city}</td>
                        </tr>
                      ))}
                      {detail.set.missing.map((slot) => (
                        <tr key={slot} className="muted">
                          <td>
                            <span className="slot">{SLOT_LABELS[slot]}</span>
                            No recent price
                          </td>
                          <td />
                          <td />
                          <td />
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </>
              ) : (
                <>
                  <p className="hint">Versions worth buying: each one adds item power over every cheaper version.</p>
                  <table className="breakdown">
                    <tbody>
                      {detail.frontier?.map((o) => (
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
                </>
              )}
            </aside>
          )}
        </div>
        <p className="hint footer">
          Each weapon shows the most item power your budget buys, at any quality, from the cheapest recent sell order in
          the cities you picked. Popularity and kill share come from a sample of recent kills
          {summary ? ` (${summary.events.toLocaleString()} kills since ${summary.from}, updated ${formatAge(new Date(summary.updatedAt))})` : ''}
          . Recommended weighs item power and popularity equally. Group kills credit every attacker, so compare kill share
          within one fight size. Full sets spend the budget across weapon, off-hand, helmet, armour, shoes and cape, picking
          the upgrade that adds the most average item power per silver each time; a two-handed weapon counts twice, as in
          game. Mastery and spec bonuses aren't included.
        </p>
      </main>
    </div>
  )
}
