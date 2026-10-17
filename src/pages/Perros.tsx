import { useEffect, useState } from 'react'
import { SouvenirIcon } from '../components/art/SouvenirArt'
import { Link } from 'react-router'
import { PageHeader, Chip } from '../components/ui/basics'
import { Leo, Bonchita, Luna, DogButton } from '../components/ui/Dogs'
import { DOG_NAMES } from '../engine/dogs'
import { wearableSouvenirs, WARDROBE, type Souvenir, type WearSlot } from '../engine/journey'
import { WARDROBE_KINDS, type ArtKind } from '../engine/artKinds'
import { wardrobeKindLabel } from '../engine/wardrobe'
import { useOutfits, setOutfit, type DogName } from '../hooks/useOutfits'
import { useSouvenirs } from '../hooks/useProgress'
import { TL } from '../engine/course'
import { ui } from '../engine/loader'
import { priceFor, coinsLabel, CURRENCY } from '../engine/economy'
import { buySouvenir } from '../db/progress'
import { useCoins } from '../hooks/useCoins'
import { CoinChip, CoinIcon } from '../components/rewards/Coin'
import { BuySheet } from '../components/rewards/BuySheet'

const SLOTS: { slot: WearSlot; label: string; emoji: string }[] = [
  { slot: 'hat', label: 'On the head', emoji: '🎩' },
  { slot: 'eyes', label: 'Over the eyes', emoji: '🕶️' },
  { slot: 'neck', label: 'Around the neck', emoji: '🧣' },
  { slot: 'mouth', label: 'In the mouth', emoji: '🍪' },
  { slot: 'paw', label: 'In a paw', emoji: '🐾' },
]
const INTRO: Record<DogName, string> = {
  leo: 'Leo wears anything sideways and is very proud of it.',
  bonchita: 'Bonchita will try to eat whatever you give her.',
  luna: 'Luna likes to look smart with the map.',
}

/** Item thumbnail: the emoji for now (one place to swap in <SouvenirArt>). */
function SouvenirThumb({ souvenir, size = 20 }: { souvenir: Souvenir; size?: number }) {
  return (
    <SouvenirIcon souvenir={souvenir} size={size} className="inline-block align-middle" />
  )
}

/** Wardrobe items by kind (each in every colour). */
const WARDROBE_BY_KIND = new Map<ArtKind, Souvenir[]>(WARDROBE_KINDS.map(({ kind }) => [kind, WARDROBE.filter((w) => w.wardrobe?.kind === kind)]))

