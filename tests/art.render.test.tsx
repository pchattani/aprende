import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { Leo, Bonchita, Luna, DogButton, DogsScene, DogStamp, DogsTrio } from '@/components/ui/Dogs'
import { PaintedScene } from '@/components/art/PaintedScene'
import { Postcard, PostcardFrame } from '@/components/art/PostcardFrame'
import { PawsportMark, PawsportWordmark } from '@/components/art/Logo'
import { MOTIFS, ACCENTS, motifSample } from '@/engine/scenes'
import { REGIONS, wearableSouvenirs } from '@/engine/journey'

describe('painted dogs', () => {
  it('renders each dog in each mood, small and large', () => {
    for (const D of [Leo, Bonchita, Luna])
      for (const mood of ['happy', 'curious', 'sleepy'] as const)
        for (const size of [40, 240]) {
          const { container, unmount } = render(<D size={size} mood={mood} />)
          const svg = container.querySelector('svg')!
          // the frame hugs each dog's width, so it is never wider than square
          expect(svg.getAttribute('height')).toBe(String(size))
          expect(Number(svg.getAttribute('width'))).toBeLessThanOrEqual(size)
          // filters only at large sizes
          expect(Boolean(container.querySelector('filter'))).toBe(size >= 64)
          unmount()
        }
  })

  it('wears souvenirs at the anchors', () => {
    const wear = wearableSouvenirs()
    const hat = wear.find((s) => s.wearable?.slot === 'hat')
    if (!hat) return
    const { container } = render(<Luna size={96} outfit={{ hat: hat.id }} />)
    expect(container.querySelector(`[data-wear="${hat.id}"]`)).toBeTruthy()
  })

  it('keeps the tappable dog button', () => {
    render(<DogButton dog="leo" size={48} />)
    const btn = screen.getByRole('button', { name: /Leo says hello/ })
    fireEvent.click(btn)
    expect(btn).toBeInTheDocument()
  })

  it('draws stamps, the trio and the scene', () => {
    render(<DogStamp dog="bonchita" size={72} />)
    expect(screen.getByRole('img', { name: 'Bonchita stamp' })).toBeInTheDocument()
    for (const pose of ['celebrate', 'wave', 'sleep'] as const) {
      const { unmount } = render(<DogsTrio pose={pose} size={300} />)
      unmount()
    }
    render(<DogsScene size={220} />)
  })
})

describe('painted postcards', () => {
  it('paints every motif at every progress step without throwing', () => {
    for (const motif of MOTIFS)
      for (const progress of [0, 0.5, 1]) {
        const { container, unmount } = render(<PaintedScene scene={motifSample(motif, 'b1', 'dusk')} progress={progress} fade={progress === 1 ? 0.5 : 0} quality={progress === 0.5 ? 'thumb' : 'full'} />)
        expect(container.querySelector('svg')).toBeTruthy()
        // the pencil sketch is drawn until the painting is complete
        expect(Boolean(container.querySelector('.pw-sketch'))).toBe(progress < 1)
        unmount()
      }
  }, 20_000) // hundreds of painted scenes: allow for a busy machine

  it('paints every accent', () => {
    for (const accent of ACCENTS) {
      const { unmount } = render(<PaintedScene scene={motifSample('harbour', 'a2', 'night', undefined, accent)} />)
      unmount()
    }
  })

  it('frames a stop as a postcard with caption, stamp and postmark', () => {
    const region = REGIONS[0]!
    const stop = region.stops[0]!
    render(<Postcard stop={stop} level={region.level} caption="Hola" stamp postmark date="16 OCT 26" />)
    expect(screen.getByText('Hola')).toBeInTheDocument()
    expect(screen.getByRole('img', { name: stop.name })).toBeInTheDocument()
    render(<PostcardFrame tilt={2}><span>x</span></PostcardFrame>)
  })

  it('draws the brand mark and wordmark', () => {
    const { container } = render(<PawsportMark size={16} />)
    expect(container.querySelector('svg')).toBeTruthy()
    render(<PawsportWordmark size={32} />)
    expect(screen.getByRole('img', { name: 'Pawsport' })).toBeInTheDocument()
  })
})
