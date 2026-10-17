/**
 * Coins: the drawn coin (a gold piece stamped with a paw), the balance chip for the header
 * and a coin amount label. Count-ups and coin flights are in ./motion.
 */
import { useEffect, useId, useRef, useState, type Ref } from 'react'
import { useCountTo } from './motion'
import { useCoins } from '../../hooks/useCoins'
import { coinsLabel, CURRENCY } from '../../engine/economy'
import './rewards.css'

/** A gold coin stamped with a paw print. */
export function CoinIcon({ size = 24, className = '', title }: { size?: number; className?: string; title?: string }) {
  const id = useId().replace(/:/g, '')
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" className={className} role={title ? 'img' : undefined} aria-hidden={title ? undefined : true} aria-label={title}>
      <defs>
        <radialGradient id={`${id}f`} cx="38%" cy="32%" r="75%">
          <stop offset="0" stopColor="#fff1b8" />
          <stop offset="0.45" stopColor="#f2c14e" />
          <stop offset="1" stopColor="#c98a12" />
        </radialGradient>
        <linearGradient id={`${id}r`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#e9a92e" />
          <stop offset="1" stopColor="#9c6407" />
        </linearGradient>
      </defs>
      <circle cx="16" cy="17" r="14" fill="#9c6407" />
      <circle cx="16" cy="15.6" r="14" fill={`url(#${id}r)`} />
      <circle cx="16" cy="15.6" r="11.6" fill={`url(#${id}f)`} />
      <circle cx="16" cy="15.6" r="11.6" fill="none" stroke="#b77a0c" strokeWidth="0.8" strokeDasharray="1.4 1.6" opacity="0.7" />
      {/* the paw, pressed into the metal */}
      <g fill="#b0720b" opacity="0.9">
        <ellipse cx="16" cy="19.2" rx="4.2" ry="3.4" />
        <ellipse cx="10.9" cy="14.6" rx="1.7" ry="2.1" transform="rotate(-18 10.9 14.6)" />
        <ellipse cx="14" cy="11.6" rx="1.7" ry="2.2" transform="rotate(-6 14 11.6)" />
        <ellipse cx="18" cy="11.6" rx="1.7" ry="2.2" transform="rotate(6 18 11.6)" />
        <ellipse cx="21.1" cy="14.6" rx="1.7" ry="2.1" transform="rotate(18 21.1 14.6)" />
      </g>
      <path d="M8.2 10.4 A9.6 9.6 0 0 1 15 6.1" stroke="#fffbe6" strokeWidth="1.6" strokeLinecap="round" fill="none" opacity="0.85" />
    </svg>
  )
}

/**
 * The coin balance as a chip (for the header). Shows the live balance, or `value` when the
 * caller is animating a tally. Bumps when the number goes up.
 */
export function CoinChip({ value, size = 'md', className = '', ref }: { value?: number; size?: 'sm' | 'md'; className?: string; ref?: Ref<HTMLSpanElement> }) {
  const live = useCoins()
  const target = value ?? live
  const shown = useCountTo(target, { duration: 450 })
  const [bump, setBump] = useState(0)
  const prev = useRef(target)
  useEffect(() => {
    if (target > prev.current) setBump((b) => b + 1)
    prev.current = target
  }, [target])
  const px = size === 'sm' ? 18 : 22
  return (
    <span ref={ref} data-coin-target="" className={`coin-chip ${size === 'sm' ? 'is-sm' : ''} ${className}`} title={`${CURRENCY.plural} (${CURRENCY.symbol})`}>
      <span key={bump} className={bump ? 'coin-bump inline-flex' : 'inline-flex'}>
        <CoinIcon size={px} />
      </span>
      <span aria-hidden="true">{shown}</span>
      <span className="sr-only">{coinsLabel(target)}</span>
    </span>
  )
}

/** "+25 pesos" with a coin in front. */
export function CoinAmount({ amount, size = 18, className = '' }: { amount: number; size?: number; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1 font-mono font-bold tabular ${className}`}>
      <CoinIcon size={size} />
      <span>{amount > 0 ? '+' : ''}{coinsLabel(amount)}</span>
    </span>
  )
}
