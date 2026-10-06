import { useEffect, useState } from 'react'
import { DEFAULT_SERVER, isServerId, type ServerId } from './api/servers'

const KEY = 'albion-tools.server'

function readSaved(): ServerId {
  try {
    const saved = localStorage.getItem(KEY)
    return isServerId(saved) ? saved : DEFAULT_SERVER
  } catch {
    return DEFAULT_SERVER
  }
}

/** The selected game server, remembered between visits. */
export function useServer(): [ServerId, (s: ServerId) => void] {
  const [server, setServer] = useState<ServerId>(readSaved)
  useEffect(() => {
    try {
      localStorage.setItem(KEY, server)
    } catch {
      // Storage unavailable (private window); the choice just won't persist.
    }
  }, [server])
  return [server, setServer]
}
