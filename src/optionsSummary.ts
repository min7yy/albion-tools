import type { TradeSettings } from './profit'

/** Short words for the Options line, so people can see what's set without opening it. */
export function tradeSummary(s: TradeSettings): string[] {
  return [
    s.premium ? 'Premium' : 'No premium',
    s.buyMode === 'instant' ? 'Buy instantly' : 'Buy with orders',
    s.sellMode === 'instant' ? 'Sell instantly' : 'Sell with orders',
  ]
}

export function ageSummary(hours: number | null): string {
  if (hours === null) return 'Any price age'
  return hours < 24 || hours % 24 ? `Prices under ${hours}h` : `Prices under ${hours / 24}d`
}

export function salesSummary(perDay: number | null): string {
  return perDay === null ? 'Any sales' : `${perDay.toLocaleString()}+ sold a day`
}

export const joinSummary = (parts: (string | false | null | undefined)[]) => parts.filter(Boolean).join(' · ')
