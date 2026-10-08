# Albion Tools

Market and build tools for Albion Online: refining and crafting profit, market flips, and a build
guide drawn from recent kills. Live at https://min7yy.github.io/albion-tools/, with a switch for
the Americas, Europe and Asia servers. The app is dark mode only.

Stack: Vite + React + TypeScript, Vitest for tests, oxlint. It builds to a static site.

```sh
npm install
npm run dev     # local dev server
npm test        # unit tests
npm run lint
npm run build   # static build in dist/
```

## Data sources

- **Prices** come from the [Albion Online Data Project](https://www.albion-online-data.com/) API,
  fetched from the browser (refining, crafting and flips).
- **Kills** come from the official gameinfo API. `.github/workflows/meta.yml` runs
  `scripts/collect-meta.ts` nonstop (50-minute runs that start the next one) and force-pushes a
  rolling week to the `meta-data` branch: `<server>.json` (the summary the Build guide loads) and
  `<server>-state.json` (per-day counts carried between runs).
- **Community skill picks** come from Albion Free Market builds, collected daily by
  `scripts/collect-community.ts` into `meta-data/community.json`.
- **Game data** (recipes, item names, skills) is generated from
  [ao-bin-dumps](https://github.com/ao-data/ao-bin-dumps) into `src/data/` by the
  `scripts/build-*-data.mjs` scripts; rerun them after a game patch.

## Layout

Each tool is a folder holding its logic, its page and the components only it uses:

- `src/refining/` – recipes, settings, profit and ranking, plus `RefiningPage`
- `src/crafting/` – recipe data, evaluation and ranking, plus `CraftingPage`
- `src/flips/` – flip finder, plus `FlipsPage`
- `src/buildguide/` – best sets per weapon and item power, skills, matchups, plus `BuildGuidePage`
- `src/meta/` – kill and community-build counting, shared by the collector scripts and the site

Shared code:

- `src/api/` – servers, cities and the price and history fetchers
- `src/lib/` – the profit engine (returns, station fee, tax), formatting and share links
- `src/hooks/` – stored settings, linked filters, price and sales fetching, routing
- `src/components/` – UI used by more than one page (settings panel, cost breakdown, tooltips)
- `src/App.tsx` – header, page tabs and server switch; pages load lazily

## Hosting

Every push to `main` is tested, built and deployed to GitHub Pages by
`.github/workflows/deploy.yml`. Pull requests run lint, tests and a build (`ci.yml`).

## UI conventions

Colours are CSS variables on `:root` in `src/index.css`; new pages use those tokens rather than
hard-coded colours.
