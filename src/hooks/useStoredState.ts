import { useEffect, useState } from 'react'

/**
 * useState that is remembered in localStorage between visits.
 * `validate` turns whatever was saved into a valid value (or the fallback).
 */
export function useStoredState<T>(
  key: string,
  fallback: T,
  validate: (saved: unknown) => T = (saved) => (saved as T) ?? fallback,
): [T, (value: T) => void] {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key)
      return raw === null ? fallback : validate(JSON.parse(raw))
    } catch {
      return fallback
    }
  })
  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value))
    } catch {
      // Storage unavailable (private window); the choice just won't persist.
    }
  }, [key, value])
  return [value, setValue]
}

/** Validator for saved objects: fills in any fields added since they were saved. */
export function withDefaults<T extends object>(defaults: T) {
  return (saved: unknown): T =>
    saved && typeof saved === 'object' ? { ...defaults, ...(saved as Partial<T>) } : defaults
}
