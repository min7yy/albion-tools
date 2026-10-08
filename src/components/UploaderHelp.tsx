import { marketCategory, type BrowsePage } from '../buildguide/browsePlan'
import type { Weapon } from '../buildguide/weapons'
import { MoreOptions } from './MoreOptions'

const RELEASES = 'https://github.com/ao-data/albiondata-client/releases/latest'

interface Props {
  /** Per city, the market pages that refresh the pieces on screen priced from older data. */
  plan: Map<string, BrowsePage[]>
  /** Weapons with nothing for sale near the target at all. */
  unpriced: Weapon[]
}

/** Folded-away steps for running the Albion Data Client, and which market pages to open to fill gaps. */
export function UploaderHelp({ plan, unpriced }: Props) {
  const pages = [...plan.values()].reduce((n, list) => n + list.length, 0)
  const unpricedPages = new Map<string, string[]>()
  for (const w of unpriced) unpricedPages.set(marketCategory(w), [...(unpricedPages.get(marketCategory(w)) ?? []), w.name])
  const count = pages + unpricedPages.size
  return (
    <MoreOptions title="Fill missing prices" summary={count ? `${count} market pages to open in game` : 'all prices current'}>
      <p className="hint">
        Prices come from players running the free Albion Data Client while they play. It uploads every listing on any
        market page you open, so browsing a whole category fills many prices at once, and they show up here for
        everyone within minutes and are kept for a week. Albion's developers allow it because it only reads traffic and
        changes nothing.
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
        <li>
          Leave it running while you play. It works out the server by itself. To start it with Windows, press Win+R, type{' '}
          <code>shell:startup</code> and copy its desktop shortcut into that folder.
        </li>
        <li>
          In the market, pick a category instead of searching an item, set the tier and enchantment, leave quality on
          all, and scroll to the bottom of the list.
        </li>
      </ol>
      {count > 0 && (
        <>
          <p className="hint">Pages that refresh what the builds below are using, most useful first:</p>
          <ul className="needed-prices">
            {[...plan].map(([city, list]) => (
              <li key={city}>
                <strong>{city}:</strong>{' '}
                {list.map((p, i) => (
                  <span key={p.category} title={p.items.join(', ')}>
                    {i > 0 && ' · '}
                    {p.category} {p.tiers.join(', ')}
                  </span>
                ))}
              </li>
            ))}
            {unpricedPages.size > 0 && (
              <li>
                <strong>Any city:</strong>{' '}
                {[...unpricedPages].map(([category, names]) => `${category} (${names.join(', ')})`).join(' · ')}, nothing
                listed near your target
              </li>
            )}
          </ul>
        </>
      )}
    </MoreOptions>
  )
}
