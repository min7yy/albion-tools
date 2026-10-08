import type { MetaSummary } from '../meta/aggregate'
import type { CommunityPicks } from '../meta/community'
import { iconId, SLOT_LABELS } from './gear'
import { alternatives, type WeaponRow } from './loadouts'
import { communityBuilds, KEY_LABELS, spellOptions } from './spells'
import { areaLabel, areasOf, extrasOf, matchupsOf, performanceOf, type Matchup } from './insights'
import { ItemIcon } from '../components/ItemIcon'
import { SpellIcon } from './SpellIcon'
import { formatPercent } from '../lib/format'
import { SetStrip } from './SetStrip'

const FIGHT_LABELS = { s: 'Solo', m: 'Small group', l: 'Large' } as const

function Skills({ base, name, slot, community }: { base: string; name: string; slot: keyof typeof SLOT_LABELS; community: CommunityPicks | null }) {
  const groups = spellOptions(base, community)
  if (!groups.length) return null
  const builds = communityBuilds(base, community)
  return (
    <div className="skill-row">
      <span className="item-cell skill-item" title={`${SLOT_LABELS[slot]}: ${name}`}>
        <ItemIcon id={iconId(base)} size={28} />
        <span>
          {name}
          {community && <small className="muted">{builds ? `${builds} community builds` : 'no community builds'}</small>}
        </span>
      </span>
      <span className="skill-groups">
        {groups.map((g) => (
          <span key={g.key} className="skill-group">
            <span className="skill-key">{KEY_LABELS[g.key]}</span>
            {g.options.map((o, i) => (
              <SpellIcon key={o.spell.id} spell={o.spell} picked={builds ? o.picked : null} top={i === 0 && !!o.picked} />
            ))}
          </span>
        ))}
      </span>
    </div>
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
  const w = summary.weapons[r.weapon.base]
  const brackets = r.brackets.filter((b) => b.wins + b.losses > 0)
  const perf = performanceOf(w)
  const { strong, weak } = matchupsOf(w)
  const areas = areasOf(w)
  const extras = (['Potion', 'Food', 'Mount'] as const).map((slot) => ({ slot, items: extrasOf(w, slot) })).filter((e) => e.items.length)
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

      <h4 className="detail-head">Skills</h4>
      <p className="hint skills-note">
        {community
          ? 'Hover or tap a skill for what it does. Percentages are how often community builds on Albion Free Market pick it (the killboard doesn’t record skills).'
          : 'Hover or tap a skill for what it does.'}
      </p>
      <div className="skills">
        <Skills base={r.weapon.base} name={r.weapon.name} slot="MainHand" community={community} />
        {r.best?.gear.map((g) => <Skills key={g.slot} base={g.base} name={g.name} slot={g.slot} community={community} />)}
      </div>

      {r.best && (
        <>
          <h4 className="detail-head">Also worn</h4>
          <table className="breakdown set">
            <tbody>
              {r.best.gear.map((g) => {
                const others = alternatives(r.weapon, summary, g.slot).filter((a) => a.item.base !== g.base)
                return others.length ? (
                  <tr key={g.slot}>
                    <td>
                      <span className="slot">{SLOT_LABELS[g.slot]}</span>
                    </td>
                    <td className="hint">
                      {others
                        .slice(0, 3)
                        .map((a) => `${a.item.name} ${formatPercent(a.share, 0)}`)
                        .join(', ')}
                    </td>
                  </tr>
                ) : null
              })}
              {extras.map((e) => (
                <tr key={e.slot}>
                  <td>
                    <span className="slot">{e.slot}</span>
                  </td>
                  <td className="hint">
                    <span className="extras">
                      {e.items.map((it) => (
                        <span key={it.icon} className="item-cell">
                          <ItemIcon id={it.icon} size={24} />
                          {it.name} {formatPercent(it.share, 0)}
                        </span>
                      ))}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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
