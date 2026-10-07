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

## Layout

- `src/api/servers.ts` – the three servers and their API hosts
- `src/api/prices.ts` – price fetcher (batching, normalisation of missing prices/dates)
- `src/api/items.ts` – resource item ids (ore, hide, fiber, wood, stone and refined goods)
- `src/App.tsx` – server switch and a price check table

## UI conventions

The app is dark mode only. Colours are CSS variables on `:root` in `src/index.css`; new pages should use those tokens rather than hard-coded colours.
