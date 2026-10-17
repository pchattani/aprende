/**
 * The shop's buy confirmation: a bottom sheet with the item, its price and the purse. Buying
 * sends coins flying from the purse into the item, which pops; then the sheet closes.
 */
import { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { SouvenirIcon } from '../art/SouvenirArt'
import type { Souvenir } from '../../engine/journey'
import { TL } from '../../engine/course'
import { coinsLabel, CURRENCY } from '../../engine/economy'
import { CoinChip, CoinIcon } from './Coin'
import { useCoinFlight } from './motion'
import { playReward } from './sfx'
import { Leo, Bonchita, Luna } from '../ui/Dogs'
import type { DogName, Outfit } from '../../hooks/useOutfits'

const DOGS = { leo: Leo, bonchita: Bonchita, luna: Luna }
import './rewards.css'

export interface BuySheetProps {
  souvenir: Souvenir
  price: number
  balance: number
  /** Who will wear it once bought ("Leo"). */
  wearer?: string
  /** The dog who will wear it and their outfit with the item on, shown cheering once bought. */
  dog?: DogName
  outfit?: Outfit
  /** Performs the purchase (db/progress.ts buySouvenir). */
  onBuy: () => Promise<'ok' | 'owned' | 'short'>
  /** Called after a successful purchase, once the animation has played. */
  onBought: () => void
  onClose: () => void
}

export function BuySheet({ souvenir, price, balance, wearer, dog, outfit, onBuy, onBought, onClose }: BuySheetProps) {
  const Dog = dog ? DOGS[dog] : undefined
  const titleId = useId()
  const [state, setState] = useState<'idle' | 'paying' | 'bought' | 'short'>('idle')
  const purse = useRef<HTMLSpanElement>(null)
  const item = useRef<HTMLSpanElement>(null)
  const { launch, layer } = useCoinFlight()
  const short = balance < price
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && state !== 'paying' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, state])

  const buy = async () => {
    if (state !== 'idle' || short) return
    setState('paying')
    const r = await onBuy()
    if (r !== 'ok') {
      setState(r === 'short' ? 'short' : 'bought')
      return
    }
    playReward('buy')
    launch(purse.current, item.current, Math.min(8, Math.max(3, Math.round(price / 15))), (last) => {
      if (!last) return
      setState('bought')
      setTimeout(onBought, 1500)
    })
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center" role="dialog" aria-modal="true" aria-labelledby={titleId}>
      <button type="button" className="levelup-in absolute inset-0 bg-[rgba(28,37,65,0.5)]" aria-label="Close" onClick={() => state !== 'paying' && onClose()} />
      {layer}
      <div className="sheet-up relative w-full max-w-xl rounded-t-[28px] border-t border-line bg-paper px-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] pt-3 shadow-float">
        <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-[var(--line-strong)]" aria-hidden="true" />
        <div className="flex items-center justify-between">
          <p className="eyebrow">Wardrobe shop</p>
          <CoinChip ref={purse} size="sm" />
        </div>
        <div className="mt-3 flex items-center gap-4">
          {state === 'bought' && Dog ? (
            <span className="bought mt-3 -mb-3 shrink-0">
              <Dog size={112} act="cheer" outfit={outfit} />
            </span>
          ) : (
            <span ref={item} className="stamp shrink-0 rotate-[-3deg] p-2">
              <SouvenirIcon souvenir={souvenir} size={84} />
            </span>
          )}
          <div className="min-w-0 flex-1">
            <h2 id={titleId} className="text-[1.5rem]" lang={TL}>{souvenir.es}</h2>
            <p className="text-xs font-semibold uppercase tracking-wider text-ink-2">{souvenir.en}</p>
            <p className="mt-1.5 text-sm text-ink-2">{souvenir.blurb}</p>
          </div>
        </div>
        <div className="mt-4 flex items-center justify-between rounded-2xl border border-dashed border-line bg-card px-4 py-2.5">
          <span className="text-sm font-semibold">Price</span>
          <span className="inline-flex items-center gap-1.5 font-mono text-lg font-bold">
            <CoinIcon size={22} /> {coinsLabel(price)}
          </span>
        </div>
        {state === 'bought' ? (
          <p className="btn-game btn-game-ink mt-4 w-full" role="status">Bought!{wearer ? ` ${wearer} is wearing it.` : ''}</p>
        ) : short || state === 'short' ? (
          <>
            <button type="button" className="btn-game mt-4 w-full" disabled>
              Need {coinsLabel(price - balance)} more
            </button>
            <p className="mt-2 text-center text-xs text-ink-2">Lessons, checkpoints and daily errands all pay {CURRENCY.plural}. Or find it on an errand.</p>
          </>
        ) : (
          <button type="button" className="btn-game mt-4 w-full" onClick={() => void buy()} disabled={state === 'paying'}>
            Buy for <CoinIcon size={22} /> {coinsLabel(price)}
          </button>
        )}
        <button type="button" className="mt-2 w-full py-2 text-sm font-bold text-ink-2" onClick={onClose} disabled={state === 'paying'}>
          {state === 'bought' ? 'Close' : 'Not now'}
        </button>
      </div>
    </div>,
    document.body,
  )
}