export default function Perros() {
  const outfits = useOutfits()
  const souvenirs = useSouvenirs()
  const [dog, setDog] = useState<DogName>('leo')
  /** The wardrobe kind open in each slot (its colours are shown); null when closed, unset follows what the dog wears. */
  const [openKind, setOpenKind] = useState<Partial<Record<WearSlot, ArtKind | null>>>({})
  /** The wardrobe item in the buy sheet, with the slot it goes in. */
  const [buying, setBuying] = useState<{ souvenir: Souvenir; slot: WearSlot; price: number } | undefined>()
  const coins = useCoins()
  const owned = new Set((souvenirs ?? []).map((s) => s.id))
  const wearables = wearableSouvenirs().filter((w) => !w.wardrobe)
  const Svg = dog === 'leo' ? Leo : dog === 'bonchita' ? Bonchita : Luna
  /** The preview dog waves hello and cheers for a moment when something new goes on. */
  const [cheer, setCheer] = useState(0)
  useEffect(() => {
    if (!cheer) return
    const t = setTimeout(() => setCheer(0), 1800)
    return () => clearTimeout(t)
  }, [cheer])
  const equip = (slot: WearSlot, id: string | undefined) => {
    if (id) setCheer((c) => c + 1)
    void setOutfit(outfits, dog, slot, id)
  }
  return (
    <div className="animate-rise pb-6">
      <PageHeader title={ui.dogsPage} subtitle={`Dress Leo, Bonchita and Luna with the souvenirs they find on quests, or buy wardrobe colours with ${CURRENCY.plural}.`} right={<CoinChip className="mt-2 shrink-0" />} />
      <div className="mb-4 flex gap-1 rounded-full bg-surface-2 p-1" role="tablist" aria-label="Choose a dog">
        {(['leo', 'bonchita', 'luna'] as DogName[]).map((d) => (
          <button key={d} type="button" role="tab" aria-selected={dog === d} onClick={() => setDog(d)} className={`flex-1 rounded-full py-1.5 text-sm font-semibold transition ${dog === d ? 'bg-brand-gradient text-white shadow-md' : 'text-muted'}`}>
            {DOG_NAMES[d]}
          </button>
        ))}
      </div>
      <div className="card mb-4 flex flex-col items-center text-center">
        <Svg size={200} outfit={outfits[dog]} act={cheer ? 'cheer' : 'wave'} className="animate-float" />
        <p className="mt-2 text-sm font-semibold text-muted">{INTRO[dog]}</p>
        <div className="mt-3 flex -space-x-2" aria-label="Tap a dog to hear it">
          <DogButton dog="leo" size={40} outfit={outfits.leo} />
          <DogButton dog="bonchita" size={40} outfit={outfits.bonchita} />
          <DogButton dog="luna" size={40} outfit={outfits.luna} />
        </div>
      </div>
      {SLOTS.map(({ slot, label, emoji }) => {
        const items = wearables.filter((w) => w.wearable?.slot === slot)
        const current = outfits[dog][slot]
        const kinds = WARDROBE_KINDS.filter((k) => k.slot === slot).map((k) => k.kind)
        const worn = WARDROBE.find((w) => w.id === current)?.wardrobe?.kind
        const open = openKind[slot] === undefined ? worn : openKind[slot] ?? undefined
        return (
          <section key={slot} className="card mb-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted">{emoji} {label}</p>
              {current && <button type="button" className="text-xs font-bold text-muted underline" onClick={() => equip(slot, undefined)}>Take off</button>}
            </div>
            {items.length > 0 && <ul className="mt-2 flex flex-wrap gap-2">
              {items.map((sv) => {
                const have = owned.has(sv.id)
                const on = current === sv.id
                return (
                  <li key={sv.id}>
                    <button
                      type="button"
                      disabled={!have}
                      onClick={() => equip(slot, on ? undefined : sv.id)}
                      aria-pressed={on}
                      title={have ? sv.es : `${sv.en}: find it on a quest`}
                      className={`flex items-center gap-1.5 rounded-full border-2 px-3 py-1.5 text-sm font-bold transition ${on ? 'border-brand-500 bg-brand-100 dark:bg-brand-500/20' : have ? 'border-line bg-surface' : 'border-dashed border-line opacity-50'}`}
                    >
                      {have ? <SouvenirThumb souvenir={sv} size={16} /> : <span aria-hidden="true">❔</span>}
                      <span lang={TL}>{have ? sv.es : 'Find it on a quest'}</span>
                    </button>
                  </li>
                )
              })}
            </ul>}
            {kinds.length > 0 && (
              <Wardrobe
                kinds={kinds}
                open={open}
                current={current}
                owned={owned}
                onOpen={(kind) => setOpenKind({ ...openKind, [slot]: kind === open ? null : kind })}
                onWear={(id) => equip(slot, current === id ? undefined : id)}
                onShop={(sv) => {
                  const price = priceFor(sv)
                  if (price !== undefined) setBuying({ souvenir: sv, slot, price })
                }}
              />
            )}
          </section>
        )
      })}
      <p className="text-center text-xs text-muted">
        Souvenirs come from <Link to="/" className="font-bold underline">daily quests</Link> and lucky finds after lessons. Once a region's souvenirs are found, errands bring new colours for the wardrobe; any colour can also be bought with {CURRENCY.plural}. <Chip>{owned.size} owned</Chip>
      </p>
      {buying && (
        <BuySheet
          souvenir={buying.souvenir}
          price={buying.price}
          balance={coins}
          wearer={DOG_NAMES[dog]}
          dog={dog}
          outfit={{ ...outfits[dog], [buying.slot]: buying.souvenir.id }}
          onBuy={() => buySouvenir(buying.souvenir.id, buying.price)}
          onBought={() => {
            equip(buying.slot, buying.souvenir.id)
            setOpenKind({ ...openKind, [buying.slot]: buying.souvenir.wardrobe?.kind })
            setBuying(undefined)
          }}
          onClose={() => setBuying(undefined)}
        />
      )}
    </div>
  )
}

