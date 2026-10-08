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
import { HowItWorks } from '../components/MoreOptions'
import { useStoredState, withDefaults } from '../hooks/useStoredState'
import { formatAge, formatDay, formatPercent } from '../lib/format'
import { LOOKBACK_FIGHTS } from '../meta/aggregate'

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

const FIGHT_SHORT: Record<FightFilter, string> = { all: 'All', s: 'Solo', m: '2–5', l: '6+' }

/** A labelled row of buttons where one is picked. */
function Segmented<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string
  options: { id: T; label: string; title?: string }[]
  value: T
  onChange: (id: T) => void
}) {
  return (
    <div className="field">
      <span className="field-label">{label}</span>
      <span className="segmented" role="radiogroup" aria-label={label}>
        {options.map((o) => (
          <button
            key={o.id}
            role="radio"
            aria-checked={value === o.id}
            className={value === o.id ? 'active' : ''}
            title={o.title}
            onClick={() => onChange(o.id)}
          >
            {o.label}
          </button>
        ))}
      </span>
    </div>
  )
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
          <Segmented label="Role" options={ROLES} value={settings.role} onChange={(role) => set({ role, sub: 'all' })} />
          <Segmented
            label="Fight size"
            options={FIGHT_FILTERS.map((f) => ({ id: f.id, label: FIGHT_SHORT[f.id], title: f.label }))}
            value={settings.fight}
            onChange={(fight) => set({ fight })}
          />
          <Segmented
            label="Hands"
            options={[
              { id: 'any', label: 'Any' },
              { id: '1h', label: '1H', title: 'One-handed' },
              { id: '2h', label: '2H', title: 'Two-handed' },
            ]}
            value={settings.hands}
            onChange={(hands) => set({ hands })}
          />
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
        {summary && (
          <div className="refresh">
            <span className="hint">
              {summary.events.toLocaleString()} kills since {formatDay(summary.from)}, updated {formatAge(new Date(summary.updatedAt))}
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
                    {summary?.weapons[key]?.from && (
                      <span
                        className="tag-since"
                        title={`Too few fights in the last week, so this counts every fight since ${formatDay(summary.weapons[key].from!)}`}
                      >
                        since {formatDay(summary.weapons[key].from!)}
                      </span>
                    )}
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
        Everything here comes from the last week of kills on the official killboard, which every Albion killboard site
        draws on; a weapon with under {LOOKBACK_FIGHTS} fights in that week counts older kills too (up to four weeks) and
        is marked with the date it counts from.
        Every attacker in a kill counts a win for their weapon and loadout (off-hand, helmet, armour, shoes and cape) and
        the victim a loss, split by fight size and by the player's average item power. Each weapon shows its best loadout
        with at least {MIN_FIGHTS} fights, and its best at each item power level with at least {MIN_BRACKET_FIGHTS}; weapons
        without one show the item most often worn with them in each slot, marked usual gear. Best means the highest win
        rate after pulling it toward 50% as if each loadout had {PRIOR_FIGHTS} more fights, so a lucky few don't win. The
        killboard only records fights where someone died, so ganks count as wins: treat win rates as a guide. The killboard
        doesn't record skills, so the recommended skill on each key is the one most picked in Albion Free Market builds
        that have more upvotes than downvotes and were made or edited in the last year (every option comes from the game
        files). How to play is written from the same data: where the weapon wins by fight size, and what each recommended
        skill is for (damage, crowd control, mobility, buffs or healing, as the game tags it). Recommended potions and food show what players brought in
        kills alongside the community's pick. Rising and falling
        compare a weapon's share of fights over the last two days with the days before. Recommended weighs win rate and
        how much it's played equally. Weapons are grouped by the role they usually play.
      </HowItWorks>
    </main>
  )
}
