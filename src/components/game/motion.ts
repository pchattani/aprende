/** Motion switches for the lesson game feel: end-to-end runs and reduced-motion users get a calm runner. */

/** Playwright sets sessionStorage.e2e = '1' (e2e/helpers.ts enableTestHook). */
export function isE2E(): boolean {
  try {
    return typeof window !== 'undefined' && window.sessionStorage.getItem('e2e') === '1'
  } catch {
    return false
  }
}

export function prefersReducedMotion(): boolean {
  try {
    return typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  } catch {
    return false
  }
}

/** Animations shortened to nothing, no sliding exercises, no bursts. */
export const calmMotion = (): boolean => isE2E() || prefersReducedMotion()

/** A one-off Web Animations API effect (transform/opacity only); a no-op where unsupported (jsdom). */
export function nudge(el: Element | null | undefined, kind: 'pop' | 'shake'): void {
  if (!el || typeof (el as HTMLElement).animate !== 'function') return
  const frames: Keyframe[] =
    kind === 'pop'
      ? [{ transform: 'scale(1)' }, { transform: 'scale(1.045)', offset: 0.35 }, { transform: 'scale(0.99)', offset: 0.7 }, { transform: 'scale(1)' }]
      : [{ transform: 'translateX(0)' }, { transform: 'translateX(-7px)', offset: 0.2 }, { transform: 'translateX(6px)', offset: 0.4 }, { transform: 'translateX(-4px)', offset: 0.6 }, { transform: 'translateX(2px)', offset: 0.8 }, { transform: 'translateX(0)' }]
  ;(el as HTMLElement).animate(frames, { duration: kind === 'pop' ? 380 : 420, easing: 'ease-out' })
}
