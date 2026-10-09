import type { TradeSettings } from './profit'

export function formatSilver(n: number | null): string {
  return n === null ? '–' : Math.round(n).toLocaleString()
}

export function formatPercent(n: number | null, digits = 1): string {
  return n === null ? '–' : `${(n * 100).toFixed(digits)}%`
}

export function formatAge(date: Date | null, now = Date.now()): string {
  if (!date) return 'no data'
  const mins = Math.max(0, Math.round((now - date.getTime()) / 60000))
  if (mins < 60) return `${mins}m ago`
  const hours = Math.round(mins / 60)
  return hours < 48 ? `${hours}h ago` : `${Math.round(hours / 24)}d ago`
}

/** "T5.2" style label used in game for tier and enchantment. */
export function tierLabel(tier: number, enchantment: number): string {
  return `T${tier}.${enchantment}`
}

/** Silver per focus point, with one decimal below 10 so small values stay readable. */
export function formatPerFocus(n: number | null): string {
  if (n === null) return '–'
  return Math.abs(n) < 10 ? n.toFixed(1) : Math.round(n).toLocaleString()
}

/** Items sold per day; undefined means still loading, null means unavailable. */
export function formatPerDay(n: number | null | undefined): string {
  if (n === undefined) return '…'
  if (n === null) return '–'
  if (n === 0) return '0'
  return n < 10 ? n.toFixed(1) : Math.round(n).toLocaleString()
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** A YYYY-MM-DD date as "26 Sep". */
export function formatDay(date: string): string {
  const m = /^\d{4}-(\d{2})-(\d{2})$/.exec(date)
  return m ? `${Number(m[2])} ${MONTHS[Number(m[1]) - 1]}` : date
}

/** A count that can be fractional (kills split between attackers), rounded for display. */
export function formatCount(n: number): string {
  return Math.round(n).toLocaleString()
}

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