/** A slot's wardrobe: pick a kind, then one of its colours. */
function Wardrobe({ kinds, open, current, owned, onOpen, onWear, onShop }: {
  kinds: ArtKind[]
  open: ArtKind | undefined
  current: string | undefined
  owned: Set<string>
  onOpen: (kind: ArtKind) => void
  onWear: (id: string) => void
  /** Open the buy sheet for an unowned colour. */
  onShop: (souvenir: Souvenir) => void
}) {
  const colours = open ? WARDROBE_BY_KIND.get(open) ?? [] : []
  const shown = colours.find((c) => c.id === current) ?? colours.find((c) => owned.has(c.id))
  const price = colours[0] ? priceFor(colours[0]) : undefined
  const missing = colours.filter((c) => !owned.has(c.id)).length
  return (
    <div className="mt-3 border-t border-line pt-2">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted">Wardrobe</p>
      <div className="mt-1.5 flex flex-wrap gap-2">
        {kinds.map((kind) => {
          const all = WARDROBE_BY_KIND.get(kind) ?? []
          const have = all.filter((w) => owned.has(w.id))
          const on = open === kind
          return (
            <button
              key={kind}
              type="button"
              onClick={() => onOpen(kind)}
              aria-expanded={on}
              className={`flex items-center gap-1.5 rounded-full border-2 px-3 py-1.5 text-sm font-bold transition ${on ? 'border-brand-500 bg-brand-100 dark:bg-brand-500/20' : have.length ? 'border-line bg-surface' : 'border-dashed border-line opacity-60'}`}
            >
              <SouvenirThumb souvenir={have[0] ?? all[0]!} size={16} />
              <span className="capitalize">{wardrobeKindLabel(kind)}</span>
              <span className="font-mono text-[11px] text-muted">{have.length}/{all.length}</span>
            </button>
          )
        })}
      </div>
      {open && (
        <div className="mt-2">
          <ul className="flex flex-wrap gap-2" aria-label={`${wardrobeKindLabel(open)} colours`}>
            {colours.map((sv) => {
              const have = owned.has(sv.id)
              const on = current === sv.id
              return (
                <li key={sv.id}>
                  <button
                    type="button"
                    onClick={() => (have ? onWear(sv.id) : onShop(sv))}
                    aria-pressed={have ? on : undefined}
                    aria-label={have ? sv.es : `${sv.en}: buy for ${coinsLabel(priceFor(sv) ?? 0)} or find it on an errand`}
                    title={have ? `${sv.es} (${sv.en})` : `${sv.en}: buy it or find it on an errand`}
                    className={`relative block h-9 w-9 rounded-full border-2 transition active:scale-90 ${on ? 'border-brand-500 ring-2 ring-brand-500 ring-offset-2 ring-offset-surface' : have ? 'border-line' : 'border-dashed border-line'}`}
                  >
                    <span className="absolute inset-0 rounded-full" style={{ background: sv.color, opacity: have ? 1 : 0.32 }} aria-hidden="true" />
                    {!have && <CoinIcon size={15} className="absolute -bottom-1 -right-1" />}
                  </button>
                </li>
              )
            })}
          </ul>
          <p className="mt-1.5 text-xs text-muted">
            {shown ? <span lang={TL} className="font-bold text-ink-2">{shown.es}</span> : 'Find it on an errand: each colour is a new reward.'}
            {missing > 0 && price !== undefined && (
              <span className="mt-0.5 flex items-center gap-1">
                Tap a <CoinIcon size={13} /> colour to buy it: <span className="price-tag text-ink">{coinsLabel(price)}</span>
              </span>
            )}
          </p>
        </div>
      )}
    </div>
  )
}
