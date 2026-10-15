import { describe, it, expect } from 'vitest'
import { numberWordsToDigitsEn, hasNumberWordEn } from '@/lang/en/numbers'

describe('English number words', () => {
  it('converts simple numbers and compounds', () => {
    expect(numberWordsToDigitsEn('fifteen')).toBe('15')
    expect(numberWordsToDigitsEn('I am fifteen years old.')).toBe('I am 15 years old.')
    expect(numberWordsToDigitsEn('twenty-one')).toBe('21')
    expect(numberWordsToDigitsEn('twenty one')).toBe('21')
    expect(numberWordsToDigitsEn('one hundred and five')).toBe('105')
    expect(numberWordsToDigitsEn('two thousand and twenty')).toBe('2020')
    expect(numberWordsToDigitsEn('a hundred people')).toBe('100 people')
    expect(numberWordsToDigitsEn('three million')).toBe('3000000')
  })
  it('keeps the rest intact', () => {
    expect(numberWordsToDigitsEn("It's half past three.")).toBe("It's half past 3.")
    expect(numberWordsToDigitsEn('I have a dog and an apple')).toBe('I have a dog and an apple')
    expect(numberWordsToDigitsEn('two dogs and three cats')).toBe('2 dogs and 3 cats')
  })
  it('detects number words', () => {
    expect(hasNumberWordEn('I am fifteen')).toBe(true)
    expect(hasNumberWordEn('I am tired')).toBe(false)
  })
})
