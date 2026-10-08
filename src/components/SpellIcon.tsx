import type { Spell } from '../buildguide/spells'
import { formatPercent } from '../format'
import { Tooltip } from './Tooltip'

/** A skill icon from the official render service with a hover card: name, cost, cooldown and description. */
export function SpellIcon({ spell, picked, size = 32, top = false }: { spell: Spell; picked: number | null; size?: number; top?: boolean }) {
  return (
    <Tooltip
      label={spell.name}
      content={
        <>
          <strong className="tip-title">{spell.name}</strong>
          {(spell.cd || spell.energy) && (
            <span className="tip-meta">
              {[spell.energy && `${spell.energy} energy`, spell.cd && `${spell.cd}s cooldown`].filter(Boolean).join(' · ')}
            </span>
          )}
          <span className="tip-desc">{spell.desc}</span>
          {picked !== null && <span className="tip-meta">Picked in {formatPercent(picked, 0)} of community builds</span>}
        </>
      }
    >
      <span className={`spell${top ? ' top-pick' : ''}${picked === 0 ? ' unpicked' : ''}`}>
        <img
          src={`https://render.albiononline.com/v1/spell/${encodeURIComponent(spell.id)}.png?size=${size * 2}`}
          width={size}
          height={size}
          alt=""
          loading="lazy"
          onError={(e) => (e.currentTarget.style.visibility = 'hidden')}
        />
        {picked !== null && picked > 0 && <small className="pick-share">{formatPercent(picked, 0)}</small>}
      </span>
    </Tooltip>
  )
}
