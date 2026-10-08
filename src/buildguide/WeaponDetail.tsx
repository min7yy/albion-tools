import { useState } from 'react'
import type { MetaSummary } from '../meta/aggregate'
import type { CommunityPicks } from '../meta/community'
import { iconId, SLOT_LABELS } from './gear'
import { alternatives, type WeaponRow } from './loadouts'
import { communityBuilds, KEY_LABELS, spellOptions } from './spells'
import { areaLabel, areasOf, communityConsumable, extrasOf, matchupsOf, performanceOf, type Matchup } from './insights'
import { ItemIcon } from '../components/ItemIcon'
import { SpellIcon } from './SpellIcon'
import { formatPercent } from '../lib/format'
import { SetStrip } from './SetStrip'

const FIGHT_LABELS = { s: 'Solo', m: 'Small group', l: 'Large' } as const

/**
 * An item's recommended skill on each key: the one community builds pick most. With "all"
 * (or when no community build uses the item) every option is shown instead.
 */
function Skills({ base, name, slot, community, all }: { base: string; name: string; slot: keyof typeof SLOT_LABELS; community: CommunityPicks | null; all: boolean }) {
  const groups = spellOptions(base, community)
  if (!groups.length) return null
  const builds = communityBuilds(base, community)
  const showAll = all || !builds
  return (
    <div className="skill-row">
      <span className="item-cell skill-item" title={`${SLOT_LABELS[slot]}: ${name}`}>
        <ItemIcon id={iconId(base)} size={28} />
        <span>
          {name}
          {community && <small className="muted">{builds ? `${builds} community builds` : 'no community builds, all options'}</small>}
        </span>
      </span>
      <span className="skill-groups">
        {groups.map((g) => (
          <span key={g.key} className="skill-group">
            <span className="skill-key">{KEY_LABELS[g.key]}</span>
            {(showAll ? g.options : g.options.slice(0, 1)).map((o, i) => (
              <SpellIcon key={o.spell.id} spell={o.spell} picked={builds ? o.picked : null} top={i === 0 && !!o.picked} />
            ))}
          </span>
        ))}
      </span>
    </div>
  )
}

/** An item with its icon, name and a share, for the also-worn and consumables lists. */
function ItemChip({ icon, name, share, note }: { icon: string; name: string; share?: number; note?: string }) {
  return (
    <span className="item-chip">
      <ItemIcon id={icon} size={32} />
      <span>
        {name}
        {(share !== undefined || note) && <small>{[share !== undefined && formatPercent(share, 0), note].filter(Boolean).join(' ')}</small>}
      </span>
    </span>
  )
}

function MatchupList({ label, list }: { label: string; list: Matchup[] }) {
  if (!list.length) return null
  return (
    <tr>
      <td>{label}</td>
      <td className="hint">
        {list.map((m, i) => (
          <span key={m.opponent.base} title={`${m.wins} killing blows on it, ${m.losses} deaths to it`}>
            {i > 0 && ', '}
            {m.opponent.name} {m.wins}–{m.losses}
          </span>
        ))}
      </td>
    </tr>
  )
}

