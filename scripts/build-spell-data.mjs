// Builds src/data/spells.json: the skills and passives each weapon, helmet, armour, pair of shoes
// and cape can take, with their English name, description, cooldown and energy cost, from the
// game's data (github.com/ao-data/ao-bin-dumps).
// Usage: node scripts/build-spell-data.mjs [items.json] [spells.json] [localization.json]
// With no arguments it downloads all three (localization.json is about 90 MB).
import { readFile, writeFile } from 'node:fs/promises'

const DUMP = 'https://raw.githubusercontent.com/ao-data/ao-bin-dumps/master'
const OUT = new URL('../src/data/spells.json', import.meta.url)
// Slot type in the item data → slot name used by the builds tracker.
const SLOTS = { mainhand: 'MainHand', head: 'Head', armor: 'Armor', shoes: 'Shoes', cape: 'Cape' }
// The key each active skill sits on: weapons fill Q, W and E; armour pieces have one fixed key.
const WEAPON_KEYS = { 1: 'Q', 2: 'W', 3: 'E' }
const GEAR_KEYS = { Head: 'D', Armor: 'R', Shoes: 'F' }
const KEY_ORDER = ['Q', 'W', 'E', 'D', 'R', 'F', 'P']
// Always-on helpers listed with armour that nobody picks.
const IGNORED = new Set(['OUTOFCOMBATHEAL'])

async function load(pathOrUrl) {
  if (pathOrUrl.startsWith('http')) {
    const res = await fetch(pathOrUrl)
    if (!res.ok) throw new Error(`${pathOrUrl}: ${res.status}`)
    return res.json()
  }
  return JSON.parse(await readFile(pathOrUrl, 'utf8'))
}

const list = (x) => (x === undefined || x === null ? [] : Array.isArray(x) ? x : [x])

const [itemsArg = `${DUMP}/items.json`, spellsArg = `${DUMP}/spells.json`, locArg = `${DUMP}/localization.json`] =
  process.argv.slice(2)
const items = (await load(itemsArg)).items
const spellData = (await load(spellsArg)).spells

const loc = new Map()
for (const tu of list((await load(locArg)).tmx.body.tu)) {
  const en = list(tu.tuv).find((v) => v['@xml:lang'] === 'EN-US')
  if (en?.seg) loc.set(tu['@tuid'], en.seg)
}

const spells = new Map()
const passives = new Set()
for (const s of list(spellData.activespell)) spells.set(s['@uniquename'], s)
for (const s of list(spellData.togglespell)) spells.set(s['@uniquename'], s)
for (const s of list(spellData.passivespell)) {
  spells.set(s['@uniquename'], s)
  passives.add(s['@uniquename'])
}

const ALIASES = { channeling: 'channelingspell' }

/** The value under `key` in `node` or, failing that, in the nearest nested object that has it. */
function find(node, key) {
  const queue = [node]
  while (queue.length) {
    const n = queue.shift()
    if (n == null || typeof n !== 'object') continue
    if (!Array.isArray(n)) {
      const v = n[key] ?? n[`@${key}`]
      if (v !== undefined) return v
    }
    queue.push(...Object.values(n))
  }
  return undefined
}

/** A field, or one worked out from others: totals over time and the ends of a range like "0-3". */
function field(node, key) {
  const v = find(node, key)
  if (v !== undefined) return v
  if (ALIASES[key]) return find(node, ALIASES[key])
  const holder = list(node)[0]
  const count = Number(find(holder, 'count') ?? find(holder, 'effectcount'))
  if (key === 'totalchange') return Number(find(holder, 'change')) * count
  if (key === 'totalduration' || key === 'time') return Number(find(holder, 'interval') ?? find(holder, 'effectinterval')) * count
  const end = /^(\w+?)_(start|min|max|end)$/.exec(key)
  if (end) {
    const range = String(find(node, end[1]) ?? '').split('-').filter(Boolean)
    return end[2] === 'start' || end[2] === 'min' ? range[0] : range[range.length - 1]
  }
  return undefined
}

/** Follows a path like "buffovertime[0].value" from a spell node; lists without an index use their first entry. */
function walk(node, path) {
  for (const part of path.split('.')) {
    const m = /^(\w+)(?:\[(\d+)\])?$/.exec(part)
    if (!m || node == null || typeof node !== 'object') return undefined
    if (Array.isArray(node)) node = node[0]
    let v = field(node, m[1])
    if (m[2] !== undefined) v = list(v)[Number(m[2])]
    node = v
  }
  return Array.isArray(node) ? node[0] : node
}

/** A reference's value as shown in a tooltip: times in seconds, fractions as percentages. */
function format(value, path) {
  if (value === undefined || typeof value === 'object') return null
  const n = Number(String(value).replace(/^A .*/, ''))
  if (!Number.isFinite(n) || String(value).trim() === '') return null
  const last = path.split('.').pop()
  if (/time|duration|delay|interval/i.test(last)) return `${+n.toFixed(2)}s`
  if (!Number.isInteger(n) && Math.abs(n) < 1) return `${+(Math.abs(n) * 100).toFixed(1)}%`
  return String(+Math.abs(n).toFixed(1))
}

