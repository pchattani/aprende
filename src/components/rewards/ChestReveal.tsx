/**
 * A travel trunk that wobbles until tapped, then bursts open with rays and sparkles and shows
 * the reward: a souvenir (drawn with SouvenirIcon) or a purse of coins, with its name and blurb.
 * Purely presentational: the caller has already awarded what is inside.
 */
import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { SouvenirIcon } from '../art/SouvenirArt'
import type { Souvenir } from '../../engine/journey'
import { TL } from '../../engine/course'
import { coinsLabel, CURRENCY } from '../../engine/economy'
import { CoinIcon } from './Coin'
import { prefersReducedMotion } from './motion'
import { playReward } from './sfx'
import { DogButton } from '../ui/Dogs'
import { useOutfits, type DogName } from '../../hooks/useOutfits'
import './rewards.css'

export type ChestReward = { kind: 'souvenir'; souvenir: Souvenir } | { kind: 'coins'; amount: number }

export interface ChestRevealProps {
  reward: ChestReward
  /** Eyebrow above the chest ("Lucky find", "Checkpoint reward", "Errand reward"). */
  label?: string
  /** Line after the blurb; defaults to "Added to your passport." for souvenirs. */
  note?: string
  /** Open by itself after this many ms (no tap needed). */
  autoOpenMs?: number
  /** Called once when the chest opens. */
  onOpen?: () => void
  /** Chest width in px (default 150). */
  size?: number
  /** The dog watching the trunk: curious while it wobbles, cheering once it opens (default Luna; null for none). */
  dog?: DogName | null
  className?: string
}

const SPARKS = Array.from({ length: 12 }, (_, i) => ({ a: `${i * 30 + ((i * 17) % 12)}deg`, r: `${80 + ((i * 37) % 50)}px`, delay: `${(i % 4) * 40}ms`, c: ['#f4cf7a', '#ffffff', '#e9a92e', '#d9473b'][i % 4]! }))

