/** Slider steps; the budget slider is logarithmic so cheap and expensive weapons both get room. */
export const SLIDER_STEPS = 1000

/** Rounds to two significant figures so budgets read as 12,000 rather than 12,347. */
export function roundBudget(n: number): number {
  if (n <= 0) return 0
  const scale = 10 ** Math.max(0, Math.floor(Math.log10(n)) - 1)
  return Math.round(n / scale) * scale
}

export function budgetToSlider(budget: number, min: number, max: number): number {
  if (max <= min) return SLIDER_STEPS
  const clamped = Math.min(max, Math.max(min, budget))
  return Math.round((Math.log(clamped / min) / Math.log(max / min)) * SLIDER_STEPS)
}

export function sliderToBudget(step: number, min: number, max: number): number {
  if (max <= min) return max
  return roundBudget(min * (max / min) ** (step / SLIDER_STEPS))
}
