/** Dev gallery of the illustrations (dogs, postcards, logo). Reached at #/art. */
import type { ReactNode } from 'react'
import type { Act } from '../components/art/dogPose'
import { Leo, Bonchita, Luna, DogStamp, DogsTrio } from '../components/ui/Dogs'
import { PaintedScene } from '../components/art/PaintedScene'
import { PostcardFrame, Postcard, Postmark, MiniStamp } from '../components/art/PostcardFrame'
import { PawsportMark, PawsportWordmark } from '../components/art/Logo'
import { MOTIFS, motifSample, type Motif, type Accent, type TimeOfDay } from '../engine/scenes'
import { REGIONS, wearableSouvenirs } from '../engine/journey'
import { COURSE_ID } from '../engine/course'
import type { LevelId } from '../engine/schema'
import type { Outfit } from '../hooks/useOutfits'
import { SouvenirArt, SouvenirIcon } from '../components/art/SouvenirArt'
import { ART_KINDS, WARDROBE_KINDS, WARDROBE_COLOURS, type WearSlot } from '../engine/artKinds'
import { Pictogram } from '../components/art/Pictogram'
import { PICTOGRAMS } from '../engine/pictograms'

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
const DOG_IDS = ['leo', 'bonchita', 'luna'] as const

/** Outfits from wardrobe-style ids (`wear-<kind>[-<colour>]`), which the dogs can draw before the souvenir list has them. */
const dress = (o: Partial<Record<WearSlot, string>>) => o as Outfit
const WARDROBE_OUTFITS: Outfit[] = [
  dress({ hat: 'wear-beret-red', eyes: 'wear-round-glasses-black', neck: 'wear-scarf-yellow', paw: 'wear-balloon-blue' }),
  dress({ hat: 'wear-cap-blue', eyes: 'wear-sunglasses-black', neck: 'wear-bandana-red', paw: 'wear-umbrella-yellow' }),
  dress({ hat: 'wear-beanie-green', eyes: 'wear-round-glasses-orange', neck: 'wear-bowtie-purple', paw: 'wear-balloon-pink' }),
  dress({ hat: 'wear-sunhat-pink', eyes: 'wear-sunglasses-purple', neck: 'wear-scarf-blue', paw: 'wear-umbrella-green' }),
  dress({ hat: 'wear-bucket-hat-orange', eyes: 'wear-sunglasses-red', neck: 'wear-bowtie-black', paw: 'wear-balloon-yellow' }),
]
/** Souvenir combinations (non-wardrobe kinds worn in each slot). */
const SOUVENIR_OUTFITS: { label: string; outfit: Outfit }[] = [
  { label: 'poncho · mate · alfajor', outfit: dress({ neck: 'wear-poncho', paw: 'wear-mate', mouth: 'wear-cookie' }) },
  { label: 'shirt · medialuna · ball', outfit: dress({ neck: 'wear-football-shirt', mouth: 'wear-croissant', paw: 'wear-football' }) },
  { label: 'mask · lei · fan', outfit: dress({ eyes: 'wear-carnival-mask', neck: 'wear-lei', paw: 'wear-fan' }) },
  { label: 'sombrero · guitar · flower', outfit: dress({ hat: 'wear-sombrero', paw: 'wear-guitar', mouth: 'wear-flower' }) },
  { label: 'flower · camera · bandoneón', outfit: dress({ hat: 'wear-flower', neck: 'wear-camera', paw: 'wear-accordion' }) },
  { label: 'mask up · medal · baguette', outfit: dress({ hat: 'wear-carnival-mask', neck: 'wear-medal', mouth: 'wear-baguette', paw: 'wear-lantern' }) },
  { label: 'feather · necklace · dumpling', outfit: dress({ hat: 'wear-feather', neck: 'wear-necklace', mouth: 'wear-dumpling', paw: 'wear-drum' }) },
]

