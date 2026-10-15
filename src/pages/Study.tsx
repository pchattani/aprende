import { Link } from 'react-router'
import { PageHeader } from '../components/ui/basics'
import { IconBook, IconVerb, IconEar } from '../components/ui/icons'
import type { SVGProps } from 'react'
import { ui } from '../engine/loader'
import { FEATURES } from '../engine/course'

const IconCards = (p: SVGProps<SVGSVGElement>) => <span className="text-2xl" aria-hidden="true" {...(p as object)}>🎴</span>
const IconPaw = (p: SVGProps<SVGSVGElement>) => <span className="text-2xl" aria-hidden="true" {...(p as object)}>🐾</span>

export default function Study() {
  const items = [
    { to: '/grammar', icon: IconBook, title: 'Grammar reference', text: 'Every grammar point from A1 to C2, searchable, with examples and pitfalls.' },
    ...(FEATURES.conjugation ? [{ to: '/verbs', icon: IconVerb, title: 'Verb trainer', text: 'Full conjugation tables and timed drills for every tense and mood.' }] : []),
    ...(FEATURES.classifiers ? [{ to: '/classifiers', icon: IconVerb, title: 'Measure words', text: 'Which classifier each noun takes (個, 隻, 本, 張…), with a quick drill.' }] : []),
    { to: '/pronunciation', icon: IconEar, title: 'Pronunciation', text: FEATURES.romanization === 'jyutping' ? 'The six tones, Jyutping, tricky sounds, minimal pairs and shadowing.' : 'Sounds, stress and the written accent, minimal pairs and shadowing.' },
    { to: '/palabras', icon: IconCards, title: ui.games.name, text: 'Memory and quick-fire games with the words you are learning.' },
    { to: '/perros', icon: IconPaw, title: ui.dogsPage, text: 'Dress Leo, Bonchita and Luna with the souvenirs they find.' },
  ]
  return (
    <div>
      <PageHeader title="Tools" subtitle="Reference and drills alongside the course." />
      <div className="grid gap-3">
        {items.map((it) => (
          <Link key={it.to} to={it.to} className="card flex items-center gap-4 transition hover:-translate-y-0.5 active:scale-[0.99]">
            <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-white ${['bg-brand-gradient', 'bg-sunset-gradient', 'bg-mint-gradient'][items.indexOf(it) % 3]}`}>
              <it.icon />
            </div>
            <div>
              <p className="font-extrabold">{it.title}</p>
              <p className="text-sm text-muted">{it.text}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
