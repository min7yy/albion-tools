import { itemName } from '../api/items'
import type { RefiningResult } from '../refining/profit'
import type { RefiningSettings } from '../refining/settings'
import { ProfitBreakdown } from './ProfitBreakdown'

interface Props {
  result: RefiningResult
  settings: RefiningSettings
  onClose: () => void
}

export function RefiningDetail({ result: r, settings, onClose }: Props) {
  const rateNote =
    settings.returnRateOverride !== null ? ' (your override)' : settings.useFocus ? ' with focus' : ''
  return (
    <ProfitBreakdown
      result={r}
      title={itemName(r.recipe.output)}
      subtitle={`Buy, refine and sell in ${r.refineCity}. Return rate ${(r.returnRate * 100).toFixed(1)}%${rateNote}.`}
      buyMode={settings.buyMode}
      sellMode={settings.sellMode}
      nameOf={itemName}
      onClose={onClose}
    />
  )
}
