import { describe, expect, it } from 'vitest'
import { WEAPONS } from './weapons'

describe('weapon data', () => {
  it('ships every weapon type with names', () => {
    expect(WEAPONS.find((w) => w.base === 'MAIN_SWORD')).toMatchObject({ name: 'Broadsword', sub: 'sword', twoHanded: false })
    expect(new Set(WEAPONS.map((w) => w.sub))).toContain('shapeshifterstaff')
  })
})
