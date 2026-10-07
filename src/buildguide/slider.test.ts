import { describe, expect, it } from 'vitest'
import { SLIDER_STEPS, budgetToSlider, roundBudget, sliderToBudget } from './slider'

describe('budget slider', () => {
  it('rounds budgets to two significant figures', () => {
    expect(roundBudget(12_347)).toBe(12_000)
    expect(roundBudget(1_570_000)).toBe(1_600_000)
    expect(roundBudget(87)).toBe(87)
  })

  it('maps the ends of the slider to the price range', () => {
    expect(sliderToBudget(0, 1_000, 1_000_000)).toBe(1_000)
    expect(sliderToBudget(SLIDER_STEPS, 1_000, 1_000_000)).toBe(1_000_000)
    // Logarithmic: halfway is the geometric middle.
    expect(sliderToBudget(SLIDER_STEPS / 2, 1_000, 1_000_000)).toBe(32_000)
  })

  it('clamps budgets outside the range', () => {
    expect(budgetToSlider(10, 1_000, 1_000_000)).toBe(0)
    expect(budgetToSlider(5e9, 1_000, 1_000_000)).toBe(SLIDER_STEPS)
    expect(budgetToSlider(31_623, 1_000, 1_000_000)).toBe(500)
  })
})
