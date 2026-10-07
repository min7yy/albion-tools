import { Fragment, useMemo, useState } from 'react'
import type { ServerId } from '../api/servers'
import { MARKET_CITIES } from '../api/cities'
import { indexQualityPrices, QUALITIES, QUALITY_NAMES, type OfferSettings, type QualityPriceLookup, type WeaponOption } from '../buildguide/value'
import { WEAPONS, weaponItemIds, type Weapon } from '../buildguide/weapons'
import { WEAPON_TYPES, weaponTypeLabel } from '../buildguide/types'
import { FIGHT_FILTERS, SORT_MODES, rankWithMeta, weaponMeta, type FightFilter, type SortMode } from '../buildguide/meta'
import { useMeta } from '../useMeta'
import { GEAR, SLOT_LABELS, gearItemIds, type Gear } from '../buildguide/gear'
import { usualGear } from '../buildguide/sets'
import { cheapestCity, equivalenceLadder, type SetPiece, type TargetSet } from '../buildguide/target'
import { specFromLevels } from '../buildguide/mastery'
import { ItemIcon } from '../components/ItemIcon'
import { HowItWorks, MoreOptions } from '../components/MoreOptions'
import { usePrices } from '../usePrices'
import { useStoredState, withDefaults } from '../useStoredState'
import { formatAge, formatPercent, formatSilver, tierLabel } from '../format'

interface BuildGuideSettings {
  /** Average item power to reach, as the game shows it (spec included). */
  target: number
  sub: string
  hands: 'any' | '1h' | '2h'
  cities: string[]
  maxAgeHours: number
  fight: FightFilter
  sort: SortMode
  /** Destiny board levels assumed on every weapon and armour line (0–100). */
  mastery: number
  /** Destiny board levels assumed on the exact item worn (0–100, elite levels aside). */
  spec: number
}

const DEFAULTS: BuildGuideSettings = {
  target: 1100,
  sub: 'sword',
  hands: 'any',
  cities: [...MARKET_CITIES],
  maxAgeHours: 48,
  fight: 'all',
  sort: 'recommended',
  mastery: 100,
  spec: 50,
}
const AGE_OPTIONS = [6, 24, 48, 168]
const TARGET_MIN = 700
const TARGET_MAX = 1800
const TARGET_PRESETS = [900, 1000, 1100, 1200, 1300, 1400]

interface Row {
  weapon: Weapon
  price: number
  set: TargetSet
}

function Version({ o }: { o: Pick<WeaponOption, 'tier' | 'ench' | 'quality'> }) {
  return (
    <>
      <span className={`ench e${o.ench}`}>{tierLabel(o.tier, o.ench)}</span>
      {o.quality > 1 && <span className={`quality q${o.quality}`}>{QUALITY_NAMES[o.quality]}</span>}
    </>
  )
}

