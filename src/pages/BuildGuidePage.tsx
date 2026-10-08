import { useMemo, useState } from 'react'
import type { ServerId } from '../api/servers'
import { WEAPONS } from '../buildguide/weapons'
import { WEAPON_TYPES, weaponTypeLabel } from '../buildguide/types'
import { ROLES, weaponRole, type Role } from '../buildguide/roles'
import { FIGHT_FILTERS, type FightFilter } from '../buildguide/meta'
import {
  BUILDS_PER_WEAPON,
  MIN_FIGHTS,
  PRIOR_FIGHTS,
  SORT_MODES,
  alternatives,
  buildsFor,
  rankBuilds,
  statsFilter,
  type BuildRow,
  type SortMode,
} from '../buildguide/loadouts'
import { useMeta } from '../useMeta'
import { SLOT_LABELS } from '../buildguide/gear'
import { ItemIcon } from '../components/ItemIcon'
import { HowItWorks, MoreOptions } from '../components/MoreOptions'
import { useStoredState, withDefaults } from '../useStoredState'
import { formatAge, formatPercent } from '../format'

interface BuildGuideSettings {
  /** Only count fights where the player's item power was near this; null for every fight. */
  itemPower: number | null
  role: Role
  /** A weapon type within the role, or 'all'. */
  sub: string
  hands: 'any' | '1h' | '2h'
  fight: FightFilter
  sort: SortMode
}

const DEFAULTS: BuildGuideSettings = {
  itemPower: null,
  role: 'dps',
  sub: 'all',
  hands: 'any',
  fight: 'all',
  sort: 'recommended',
}
const IP_PRESETS = [800, 900, 1000, 1100, 1200, 1300, 1400]

/** Cards shown before "Show more": a whole role can have a few hundred builds. */
const CARDS_SHOWN = 30

/** Icons are drawn at one tier: the kill data says which items, and the item power says how strong. */
const iconId = (base: string) => `T6_${base}`

const FIGHT_LABELS = { s: 'Solo', m: 'Small group', l: 'Large' } as const

function buildKey(r: BuildRow): string {
  return `${r.weapon.base}|${r.usual ? 'usual' : r.gear.map((g) => g.base).join('|')}`
}

