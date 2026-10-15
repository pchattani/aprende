import { useMemo, useState } from 'react'
import { vocab } from '../engine/loader'
import { Rng } from '../engine/random'
import { PageHeader, Button, Chip, SpeakerButton } from '../components/ui/basics'
import { TargetText } from '../components/ui/TargetText'
import { recordAnswer } from '../db/progress'
import { playSound } from '../engine/sounds'
import { LEVEL_ORDER, type VocabEntry } from '../engine/schema'

/** Measure words (classifiers): a table grouped by classifier and a quick "which classifier?" drill. */
export default function Classifiers() {
  const nouns = useMemo(() => [...vocab.values()].filter((v) => v.pos === 'noun' && v.cl), [])
  const classifiers = useMemo(() => {
    const m = new Map<string, VocabEntry[]>()
    for (const n of nouns) m.set(n.cl!, [...(m.get(n.cl!) ?? []), n])
    return [...m.entries()].sort((a, b) => b[1].length - a[1].length)
  }, [nouns])
  const clEntry = (cl: string) => [...vocab.values()].find((v) => v.lemma === cl && v.pos === 'classifier')
  const [mode, setMode] = useState<'table' | 'drill'>('drill')
  return (
    <div className="pb-6">
      <PageHeader title="Measure words" subtitle="Every noun is counted with its own classifier: 一隻狗, 一本書, 一張枱." right={<Chip tone="brand">{classifiers.length} classifiers</Chip>} />
      <div className="mb-3 flex gap-2">
        <button type="button" onClick={() => setMode('drill')} className={`flex-1 rounded-2xl py-2 text-sm font-bold ${mode === 'drill' ? 'bg-brand-600 text-white' : 'bg-surface-2 text-muted'}`}>Drill</button>
        <button type="button" onClick={() => setMode('table')} className={`flex-1 rounded-2xl py-2 text-sm font-bold ${mode === 'table' ? 'bg-brand-600 text-white' : 'bg-surface-2 text-muted'}`}>Table</button>
      </div>
      {mode === 'table' ? (
        <div className="grid gap-3">
          {classifiers.map(([cl, list]) => {
            const e = clEntry(cl)
            return (
              <section key={cl} className="card">
                <div className="flex items-center gap-3">
                  <SpeakerButton text={cl} size="sm" />
                  <p className="font-display text-2xl"><TargetText text={cl} /></p>
                  <p className="text-sm text-muted">{e?.en.join(', ') ?? ''} · {list.length} nouns</p>
                </div>
                <ul className="mt-2 flex flex-wrap gap-1.5">
                  {list.slice(0, 40).map((n) => (
                    <li key={n.id} className="rounded-xl bg-surface-2 px-2 py-1 text-sm" title={n.en.join(', ')}>
                      <TargetText text={`一${cl}${n.lemma}`} /> <span className="text-xs text-muted">{n.en[0]}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )
          })}
        </div>
      ) : (
        <Drill nouns={nouns} classifiers={classifiers.map(([cl]) => cl)} />
      )}
    </div>
  )
}

function Drill({ nouns, classifiers }: { nouns: VocabEntry[]; classifiers: string[] }) {
  const [rng] = useState(() => new Rng(Date.now()))
  const [level, setLevel] = useState(0)
  const pool = useMemo(() => nouns.filter((n) => LEVEL_ORDER.indexOf(n.level) <= level), [nouns, level])
  const make = () => {
    if (!pool.length) return undefined
    const n = rng.pick(pool)
    const others = rng.sample(classifiers.filter((c) => c !== n.cl), 3)
    const options = rng.shuffle([n.cl!, ...others])
    return { n, options }
  }
  const [q, setQ] = useState(make)
  const [picked, setPicked] = useState<string | undefined>()
  const [score, setScore] = useState({ right: 0, total: 0 })
  if (!q) return <p className="card text-sm text-muted">No nouns with classifiers at this level yet.</p>
  const answer = (c: string) => {
    if (picked) return
    setPicked(c)
    const ok = c === q.n.cl
    void recordAnswer(q.n.id, ok ? 'correct' : 'wrong', 'fillBlank')
    playSound(ok ? 'correct' : 'wrong')
    setScore((s) => ({ right: s.right + (ok ? 1 : 0), total: s.total + 1 }))
  }
  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-1.5">
        {LEVEL_ORDER.map((l, i) => (
          <button key={l} type="button" onClick={() => { setLevel(i); setPicked(undefined); setQ(make()) }} className={`rounded-full px-3 py-1 text-xs font-extrabold ${i === level ? 'bg-brand-gradient text-white' : 'bg-surface-2 text-muted'}`}>up to {l.toUpperCase()}</button>
        ))}
      </div>
      <div className="card text-center">
        <p className="text-xs font-extrabold uppercase tracking-wider text-brand-600">Which measure word?</p>
        <p className="mt-3 font-display text-3xl"><TargetText text={`一 ＿ ${q.n.lemma}`} /></p>
        <p className="text-sm text-muted">one {q.n.en[0]}</p>
        <div className="mt-4 grid grid-cols-2 gap-2" role="radiogroup">
          {q.options.map((c) => {
            const cls = picked ? (c === q.n.cl ? 'correct' : c === picked ? 'wrong' : '') : ''
            return (
              <button key={c} type="button" role="radio" aria-checked={picked === c} disabled={Boolean(picked)} onClick={() => answer(c)} className={`tile py-3 text-xl ${cls}`}>
                <TargetText text={c} />
              </button>
            )
          })}
        </div>
        {picked && (
          <div className="mt-3">
            <p className="font-bold"><TargetText text={`一${q.n.cl}${q.n.lemma}`} /></p>
            <Button className="mt-3 w-full" onClick={() => { setPicked(undefined); setQ(make()) }}>Next</Button>
          </div>
        )}
        <p className="mt-3 text-xs font-bold text-muted">{score.right} / {score.total} right</p>
      </div>
    </div>
  )
}
