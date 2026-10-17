import { describe, it, expect } from 'vitest'
import { equivEs } from '@/hooks/useDeps'

describe('optional subject pronouns typed without accents', () => {
  it('accepts "El tiene…" and "Tu tienes…" when a verb follows', () => {
    expect(equivEs('El tiene doce años', 'Tiene doce años.')).toBeTruthy()
    expect(equivEs('Él tiene doce años', 'Tiene doce años.')).toBeTruthy()
    expect(equivEs('Ella tiene doce años', 'Tiene doce años.')).toBeTruthy()
    expect(equivEs('Tu tienes razón', 'Tienes razón.')).toBeTruthy()
    expect(equivEs('El tiene doce años', 'Él tiene doce años.')).toBeTruthy()
  })
  it('never drops the article "el" or the possessive "tu" before a noun', () => {
    expect(equivEs('Libro es rojo', 'El libro es rojo.')).toBe(false)
    expect(equivEs('Poder es peligroso', 'El poder es peligroso.')).toBe(false)
    expect(equivEs('Casa es grande', 'Tu casa es grande.')).toBe(false)
  })
})
