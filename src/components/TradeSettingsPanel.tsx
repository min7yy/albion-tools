import type { TradeMode, TradeSettings } from '../profit'

interface Props {
  settings: TradeSettings
  onChange: (s: TradeSettings) => void
}

/** Premium and buy/sell mode, for tools without crafting settings. */
export function TradeSettingsPanel({ settings, onChange }: Props) {
  const set = <K extends keyof TradeSettings>(key: K, value: TradeSettings[K]) => onChange({ ...settings, [key]: value })
  return (
    <fieldset className="panel settings">
      <legend>Settings</legend>
      <label className="check">
        <input type="checkbox" checked={settings.premium} onChange={(e) => set('premium', e.target.checked)} />
        Premium (4% tax)
      </label>
      <label>
        Buy
        <select value={settings.buyMode} onChange={(e) => set('buyMode', e.target.value as TradeMode)}>
          <option value="instant">Instantly (sell orders)</option>
          <option value="order">With buy orders</option>
        </select>
      </label>
      <label>
        Sell
        <select value={settings.sellMode} onChange={(e) => set('sellMode', e.target.value as TradeMode)}>
          <option value="order">With sell orders</option>
          <option value="instant">Instantly (buy orders)</option>
        </select>
      </label>
      <p className="hint">
        Selling to the Black Market is always instant. Instant buys and sells are the safest numbers; orders earn more
        but can take a while to fill.
      </p>
    </fieldset>
  )
}
