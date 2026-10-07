import { Fragment, useMemo, useState } from 'react'
import type { ServerId } from '../api/servers'
import { MARKET_CITIES } from '../api/cities'
import { indexQualityPrices, QUALITIES, QUALITY_NAMES, type OfferSettings, type QualityPriceLookup, type WeaponOption } from '../buildguide/value'
import { WEAPONS, weaponItemIds, type Weapon } from '../buildguide/weapons'
import { WEAPON_TYPES, weaponTypeLabel } from '../buildguide/types'
import { ROLES, weaponRole, type Role } from '../buildguide/roles'
import { FIGHT_FILTERS, type FightFilter } from '../buildguide/meta'
import { BUILDS_PER_WEAPON, SORT_MODES, loadoutsFor, rankBuilds, type BuildRow, type SortMode } from '../buildguide/loadouts'
import { useMeta } from '../useMeta'
import { GEAR, SLOT_LABELS, gearItemIds, type Gear } from '../buildguide/gear'
import { usualGear } from '../buildguide/sets'
import { cheapestCity, equivalenceLadder, noSetReason, type SetPiece } from '../buildguide/target'
import { specFromLevels } from '../buildguide/mastery'
import { ItemIcon } from '../components/ItemIcon'
import { HowItWorks, MoreOptions } from '../components/MoreOptions'
import { usePrices } from '../usePrices'
import { useSaleAverages } from '../useSaleAverages'
import { useStoredState, withDefaults } from '../useStoredState'
import { formatAge, formatPercent, formatSilver, tierLabel } from '../format'

