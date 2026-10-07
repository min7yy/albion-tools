import { itemName } from '../api/items'
import type { RefiningResult } from '../refining/profit'
import type { RefiningSettings } from '../refining/settings'
import type { SalesVolume } from '../api/history'
import { formatPerDay, formatPerFocus, formatSilver } from '../format'
import { ProfitBreakdown } from './ProfitBreakdown'

interface Props {
  result: RefiningResult
  settings: RefiningSettings
  /** Undefined while loading, null when sales history failed. */
  volume: SalesVolume | null | undefined
  onClose: () => void
}

export function RefiningDetail({ result: r, settings, volume, onClose }: Props) {
  const rateNote =
    settings.returnRateOverride !== null ? ' (your override)' : settings.useFocus ? ' with focus' : ''
  return (
    <ProfitBreakdown
      result={r}
      title={itemName(r.recipe.output)}
      subtitle={
        <>
          Buy, refine and sell in {r.refineCity}. Return rate {(r.returnRate * 100).toFixed(1)}%{rateNote}.
          <br />
          Focus: {Math.round(r.focusCost).toLocaleString()} per refine, {formatPerFocus(r.silverPerFocus)} extra silver
          per focus point.
          <br />
          Sold here: {formatPerDay(volume === null ? null : volume?.perDay)} a day over the last 7 days
          {volume?.avgPrice != null && <>, averaging {formatSilver(volume.avgPrice)} each</>}.
        </>
      }
      buyMode={settings.buyMode}
      sellMode={settings.sellMode}
      nameOf={itemName}
      onClose={onClose}
    />
  )
}
