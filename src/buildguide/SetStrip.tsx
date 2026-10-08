import { iconId, SLOT_LABELS } from './gear'
import type { GearSlot } from '../meta/aggregate'
import { ItemIcon } from '../components/ItemIcon'

interface StripItem {
  base: string
  name: string
}

/** Icons for a weapon and its gear, each with its name on hover. */
export function SetStrip({ weapon, gear, size }: { weapon: StripItem; gear: (StripItem & { slot: GearSlot })[]; size: number }) {
  return (
    <span className="build-strip">
      {[{ ...weapon, slot: 'MainHand' as const }, ...gear].map((item) => (
        <span key={item.base} className="strip-item" title={`${SLOT_LABELS[item.slot]}: ${item.name}`}>
          <ItemIcon id={iconId(item.base)} size={size} />
        </span>
      ))}
    </span>
  )
}
