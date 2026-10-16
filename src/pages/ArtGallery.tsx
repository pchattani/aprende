/** Dev gallery of the illustrations (dogs, postcards, logo). Reached at #/art. */
import type { ReactNode } from 'react'
import { Leo, Bonchita, Luna, DogStamp, DogsTrio } from '../components/ui/Dogs'
import { PaintedScene } from '../components/art/PaintedScene'
import { PostcardFrame, Postcard, Postmark, MiniStamp } from '../components/art/PostcardFrame'
import { PawsportMark, PawsportWordmark } from '../components/art/Logo'
import { MOTIFS, motifSample, type Motif, type Accent, type TimeOfDay } from '../engine/scenes'
import { REGIONS, wearableSouvenirs } from '../engine/journey'
import { COURSE_ID } from '../engine/course'
import type { LevelId } from '../engine/schema'
import type { Outfit } from '../hooks/useOutfits'

const DOGS = [Leo, Bonchita, Luna]
const MOODS = ['happy', 'curious', 'sleepy'] as const
const LEVELS: LevelId[] = ['a1', 'a2', 'b1', 'b2', 'c1', 'c2']

/** One sample per motif, spread over regions and times so the palettes show too. */
const SAMPLES: { motif: Motif; variant?: string; accent?: Accent; time?: TimeOfDay }[] = [
  ...MOTIFS.map((motif) => ({ motif })),
  { motif: 'tower', variant: 'lattice', time: 'dusk' },
  { motif: 'tower', variant: 'leaning' },
  { motif: 'desert', variant: 'rainbow' },
  { motif: 'desert', variant: 'salt' },
  { motif: 'glacier', variant: 'shore', accent: 'penguins' },
  { motif: 'canal', variant: 'venice', accent: 'gondola', time: 'golden' },
  { motif: 'castle', variant: 'chateau' },
  { motif: 'castle', variant: 'abbey-island' },
  { motif: 'oldtown', variant: 'hill', accent: 'tram', time: 'dusk' },
  { motif: 'skyline', variant: 'harbour', accent: 'fireworks', time: 'night' },
  { motif: 'cliffs', variant: 'village' },
  { motif: 'farm', variant: 'lavender' },
]
const TIMES: TimeOfDay[] = ['day', 'golden', 'day', 'dawn', 'day', 'dusk']

function Section({ title, shot, children, note }: { title: string; shot: string; children: ReactNode; note?: string }) {
  return (
    <section data-shot={shot} className="rounded-2xl p-4" style={{ background: 'var(--paper)' }}>
      <h2 className="mb-1 text-2xl">{title}</h2>
      {note && <p className="mb-3 text-sm text-muted">{note}</p>}
      {children}
    </section>
  )
}

function Label({ children }: { children: ReactNode }) {
  return <p className="mt-1 text-center font-mono text-[10px] text-muted">{children}</p>
}

