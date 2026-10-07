import { MoreOptions } from './MoreOptions'

const RELEASES = 'https://github.com/ao-data/albiondata-client/releases/latest'

interface Props {
  /** Per city, the items on screen priced from an older listing or an average. */
  needed: Map<string, string[]>
  /** Weapons with nothing for sale near the target at all. */
  unpriced: string[]
}

/** Folded-away steps for running the Albion Data Client, and what to look up in game to fill gaps. */
export function UploaderHelp({ needed, unpriced }: Props) {
  const count = [...needed.values()].reduce((n, list) => n + list.length, 0) + unpriced.length
  return (
    <MoreOptions title="Fill missing prices" summary={count ? `${count} to look up in game` : 'all prices current'}>
      <p className="hint">
        Prices come from players running the free Albion Data Client while they play: every market page you open is
        uploaded, and shows up here within minutes for everyone. Albion's developers allow it because it only reads
        traffic and changes nothing.
      </p>
      <ol className="help-steps">
        <li>
          Windows: install <a href="https://npcap.com/#download" target="_blank" rel="noreferrer">Npcap</a> and tick
          "WinPcap API-compatible Mode" during setup.
        </li>
        <li>
          Install the client from{' '}
          <a href={RELEASES} target="_blank" rel="noreferrer">
            its releases page
          </a>{' '}
          (Windows: albiondata-client-amd64-installer.exe; Mac: albiondata-client-amd64-mac.zip, then run.command).
        </li>
        <li>Leave it running while you play. It works out the server by itself.</li>
        <li>
          Optional, Windows: to start it with your PC, press Win+R, type <code>shell:startup</code> and copy the client's
          desktop shortcut into that folder.
        </li>
      </ol>
      {count > 0 && (
        <>
          <p className="hint">Open these in the city's market to refresh what the builds below are using:</p>
          <ul className="needed-prices">
            {[...needed].map(([city, items]) => (
              <li key={city}>
                <strong>{city}:</strong> {items.join(', ')}
              </li>
            ))}
            {unpriced.length > 0 && (
              <li>
                <strong>Any city:</strong> {unpriced.join(', ')} (nothing listed near your target)
              </li>
            )}
          </ul>
        </>
      )}
    </MoreOptions>
  )
}
