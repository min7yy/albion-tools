import { useEffect, useMemo, useState } from 'react'
import { SERVERS } from './api/servers'
import { ROYAL_CITIES } from './api/cities'
import { RESOURCES, itemId, type ResourceKind } from './api/items'
import { fetchPrices, indexPrices, type Price } from './api/prices'
import { useServer } from './useServer'

const CHECK_TIERS = [4, 5, 6, 7, 8]

function formatSilver(n: number | null): string {
  return n === null ? '–' : n.toLocaleString()
}

function formatAge(date: Date | null): string {
  if (!date) return ''
  const mins = Math.round((Date.now() - date.getTime()) / 60000)
  if (mins < 60) return `${mins}m ago`
  const hours = Math.round(mins / 60)
  return hours < 48 ? `${hours}h ago` : `${Math.round(hours / 24)}d ago`
}

export default function App() {
  const [server, setServer] = useServer()
  const [resource, setResource] = useState<ResourceKind>('ore')
  const [prices, setPrices] = useState<Price[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  const { raw, refined } = RESOURCES[resource]
  const items = useMemo(
    () => CHECK_TIERS.flatMap((t) => [itemId(t, raw), itemId(t, refined)]),
    [raw, refined],
  )

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    setError(null)
    fetchPrices({ server, items, locations: [...ROYAL_CITIES], signal: controller.signal })
      .then(setPrices)
      .catch((e: unknown) => {
        if (!controller.signal.aborted) setError(e instanceof Error ? e.message : String(e))
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })
    return () => controller.abort()
  }, [server, items, reloadKey])

  const byKey = useMemo(() => indexPrices(prices), [prices])

  return (
    <div className="app">
      <header>
        <h1>Albion Tools</h1>
        <div className="server-switch" role="radiogroup" aria-label="Server">
          {SERVERS.map((s) => (
            <button
              key={s.id}
              role="radio"
              aria-checked={server === s.id}
              className={server === s.id ? 'active' : ''}
              onClick={() => setServer(s.id)}
            >
              {s.label}
            </button>
          ))}
        </div>
      </header>

      <main>
        <section>
          <div className="toolbar">
            <h2>Price check</h2>
            <select value={resource} onChange={(e) => setResource(e.target.value as ResourceKind)}>
              {Object.entries(RESOURCES).map(([k, r]) => (
                <option key={k} value={k}>
                  {r.label}
                </option>
              ))}
            </select>
            <button onClick={() => setReloadKey((k) => k + 1)} disabled={loading}>
              {loading ? 'Loading…' : 'Refresh'}
            </button>
          </div>
          <p className="hint">
            Cheapest sell order per city, flat (.0) items, normal quality. Data from the Albion
            Online Data Project.
          </p>
          {error && <p className="error">{error}</p>}
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Item</th>
                  {ROYAL_CITIES.map((c) => (
                    <th key={c}>{c}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {items.map((id) => (
                  <tr key={id}>
                    <td className="item">{id}</td>
                    {ROYAL_CITIES.map((c) => {
                      const p = byKey.get(`${id}|${c}`)
                      return (
                        <td key={c} className="num">
                          {formatSilver(p?.sellMin ?? null)}
                          <span className="age">{formatAge(p?.sellMinDate ?? null)}</span>
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  )
}