/** Resolves "$$OTHER_SPELL.path$" or "$path$" (relative to `own`). */
function resolve(tag, own) {
  const other = /^\$\$([^.$]+)\.([^$]+)\$$/.exec(tag)
  if (other) return format(walk(spells.get(other[1]), other[2]), other[2])
  const self = /^\$([^$]+)\$$/.exec(tag)
  return self ? format(walk(own, self[1]), self[1]) : null
}

/** Tooltip text: placeholders filled in, colour tags dropped. Unknown values read as "…". */
function describe(spell) {
  const name = spell['@uniquename']
  const tag =
    spell['@descriptionlocatag'] ??
    (loc.has(`@SPELLS_${name}_DESC`) ? `@SPELLS_${name}_DESC` : `${spell['@namelocatag'] ?? `@SPELLS_${name}`}_DESC`)
  let text = loc.get(tag)
  if (!text) return ''
  const refs = list(spell.locareferences?.description?.locareference).map((r) => resolve(r['@tag'], spell))
  text = text.replace(/\{(\d+)\}/g, (_, i) => refs[Number(i)] ?? '…')
  text = text.replace(/\$\$?[^$\s]+\$/g, (t) => resolve(t, spell) ?? '…').replace(/\$\$?[^$]*\$/g, '…')
  return text
    .replace(/\[#\] ?/g, '')
    .replace(/\[\/?[a-z]+\]/gi, '')
    .replace(/[ \t]+\n/g, '\n')
    .trim()
}

function spellName(spell) {
  const name = spell['@uniquename']
  return loc.get(spell['@namelocatag'] ?? `@SPELLS_${name}`) ?? loc.get(`@SPELLS_${name}`) ?? null
}

// Items list their spells directly, or point at another item's list and then remove some and add
// their own (artifact weapons swap in their unique E this way).
const byId = new Map()
for (const item of [...list(items.weapon), ...list(items.transformationweapon), ...list(items.equipmentitem)]) {
  byId.set(item['@uniquename'], item)
}
function spellList(item, depth = 0) {
  const own = list(item.craftingspelllist?.craftspell)
  const ref = item.craftingspelllist?.['@reference']
  if (!ref || depth >= 5 || !byId.has(ref)) return own
  const removed = new Set(list(item.craftingspelllist.removespell).map((r) => r['@uniquename']))
  return [...spellList(byId.get(ref), depth + 1).filter((c) => !removed.has(c['@uniquename'])), ...own]
}

const outSpells = {}
const outItems = {}
for (const item of byId.values()) {
  const slot = SLOTS[item['@slottype']]
  if (!slot || !item.craftingrequirements) continue
  const base = item['@uniquename'].replace(/^T\d_/, '').replace(/@\d+$/, '')
  // Tiers can list different spells (lower tiers fewer), so each item line gets them all.
  const entries = (outItems[base] ??= [])
  for (const c of spellList(item)) {
    const id = c['@uniquename']
    if (IGNORED.has(id) || entries.some((e) => e[0] === id)) continue
    const spell = spells.get(id)
    const name = spell && spellName(spell)
    if (!name) continue
    const passive = passives.has(id)
    const key = passive ? 'P' : slot === 'MainHand' ? WEAPON_KEYS[c['@slots']] : GEAR_KEYS[slot]
    // Out-of-combat heals and other always-on helpers have no key and nobody picks them.
    if (!key) continue
    entries.push([id, key])
    if (!outSpells[id]) {
      outSpells[id] = {
        name,
        desc: describe(spell),
        ...(spell['@recastdelay'] && Number(spell['@recastdelay']) > 0 ? { cd: Number(spell['@recastdelay']) } : {}),
        ...(spell['@energyusage'] && Number(spell['@energyusage']) > 0 ? { energy: Number(spell['@energyusage']) } : {}),
      }
    }
  }
}
for (const [base, entries] of Object.entries(outItems)) {
  if (!entries.length) delete outItems[base]
  else entries.sort((a, b) => KEY_ORDER.indexOf(a[1]) - KEY_ORDER.indexOf(b[1]))
}

// Names of the potions, food, mounts and bags worn with each weapon, as [name, tier] from their
// highest tier (the tier the icon is drawn at).
const TIER_PREFIX = /^(Beginner's|Novice's|Journeyman's|Adept's|Expert's|Master's|Grandmaster's|Elder's) /
const EXTRA_SLOTS = new Set(['potion', 'food', 'mount', 'bag'])
const names = {}
const nameTier = {}
for (const item of [...list(items.consumableitem), ...list(items.mount), ...list(items.equipmentitem)]) {
  const id = item['@uniquename']
  if (!EXTRA_SLOTS.has(item['@slottype'])) continue
  const name = loc.get(`@ITEMS_${id}`)
  // Untiered items (UNIQUE_MOUNT_…) keep their whole id; tier 0 marks them.
  const tier = /^T\d+_/.test(id) ? Number(item['@tier'] ?? 0) : 0
  const base = id.replace(/^T\d+_/, '')
  if (!name || (nameTier[base] ?? -1) > tier) continue
  names[base] = [name.replace(TIER_PREFIX, ''), tier]
  nameTier[base] = tier
}

await writeFile(OUT, JSON.stringify({ source: DUMP, spells: outSpells, items: outItems, names }) + '\n')
const missing = Object.values(outSpells).filter((s) => !s.desc).length
console.log(
  `Wrote ${Object.keys(outSpells).length} spells for ${Object.keys(outItems).length} items to ${OUT.pathname} (${missing} without a description)`,
)
