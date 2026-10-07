import type { RefiningSettings, TradeMode } from '../refining/settings'

interface Props {
  settings: RefiningSettings
  onChange: (s: RefiningSettings) => void
  onReset: () => void
}

export function SettingsPanel({ settings, onChange, onReset }: Props) {
  const set = <K extends keyof RefiningSettings>(key: K, value: RefiningSettings[K]) =>
    onChange({ ...settings, [key]: value })

  return (
    <fieldset className="panel settings">
      <legend>Settings</legend>
      <label className="check">
        <input type="checkbox" checked={settings.useFocus} onChange={(e) => set('useFocus', e.target.checked)} />
        Use focus
      </label>
      <label className="check">
        <input type="checkbox" checked={settings.premium} onChange={(e) => set('premium', e.target.checked)} />
        Premium (4% tax)
      </label>
      <label>
        Station fee per 100 nutrition
        <input
          type="number"
          min={0}
          step={50}
          value={settings.stationFeePer100}
          onChange={(e) => set('stationFeePer100', Math.max(0, Number(e.target.value) || 0))}
        />
      </label>
      <label>
        Buy materials
        <select value={settings.buyMode} onChange={(e) => set('buyMode', e.target.value as TradeMode)}>
          <option value="instant">Instantly (sell orders)</option>
          <option value="order">With buy orders</option>
        </select>
      </label>
      <label>
        Sell items
        <select value={settings.sellMode} onChange={(e) => set('sellMode', e.target.value as TradeMode)}>
          <option value="order">With sell orders</option>
          <option value="instant">Instantly (buy orders)</option>
        </select>
      </label>
      <label>
        Return rate
        <span className="inline">
          <input
            type="number"
            min={0}
            max={99}
            step={0.1}
            placeholder="Auto"
            value={settings.returnRateOverride === null ? '' : +(settings.returnRateOverride * 100).toFixed(2)}
            onChange={(e) =>
              set(
                'returnRateOverride',
                e.target.value === '' ? null : Math.min(0.99, Math.max(0, Number(e.target.value) / 100)),
              )
            }
          />
          %
        </span>
      </label>
      <button type="button" className="link" onClick={onReset}>
        Reset settings
      </button>
    </fieldset>
  )
}