/** The trunk: domed lid on a hinge, brass bands, a clasp and a couple of travel stickers. */
function Trunk({ width, open }: { width: number; open: boolean }) {
  const id = useId().replace(/:/g, '')
  return (
    <svg width={width} height={width * (140 / 160)} viewBox="0 0 160 140" overflow="visible" aria-hidden="true">
      <defs>
        <linearGradient id={`${id}w`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#c27a40" />
          <stop offset="1" stopColor="#8a4a22" />
        </linearGradient>
        <linearGradient id={`${id}l`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#d58c4f" />
          <stop offset="1" stopColor="#a05a2a" />
        </linearGradient>
        <linearGradient id={`${id}m`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#c98a12" />
          <stop offset="0.45" stopColor="#f6d77c" />
          <stop offset="1" stopColor="#c98a12" />
        </linearGradient>
        <radialGradient id={`${id}glow`} cx="50%" cy="100%" r="80%">
          <stop offset="0" stopColor="#fff6cf" stopOpacity="1" />
          <stop offset="0.5" stopColor="#f4cf7a" stopOpacity="0.7" />
          <stop offset="1" stopColor="#f4cf7a" stopOpacity="0" />
        </radialGradient>
        <clipPath id={`${id}lid`}>
          <path d="M14 63 L14 44 Q14 16 80 16 Q146 16 146 44 L146 63 Z" />
        </clipPath>
      </defs>
      {/* the open mouth and its glow */}
      <g className="chest-glow">
        <ellipse cx="80" cy="34" rx="70" ry="44" fill={`url(#${id}glow)`} />
        <rect x="18" y="56" width="124" height="12" rx="4" fill="#3a2414" />
      </g>
      {/* body */}
      <rect x="14" y="62" width="132" height="68" rx="10" fill={`url(#${id}w)`} />
      <path d="M16 84 H144 M16 106 H144" stroke="#6e3a1a" strokeWidth="1.4" opacity="0.45" />
      <rect x="30" y="62" width="11" height="68" fill={`url(#${id}m)`} />
      <rect x="119" y="62" width="11" height="68" fill={`url(#${id}m)`} />
      <circle cx="35.5" cy="72" r="1.6" fill="#7a5208" />
      <circle cx="35.5" cy="120" r="1.6" fill="#7a5208" />
      <circle cx="124.5" cy="72" r="1.6" fill="#7a5208" />
      <circle cx="124.5" cy="120" r="1.6" fill="#7a5208" />
      {/* travel stickers */}
      <g transform="rotate(-12 60 106)">
        <circle cx="60" cy="106" r="11" fill="#f4ead6" />
        <circle cx="60" cy="106" r="8.4" fill="none" stroke="#d9473b" strokeWidth="1.6" />
        <path d="M54.5 109 l3.8 -6 l2.6 4 l1.8 -2.2 l3 4.2 z" fill="#2f6fc0" />
      </g>
      <g transform="rotate(8 101 108)">
        <rect x="90" y="100" width="22" height="14" rx="2" fill="#2f6fc0" />
        <path d="M93 105 h16 M93 109 h10" stroke="#f7efe0" strokeWidth="1.4" />
      </g>
      <rect x="14" y="62" width="132" height="68" rx="10" fill="none" stroke="#5e3016" strokeWidth="1.5" opacity="0.5" />
      {/* clasp on the body */}
      <rect x="69" y="60" width="22" height="24" rx="4" fill={`url(#${id}m)`} stroke="#8a5a08" strokeWidth="1" />
      <circle cx="80" cy="70" r="2.6" fill="#3a2414" />
      <path d="M80 71 L78.6 77 H81.4 Z" fill="#3a2414" />
      {/* lid (hinged at the back left, see .chest-lid) */}
      <g className="chest-lid">
        <path d="M14 63 L14 44 Q14 16 80 16 Q146 16 146 44 L146 63 Z" fill={`url(#${id}l)`} />
        <g clipPath={`url(#${id}lid)`}>
          <path d="M14 40 Q80 26 146 40" stroke="#7a4220" strokeWidth="1.4" fill="none" opacity="0.4" />
          <rect x="30" y="10" width="11" height="60" fill={`url(#${id}m)`} />
          <rect x="119" y="10" width="11" height="60" fill={`url(#${id}m)`} />
          <path d="M30 26 Q50 18 70 20" stroke="#fff" strokeOpacity="0.28" strokeWidth="4" strokeLinecap="round" fill="none" />
        </g>
        <rect x="12" y="56" width="136" height="8" rx="3" fill={`url(#${id}m)`} stroke="#8a5a08" strokeWidth="0.8" />
        <path d="M14 63 L14 44 Q14 16 80 16 Q146 16 146 44 L146 63" fill="none" stroke="#5e3016" strokeWidth="1.5" opacity="0.5" />
        {!open && <rect x="74" y="54" width="12" height="10" rx="2" fill={`url(#${id}m)`} stroke="#8a5a08" strokeWidth="0.8" />}
      </g>
    </svg>
  )
}

export function ChestReveal({ reward, label = 'Treasure', note, autoOpenMs, onOpen, size = 150, dog = 'luna', className = '' }: ChestRevealProps) {
  const [open, setOpen] = useState(false)
  const outfits = useOutfits()
  const reduce = prefersReducedMotion()
  const onOpenRef = useRef(onOpen)
  useEffect(() => {
    onOpenRef.current = onOpen
  }, [onOpen])
  const opened = useRef(false)
  const doOpen = useCallback(() => {
    if (opened.current) return
    opened.current = true
    setOpen(true)
    playReward('chest')
    onOpenRef.current?.()
  }, [])
  useEffect(() => {
    if (autoOpenMs === undefined) return
    const t = setTimeout(doOpen, autoOpenMs)
    return () => clearTimeout(t)
  }, [autoOpenMs, doOpen])

  const sv = reward.kind === 'souvenir' ? reward.souvenir : undefined
  const name = sv ? sv.es : `+${coinsLabel(reward.kind === 'coins' ? reward.amount : 0)}`
  const footnote = note ?? (sv ? 'Added to your passport.' : `Into the purse with the other ${CURRENCY.plural}.`)
  const stage = Math.round(size * 1.5)
  return (
    <section className={`relative overflow-hidden rounded-3xl border border-line bg-card px-4 pb-5 pt-4 text-center shadow-card ${className}`} aria-label={label}>
      <p className="eyebrow relative z-[1]">{label}</p>
      <div className="relative mx-auto" style={{ height: stage, width: '100%' }}>
        {open && !reduce && <div className="rays" style={{ width: stage * 2.1, height: stage * 2.1, top: '42%' }} aria-hidden="true" />}
        {open && !reduce && (
          <div className="absolute left-1/2 top-[52%] h-0 w-0" aria-hidden="true">
            {SPARKS.map((s, i) => (
              <svg key={i} className="sparkle" viewBox="0 0 12 12" style={{ '--a': s.a, '--r': s.r, '--delay': s.delay } as React.CSSProperties}>
                <path d="M6 0 L7.3 4.7 L12 6 L7.3 7.3 L6 12 L4.7 7.3 L0 6 L4.7 4.7 Z" fill={s.c} />
              </svg>
            ))}
          </div>
        )}
        {/* the prize, waiting inside until the lid opens */}
        <div className={`chest-prize ${open ? 'is-out' : ''} absolute left-1/2 top-0 z-[2] -ml-[44px] flex h-[88px] w-[88px] items-center justify-center`} aria-hidden={!open}>
          <div className="prize-float flex h-full w-full items-center justify-center">
            {sv ? (
              <span className="stamp rotate-[-4deg] p-1.5"><SouvenirIcon souvenir={sv} size={66} /></span>
            ) : (
              <span className="relative block h-[70px] w-[76px]">
                <CoinIcon size={46} className="absolute left-0 top-5 rotate-[-14deg]" />
                <CoinIcon size={46} className="absolute right-0 top-4 rotate-[12deg]" />
                <CoinIcon size={50} className="absolute left-1/2 top-0 -ml-[25px]" />
              </span>
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={doOpen}
          disabled={open}
          aria-label={open ? `Opened: ${name}` : `Open the ${label.toLowerCase()} chest`}
          className={`chest-body ${open ? 'is-open' : ''} absolute bottom-2 left-1/2 block rounded-2xl disabled:cursor-default`}
          style={{ width: size, marginLeft: -size / 2 }}
        >
          <Trunk width={size} open={open} />
        </button>
        {dog && (
          <span className="absolute bottom-0 left-0 z-[1]">
            <DogButton dog={dog} size={Math.round(size * 0.5)} act={open ? 'cheer' : 'curious'} outfit={outfits[dog]} />
          </span>
        )}
        <span className="chest-shadow pointer-events-none absolute bottom-0 left-1/2 -ml-[60px] block h-3 w-[120px] rounded-[50%] bg-[rgba(28,37,65,0.18)]" aria-hidden="true" />
      </div>
      {!open ? (
        <p className="chest-hint relative font-hand text-2xl leading-none text-ink-2">Tap the trunk to open it</p>
      ) : (
        <div className={`chest-text is-on relative`} aria-live="polite">
          {sv ? (
            <>
              <p className="font-display text-[1.45rem] leading-tight" lang={TL}>{sv.es}</p>
              <p className="text-xs font-semibold uppercase tracking-wider text-ink-2">{sv.en}</p>
              <p className="mx-auto mt-2 max-w-[18rem] text-sm text-ink-2">{sv.blurb} {footnote}</p>
            </>
          ) : (
            <>
              <p className="font-display text-[1.6rem] leading-tight">{name}</p>
              <p className="mx-auto mt-1 max-w-[18rem] text-sm text-ink-2">{footnote}</p>
            </>
          )}
        </div>
      )}
    </section>
  )
}
