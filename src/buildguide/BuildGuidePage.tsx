import { useMemo, useState } from 'react'
import type { ServerId } from '../api/servers'
import { WEAPONS } from './weapons'
import { WEAPON_TYPES, weaponTypeLabel } from './types'
import { ROLES, weaponRole, type Role } from './roles'
import { FIGHT_FILTERS, type FightFilter } from './useMeta'
import {
  MIN_BRACKET_FIGHTS,
  MIN_FIGHTS,
  PRIOR_FIGHTS,
  SORT_MODES,
  rankBuilds,
  weaponRow,
  type WeaponRow,
  type SortMode,
} from './loadouts'
import { useCommunityPicks, useMeta } from './useMeta'
import { WeaponDetail } from './WeaponDetail'
import { trendOf } from './insights'
import { SetStrip } from './SetStrip'
import { HowItWorks, MoreOptions } from '../components/MoreOptions'
import { useStoredState, withDefaults } from '../hooks/useStoredState'
import { formatAge, formatPercent } from '../lib/format'

interface BuildGuideSettings {
  role: Role
  /** A weapon type within the role, or 'all'. */
  sub: string
  hands: 'any' | '1h' | '2h'
  fight: FightFilter
  sort: SortMode
}

const DEFAULTS: BuildGuideSettings = {
  role: 'dps',
  sub: 'all',
  hands: 'any',
  fight: 'all',
  sort: 'recommended',
}

/** Cards shown before "Show more": a whole role can have a few hundred builds. */
const CARDS_SHOWN = 30

export default function BuildGuidePage({ server }: { server: ServerId }) {
  const [settings, setSettings] = useStoredState<BuildGuideSettings>(
    // v8: one card per weapon, with sets per item power bracket instead of an item power picker.
    'albion-tools.buildguide.settings.v8',
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
  const community = useCommunityPicks()

  const [rows, quiet] = useMemo(() => {
    if (!summary) return [[], []] as const
    const list: WeaponRow[] = []
    const none: string[] = []
    for (const w of weapons) {
      const r = weaponRow(w, summary, settings.fight)
      if (r) list.push(r)
      else none.push(w.name)
    }
    return [rankBuilds(list, settings.sort), none] as const
  }, [weapons, summary, settings.fight, settings.sort])

  return (
    <main className="panel">
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
        <p className="hint">No recent fights match these filters. Try All fights.</p>
      ) : (
        <ol className="build-cards">
          {rows.slice(0, cardLimit).map((r, i) => {
            const key = r.weapon.base
            const open = selected === key
            const trend = summary ? trendOf(key, summary) : null
            return (
              <li key={key} className={`build-card${open ? ' open' : ''}`}>
                <button className="build-head" aria-expanded={open} onClick={() => setSelected(open ? null : key)}>
                  <span className="build-title">
                    <span className="muted">{i + 1}</span>
                    <strong>{r.weapon.name}</strong>
                    {r.weapon.twoHanded && <span className="tag-2h">2H</span>}
                    {trend && (
                      <span
                        className={`tag-trend ${trend.dir}`}
                        title={`Share of fights over the last 2 days is ${trend.ratio.toFixed(1)}× its share over the days before`}
                      >
                        {trend.dir === 'up' ? '▲ Rising' : '▼ Falling'}
                      </span>
                    )}
                  </span>
                  <span className="build-price" title={`${r.wins} kills, ${r.losses} deaths`}>
                    <strong>{formatPercent(r.wins / r.fights, 0)}</strong>
                    <small>win rate</small>
                  </span>
                  {r.best && <SetStrip weapon={r.weapon} gear={r.best.gear} size={40} />}
                  <span className="build-stats">
                    <span title="Recent fights where this weapon got a kill or died">{r.fights.toLocaleString()} fights</span>
                    {r.itemPower && <span title="Average item power of the players using it">~{r.itemPower} IP</span>}
                    {r.best && !r.best.usual && (
                      <span title="Win rate of the set shown, the best of the loadouts with enough fights">
                        set {formatPercent(r.best.wins / r.best.fights, 0)} over {r.best.fights}
                      </span>
                    )}
                    {r.best?.usual && (
                      <span
                        className="tag-avg"
                        title={`No single loadout has ${MIN_FIGHTS} fights yet, so this is the item most often worn with the weapon in each slot`}
                      >
                        usual gear
                      </span>
                    )}
                  </span>
                </button>
                {open && summary && <WeaponDetail row={r} summary={summary} community={community} />}
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
        Everything here comes from recent kills on the official killboard, which every Albion killboard site draws on.
        Every attacker in a kill counts a win for their weapon and loadout (off-hand, helmet, armour, shoes and cape) and
        the victim a loss, split by fight size and by the player's average item power. Each weapon shows its best loadout
        with at least {MIN_FIGHTS} fights, and its best at each item power level with at least {MIN_BRACKET_FIGHTS}; weapons
        without one show the item most often worn with them in each slot, marked usual gear. Best means the highest win
        rate after pulling it toward 50% as if each loadout had {PRIOR_FIGHTS} more fights, so a lucky few don't win. The
        killboard only records fights where someone died, so ganks count as wins: treat win rates as a guide. The killboard
        doesn't record skills, so the skill lists show every option from the game files, ranked by how often community
        builds on Albion Free Market pick them. Matchups count killing blows between two weapons. Rising and falling
        compare a weapon's share of fights over the last two days with the days before. Recommended weighs win rate and
        how much it's played equally. Weapons are grouped by the role they usually play.
      </HowItWorks>
    </main>
  )
}