/** The same item power for less: every version of one piece that matches it, with its cheapest city. */
function Ladder({
  piece,
  option,
  item,
  setCity,
  lookup,
  offers,
  spec,
}: {
  piece: SetPiece
  option: WeaponOption
  item: Weapon | Gear
  setCity: string
  lookup: QualityPriceLookup
  offers: OfferSettings
  spec: number
}) {
  const rows = useMemo(
    () => equivalenceLadder(item, piece.slot, option.itemPower, lookup, offers, spec),
    [item, piece.slot, option.itemPower, lookup, offers, spec],
  )
  if (!rows.length) return null
  let cheapest = Infinity
  for (const r of rows) for (const p of r.prices.values()) cheapest = Math.min(cheapest, p)
  return (
    <table className="breakdown ladder">
      <tbody>
        {rows.map((r) => {
          const [bestCity, bestPrice] = [...r.prices].sort((a, b) => a[1] - b[1])[0]
          const here = r.prices.get(setCity)
          return (
            <tr key={`${r.tier}.${r.ench}.${r.quality}`}>
              <td>
                <span className="slot">{r.itemPower} IP</span>
                <Version o={r} />
              </td>
              <td className="num">
                <span className="slot">{setCity}</span>
                {here ? formatSilver(here) : '–'}
              </td>
              <td className={`num${bestPrice === cheapest ? ' pos' : ''}`}>
                <span className="slot">{bestCity}</span>
                {formatSilver(bestPrice)}
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

export default function BuildGuidePage({ server }: { server: ServerId }) {
  const [settings, setSettings] = useStoredState<BuildGuideSettings>(
    // v4: rebuilt around a target item power, with spec as destiny board levels.
    'albion-tools.buildguide.settings.v4',
    DEFAULTS,
    withDefaults(DEFAULTS),
  )
  const set = (patch: Partial<BuildGuideSettings>) => setSettings({ ...settings, ...patch })
  const [selected, setSelected] = useState<string | null>(null)
  const [openSlot, setOpenSlot] = useState<string | null>(null)

  // Prices are fetched one weapon type at a time: every version and quality of every item is a lot of rows.
  const weapons = useMemo(
    () =>
      WEAPONS.filter((w) => w.sub === settings.sub).filter(
        (w) => settings.hands === 'any' || w.twoHanded === (settings.hands === '2h'),
      ),
    [settings.sub, settings.hands],
  )
  const { summary, error: metaError } = useMeta(server)
  const meta = useMemo(() => (summary ? weaponMeta(summary, settings.fight) : null), [summary, settings.fight])

  // Each weapon is paired with the gear most often seen with it in recent kills.
  const gearFor = useMemo(() => {
    const map = new Map<string, Gear[][]>()
    if (summary) for (const w of weapons) map.set(w.base, usualGear(w, summary))
    return map
  }, [weapons, summary])
  const itemIds = useMemo(() => {
    if (!summary) return []
    const gear = new Map<string, Gear>()
    for (const slots of gearFor.values()) for (const g of slots.flat()) gear.set(g.base, g)
    return [...weaponItemIds(weapons), ...gearItemIds([...gear.values()])]
  }, [summary, weapons, gearFor])
  const { prices, loading, error, fetchedAt, reload } = usePrices(server, itemIds, [...MARKET_CITIES], QUALITIES)

  const offers = useMemo<OfferSettings>(
    () => ({
      cities: settings.cities,
      maxAgeHours: settings.maxAgeHours,
      // Ages are measured from when the prices were loaded; with no prices there is nothing to age.
      now: fetchedAt?.getTime() ?? 0,
    }),
    [settings.cities, settings.maxAgeHours, fetchedAt],
  )
  const lookup = useMemo(() => indexQualityPrices(prices), [prices])
  const spec = specFromLevels(settings.mastery, settings.spec)

  const rows = useMemo(() => {
    const list: Row[] = []
    for (const weapon of weapons) {
      const found = cheapestCity(weapon, gearFor.get(weapon.base) ?? [], lookup, offers, spec, settings.target)
      if (found) list.push({ weapon, price: found.price, set: found })
    }
    return rankWithMeta(list, meta, settings.sort)
  }, [weapons, gearFor, lookup, offers, spec, settings.target, meta, settings.sort])

  const toggleCity = (city: string) =>
    set({
      cities: settings.cities.includes(city) ? settings.cities.filter((c) => c !== city) : [...settings.cities, city],
    })
  const clampTarget = (n: number) => Math.min(TARGET_MAX, Math.max(TARGET_MIN, Math.round(n / 10) * 10))

  return (
    <main className="panel">
      <div className="target-row">
        <label className="budget-input">
          Target average item power
          <span>
            <input
              type="number"
              min={TARGET_MIN}
              max={TARGET_MAX}
              step={10}
              value={settings.target}
              onChange={(e) => set({ target: Number(e.target.value) || 0 })}
              onBlur={() => set({ target: clampTarget(settings.target) })}
            />{' '}
            <small>IP</small>
          </span>
        </label>
        <div className="chips" role="group" aria-label="Common targets">
          {TARGET_PRESETS.map((t) => (
            <button key={t} className={settings.target === t ? 'active' : ''} onClick={() => set({ target: t })}>
              {t}
            </button>
          ))}
        </div>
      </div>
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
            <span className="segmented" role="radiogroup" aria-label="Sort by">
              {SORT_MODES.map((m) => (
                <button
                  key={m.id}
                  role="radio"
                  aria-checked={settings.sort === m.id}
                  className={settings.sort === m.id ? 'active' : ''}
                  onClick={() => set({ sort: m.id })}
                >
                  {m.label}
                </button>
              ))}
            </span>
          </label>
        </div>
        <div className="refresh">
          <span className="hint">{loading ? 'Loading prices…' : fetchedAt ? `Prices loaded ${formatAge(fetchedAt)}` : ''}</span>
          <button onClick={reload} disabled={loading}>
            Refresh
          </button>
        </div>
      </div>
      <MoreOptions
        summary={[
          `Mastery ${settings.mastery}, spec ${settings.spec} (+${Math.round(spec)} IP)`,
          settings.hands !== 'any' && (settings.hands === '1h' ? 'One-handed' : 'Two-handed'),
          settings.cities.length === MARKET_CITIES.length ? 'All cities' : `${settings.cities.length} cities`,
          `Prices under ${settings.maxAgeHours < 48 ? `${settings.maxAgeHours}h` : `${settings.maxAgeHours / 24}d`}`,
        ]
          .filter(Boolean)
          .join(' · ')}
      >
        <div className="option-group">
          <label title="Destiny board levels on each weapon and armour line, e.g. Crossbow Fighter. Each level adds 0.2 item power.">
            Mastery level
            <input
              type="number"
              min={0}
              max={100}
              value={settings.mastery}
              onChange={(e) => set({ mastery: Math.min(100, Math.max(0, Number(e.target.value) || 0)) })}
            />
          </label>
          <label title="Destiny board levels on the exact items worn, e.g. Light Crossbow Combat Specialist. Each level adds 2 item power.">
            Item spec level
            <input
              type="number"
              min={0}
              max={120}
              value={settings.spec}
              onChange={(e) => set({ spec: Math.min(120, Math.max(0, Number(e.target.value) || 0)) })}
            />
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
            Ignore prices older than
            <select value={settings.maxAgeHours} onChange={(e) => set({ maxAgeHours: Number(e.target.value) })}>
              {AGE_OPTIONS.map((h) => (
                <option key={h} value={h}>
                  {h < 48 ? `${h} hours` : `${h / 24} days`}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="option-group">
          {MARKET_CITIES.map((city) => (
            <label key={city} className="check">
              <input type="checkbox" checked={settings.cities.includes(city)} onChange={() => toggleCity(city)} />
              {city}
            </label>
          ))}
        </div>
      </MoreOptions>
      {error && <p className="error">{error}</p>}
      {metaError && <p className="error">{metaError}. Sets are built from the gear seen in recent kills, so they can't load.</p>}

      {(loading && !prices.length) || (!summary && !metaError) ? (
        <p className="hint">Loading prices for {weapons.length} weapons and their usual gear…</p>
      ) : !rows.length ? (
        <p className="hint">
          No set reaches {settings.target} item power with recent prices in one city. Try a lower target, more cities or
          older prices.
        </p>
      ) : (
        <ol className="build-cards">
          {rows.map((r, i) => {
            const open = selected === r.weapon.base
            return (
              <li key={r.weapon.base} className={`build-card${open ? ' open' : ''}`}>
                <button
                  className="build-head"
                  aria-expanded={open}
                  onClick={() => {
                    setSelected(open ? null : r.weapon.base)
                    setOpenSlot(null)
                  }}
                >
                  <span className="build-title">
                    <span className="muted">{i + 1}</span>
                    <strong>{r.weapon.name}</strong>
                    {r.weapon.twoHanded && <span className="tag-2h">2H</span>}
                  </span>
                  <span className="build-price">
                    <strong>{formatSilver(r.price)}</strong>
                    <small>in {r.set.city}</small>
                  </span>
                  <span className="build-strip">
                    {r.set.picks.map(({ piece, option }) => (
                      <span key={piece.slot} className="strip-item" title={`${SLOT_LABELS[piece.slot]}: ${piece.name}`}>
                        <ItemIcon id={option.itemId} size={40} />
                        <span className={`ench e${option.ench}`}>{tierLabel(option.tier, option.ench)}</span>
                      </span>
                    ))}
                  </span>
                  <span className="build-stats">
                    <span title="Average over six slots as the game counts it, spec included">{r.set.itemPower} IP</span>
                    {r.meta && (
                      <span title="Share of all weapons seen in recent kills for this fight size">
                        {formatPercent(r.meta.popularity)} of kills
                      </span>
                    )}
                    {r.meta && <span title="Kills as a share of kills plus deaths">{formatPercent(r.meta.killRatio, 0)} kill share</span>}
                  </span>
                </button>
                {open && (
                  <div className="build-body">
                    <p className="hint">Tap a piece to see versions with the same item power and where each is cheapest.</p>
                    <table className="breakdown set">
                      <tbody>
                        {r.set.picks.map(({ piece, option }) => {
                          const item = piece.slot === 'MainHand' ? r.weapon : GEAR.get(piece.base)
                          const slotOpen = openSlot === piece.slot
                          return (
                            <Fragment key={piece.slot}>
                              <tr className="clickable" onClick={() => setOpenSlot(slotOpen ? null : piece.slot)}>
                                <td>
                                  <span className="slot">
                                    {SLOT_LABELS[piece.slot]} {slotOpen ? '▾' : '▸'}
                                  </span>
                                  <span className="item-cell">
                                    <ItemIcon id={option.itemId} size={24} />
                                    {item?.name ?? piece.name}
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
                              {slotOpen && item && (
                                <tr className="ladder-row">
                                  <td colSpan={3}>
                                    <Ladder
                                      piece={piece}
                                      option={option}
                                      item={item}
                                      setCity={r.set.city}
                                      lookup={lookup}
                                      offers={offers}
                                      spec={spec}
                                    />
                                  </td>
                                </tr>
                              )}
                            </Fragment>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </li>
            )
          })}
        </ol>
      )}
      <HowItWorks>
        Each weapon is paired with the helmet, armour, shoes, cape and off-hand most often seen with it in recent kills (or
        the next most common when a city doesn't sell it), and the whole set is bought in one city: the cheapest city
        whose versions reach your target average item power. The average counts six slots as the game does, with a
        two-handed weapon filling the off-hand too, and includes your spec. Item power, the tier bonus (+5% of spec per
        tier above T4, none on capes) and the spec numbers come from the game's own files. T8.0, T7.1, T6.2, T5.3 and T4.4
        share base item power, and quality adds 20 to 100, so the cheapest way there often mixes tiers. Popularity and
        kill share come from a sample of recent kills
        {summary ? ` (${summary.events.toLocaleString()} kills since ${summary.from}, updated ${formatAge(new Date(summary.updatedAt))})` : ''}
        . Recommended is 70% price and 30% popularity.
      </HowItWorks>
    </main>
  )
}
