import { DEFAULT_SERVER, isServerId, type ServerId } from '../api/servers'
import { OPENED_WITH } from '../lib/shareLink'
import { useStoredState } from './useStoredState'

/** The selected game server, remembered between visits. A share link's server wins. */
export function useServer(): [ServerId, (s: ServerId) => void] {
  const linked = OPENED_WITH.params.get('server')
  const fromLink = isServerId(linked) ? linked : null
  return useStoredState<ServerId>('albion-tools.server', fromLink ?? DEFAULT_SERVER, (saved) =>
    fromLink ?? (isServerId(saved) ? saved : DEFAULT_SERVER),
  )
}