export default function BuildGuidePage({ server }: { server: ServerId }) {
  const [settings, setSettings] = useStoredState<BuildGuideSettings>(
    // v7: builds come from kill data alone, with no prices.
    'albion-tools.buildguide.settings.v7',
    DEFAULTS,
    withDefaults(DEFAULTS),
  )
  const set = (patch: Partial<BuildGuideSettings>) => setSettings({ ...settings, ...patch })
  const [selected, setSelected] = useState<string | null>(null)
  const [cardLimit, setCardLimit] = useState(CARDS_SHOWN)

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

  // Item power is only in kills recorded since the tracker started saving it.
  const hasItemPower = useMemo(
    () => !!summary && Object.values(summary.weapons).some((w) => Object.keys(w.stats).some((k) => k.length > 1)),
    [summary],
  )
  const [rows, quiet] = useMemo(() => {
    if (!summary) return [[], []] as const
    const filter = statsFilter(settings.fight, settings.itemPower)
    const list: BuildRow[] = []
    const none: string[] = []
    for (const w of weapons) {
      const builds = buildsFor(w, summary, filter)
      if (builds.length) list.push(...builds)
      else none.push(w.name)
    }
    return [rankBuilds(list, settings.sort), none] as const
  }, [weapons, summary, settings.fight, settings.itemPower, settings.sort])

  return (
    <main className="panel">
      <div className="target-row">
        <span className="budget-input">Your item power</span>
        <div className="chips" role="group" aria-label="Item power">
          <button className={settings.itemPower === null ? 'active' : ''} onClick={() => set({ itemPower: null })}>
            Any
          </button>
          {IP_PRESETS.map((ip) => (
            <button key={ip} className={settings.itemPower === ip ? 'active' : ''} onClick={() => set({ itemPower: ip })}>
              {ip}
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
        {summary && (
          <div className="refresh">
            <span className="hint">
              {summary.events.toLocaleString()} kills since {summary.from}, updated {formatAge(new Date(summary.updatedAt))}
            </span>
          </div>
        )}
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
      <MoreOptions summary={settings.hands === 'any' ? 'Any weapon' : settings.hands === '1h' ? 'One-handed' : 'Two-handed'}>
        <div className="option-group">
          <label>
            Hands
            <select value={settings.hands} onChange={(e) => set({ hands: e.target.value as BuildGuideSettings['hands'] })}>
              <option value="any">Any</option>
              <option value="1h">One-handed</option>
              <option value="2h">Two-handed</option>
            </select>
          </label>
        </div>
      </MoreOptions>
      {metaError && <p className="error">{metaError}</p>}

      {!summary && !metaError ? (
        <p className="hint">Loading recent kills…</p>
      ) : summary && !rows.length ? (
        <p className="hint">
          {settings.itemPower && !hasItemPower
            ? 'Item power is recorded for kills from 8 October onward, so this fills in as new kills come in. Pick Any for now.'
            : 'No recent fights match these filters. Try Any item power or All fights.'}
        </p>
      ) : (
        <ol className="build-cards">
          {rows.slice(0, cardLimit).map((r, i) => {
            const key = buildKey(r)
            const open = selected === key
            return (
              <li key={key} className={`build-card${open ? ' open' : ''}`}>
                <button className="build-head" aria-expanded={open} onClick={() => setSelected(open ? null : key)}>
                  <span className="build-title">
                    <span className="muted">{i + 1}</span>
                    <strong>{r.weapon.name}</strong>
                    {r.weapon.twoHanded && <span className="tag-2h">2H</span>}
                  </span>
                  <span className="build-price" title={`${r.wins} kills, ${r.losses} deaths`}>
                    <strong>{formatPercent(r.wins / r.fights, 0)}</strong>
                    <small>win rate</small>
                  </span>
                  <span className="build-strip">
                    {[r.weapon, ...r.gear].map((item, n) => (
                      <span key={item.base} className="strip-item" title={`${n ? SLOT_LABELS[r.gear[n - 1].slot] : 'Weapon'}: ${item.name}`}>
                        <ItemIcon id={iconId(item.base)} size={40} />
                      </span>
                    ))}
                  </span>
                  <span className="build-stats">
                    <span title="Recent fights where this build got a kill or died">{r.fights.toLocaleString()} fights</span>
                    {r.itemPower && <span title="Average item power of the players wearing it">~{r.itemPower} IP</span>}
                    {r.usual && (
                      <span
                        className="tag-avg"
                        title={`No single loadout has ${MIN_FIGHTS} fights yet, so this is the item most often worn with the weapon in each slot, with the weapon's own record`}
                      >
                        usual gear
                      </span>
                    )}
                  </span>
                </button>
                {open && summary && (
                  <div className="build-body">
                    <table className="breakdown set">
                      <tbody>
                        {r.gear.map((g) => {
                          const others = alternatives(r.weapon, summary, g.slot).filter((a) => a.item.base !== g.base)
                          return (
                            <tr key={g.slot}>
                              <td>
                                <span className="slot">{SLOT_LABELS[g.slot]}</span>
                                <span className="item-cell">
                                  <ItemIcon id={iconId(g.base)} size={24} />
                                  {g.name}
                                </span>
                              </td>
                              <td className="hint">
                                {others.length > 0 &&
                                  `Also worn: ${others
                                    .slice(0, 3)
                                    .map((a) => `${a.item.name} ${formatPercent(a.share, 0)}`)
                                    .join(', ')}`}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                    <table className="breakdown">
                      <tbody>
                        {(['s', 'm', 'l'] as const).map((size) => {
                          const [w, l] = r.bySize[size]
                          return w + l > 0 ? (
                            <tr key={size}>
                              <td>{FIGHT_LABELS[size]}</td>
                              <td className="num">{(w + l).toLocaleString()} fights</td>
                              <td className="num">{formatPercent(w / (w + l), 0)} win rate</td>
                            </tr>
                          ) : null
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
      {summary && quiet.length > 0 && (
        <p className="hint">No recent fights for: {quiet.join(', ')}.</p>
      )}
      <HowItWorks>
        Builds are whole loadouts (weapon, off-hand, helmet, armour, shoes and cape) seen together in recent kills from the
        official killboard, which every Albion killboard site draws on. Every attacker in a kill counts a win for their
        loadout and the victim a loss, split by fight size and by the player's item power. Up to {BUILDS_PER_WEAPON}{' '}
        loadouts per weapon with at least {MIN_FIGHTS} fights are shown; weapons without one show the item most often worn
        with them in each slot, marked usual gear. Picking an item power counts only fights where the player was within 100
        of it. The killboard only records fights where someone died, so ganks count as wins: treat win rates as a guide.
        Rankings pull win rates toward 50% as if each build had {PRIOR_FIGHTS} more fights, so a lucky few don't top the
        list. Recommended weighs win rate and how much it's played equally. Weapons are grouped by the role they usually
        play (the usual community split).
      </HowItWorks>
    </main>
  )
}
