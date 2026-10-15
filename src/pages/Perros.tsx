import { useState } from 'react'
import { Link } from 'react-router'
import { PageHeader, Chip } from '../components/ui/basics'
import { Leo, Bonchita, Luna, DogButton } from '../components/ui/Dogs'
import { DOG_NAMES } from '../engine/dogs'
import { wearableSouvenirs, type WearSlot } from '../engine/journey'
import { useOutfits, setOutfit, type DogName } from '../hooks/useOutfits'
import { useSouvenirs } from '../hooks/useProgress'

const SLOTS: { slot: WearSlot; label: string; emoji: string }[] = [
  { slot: 'hat', label: 'On the head', emoji: '🎩' },
  { slot: 'neck', label: 'Around the neck', emoji: '🧣' },
  { slot: 'mouth', label: 'In the mouth', emoji: '🍪' },
  { slot: 'paw', label: 'In a paw', emoji: '🐾' },
]
const INTRO: Record<DogName, string> = {
  leo: 'Leo wears anything sideways and is very proud of it.',
  bonchita: 'Bonchita will try to eat whatever you give her.',
  luna: 'Luna likes to look smart with the map.',
}

export default function Perros() {
  const outfits = useOutfits()
  const souvenirs = useSouvenirs()
  const [dog, setDog] = useState<DogName>('leo')
  const owned = new Set((souvenirs ?? []).map((s) => s.id))
  const wearables = wearableSouvenirs()
  const Svg = dog === 'leo' ? Leo : dog === 'bonchita' ? Bonchita : Luna
  const equip = (slot: WearSlot, id: string | undefined) => void setOutfit(outfits, dog, slot, id)
  return (
    <div className="animate-rise pb-6">
      <PageHeader title="Los perros" subtitle="Dress Leo, Bonchita and Luna with the souvenirs they find on quests." />
      <div className="mb-4 flex gap-1 rounded-full bg-surface-2 p-1" role="tablist" aria-label="Choose a dog">
        {(['leo', 'bonchita', 'luna'] as DogName[]).map((d) => (
          <button key={d} type="button" role="tab" aria-selected={dog === d} onClick={() => setDog(d)} className={`flex-1 rounded-full py-1.5 text-sm font-extrabold transition ${dog === d ? 'bg-brand-gradient text-white shadow-md' : 'text-muted'}`}>
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
        return (
          <section key={slot} className="card mb-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-extrabold uppercase tracking-wider text-muted">{emoji} {label}</p>
              {current && <button type="button" className="text-xs font-bold text-muted underline" onClick={() => equip(slot, undefined)}>Take off</button>}
            </div>
            <ul className="mt-2 flex flex-wrap gap-2">
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
                      <span aria-hidden="true">{have ? sv.emoji : '❔'}</span>
                      <span lang="es">{have ? sv.es : 'Find it on a quest'}</span>
                    </button>
                  </li>
                )
              })}
            </ul>
          </section>
        )
      })}
      <p className="text-center text-xs text-muted">
        Souvenirs come from <Link to="/" className="font-bold underline">daily quests</Link> and lucky finds after lessons. <Chip>{owned.size} owned</Chip>
      </p>
    </div>
  )
}
