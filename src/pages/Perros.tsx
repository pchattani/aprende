import { useState } from 'react'
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
  const owned = new Set((souvenirs ?? []).map((s) => s.id))
  const wearables = wearableSouvenirs().filter((w) => !w.wardrobe)
  const Svg = dog === 'leo' ? Leo : dog === 'bonchita' ? Bonchita : Luna
  const equip = (slot: WearSlot, id: string | undefined) => void setOutfit(outfits, dog, slot, id)
  return (
    <div className="animate-rise pb-6">
      <PageHeader title={ui.dogsPage} subtitle="Dress Leo, Bonchita and Luna with the souvenirs they find on quests." />
      <div className="mb-4 flex gap-1 rounded-full bg-surface-2 p-1" role="tablist" aria-label="Choose a dog">
        {(['leo', 'bonchita', 'luna'] as DogName[]).map((d) => (
          <button key={d} type="button" role="tab" aria-selected={dog === d} onClick={() => setDog(d)} className={`flex-1 rounded-full py-1.5 text-sm font-semibold transition ${dog === d ? 'bg-brand-gradient text-white shadow-md' : 'text-muted'}`}>
            {DOG_NAMES[d]}
          </button>
        ))}
      </div>
      <div className="card mb-4 flex flex-col items-center text-center">
        <Svg size={200} outfit={outfits[dog]} className="animate-float" />
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
              />
            )}
          </section>
        )
      })}
      <p className="text-center text-xs text-muted">
        Souvenirs come from <Link to="/" className="font-bold underline">daily quests</Link> and lucky finds after lessons. Once a region's souvenirs are found, errands bring new colours for the wardrobe. <Chip>{owned.size} owned</Chip>
      </p>
    </div>
  )
}

/** A slot's wardrobe: pick a kind, then one of its colours. */
function Wardrobe({ kinds, open, current, owned, onOpen, onWear }: {
  kinds: ArtKind[]
  open: ArtKind | undefined
  current: string | undefined
  owned: Set<string>
  onOpen: (kind: ArtKind) => void
  onWear: (id: string) => void
}) {
  const colours = open ? WARDROBE_BY_KIND.get(open) ?? [] : []
  const shown = colours.find((c) => c.id === current) ?? colours.find((c) => owned.has(c.id))
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
                    disabled={!have}
                    onClick={() => onWear(sv.id)}
                    aria-pressed={on}
                    aria-label={have ? sv.es : `${sv.en}: find it on an errand`}
                    title={have ? `${sv.es} (${sv.en})` : `${sv.en}: find it on an errand`}
                    className={`h-9 w-9 rounded-full border-2 transition ${on ? 'border-brand-500 ring-2 ring-brand-500 ring-offset-2 ring-offset-surface' : have ? 'border-line' : 'border-dashed border-line opacity-30'}`}
                    style={{ background: sv.color }}
                  />
                </li>
              )
            })}
          </ul>
          <p className="mt-1.5 text-xs text-muted">
            {shown ? <span lang={TL} className="font-bold text-ink-2">{shown.es}</span> : 'Find it on an errand: each colour is a new reward.'}
          </p>
        </div>
      )}
    </div>
  )
}
