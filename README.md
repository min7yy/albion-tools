# Albion Tools

Market analysis tools for Albion Online, starting with a refining profit calculator.
Prices come from the [Albion Online Data Project](https://www.albion-online-data.com/) API,
fetched directly from the browser, with a switch for the Americas, Europe and Asia servers.

Stack: Vite + React + TypeScript, Vitest for tests. It builds to a static site.

```sh
npm install
npm run dev     # local dev server
npm test        # unit tests
npm run build   # static build in dist/
```

## Hosting

Every push to `main` is tested, built and deployed to GitHub Pages by
`.github/workflows/deploy.yml`: https://min7yy.github.io/albion-tools/
Pull requests run lint, tests and a build (`.github/workflows/ci.yml`).

## Layout

- `src/api/servers.ts` – the three servers and their API hosts
- `src/api/prices.ts` – price fetcher (batching, normalisation of missing prices/dates)
- `src/api/items.ts` – resource item ids (ore, hide, fiber, wood, stone and refined goods)
- `src/refining/recipes.ts` – refining recipes for every resource, tier (T2–T8) and enchantment
- `src/refining/settings.ts` – return rate, focus, station fee and market tax settings
- `src/refining/profit.ts` – profit per refined item with a full cost breakdown
- `src/refining/rank.ts` – evaluates every recipe in every royal city, then filters and sorts
- `src/profit.ts` – shared profit engine (returns, station fee, tax) used by refining and crafting
- `src/crafting/` – crafting recipes, evaluation and ranking
- `src/flips/` – flip finder: buy in one market, sell in another or to the Black Market
- `src/buildguide/` – build guide engine: cheapest version of each weapon by item power per silver, under a budget
- `src/data/crafting.json` – generated recipe data; rebuild with `node scripts/build-crafting-data.mjs`
- `src/data/weapons.json` – generated weapon item power data; rebuild with `node scripts/build-weapon-data.mjs`
- `src/components/` – settings panel, filters, ranked tables and cost breakdown
- `src/pages/` – the Refining, Crafting, Flips and Build guide pages
- `src/App.tsx` – header, page tabs and server switch

## UI conventions

The app is dark mode only. Colours are CSS variables on `:root` in `src/index.css`; new pages should use those tokens rather than hard-coded colours.
