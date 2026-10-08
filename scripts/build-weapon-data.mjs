// Builds src/data/weapons.json and src/data/gear.json (name, type and slot of every craftable
// weapon, off-hand, helmet, armour, pair of shoes and cape) from the game's item data
// (github.com/ao-data/ao-bin-dumps).
// Usage: node scripts/build-weapon-data.mjs [items.json] [formatted/items.json]
// With no arguments it downloads both files.
import { readFile, writeFile } from 'node:fs/promises'

const DUMP = 'https://raw.githubusercontent.com/ao-data/ao-bin-dumps/master'
const OUT = new URL('../src/data/weapons.json', import.meta.url)
const GEAR_OUT = new URL('../src/data/gear.json', import.meta.url)
// Gear slot type in the item data → slot name used by the builds tracker.
const GEAR_SLOTS = { offhand: 'OffHand', head: 'Head', armor: 'Armor', shoes: 'Shoes', cape: 'Cape' }
const TIER_PREFIX = /^(Beginner's|Novice's|Journeyman's|Adept's|Expert's|Master's|Grandmaster's|Elder's) /

async function load(pathOrUrl) {
  if (pathOrUrl.startsWith('http')) {
    const res = await fetch(pathOrUrl)
    if (!res.ok) throw new Error(`${pathOrUrl}: ${res.status}`)
    return res.json()
  }
  return JSON.parse(await readFile(pathOrUrl, 'utf8'))
}

const list = (x) => (x === undefined ? [] : Array.isArray(x) ? x : [x])

const [itemsArg = `${DUMP}/items.json`, namesArg = `${DUMP}/formatted/items.json`] = process.argv.slice(2)
const items = (await load(itemsArg)).items
const names = new Map((await load(namesArg)).map((n) => [n.UniqueName, n.LocalizedNames?.['EN-US']]))

// Weapons are grouped by their id without the tier prefix.
const weapons = new Map()
// Shapeshifter staffs live in their own section.
for (const item of [...list(items.weapon), ...list(items.transformationweapon)]) {
  const id = item['@uniquename']
  // Only craftable weapons are traded on the market (this skips quest, event and starter items).
  if (item['@shopcategory'] !== 'weapons' || !item.craftingrequirements || !item['@itempower']) continue
  const base = id.replace(/^T\d_/, '')
  if (!weapons.has(base)) {
    weapons.set(base, {
      base,
      name: (names.get(id) ?? id).replace(TIER_PREFIX, ''),
      sub: item['@shopsubcategory1'],
      twoHanded: item['@twohanded'] === 'true',
    })
  }
}

const out = [...weapons.values()].sort((a, b) => a.sub.localeCompare(b.sub) || a.name.localeCompare(b.name))

await writeFile(OUT, JSON.stringify({ source: DUMP, weapons: out }) + '\n')
console.log(`Wrote ${out.length} weapons to ${OUT.pathname}`)

// Gear: same shape, keyed by slot instead of weapon type.
const gear = new Map()
for (const item of list(items.equipmentitem)) {
  const id = item['@uniquename']
  const slot = GEAR_SLOTS[item['@slottype']]
  if (!slot || !item.craftingrequirements || !item['@itempower']) continue
  const base = id.replace(/^T\d_/, '')
  if (!gear.has(base)) gear.set(base, { base, name: (names.get(id) ?? id).replace(TIER_PREFIX, ''), slot })
}
const gearOut = [...gear.values()].sort((a, b) => a.slot.localeCompare(b.slot) || a.base.localeCompare(b.base))
await writeFile(GEAR_OUT, JSON.stringify({ source: DUMP, gear: gearOut }) + '\n')
console.log(`Wrote ${gearOut.length} gear items to ${GEAR_OUT.pathname}`)
