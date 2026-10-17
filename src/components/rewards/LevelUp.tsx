/**
 * Full-screen celebration when the learner reaches a new traveller level: rays, the big seal,
 * the three dogs cheering, what the level unlocks and the travel fund that comes with it.
 */
import { useEffect, useId, useRef } from 'react'
import { createPortal } from 'react-dom'
import { Leo, Bonchita, Luna } from '../ui/Dogs'
import { useOutfits } from '../../hooks/useOutfits'
import { Confetti } from '../ui/Confetti'
import { LevelBadge } from './Level'
import { CoinAmount } from './Coin'
import { titleFor, nextTitle } from '../../engine/traveller'
import { playReward } from './sfx'
import './rewards.css'

export interface LevelUpProps {
  /** The level just reached. */
  level: number
  /** A title unlocked by this level-up, if any ("Explorer"). */
  newTitle?: string
  /** Coins that came with it (shown, not awarded: the caller awards them). */
  coins?: number
  onClose: () => void
}

export function LevelUp({ level, newTitle, coins = 0, onClose }: LevelUpProps) {
  const titleId = useId()
  const btn = useRef<HTMLButtonElement>(null)
  const ahead = nextTitle(level)
  const outfits = useOutfits()
  useEffect(() => {
    playReward('levelup')
    btn.current?.focus({ preventScroll: true })
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = overflow
    }
  }, [onClose])
  return createPortal(
    <div role="dialog" aria-modal="true" aria-labelledby={titleId} className="levelup-backdrop levelup-in fixed inset-0 z-50 flex flex-col items-center overflow-y-auto px-4 pb-[calc(1.25rem+env(safe-area-inset-bottom))] pt-[calc(2rem+env(safe-area-inset-top))] text-center">
      <Confetti count={70} />
      <p className="eyebrow relative !text-[#f4cf7a]">Traveller level up</p>
      <div className="relative mt-2 flex h-[210px] w-full items-center justify-center">
        <div className="rays" style={{ width: 460, height: 460 }} aria-hidden="true" />
        <LevelBadge level={level} size={150} ribbon className="badge-in relative drop-shadow-[0_12px_18px_rgba(0,0,0,0.35)]" />
      </div>
      <h2 id={titleId} className="relative mt-3 font-display text-[2.6rem] leading-none text-white">
        Level {level}!
      </h2>
      <p className="relative mt-2 font-hand text-[1.7rem] leading-none text-[#f4cf7a]">{titleFor(level)}</p>

      <div className="card-up relative mt-[5.5rem] w-full max-w-sm">
        <div className="pointer-events-none absolute -top-[92px] left-1/2 flex -translate-x-1/2 items-end -space-x-5" aria-label="Leo, Bonchita and Luna cheering" role="img">
          <Leo size={104} act="cheer" outfit={outfits.leo} />
          <Bonchita size={92} act="cheer" outfit={outfits.bonchita} className="relative z-[1] -mb-1" />
          <Luna size={104} act="cheer" outfit={outfits.luna} />
        </div>
        <div className="relative rounded-3xl border border-line bg-card px-5 pb-5 pt-7 text-ink shadow-float">
          {newTitle ? (
            <>
              <span className="ribbon -mt-11 mb-3">New title</span>
              <p className="text-[0.95rem]">
                You are now a <strong className="font-display text-lg">{newTitle}</strong>. Leo wants it embroidered on his bandana.
              </p>
            </>
          ) : (
            <p className="text-[0.95rem]">The dogs have covered a lot of ground. Luna marks the map; Bonchita asks about snacks.</p>
          )}
          {coins > 0 && (
            <p className="mt-3 flex items-center justify-center gap-2 rounded-2xl bg-surface-2 py-2 text-sm">
              Travel fund <CoinAmount amount={coins} size={20} />
            </p>
          )}
          {ahead && <p className="mt-3 text-xs text-ink-2">Next title: <span className="font-bold text-ink">{ahead.title}</span> at level {ahead.level}.</p>}
          <button ref={btn} type="button" className="btn-game mt-4 w-full" onClick={onClose}>
            Keep travelling
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
