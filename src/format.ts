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
