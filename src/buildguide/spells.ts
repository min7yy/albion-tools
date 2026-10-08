import data from '../data/spells.json'
import type { CommunityPicks } from '../meta/community'

/** The key a skill sits on: Q, W and E on weapons, D/R/F on helmet, armour and shoes, P for passives. */
export type SpellKey = 'Q' | 'W' | 'E' | 'D' | 'R' | 'F' | 'P'

/** One skill or passive, as stored in src/data/spells.json (see scripts/build-spell-data.mjs). */
export interface Spell {
  id: string
  name: string
  /** English tooltip text from the game, with base values filled in. */
  desc: string
  /** Cooldown in seconds. */
  cd?: number
  energy?: number
  /** What an active skill is for, from the game's tooltip type; passives have none. */
  kind?: SpellKind
}

export type SpellKind = 'damage' | 'control' | 'mobility' | 'heal' | 'buff' | 'debuff'

export const KIND_LABELS: Record<SpellKind, string> = {
  damage: 'Damage',
  control: 'Crowd control',
  mobility: 'Mobility',
  heal: 'Healing',
  buff: 'Buff',
  debuff: 'Debuff',
}

const typed = data as unknown as {
  spells: Record<string, Omit<Spell, 'id'>>
  items: Record<string, [string, SpellKey][]>
  names: Record<string, [string, number]>
}

export const KEY_LABELS: Record<SpellKey, string> = {
  Q: 'Q',
  W: 'W',
  E: 'E',
  D: 'D',
  R: 'R',
  F: 'F',
  P: 'Passive',
}

/** A skill option on an item, with its share of community builds that pick it. */
export interface SpellOption {
  spell: Spell
  /** Share of community builds with this item that take this skill; null without community data. */
  picked: number | null
}

/** Builds an item or weapon needs before community picks are shown: one build is one person's opinion. */
export const MIN_COMMUNITY_BUILDS = 2

/** An item's skill options grouped by key, in key order, most picked first within each key. */
export function spellOptions(base: string, community: CommunityPicks | null): { key: SpellKey; options: SpellOption[] }[] {
  const entries = typed.items[base] ?? []
  const counts = community?.items[base]
  const groups: { key: SpellKey; options: SpellOption[] }[] = []
  for (const [id, key] of entries) {
    const spell = typed.spells[id]
    if (!spell) continue
    let group = groups.find((g) => g.key === key)
    if (!group) groups.push((group = { key, options: [] }))
    const picked = counts && counts[0] >= MIN_COMMUNITY_BUILDS ? (counts[1][id] ?? 0) / counts[0] : null
    group.options.push({ spell: { id, ...spell }, picked })
  }
  for (const g of groups) g.options.sort((a, b) => (b.picked ?? 0) - (a.picked ?? 0))
  return groups
}

/** Community builds counted for an item (0 when fewer than MIN_COMMUNITY_BUILDS use it). */
export function communityBuilds(base: string, community: CommunityPicks | null): number {
  const n = community?.items[base]?.[0] ?? 0
  return n >= MIN_COMMUNITY_BUILDS ? n : 0
}

/** Name and icon id of a potion, food, mount or bag base, e.g. POTION_HEAL → Major Healing Potion. */
export function extraItem(base: string): { name: string; icon: string } | null {
  const entry = typed.names[base]
  return entry ? { name: entry[0], icon: entry[1] ? `T${entry[1]}_${base}` : base } : null
}
