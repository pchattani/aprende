import { Link } from 'react-router'
import { PageHeader } from '../components/ui/basics'
import { IconBook, IconVerb, IconEar } from '../components/ui/icons'

export default function Study() {
  const items = [
    { to: '/grammar', icon: IconBook, title: 'Grammar reference', text: 'Every grammar point from A1 to C2, searchable, with examples and pitfalls.' },
    { to: '/verbs', icon: IconVerb, title: 'Verb trainer', text: 'Full conjugation tables and timed drills for every tense and mood.' },
    { to: '/pronunciation', icon: IconEar, title: 'Pronunciation', text: 'Sounds, stress and the written accent, minimal pairs and shadowing.' },
  ]
  return (
    <div>
      <PageHeader title="Tools" subtitle="Reference and drills alongside the course." />
      <div className="grid gap-3">
        {items.map((it) => (
          <Link key={it.to} to={it.to} className="card flex items-center gap-4 transition hover:-translate-y-0.5 active:scale-[0.99]">
            <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-white ${['bg-brand-gradient', 'bg-sunset-gradient', 'bg-mint-gradient'][items.indexOf(it)]}`}>
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
