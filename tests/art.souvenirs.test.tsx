import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { SouvenirArt, SouvenirIcon } from '@/components/art/SouvenirArt'
import { souvenirArt, parseWearId } from '@/components/art/souvenirKinds'
import { ART_KINDS, WARDROBE_KINDS, WARDROBE_COLOURS } from '@/engine/artKinds'
import { Leo, Bonchita, Luna, DogStamp } from '@/components/ui/Dogs'
import type { Outfit } from '@/hooks/useOutfits'

describe('souvenir illustrations', () => {
  it('draws every ART_KIND as an svg with its own shapes', () => {
    for (const kind of ART_KINDS) {
      const { container, unmount } = render(<SouvenirArt kind={kind} size={48} title={kind} />)
      const svg = container.querySelector('svg')!
      expect(svg, kind).toBeTruthy()
      expect(svg.getAttribute('aria-label')).toBe(kind)
      expect(container.querySelector(`[data-art="${kind}"]`), kind).toBeTruthy()
      // more than the ground shadow: real drawing
      expect(svg.querySelectorAll('path, circle, ellipse, rect').length, kind).toBeGreaterThan(3)
      unmount()
    }
  })

  it('recolours every wardrobe kind', () => {
    for (const { kind } of WARDROBE_KINDS) {
      const seen = new Set<string>()
      for (const c of WARDROBE_COLOURS) {
        const { container, unmount } = render(<SouvenirArt kind={kind} color={c.hex} />)
        const html = container.innerHTML.replace(/id="[^"]*"|url\(#[^)]*\)|sv[a-zA-Z0-9_-]*-/g, '')
        expect(html.toLowerCase(), `${kind} ${c.id}`).toContain(c.hex.toLowerCase())
        seen.add(html)
        unmount()
      }
      expect(seen.size, kind).toBe(WARDROBE_COLOURS.length)
    }
  })

  it('switches on the paint filter only at large sizes', () => {
    const { container: small } = render(<SouvenirArt kind="mate" size={32} />)
    expect(small.querySelector('filter')).toBeNull()
    const { container: big } = render(<SouvenirArt kind="mate" size={96} />)
    expect(big.querySelector('filter')).toBeTruthy()
  })

  it('SouvenirIcon draws `art` and falls back to the emoji', () => {
    const { container: drawn } = render(<SouvenirIcon souvenir={{ emoji: '🧉', art: 'mate', color: '#335577' }} size={40} />)
    expect(drawn.querySelector('svg [data-art="mate"]')).toBeTruthy()
    const { container: plain } = render(<SouvenirIcon souvenir={{ emoji: '🧉' }} size={40} />)
    expect(plain.querySelector('svg')).toBeNull()
    expect(plain.textContent).toBe('🧉')
    const { container: bogus } = render(<SouvenirIcon souvenir={{ emoji: '🎁', art: 'no-such-kind' }} />)
    expect(bogus.textContent).toBe('🎁')
  })

  it('reads art defensively and parses wardrobe ids', () => {
    expect(souvenirArt({ emoji: 'x' })).toBeUndefined()
    expect(souvenirArt({ emoji: 'x', art: 'beret', color: '#fff' })).toEqual({ kind: 'beret', color: '#fff' })
    expect(parseWearId('wear-bucket-hat-blue')).toEqual({ kind: 'bucket-hat', color: '#2f5bd3' })
    expect(parseWearId('wear-football-shirt')).toEqual({ kind: 'football-shirt' })
    expect(parseWearId('wear-nothing-red')).toBeUndefined()
    expect(parseWearId('mate')).toBeUndefined()
  })
})

describe('dress-up', () => {
  const outfit = { hat: 'wear-beret-red', eyes: 'wear-sunglasses-black', neck: 'wear-scarf-yellow', paw: 'wear-umbrella-blue', mouth: 'wear-croissant' } as Outfit
  it('draws worn items (not emoji) in every slot, on every dog and mood', () => {
    for (const D of [Leo, Bonchita, Luna])
      for (const mood of ['happy', 'curious', 'sleepy'] as const) {
        const { container, unmount } = render(<D size={96} mood={mood} outfit={outfit} />)
        for (const id of Object.values(outfit)) {
          const g = container.querySelector(`[data-wear="${id}"]`)
          expect(g, id).toBeTruthy()
          expect(g!.querySelector('[data-art]'), id).toBeTruthy()
          expect(g!.querySelector('text'), id).toBeNull()
        }
        unmount()
      }
  })

  it('drapes garments and hangs other neck items on a cord', () => {
    const { container } = render(<Leo size={96} outfit={{ neck: 'wear-poncho' }} />)
    expect(container.querySelector('[data-wear="wear-poncho"] [data-art="poncho"]')).toBeTruthy()
    const { container: c2 } = render(<Luna size={96} outfit={{ neck: 'wear-camera' }} />)
    expect(c2.querySelector('[data-wear="wear-camera"] path')).toBeTruthy()
  })
})

describe('dog stamps', () => {
  it('shows each dog as a bust in each mood at exercise sizes', () => {
    for (const dog of ['leo', 'bonchita', 'luna'] as const)
      for (const mood of ['happy', 'curious', 'sleepy'] as const)
        for (const size of [60, 78, 120]) {
          const { container, unmount } = render(<DogStamp dog={dog} size={size} mood={mood} />)
          // the portrait is a cropped view of the whole dog, not a separate head
          const inner = container.querySelector('svg svg')!
          expect(inner.getAttribute('viewBox')!.split(' ').map(Number)[3]).toBeGreaterThan(60)
          unmount()
        }
  })
})
