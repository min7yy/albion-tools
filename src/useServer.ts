import { DEFAULT_SERVER, isServerId, type ServerId } from './api/servers'
import { useStoredState } from './useStoredState'

/** The selected game server, remembered between visits. */
export function useServer(): [ServerId, (s: ServerId) => void] {
  return useStoredState<ServerId>('albion-tools.server', DEFAULT_SERVER, (saved) =>
    isServerId(saved) ? saved : DEFAULT_SERVER,
  )
}
