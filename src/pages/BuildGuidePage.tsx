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
import { cheapestSet, dearestSet, homeAndBest, planSets, usualGear, type SetChoice } from '../buildguide/sets'
import { specBonus } from '../buildguide/power'
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
  /** Item power from weapon spec; higher tiers multiply it (the mastery modifier). */
  specItemPower: number
  /** Full sets are bought here, with a pointer to a better city when the trip is worth it. '' for none. */
  homeCity: string
}

const DEFAULTS: BuildGuideSettings = {
  budget: 100_000,
  sub: 'sword',
  hands: 'any',
  cities: [...MARKET_CITIES],
  maxAgeHours: 48,
  fight: 'all',
  sort: 'recommended',
  mode: 'set',
  specItemPower: 100,
  homeCity: '',
}
const AGE_OPTIONS = [6, 24, 48, 168]

interface Row {
  weapon: Weapon
  itemPower: number
  strength?: number
  price: number
  /** The weapon version bought. */
  best: WeaponOption
  /** Weapon mode: every version worth buying. */
  frontier?: WeaponOption[]
  /** Set mode: the version bought for each slot. */
  set?: SetChoice
  /** A notably stronger set for the same budget in another city than home. */
  elsewhere?: SetChoice | null
}

const formatStrength = (s: number) => `${s >= 1 ? '+' : '−'}${Math.round(Math.abs(s - 1) * 100)}%`

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
    // v2: full sets became the default, so older saved settings start fresh.
    'albion-tools.buildguide.settings.v2',
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
    const map = new Map<string, Gear[][]>()
    if (setMode && summary) for (const w of weapons) map.set(w.base, usualGear(w, summary))
    return map
  }, [setMode, weapons, summary])
  const itemIds = useMemo(() => {
    const gear = new Map<string, Gear>()
    for (const slots of gearFor.values()) for (const g of slots.flat()) gear.set(g.base, g)
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
  const spec = settings.specItemPower
  const values = useMemo(
    () => evaluateWeapons(weapons, lookup, offerSettings, (tier) => specBonus(tier, spec)),
    [weapons, lookup, offerSettings, spec],
  )
  // Each set is priced one city at a time: every piece comes from the same market.
  const home = settings.homeCity || null
  const plans = useMemo(() => {
    if (!setMode) return []
    // Home is always priced, even when it isn't ticked.
    const cities = home && !offerSettings.cities.includes(home) ? [...offerSettings.cities, home] : offerSettings.cities
    return values.map((v) => planSets(v.weapon, gearFor.get(v.weapon.base) ?? [], lookup, { ...offerSettings, cities }, spec))
  }, [setMode, values, gearFor, lookup, offerSettings, spec, home])

  const range = useMemo(() => {
    if (!setMode) return budgetRange(values)
    const mins = plans.map(cheapestSet).filter((p) => p !== null)
    const maxes = plans.map(dearestSet).filter((p) => p !== null)
    return mins.length ? { min: Math.min(...mins), max: Math.max(...maxes) } : null
  }, [setMode, values, plans])

  const rows = useMemo(() => {
    const list: Row[] = setMode
      ? plans.flatMap((cityPlans) => {
          const found = homeAndBest(cityPlans, settings.budget, home)
          if (!found) return []
          const { choice, elsewhere } = found
          return [
            {
              weapon: cityPlans[0].weapon,
              itemPower: choice.itemPower,
              strength: choice.strength,
              price: choice.price,
              best: choice.picks[0].option,
              set: choice,
              elsewhere,
            },
          ]
        })
      : rankForBudget(values, settings.budget).map((r) => ({
          weapon: r.weapon,
          itemPower: r.best.itemPower,
          price: r.best.price,
          best: r.best,
          frontier: r.frontier,
        }))
    return rankWithMeta(list, meta, settings.sort)
  }, [setMode, plans, values, settings.budget, meta, settings.sort, home])
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
          <legend>Your spec</legend>
          <label>
            Weapon spec item power
            <input
              type="number"
              min={0}
              max={400}
              step={10}
              value={settings.specItemPower}
              onChange={(e) => set({ specItemPower: Math.max(0, Number(e.target.value) || 0) })}
            />
          </label>
          <p className="hint">
            The item power your weapon spec adds (shown in game on the weapon's tooltip). Higher tiers add 5% of it per tier
            above T4, so with spec a T8.0 beats a T4.4.
          </p>
        </fieldset>

        <fieldset className="panel">
          <legend>{settings.mode === 'set' ? 'Cities to compare' : 'Buy in'}</legend>
          {settings.mode === 'set' && (
            <label>
              Home city
              <select value={settings.homeCity} onChange={(e) => set({ homeCity: e.target.value })}>
                <option value="">None, use the best city</option>
                {MARKET_CITIES.map((city) => (
                  <option key={city} value={city}>
                    {city}
                  </option>
                ))}
              </select>
            </label>
          )}
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
                    {setMode && (
                      <th className="num" title="How much stronger than the same set at T4.0, weighing each slot by what its item power does">
                        Strength
                      </th>
                    )}
                    <th className="num">{setMode ? 'Average IP' : 'Item power'}</th>
                    <th className="num" title="Share of all weapons seen in recent kills for this fight size">Popularity</th>
                    <th className="num" title="Kills as a share of kills plus deaths">Kill share</th>
                    <th className="num">{setMode ? 'Set price' : 'Price'}</th>
                    <th>{setMode ? 'Buy all in' : 'City'}</th>
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
                      {setMode && <td className="num strong">{formatStrength(r.strength ?? 1)}</td>}
                      <td className={setMode ? 'num' : 'num strong'}>{r.itemPower}</td>
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
                      <td>
                        {r.set?.city ?? r.best.city}
                        {r.elsewhere && (
                          <span
                            className="tag-2h"
                            title={`${r.elsewhere.city} sells a ${formatStrength(r.elsewhere.strength / r.set!.strength)} stronger set for this budget`}
                          >
                            {r.elsewhere.city} {formatStrength(r.elsewhere.strength / r.set!.strength)}
                          </span>
                        )}
                      </td>
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
                    Buy everything in {detail.set.city}: {formatSilver(detail.price)} silver for {detail.itemPower} average item
                    power, {formatStrength(detail.set.strength)} stronger than the same set at T4.0. Uses the gear most often
                    seen with this weapon, or the next most common when {detail.set.city} doesn't sell it.
                  </p>
                  {detail.elsewhere && (
                    <p className="hint">
                      Worth the trip? {detail.elsewhere.city} sells a set{' '}
                      {formatStrength(detail.elsewhere.strength / detail.set.strength)} stronger for{' '}
                      {formatSilver(detail.elsewhere.price)} silver
                      {detail.elsewhere.missing.length < detail.set.missing.length ? ', and it has every piece' : ''}.
                    </p>
                  )}
                  <table className="breakdown set">
                    <tbody>
                      {detail.set.picks.map(({ piece, option }) => (
                        <tr key={piece.slot}>
                          <td>
                            <span className="slot">{SLOT_LABELS[piece.slot]}</span>
                            <span className="item-cell">
                              <ItemIcon id={option.itemId} size={24} />
                              {piece.slot === 'MainHand' ? detail.weapon.name : (GEAR.get(piece.base)?.name ?? piece.name)}
                              {piece.rank > 0 && (
                                <span className="tag-2h" title="The usual item isn't sold here, so this is the next most common one">
                                  alt
                                </span>
                              )}
                            </span>
                          </td>
                          <td>
                            <span className="slot">{option.itemPower} IP</span>
                            <Version o={option} />
                          </td>
                          <td className="num">{formatSilver(option.price)}</td>
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
          . Recommended is 70% strength and 30% popularity. Group kills credit every attacker, so compare kill share
          within one fight size. Full sets are bought in one city: your home city if you set one (with a note when another city
          sells a set at least 3% stronger for the budget), otherwise the city with the strongest set. Strength uses the game's own scaling per 100 item power: weapon damage +9.2% (two-handed)
          or +8.3% (one-handed), hit points +6% (armour 50%, helmet and shoes 25% each) and resistances +3% (armour only),
          so the weapon and armour get most of the budget and the cape the least. Armour spells are assumed to be about 15%
          of your output.
        </p>
      </main>
    </div>
  )
}