export default function ArtGallery() {
  const wear = wearableSouvenirs()
  const ofSlot = (slot: string) => wear.filter((s) => s.wearable?.slot === slot).map((s) => s.id)
  const outfits: Outfit[] = [{ hat: ofSlot('hat')[0] }, { neck: ofSlot('neck')[0], paw: ofSlot('paw')[0] }, { mouth: ofSlot('mouth')[0], hat: ofSlot('hat')[1] }]
  return (
    <div className="relative left-1/2 w-[min(100vw,1180px)] -translate-x-1/2 space-y-6 px-4 pb-10">
      <header className="pt-2">
        <PawsportWordmark size={40} />
        <p className="mt-2 text-sm text-muted">
          Illustration gallery · course <span className="font-mono">{COURSE_ID}</span>
        </p>
      </header>

      <Section title="Brand mark" shot="logo">
        <div className="flex flex-wrap items-end gap-6">
          {[16, 24, 32, 48, 96].map((s) => (
            <div key={s}>
              <PawsportMark size={s} />
              <Label>{s}px</Label>
            </div>
          ))}
          <div className="text-blue">
            <PawsportMark size={48} />
            <Label>currentColor</Label>
          </div>
          <PawsportWordmark size={28} />
          <PawsportWordmark size={44} />
          <div>
            <img src={`${import.meta.env.BASE_URL}favicon.svg`} width={32} height={32} alt="favicon" />
            <Label>favicon</Label>
          </div>
          <div>
            <img src={`${import.meta.env.BASE_URL}icons/icon-192.png`} width={72} height={72} alt="app icon" className="rounded-2xl" />
            <Label>icon-192</Label>
          </div>
        </div>
      </Section>

      <Section title="Dogs" shot="dogs" note="Moods happy / curious / sleepy at 240, 96 and 40px. Filters and fur texture switch off below 64px.">
        {[240, 96, 40].map((s) => (
          <div key={s} data-shot={`dogs${s}`} className="mb-4 flex flex-wrap items-end gap-3">
            {DOGS.map((D, i) => MOODS.map((m) => <D key={`${i}${m}`} size={s} mood={m} />))}
          </div>
        ))}
      </Section>

      <Section title="Outfits" shot="outfits" note="Souvenirs worn at each dog's hat / neck / mouth / paw anchors.">
        <div className="flex flex-wrap items-end gap-4">
          {DOGS.map((D, i) => outfits.map((o, k) => <D key={`${i}${k}`} size={120} outfit={o} />))}
        </div>
      </Section>

      <Section title="Dog stamps" shot="stamps" note="Speaker avatars beside exercise prompts.">
        <div className="flex flex-wrap items-end gap-5">
          {(['leo', 'bonchita', 'luna'] as const).map((d) => <DogStamp key={d} dog={d} size={96} />)}
          {(['leo', 'bonchita', 'luna'] as const).map((d, i) => <DogStamp key={`s${d}`} dog={d} size={64} mood={MOODS[i]} tilt={i - 1} />)}
          {(['leo', 'bonchita', 'luna'] as const).map((d) => <DogStamp key={`x${d}`} dog={d} size={44} />)}
        </div>
      </Section>

      <Section title="The three together" shot="trio">
        <div className="flex flex-wrap items-end gap-6">
          {(['celebrate', 'wave', 'sleep'] as const).map((p) => (
            <div key={p}>
              <DogsTrio pose={p} size={340} />
              <Label>{p}</Label>
            </div>
          ))}
          <div>
            <DogsTrio pose="celebrate" size={160} />
            <Label>celebrate · 160</Label>
          </div>
        </div>
      </Section>

      <Section title="Postcard frame" shot="frame">
        <div className="flex flex-wrap items-start gap-8">
          <div style={{ width: 300 }}>
            <PostcardFrame caption="¡Llegamos!" stamp postmark place="Buenos Aires" date="16 OCT 26" tilt={-2}>
              <PaintedScene scene={motifSample('harbour', 'a1', 'golden', undefined, 'sailboats')} className="block h-full w-full" />
            </PostcardFrame>
          </div>
          <div style={{ width: 240 }}>
            <PostcardFrame caption="progress 0.35" tilt={1.5}>
              <PaintedScene scene={motifSample('plaza', 'b1', 'day', 'cathedral')} progress={0.35} className="block h-full w-full" />
            </PostcardFrame>
          </div>
          <Postmark place="Ushuaia · Fin del mundo" date="02 FEB 27" />
          <MiniStamp size={48} color="#2f6fc0" value="35" />
        </div>
      </Section>

      <Section title={`Motifs (${MOTIFS.length})`} shot="motifs" note="Each motif with a sample palette; extra rows show variants and accents.">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {SAMPLES.map((s, i) => (
            <div key={i}>
              <PostcardFrame>
                <PaintedScene scene={motifSample(s.motif, LEVELS[i % 6], s.time ?? TIMES[i % TIMES.length], s.variant, s.accent)} lazy className="block h-full w-full" />
              </PostcardFrame>
              <Label>
                {s.motif}
                {s.variant ? ` · ${s.variant}` : ''}
                {s.accent ? ` + ${s.accent}` : ''}
              </Label>
            </div>
          ))}
        </div>
      </Section>

      {REGIONS.map((region) => (
        <Section key={region.level} title={`${region.level.toUpperCase()} · ${region.name}`} shot={`stops-${region.level}`} note="Each stop at progress 0 / 0.5 / 1 and fade 0.7.">
          <div className="space-y-3">
            {region.stops.map((stop) => (
              <div key={stop.unitId} className={`lvl-${region.level}`}>
                <p className="mb-1 text-sm font-bold">
                  <span className="font-mono text-xs text-muted">{stop.unitId}</span> {stop.name} <span className="text-muted">· {stop.en}</span>
                </p>
                <div className="grid grid-cols-4 gap-3">
                  {[0, 0.5, 1].map((p) => (
                    <Postcard key={p} stop={stop} level={region.level} progress={p} quality="thumb" lazy />
                  ))}
                  <Postcard stop={stop} level={region.level} fade={0.7} quality="thumb" lazy />
                </div>
              </div>
            ))}
          </div>
        </Section>
      ))}

      <Section title="Full size" shot="hero" note="A few stops at full quality.">
        <div className="grid gap-6 sm:grid-cols-2">
          {REGIONS.slice(0, 6).map((region, i) => {
            const stop = region.stops[(i * 5 + 2) % region.stops.length]!
            return <Postcard key={stop.unitId} stop={stop} level={region.level} caption={stop.name} stamp postmark date="16 OCT 26" tilt={i % 2 ? 1.2 : -1.4} lazy />
          })}
        </div>
      </Section>
    </div>
  )
}
