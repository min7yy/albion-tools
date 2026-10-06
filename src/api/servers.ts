export type ServerId = 'americas' | 'europe' | 'asia'

export interface Server {
  id: ServerId
  label: string
  /** Base URL of the Albion Online Data Project API for this server. */
  apiBase: string
}

export const SERVERS: Server[] = [
  { id: 'americas', label: 'Americas', apiBase: 'https://west.albion-online-data.com' },
  { id: 'europe', label: 'Europe', apiBase: 'https://europe.albion-online-data.com' },
  { id: 'asia', label: 'Asia', apiBase: 'https://east.albion-online-data.com' },
]

export const DEFAULT_SERVER: ServerId = 'americas'

export function getServer(id: ServerId): Server {
  const server = SERVERS.find((s) => s.id === id)
  if (!server) throw new Error(`Unknown server: ${id}`)
  return server
}

export function isServerId(value: unknown): value is ServerId {
  return SERVERS.some((s) => s.id === value)
}
