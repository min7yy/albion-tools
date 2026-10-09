import type { CommunityPicks } from '../meta/community'
import type { FightSize } from '../meta/aggregate'
import { SLOT_LABELS } from './gear'
import type { WeaponRow } from './loadouts'
import { ROLES, weaponRole } from './weapons'
import { spellOptions, type Spell, type SpellKey } from './spells'

/** Fights at a size before the guide says how the weapon does there. */
const GUIDE_MIN_FIGHTS = 20

const SIZE_WORDS: Record<FightSize, string> = { s: 'solo', m: 'small-group (2–5)', l: 'large (6+)' }

/** The skill picked on one key of one piece, with the share of community builds behind it. */
interface GuideSkill {
  key: SpellKey
  spell: Spell
  picked: number
}

/** One piece of the set and what to do with it: its recommended skills, or the options when none is clear. */
interface GuidePiece {
  slot: keyof typeof SLOT_LABELS
  base: string
  name: string
  skills: GuideSkill[]
  /** Keys with no recommendation yet (too few upvoted builds), with their options. */
  open: { key: SpellKey; options: Spell[] }[]
}

export interface Guide {
  /** Plain sentences on where the weapon wins and how its kit fits together. */
  lines: string[]
  pieces: GuidePiece[]
}

/** Tooltips run long; the summary keeps whole sentences up to about this many characters. */
const SUMMARY_CHARS = 200

/**
 * The opening of a tooltip for the one-line summaries: whole sentences until it says something
 * (skipping lead-ins like "Condition:"), cut at a sentence end near SUMMARY_CHARS.
 */
export function summarize(text: string): string {
  const sentences = text
    .replace(/\s*\n+\s*/g, ' ')
    .split(/(?<=[.!?])\s+/)
    .map((x) => x.trim())
    .filter(Boolean)
  let out = ''
  for (const sentence of sentences) {
    if (out && out.length + sentence.length > SUMMARY_CHARS) break
    out = out ? `${out} ${sentence}` : sentence
    if (out.length >= 60 && !out.endsWith(':')) break
  }
  return out.length > SUMMARY_CHARS + 60 ? `${out.slice(0, SUMMARY_CHARS).replace(/\s+\S*$/, '')}…` : out
}

function piece(slot: GuidePiece['slot'], base: string, name: string, community: CommunityPicks | null): GuidePiece {
  const skills: GuideSkill[] = []
  const open: GuidePiece['open'] = []
  for (const g of spellOptions(base, community)) {
    const top = g.options[0]
    if (g.options.length === 1) skills.push({ key: g.key, spell: top.spell, picked: top.picked ?? 1 })
    else if (top.picked) skills.push({ key: g.key, spell: top.spell, picked: top.picked })
    else open.push({ key: g.key, options: g.options.map((o) => o.spell) })
  }
  return { slot, base, name, skills, open }
}

const list = (names: string[]) =>
  names.length <= 1 ? (names[0] ?? '') : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`

/**
 * A short how-to-play for a weapon's best set, built only from data: where it wins (kill data), and
 * what each recommended skill does (game files), grouped by what it's for.
 */
export function guideFor(row: WeaponRow, community: CommunityPicks | null): Guide {
  const pieces = [
    piece('MainHand', row.weapon.base, row.weapon.name, community),
    ...(row.best?.gear ?? []).map((g) => piece(g.slot, g.base, g.name, community)),
  ]
  const lines: string[] = []

  const role = ROLES.find((r) => r.id === weaponRole(row.weapon))!.label
  const sizes = (['s', 'm', 'l'] as const)
    .map((size) => {
      const [w, l] = row.bySize[size]
      return { size, fights: Math.round(w + l), rate: w + l ? w / (w + l) : 0 }
    })
    .filter((s) => s.fights >= GUIDE_MIN_FIGHTS)
    .sort((a, b) => b.rate - a.rate)
  const pct = (x: number) => `${Math.round(x * 100)}%`
  if (sizes.length >= 2) {
    const best = sizes[0]
    const worst = sizes[sizes.length - 1]
    lines.push(
      `${role} weapon that does best in ${SIZE_WORDS[best.size]} fights (${pct(best.rate)} over ${best.fights}) and worst in ${SIZE_WORDS[worst.size]} ones (${pct(worst.rate)} over ${worst.fights}).`,
    )
  } else if (sizes.length === 1) {
    lines.push(`${role} weapon, mostly seen in ${SIZE_WORDS[sizes[0].size]} fights (${pct(sizes[0].rate)} over ${sizes[0].fights}).`)
  } else {
    lines.push(`${role} weapon. Too few recent fights to say where it does best.`)
  }

  const actives = pieces.flatMap((p) => p.skills.filter((s) => s.key !== 'P').map((s) => ({ ...s, piece: p })))
  const named = (s: (typeof actives)[number]) => `${s.spell.name} (${s.key})`
  const of = (...kinds: Spell['kind'][]) => actives.filter((s) => kinds.includes(s.spell.kind))
  const control = of('control', 'debuff')
  const damage = of('damage')
  const mobility = of('mobility')
  if (control.length && damage.length) {
    lines.push(`Land ${list(control.map(named))} to set up, then deal damage with ${list(damage.map(named))}.`)
  } else if (damage.length) {
    lines.push(`Your damage comes from ${list(damage.map(named))}.`)
  } else if (control.length) {
    lines.push(`Your kit is control: ${list(control.map(named))}.`)
  }
  if (mobility.length) lines.push(`Keep ${list(mobility.map(named))} to engage or get out.`)
  const buffs = of('buff')
  const heals = of('heal')
  if (buffs.length) lines.push(`Time your buff${buffs.length > 1 ? 's' : ''}, ${list(buffs.map(named))}, for when the fight turns.`)
  if (heals.length) lines.push(`${list(heals.map(named))} ${heals.length > 1 ? 'heal or cleanse' : 'heals or cleanses'}.`)
  if (pieces.some((p) => p.open.length)) {
    lines.push('Keys without enough upvoted builds to recommend a skill list their options instead.')
  }
  return { lines, pieces }
}
