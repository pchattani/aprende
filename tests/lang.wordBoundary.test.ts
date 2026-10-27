import { describe, it, expect } from 'vitest'
import { contentRegExp, unicodeWordBoundaries } from '@/lang/wordBoundary'

describe('content rules see accented letters as part of words', () => {
  it('does not find "a el" inside "parecía el"', () => {
    const re = contentRegExp('\\ba el\\b', 'iu')
    expect(re.test('parecía el paisaje')).toBe(false)
    expect(re.test('aceptaría el trabajo')).toBe(false)
    expect(re.test('voy a el parque')).toBe(true)
  })
  it('keeps the match at the edges of accented words', () => {
    expect(contentRegExp('\\bmás mejor\\b', 'iu').test('es más mejor')).toBe(true)
    expect(contentRegExp('\\bestá\\b', 'iu').test('estás')).toBe(false)
  })
  it('leaves a literal backslash-b alone', () => {
    expect(unicodeWordBoundaries('a\\\\b')).toBe('a\\\\b')
  })
})