interface BuildGuideSettings {
  /** Average item power to reach, as the game shows it (spec included). */
  target: number
  role: Role
  /** A weapon type within the role, or 'all'. */
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
  role: 'dps',
  sub: 'all',
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

/** Cards shown before "Show more": a whole role can have a few hundred builds. */
const CARDS_SHOWN = 30

/** Identifies a card: the weapon plus its loadout. */
function buildKey(r: BuildRow): string {
  return `${r.weapon.base}|${r.loadout ? r.set.picks.map((p) => p.piece.base).join('|') : 'usual'}`
}

function Version({ o }: { o: Pick<WeaponOption, 'tier' | 'ench' | 'quality'> }) {
  return (
    <>
      <span className={`ench e${o.ench}`}>{tierLabel(o.tier, o.ench)}</span>
      {o.quality > 1 && <span className={`quality q${o.quality}`}>{QUALITY_NAMES[o.quality]}</span>}
    </>
  )
}

/** Marks a price that is last week's average sale rather than a current listing. */
function Avg() {
  return (
    <span className="tag-avg" title="No current listing here; this is last week's average sale price">
      {' '}avg
    </span>
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
                {here && r.averaged.has(setCity) && <Avg />}
              </td>
              <td className={`num${bestPrice === cheapest ? ' pos' : ''}`}>
                <span className="slot">{bestCity}</span>
                {formatSilver(bestPrice)}
                {r.averaged.has(bestCity) && <Avg />}
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
    // v6: builds are whole loadouts from recent kills, sorted by win rate and play too.
    'albion-tools.buildguide.settings.v6',
    DEFAULTS,
    withDefaults(DEFAULTS),
  )
  const set = (patch: Partial<BuildGuideSettings>) => setSettings({ ...settings, ...patch })
  const [selected, setSelected] = useState<string | null>(null)
  const [openSlot, setOpenSlot] = useState<string | null>(null)
  const [cardLimit, setCardLimit] = useState(CARDS_SHOWN)

  // Prices are fetched for one role at a time: every version and quality of every item is a lot of rows.
  const roleTypes = useMemo(
    () => WEAPON_TYPES.filter((s) => WEAPONS.some((w) => w.sub === s && weaponRole(w) === settings.role)),
    [settings.role],
  )
  const sub = roleTypes.includes(settings.sub) ? settings.sub : 'all'
  const weapons = useMemo(
    () =>
      WEAPONS.filter((w) => weaponRole(w) === settings.role)
        .filter((w) => sub === 'all' || w.sub === sub)
        .filter((w) => settings.hands === 'any' || w.twoHanded === (settings.hands === '2h')),
    [settings.role, sub, settings.hands],
  )
  const { summary, error: metaError } = useMeta(server)

  // Each weapon's most worn whole loadouts from recent kills in this fight size.
  const loadouts = useMemo(() => {
    const map = new Map<string, ReturnType<typeof loadoutsFor>>()
    if (summary) for (const w of weapons) map.set(w.base, loadoutsFor(w, summary, settings.fight).slice(0, BUILDS_PER_WEAPON))
    return map
  }, [weapons, summary, settings.fight])
  // Weapons without enough recorded fights fall back to the gear most often seen with them, slot by slot.
  const gearFor = useMemo(() => {
    const map = new Map<string, Gear[][]>()
    if (summary) for (const w of weapons) map.set(w.base, usualGear(w, summary))
    return map
  }, [weapons, summary])
  const itemIds = useMemo(() => {
    if (!summary) return []
    const gear = new Map<string, Gear>()
    for (const slots of gearFor.values()) for (const g of slots.flat()) gear.set(g.base, g)
    for (const list of loadouts.values()) for (const l of list) for (const g of l.gear.flat()) gear.set(g.base, g)
    return [...weaponItemIds(weapons), ...gearItemIds([...gear.values()])]
  }, [summary, weapons, gearFor, loadouts])
  const { prices, loading, error, fetchedAt, reload } = usePrices(server, itemIds, [...MARKET_CITIES], QUALITIES)
  // Fills gaps where a city has no current listing; the page shows listings first and updates when this lands.
  const history = useSaleAverages(server, itemIds, [...MARKET_CITIES], QUALITIES)

  const offers = useMemo<OfferSettings>(
    () => ({
      cities: settings.cities,
      maxAgeHours: settings.maxAgeHours,
      // Ages are measured from when the prices were loaded; with no prices there is nothing to age.
      now: fetchedAt?.getTime() ?? 0,
      averages: history.averages,
    }),
    [settings.cities, settings.maxAgeHours, fetchedAt, history.averages],
  )
  const lookup = useMemo(() => indexQualityPrices(prices), [prices])
  const spec = specFromLevels(settings.mastery, settings.spec)

  const [rows, missing] = useMemo(() => {
    const list: BuildRow[] = []
    const none: Weapon[] = []
    for (const weapon of weapons) {
      let priced = 0
      for (const loadout of loadouts.get(weapon.base) ?? []) {
        const set = cheapestCity(weapon, loadout.gear, lookup, offers, spec, settings.target, 'even')
        if (!set) continue
        list.push({ weapon, loadout, set })
        priced++
      }
      if (priced) continue
      const set = cheapestCity(weapon, gearFor.get(weapon.base) ?? [], lookup, offers, spec, settings.target, 'even')
      if (set) list.push({ weapon, loadout: null, set })
      else none.push(weapon)
    }
    return [rankBuilds(list, settings.sort), none] as const
  }, [weapons, loadouts, gearFor, lookup, offers, spec, settings.target, settings.sort])
  // Only worked out once prices are in, and only for the weapons left out.
  const missingReasons = useMemo(
    () =>
      prices.length
        ? missing.map((w) => ({ weapon: w, reason: noSetReason(w, gearFor.get(w.base) ?? [], lookup, offers, spec) }))
        : [],
    [missing, prices.length, gearFor, lookup, offers, spec],
  )

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
            Role
            <span className="segmented" role="radiogroup" aria-label="Role">
              {ROLES.map((r) => (
                <button
                  key={r.id}
                  role="radio"
                  aria-checked={settings.role === r.id}
                  className={settings.role === r.id ? 'active' : ''}
                  onClick={() => set({ role: r.id, sub: 'all' })}
                >
                  {r.label}
                </button>
              ))}
            </span>
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
      {roleTypes.length > 1 && (
        <div className="chips type-chips" role="group" aria-label="Weapon type">
          {['all', ...roleTypes].map((s) => (
            <button key={s} className={sub === s ? 'active' : ''} onClick={() => set({ sub: s })}>
              {s === 'all' ? 'All' : weaponTypeLabel(s)}
            </button>
          ))}
        </div>
      )}
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
          older prices. Each weapon's reason is below.
        </p>
      ) : (
        <ol className="build-cards">
          {rows.slice(0, cardLimit).map((r, i) => {
            const key = buildKey(r)
            const open = selected === key
            return (
              <li key={key} className={`build-card${open ? ' open' : ''}`}>
                <button
                  className="build-head"
                  aria-expanded={open}
                  onClick={() => {
                    setSelected(open ? null : key)
                    setOpenSlot(null)
                  }}
                >
                  <span className="build-title">
                    <span className="muted">{i + 1}</span>
                    <strong>{r.weapon.name}</strong>
                    {r.weapon.twoHanded && <span className="tag-2h">2H</span>}
                  </span>
                  <span className="build-price">
                    <strong>{formatSilver(r.set.price)}</strong>
                    <small>
                      in {r.set.city}
                      {r.set.picks.some((p) => p.option.average) && (
                        <span className="tag-avg" title="Some pieces have no current listing; their price is last week's average sale">
                          {' '}incl. avg
                        </span>
                      )}
                    </small>
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
                    {r.loadout ? (
                      <>
                        <span title="Recent fights where this exact loadout got a kill or died">
                          {r.loadout.fights.toLocaleString()} fights
                        </span>
                        <span
                          title={`${r.loadout.wins} kills, ${r.loadout.losses} deaths. Ranked with a little pull toward 50% so small samples don't top the list.`}
                        >
                          {formatPercent(r.loadout.wins / r.loadout.fights, 0)} win rate
                        </span>
                      </>
                    ) : (
                      <span
                        className="tag-avg"
                        title="Not enough recent fights with one exact loadout yet, so this uses the gear most often seen with the weapon, slot by slot"
                      >
                        usual gear
                      </span>
                    )}
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
                                      <span className="tag-2h" title="The usual item isn't sold here, so this is the next most common one or a common substitute">
                                        alt
                                      </span>
                                    )}
                                  </span>
                                </td>
                                <td>
                                  <span className="slot">{option.itemPower} IP</span>
                                  <Version o={option} />
                                </td>
                                <td className="num">
                                  {formatSilver(option.price)}
                                  {option.average && <Avg />}
                                </td>
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
      {rows.length > cardLimit && (
        <button className="show-more" onClick={() => setCardLimit(cardLimit + CARDS_SHOWN)}>
          Show more ({rows.length - cardLimit} left)
        </button>
      )}
      {missingReasons.length > 0 && (
        <ol className="build-cards missing-builds" aria-label="Weapons with no set">
          {missingReasons.map((m) => (
            <li key={m.weapon.base} className="build-card unpriced">
              <span className="build-head">
                <span className="build-title">
                  <strong>{m.weapon.name}</strong>
                  {m.weapon.twoHanded && <span className="tag-2h">2H</span>}
                </span>
                <span className="build-stats">No set at {settings.target} IP: {m.reason}</span>
              </span>
            </li>
          ))}
        </ol>
      )}
      <HowItWorks>
        Builds are whole loadouts (weapon, off-hand, helmet, armour, shoes and cape) seen together in recent kills from the
        official killboard. Every attacker in a kill counts a win for their loadout and the victim a loss, split by fight
        size; up to {BUILDS_PER_WEAPON} loadouts per weapon with at least 8 fights are shown. The killboard only records
        fights where someone died, so ganks count as wins: treat win rates as a guide. Weapons without enough fights yet use
        the gear most often seen with them, slot by slot, marked usual gear. Each set is bought in one city: the cheapest
        city whose versions reach your target average item power with every piece within 100 IP of it (capes, which get no spec, a little lower), counting six slots as the game does (a two-handed weapon
        fills the off-hand too) and your spec (+5% of spec per tier above T4, none on capes, from the game's own files).
        Where a city has no current listing, last week's average sale price there is used and marked avg. Recommended
        weighs win rate 40%, how often it's played 30% and price 30%. Weapons are grouped by the role they usually play
        (the usual community split).
        {summary ? ` Based on ${summary.events.toLocaleString()} kills since ${summary.from}, updated ${formatAge(new Date(summary.updatedAt))}.` : ''}
      </HowItWorks>
    </main>
  )
}
