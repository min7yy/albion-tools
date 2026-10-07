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
- `src/components/` – settings panel, filters, ranked table and cost breakdown
- `src/App.tsx` – the refining page and server switch

## UI conventions

The app is dark mode only. Colours are CSS variables on `:root` in `src/index.css`; new pages should use those tokens rather than hard-coded colours.
