import { useMemo, useState } from 'react'
import { vocab } from '../engine/loader'
import { conjugate, PERSONS, TENSES, TENSE_LABELS, withReflexive, type Tense } from '../lang/es/verbs'
import { match, stripAccents } from '../lang/es/normalize'
import { Rng } from '../engine/random'
import { PageHeader, Button, Chip, SpeakerButton } from '../components/ui/basics'
import { IconSearch } from '../components/ui/icons'
import { SPECIAL_CHARS } from '../components/exercises/chars'
import { LEVEL_ORDER, type LevelId } from '../engine/schema'


export default function Verbs() {
  const verbs = useMemo(() => [...vocab.values()].filter((v) => v.pos === 'verb' && !v.lemma.includes(' ')).sort((a, b) => a.lemma.localeCompare(b.lemma)), [])
  const [q, setQ] = useState('')
  const [lemma, setLemma] = useState('ser')
  const [tense, setTense] = useState<Tense>('pres')
  const [mode, setMode] = useState<'table' | 'drill'>('table')
  const suggestions = useMemo(() => {
    const n = stripAccents(q.toLowerCase())
    return n ? verbs.filter((v) => stripAccents(v.lemma).startsWith(n)).slice(0, 8) : []
  }, [q, verbs])
  const conj = useMemo(() => {
    try {
      return conjugate(lemma)
    } catch {
      return undefined
    }
  }, [lemma])
  const entry = verbs.find((v) => v.lemma === lemma)

  return (
    <div className="pb-6">
      <PageHeader title="Verbs" subtitle="Tables for any verb, drills for every tense." right={<Chip tone="brand">{verbs.length} verbs</Chip>} />
      <div className="mb-3 flex gap-2">
        <button type="button" onClick={() => setMode('table')} className={`flex-1 rounded-2xl py-2 text-sm font-bold ${mode === 'table' ? 'bg-brand-600 text-white' : 'bg-surface-2 text-muted'}`}>Tables</button>
        <button type="button" onClick={() => setMode('drill')} className={`flex-1 rounded-2xl py-2 text-sm font-bold ${mode === 'drill' ? 'bg-brand-600 text-white' : 'bg-surface-2 text-muted'}`}>Drill</button>
      </div>
      {mode === 'table' ? (
        <>
          <div className="relative mb-3">
            <label className="flex items-center gap-2 rounded-2xl border-2 border-line bg-surface px-3">
              <IconSearch className="text-muted" width={18} height={18} />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && q.trim()) {
                    setLemma(q.trim().toLowerCase())
                    setQ('')
                  }
                }}
                placeholder="Type a verb (hablar, tener, irse…)"
                className="w-full bg-transparent py-2 outline-none"
                lang="es"
                aria-label="Verb"
              />
            </label>
            {suggestions.length > 0 && (
              <ul className="absolute z-10 mt-1 w-full overflow-hidden rounded-2xl border-2 border-line bg-surface shadow-lg">
                {suggestions.map((v) => (
                  <li key={v.id}>
                    <button type="button" className="flex w-full justify-between px-3 py-2 text-left" onClick={() => { setLemma(v.lemma); setQ('') }}>
                      <span className="font-bold" lang="es">{v.lemma}</span>
                      <span className="text-sm text-muted">{v.en[0]}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          {conj ? (
            <div className="card">
              <div className="mb-3 flex items-center gap-3">
                <SpeakerButton text={conj.lemma} size="sm" />
                <div>
                  <h2 className="text-2xl font-extrabold" lang="es">{conj.lemma}</h2>
                  <p className="text-sm text-muted">{entry?.en.join(', ') ?? ''} · participle <b lang="es">{conj.participle}</b> · gerund <b lang="es">{conj.gerund}</b></p>
                </div>
              </div>
              <div className="mb-3 flex gap-1 overflow-x-auto pb-1">
                {TENSES.map((t) => (
                  <button key={t} type="button" onClick={() => setTense(t)} className={`shrink-0 rounded-full px-3 py-1 text-xs font-bold ${tense === t ? 'bg-sky-500 text-white' : 'bg-surface-2 text-muted'}`}>
                    {TENSE_LABELS[t].en}
                  </button>
                ))}
              </div>
              <p className="mb-2 text-sm text-muted">
                <span lang="es" className="font-bold">{TENSE_LABELS[tense].es}</span> · introduced at {TENSE_LABELS[tense].level.toUpperCase()}
              </p>
              <table className="w-full text-sm">
                <tbody>
                  {PERSONS.map((p, i) => {
                    const f = conj.reflexive ? withReflexive(conj.forms[tense][i], i, tense) : conj.forms[tense][i]
                    return (
                      <tr key={p} className="border-t border-line">
                        <td className="py-2 pr-2 text-muted">{p}</td>
                        <td className="py-2 font-bold" lang="es">{f ?? '—'}</td>
                        <td className="py-2 text-right">{f && <SpeakerButton text={f} size="sm" />}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="card text-sm text-muted">That does not look like a Spanish infinitive (it should end in -ar, -er or -ir).</p>
          )}
        </>
      ) : (
        <Drill verbs={verbs.map((v) => ({ lemma: v.lemma, level: v.level }))} />
      )}
    </div>
  )
}

function Drill({ verbs }: { verbs: { lemma: string; level: LevelId }[] }) {
  const [tenses, setTenses] = useState<Set<Tense>>(new Set(['pres']))
  const [maxLevel, setMaxLevel] = useState<LevelId>('a1')
  const [rng] = useState(() => new Rng(Date.now()))
  const [q, setQ] = useState<{ lemma: string; tense: Tense; person: number; answer: string } | undefined>()
  const [text, setText] = useState('')
  const [state, setState] = useState<'ask' | 'ok' | 'almost' | 'bad'>('ask')
  const [score, setScore] = useState({ right: 0, total: 0 })

  const pool = verbs.filter((v) => LEVEL_ORDER.indexOf(v.level) <= LEVEL_ORDER.indexOf(maxLevel))
  const next = () => {
    if (!pool.length || tenses.size === 0) return
    for (let tries = 0; tries < 20; tries++) {
      const v = rng.pick(pool)
      const t = rng.pick([...tenses])
      const person = t === 'impAff' || t === 'impNeg' ? 1 + rng.int(5) : rng.int(6)
      const c = conjugate(v.lemma)
      const raw = c.forms[t][person]
      const answer = c.reflexive ? withReflexive(raw, person, t) : raw
      if (answer) {
        setQ({ lemma: v.lemma, tense: t, person, answer })
        setText('')
        setState('ask')
        return
      }
    }
  }
  const check = () => {
    if (!q) return
    const r = match(text, [q.answer])
    setState(r.verdict === 'correct' ? 'ok' : r.verdict === 'almost' ? 'almost' : 'bad')
    setScore((s) => ({ right: s.right + (r.verdict !== 'wrong' ? 1 : 0), total: s.total + 1 }))
  }
  return (
    <div className="card">
      <p className="mb-2 text-xs font-bold uppercase tracking-wide text-muted">Tenses</p>
      <div className="mb-3 flex flex-wrap gap-1.5">
        {TENSES.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => {
              const n = new Set(tenses)
              if (n.has(t)) n.delete(t)
              else n.add(t)
              setTenses(n)
            }}
            className={`rounded-full px-3 py-1 text-xs font-bold ${tenses.has(t) ? 'bg-sky-500 text-white' : 'bg-surface-2 text-muted'}`}
          >
            {TENSE_LABELS[t].en}
          </button>
        ))}
      </div>
      <p className="mb-2 text-xs font-bold uppercase tracking-wide text-muted">Verbs up to level</p>
      <div className="mb-4 flex gap-1.5">
        {LEVEL_ORDER.map((l) => (
          <button key={l} type="button" onClick={() => setMaxLevel(l)} className={`rounded-full px-3 py-1 text-xs font-bold uppercase ${maxLevel === l ? 'bg-brand-600 text-white' : 'bg-surface-2 text-muted'}`}>
            {l}
          </button>
        ))}
      </div>
      {!q ? (
        <Button className="w-full" onClick={next} disabled={tenses.size === 0 || pool.length === 0}>
          Start drilling ({pool.length} verbs)
        </Button>
      ) : (
        <div>
          <p className="text-sm text-muted">
            Score {score.right}/{score.total}
          </p>
          <p className="mt-2 text-2xl font-extrabold" lang="es">{q.lemma}</p>
          <p className="text-sm">
            <Chip tone="sky">{TENSE_LABELS[q.tense].en}</Chip> <Chip>{PERSONS[q.person]}</Chip>
          </p>
          <input
            value={text}
            disabled={state !== 'ask'}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key !== 'Enter') return
              if (state === 'ask') check()
              else next()
            }}
            className="mt-3 w-full rounded-2xl border-2 border-line bg-surface-2 p-3 text-lg outline-none focus:border-sky-500"
            lang="es"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            aria-label="Verb form"
          />
          <div className="mt-2 flex flex-wrap gap-1.5">
            {SPECIAL_CHARS.slice(0, 7).map((c) => (
              <button key={c} type="button" onClick={() => setText((t) => t + c)} className="rounded-lg border-2 border-line bg-surface px-2.5 py-1 font-bold" lang="es">
                {c}
              </button>
            ))}
          </div>
          {state !== 'ask' && (
            <p className={`mt-3 rounded-xl p-3 font-bold ${state === 'bad' ? 'bg-bad-100 text-bad-700' : 'bg-ok-100 text-ok-700'}`} lang="es">
              {state === 'ok' ? '¡Correcto!' : state === 'almost' ? `Almost: ${q.answer}` : `Answer: ${q.answer}`}
            </p>
          )}
          <div className="mt-3 grid grid-cols-2 gap-2">
            <Button variant="ghost" onClick={() => setQ(undefined)}>Stop</Button>
            {state === 'ask' ? (
              <Button variant="ok" onClick={check} disabled={!text.trim()}>Check</Button>
            ) : (
              <Button onClick={next}>Next</Button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
