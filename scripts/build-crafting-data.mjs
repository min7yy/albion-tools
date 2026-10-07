// Builds src/data/crafting.json from the game's item data (github.com/ao-data/ao-bin-dumps).
// Usage: node scripts/build-crafting-data.mjs [items.json] [formatted/items.json] [craftingmodifiers.json]
// With no arguments it downloads all three files.
import { readFile, writeFile } from 'node:fs/promises'

const DUMP = 'https://raw.githubusercontent.com/ao-data/ao-bin-dumps/master'
const OUT = new URL('../src/data/crafting.json', import.meta.url)
const SECTIONS = ['weapon', 'equipmentitem']
const SKIP_CATEGORIES = new Set(['vanity', 'other'])
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

/** AODP item id: enchanted items and resources carry an @N suffix. */
function marketId(name, ench) {
  const n = Number(ench || 0)
  if (!n) return name
  return `${name}@${n}`
}

// Market cities by the cluster id craftingmodifiers.json uses.
const CITY_CLUSTERS = {
  '0000': 'Thetford',
  1000: 'Lymhurst',
  2000: 'Bridgewatch',
  3004: 'Martlock',
  4000: 'Fort Sterling',
  3003: 'Caerleon',
  5000: 'Brecilien',
}

const [
  itemsArg = `${DUMP}/items.json`,
  namesArg = `${DUMP}/formatted/items.json`,
  modifiersArg = `${DUMP}/craftingmodifiers.json`,
] = process.argv.slice(2)
const items = (await load(itemsArg)).items
const names = new Map((await load(namesArg)).map((n) => [n.UniqueName, n.LocalizedNames?.['EN-US']]))

// Item values of every ingredient, used for station fees (nutrition = 11.25% of item value).
const values = new Map()
for (const section of Object.values(items)) {
  for (const item of list(section)) {
    if (item && typeof item === 'object' && item['@uniquename'] && item['@itemvalue']) {
      values.set(item['@uniquename'], Number(item['@itemvalue']))
    }
  }
}
function valueOf(name, ench) {
  const base = name.replace(/_LEVEL\d$/, '')
  const v = values.get(name) ?? values.get(base)
  if (v === undefined) return 0
  return values.has(name) ? v : v * 2 ** Number(ench || 0)
}

function toRecipe(item, req, ench) {
  const resources = list(req.craftresource).map((r) => ({
    id: marketId(r['@uniquename'], r['@enchantmentlevel']),
    count: Number(r['@count']),
    noReturn: r['@maxreturnamount'] === '0' ? 1 : 0,
    value: valueOf(r['@uniquename'], r['@enchantmentlevel']),
  }))
  // Skip recipes that need tokens or items no market sells (faction hearts, quest items).
  if (resources.some((r) => /TOKEN|FACTION|QUESTITEM/.test(r.id))) return null
  const id = marketId(item['@uniquename'], ench)
  const fullName = names.get(id) ?? names.get(item['@uniquename']) ?? item['@uniquename']
  return {
    id,
    base: item['@uniquename'].replace(/^T\d_/, ''),
    tier: Number(item['@tier']),
    ench: Number(ench),
    name: fullName.replace(TIER_PREFIX, ''),
    category: item['@shopcategory'],
    sub: item['@shopsubcategory1'],
    craft: item['@craftingcategory'],
    amount: Number(req['@amountcrafted'] || 1),
    focus: Number(req['@craftingfocus'] || 0),
    itemValue: resources.reduce((sum, r) => sum + r.value * r.count, 0),
    resources: resources.map(({ id, count, noReturn }) => (noReturn ? [id, count, 1] : [id, count])),
  }
}

const recipes = []
for (const section of SECTIONS) {
  for (const item of list(items[section])) {
    if (SKIP_CATEGORIES.has(item['@shopcategory'])) continue
    const base = list(item.craftingrequirements).map((req) => toRecipe(item, req, 0)).find(Boolean)
    if (!base) continue
    recipes.push(base)
    for (const e of list(item.enchantments?.enchantment)) {
      const r = list(e.craftingrequirements).map((req) => toRecipe(item, req, e['@enchantmentlevel'])).find(Boolean)
      if (r) recipes.push(r)
    }
  }
}

recipes.sort((a, b) => a.base.localeCompare(b.base) || a.tier - b.tier || a.ench - b.ench)

// Names for ingredients that aren't plain resources (artifacts, hearts and so on).
const RESOURCE = /^T\d_(ORE|HIDE|FIBER|WOOD|ROCK|METALBAR|LEATHER|CLOTH|PLANKS|STONEBLOCK)(_LEVEL\d@\d)?$/
const ingredientNames = {}
for (const r of recipes) {
  for (const [id] of r.resources) {
    if (!RESOURCE.test(id) && !(id in ingredientNames)) ingredientNames[id] = names.get(id) ?? id
  }
}

// City crafting specialties: extra production bonus (in %) per crafting category, e.g. swords in Lymhurst.
const cityBonuses = {}
for (const loc of list((await load(modifiersArg)).craftingmodifiers.craftinglocation)) {
  const city = CITY_CLUSTERS[loc['@clusterid']]
  if (!city) continue
  cityBonuses[city] = Object.fromEntries(
    list(loc.craftingmodifier).map((m) => [m['@name'], Math.round(Number(m['@value']) * 100)]),
  )
}

await writeFile(OUT, JSON.stringify({ source: DUMP, recipes, ingredientNames, cityBonuses }) + '\n')
console.log(`Wrote ${recipes.length} recipes to ${OUT.pathname}`)
