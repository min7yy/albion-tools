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