/** The open card: sets by item power, skills, what else people bring, and how the weapon does. */
export function WeaponDetail({ row: r, summary, community }: { row: WeaponRow; summary: MetaSummary; community: CommunityPicks | null }) {
  const [allSkills, setAllSkills] = useState(false)
  const w = summary.weapons[r.weapon.base]
  const brackets = r.brackets.filter((b) => b.wins + b.losses > 0)
  const perf = performanceOf(w)
  const { strong, weak } = matchupsOf(w)
  const areas = areasOf(w)
  const consumables = (['Potion', 'Food'] as const).map((slot) => ({
    slot,
    kills: extrasOf(w, slot, 1)[0],
    picked: communityConsumable(r.weapon.base, community, slot),
  }))
  const mounts = extrasOf(w, 'Mount', 2)
  const showAreas = areas.length > 1 || (areas.length === 1 && areas[0].area !== 'OPEN_WORLD')

  return (
    <div className="build-body">
      <h4 className="detail-head">Best set by item power</h4>
      {brackets.length ? (
        <table className="breakdown ladder-sets">
          <tbody>
            {brackets.map((b) => (
              <tr key={b.bracket.label}>
                <td className="ip-label">{b.bracket.label} IP</td>
                <td>
                  {b.set ? (
                    <SetStrip weapon={r.weapon} gear={b.set.gear} size={26} />
                  ) : (
                    <span className="hint">No set with enough fights yet</span>
                  )}
                </td>
                <td className="num" title={b.set ? `This set: ${b.set.wins} kills, ${b.set.losses} deaths` : undefined}>
                  {b.set ? (
                    <>
                      {formatPercent(b.set.wins / b.set.fights, 0)}
                      <small className="muted"> {b.set.fights} fights</small>
                    </>
                  ) : (
                    <small className="muted">
                      weapon {formatPercent(b.wins / (b.wins + b.losses), 0)} over {b.wins + b.losses}
                    </small>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="hint">Item power is recorded for kills from 8 October onward, so this fills in as new kills come in.</p>
      )}

      <div className="detail-head-row">
        <h4 className="detail-head">{allSkills ? 'All skills' : 'Recommended skills'}</h4>
        <button className="link-button" onClick={() => setAllSkills(!allSkills)}>
          {allSkills ? 'Show recommended only' : 'Show all options'}
        </button>
      </div>
      <p className="hint skills-note">
        {community
          ? 'The skill community builds on Albion Free Market pick most for each key (the killboard doesn’t record skills). Hover or tap one for what it does.'
          : 'Community skill picks haven’t loaded or aren’t published yet, so every option shows. Hover or tap one for what it does.'}
      </p>
      <div className="skills">
        <Skills base={r.weapon.base} name={r.weapon.name} slot="MainHand" community={community} all={allSkills} />
        {r.best?.gear.map((g) => <Skills key={g.slot} base={g.base} name={g.name} slot={g.slot} community={community} all={allSkills} />)}
      </div>

      {consumables.some((c) => c.kills || c.picked) ? (
        <>
          <h4 className="detail-head">Recommended consumables</h4>
          <div className="worn-grid">
            {consumables.map((c) =>
              c.kills || c.picked ? (
                <div key={c.slot} className="worn-slot">
                  <span className="slot">{c.slot}</span>
                  <span className="worn-items">
                    {c.kills && <ItemChip icon={c.kills.icon} name={c.kills.name} share={c.kills.share} note="of kills" />}
                    {c.picked && c.picked.icon !== c.kills?.icon && (
                      <ItemChip icon={c.picked.icon} name={c.picked.name} share={c.picked.share} note="of community builds" />
                    )}
                    {c.picked && c.picked.icon === c.kills?.icon && <small className="muted agree">community builds agree</small>}
                  </span>
                </div>
              ) : null,
            )}
          </div>
        </>
      ) : (
        <>
          <h4 className="detail-head">Recommended consumables</h4>
          <p className="hint">
            No potions or food recorded for this weapon yet. Kills record them from 8 October onward, so this fills in as
            new kills come in.
          </p>
        </>
      )}

      {r.best && (
        <>
          <h4 className="detail-head">Also worn with it</h4>
          <div className="worn-grid">
            {r.best.gear.map((g) => {
              const others = alternatives(r.weapon, summary, g.slot)
                .filter((a) => a.item.base !== g.base)
                .slice(0, 3)
              return others.length ? (
                <div key={g.slot} className="worn-slot">
                  <span className="slot">{SLOT_LABELS[g.slot]}</span>
                  <span className="worn-items">
                    {others.map((a) => (
                      <ItemChip key={a.item.base} icon={iconId(a.item.base)} name={a.item.name} share={a.share} note="of kills" />
                    ))}
                  </span>
                </div>
              ) : null
            })}
            <div className="worn-slot">
              <span className="slot">Mount</span>
              <span className="worn-items">
                {mounts.length ? (
                  mounts.map((m) => <ItemChip key={m.icon} icon={m.icon} name={m.name} share={m.share} note="of kills" />)
                ) : (
                  <small className="muted">None recorded yet; kills record mounts from 8 October onward</small>
                )}
              </span>
            </div>
          </div>
        </>
      )}

      <h4 className="detail-head">Record</h4>
      <table className="breakdown">
        <tbody>
          {(['s', 'm', 'l'] as const).map((size) => {
            const [wins, losses] = r.bySize[size]
            return wins + losses > 0 ? (
              <tr key={size}>
                <td>{FIGHT_LABELS[size]}</td>
                <td className="num">{(wins + losses).toLocaleString()} fights</td>
                <td className="num">{formatPercent(wins / (wins + losses), 0)} win rate</td>
              </tr>
            ) : null
          })}
          {perf && (perf.damage !== null || perf.killFame !== null) && (
            <tr>
              <td>Per kill</td>
              <td className="hint" colSpan={2}>
                {[
                  perf.damage !== null && `${Math.round(perf.damage).toLocaleString()} damage`,
                  perf.healing !== null && perf.healing >= 1 && `${Math.round(perf.healing).toLocaleString()} healing`,
                  perf.killFame !== null && `${Math.round(perf.killFame).toLocaleString()} kill fame on its killing blows`,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </td>
            </tr>
          )}
          <MatchupList label="Beats" list={strong} />
          <MatchupList label="Loses to" list={weak} />
          {showAreas && (
            <tr>
              <td>Where</td>
              <td className="hint" colSpan={2}>
                {areas
                  .slice(0, 4)
                  .map((a) => `${areaLabel(a.area)} ${formatPercent(a.share, 0)}`)
                  .join(', ')}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