const ACTS: Act[] = ['idle', 'talk', 'cheer', 'sad', 'curious', 'think', 'sleepy', 'walk', 'wave']

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

      <Section title="Characters" shot="acts" note="Each dog is a rig: idle (breathing, blinking), talk, cheer, sad, curious, think, sleepy, walk and wave.">
        {DOGS.map((D, i) => (
          <div key={i} data-shot={`acts${i}`} className="mb-4 flex flex-wrap items-end gap-3">
            {ACTS.map((a) => (
              <div key={a} className="text-center">
                <D size={130} act={a} />
                <Label>{a}</Label>
              </div>
            ))}
          </div>
        ))}
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

      <Section title="Dog stamps" shot="stamps" note="Speaker avatars beside exercise prompts (78px there), at 60, 78 and 120px in each mood: the dog is a bust, head on neck and shoulders.">
        {[120, 78, 60].map((size) => (
          <div key={size} data-shot={`stamps${size}`} className="mb-4 flex flex-wrap items-end gap-4">
            {DOG_IDS.map((d) => MOODS.map((m, i) => <DogStamp key={`${d}${m}`} dog={d} size={size} mood={m} tilt={size === 78 ? (i - 1) * 3 : 0} />))}
          </div>
        ))}
        <div className="flex flex-wrap items-end gap-4">
          {DOG_IDS.map((d) => <DogStamp key={`x${d}`} dog={d} size={44} />)}
        </div>
      </Section>

      <Section title={`Souvenirs (${ART_KINDS.length} kinds)`} shot="souvenirs" note="Every ART_KIND at 32 and 72px, in its default colour.">
        <div className="grid grid-cols-3 gap-x-2 gap-y-3 sm:grid-cols-6 lg:grid-cols-9">
          {ART_KINDS.map((k) => (
            <div key={k} className="flex flex-col items-center">
              <div className="flex items-end gap-1">
                <SouvenirArt kind={k} size={32} />
                <SouvenirArt kind={k} size={72} title={k} />
              </div>
              <Label>{k}</Label>
            </div>
          ))}
        </div>
        <div className="mt-4 flex items-end gap-3">
          <SouvenirIcon souvenir={{ emoji: '🧉', art: 'mate' }} size={40} />
          <SouvenirIcon souvenir={{ emoji: '🧉' }} size={40} />
          <SouvenirIcon souvenir={{ emoji: '🎁', art: 'not-a-kind' }} size={40} />
          <Label>SouvenirIcon: art · emoji fallback · unknown art</Label>
        </div>
      </Section>

      <Section title="Wardrobe" shot="wardrobe" note="The 12 wardrobe kinds in all 8 colours (48px).">
        <div className="overflow-x-auto">
          <table className="border-separate border-spacing-1">
            <thead>
              <tr>
                <th />
                {WARDROBE_COLOURS.map((c) => <th key={c.id} className="font-mono text-[10px] text-muted">{c.id}</th>)}
              </tr>
            </thead>
            <tbody>
              {WARDROBE_KINDS.map(({ kind, slot }) => (
                <tr key={kind}>
                  <td className="pr-2 text-right font-mono text-[10px] text-muted">{kind}<br />{slot}</td>
                  {WARDROBE_COLOURS.map((c) => <td key={c.id}><SouvenirArt kind={kind} color={c.hex} size={48} /></td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section title="Dress-up" shot="dressup" note="Hat + glasses + neck + paw items fitted to each dog (160 and 64px, all moods), then souvenir combinations.">
        <div data-shot="dressup-wardrobe" className="mb-4 flex flex-wrap items-end gap-3">
          {DOGS.map((D, i) => WARDROBE_OUTFITS.slice(0, 3).map((_o, k) => <D key={`${i}${k}`} size={160} mood={MOODS[(i + k) % 3]} outfit={WARDROBE_OUTFITS[(i + k) % WARDROBE_OUTFITS.length]} />))}
        </div>
        <div data-shot="dressup-small" className="mb-4 flex flex-wrap items-end gap-2">
          {DOGS.map((D, i) => WARDROBE_OUTFITS.map((o, k) => <D key={`${i}${k}`} size={64} outfit={o} />))}
        </div>
        <div data-shot="dressup-souvenirs" className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-7">
          {SOUVENIR_OUTFITS.map(({ label, outfit }, k) => (
            <div key={label}>
              {DOGS.map((D, i) => <D key={i} size={i === k % 3 ? 130 : 0} outfit={outfit} style={i === k % 3 ? undefined : { display: 'none' }} />)}
              <Label>{label}</Label>
            </div>
          ))}
        </div>
      </Section>

      <Section title={`Pictograms (${Object.keys(PICTOGRAMS).length})`} shot="pictograms" note="Where a character came from: picture → ancient form → today. Used in pictogram exercises (last tile hidden until answered) and in the guidebook of lessons that teach writing.">
        <div className="grid gap-x-6 gap-y-5 sm:grid-cols-2 lg:grid-cols-3">
          {Object.entries(PICTOGRAMS).map(([char, info]) => (
            <div key={char}>
              <Pictogram char={char} />
              <p className="mt-1 text-sm"><span className="font-bold">{char}</span> {info.en} <span className="text-muted">· {info.type}</span></p>
              <p className="text-xs text-muted">{info.story}</p>
            </div>
          ))}
          <div>
            <Pictogram char="火" reveal={false} />
            <Label>reveal=false (pictogram exercise before answering)</Label>
          </div>
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
