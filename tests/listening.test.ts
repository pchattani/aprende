import { describe, it, expect } from 'vitest'
import { buildListening, buildQuiz as quizOf, readerPieces, splitSentences, estimateSeconds, formatDuration, siblingEnglish, type ListenPiece } from '@/engine/listening'
import { listeningPieces, listeningPiece, unitDialogues } from '@/engine/listeningData'
import { readers, levels } from '@/engine/loader'
import { LEVEL_ORDER, type Reader } from '@/engine/schema'
import { languagePack } from '@lang'

// Runs for the current course (VITE_LANG): node scripts/courses.mjs "npx vitest run tests/listening.test.ts".

describe('splitSentences', () => {
  it('splits after . ! ? and keeps numbers, abbreviations and quotes together', () => {
    expect(splitSentences('¡Hola! Buenos días. ¿Qué tal?')).toEqual(['¡Hola!', 'Buenos días.', '¿Qué tal?'])
    expect(splitSentences('Son 1.400 personas. El Sr. García llega.')).toEqual(['Son 1.400 personas.', 'El Sr. García llega.'])
    expect(splitSentences('I say: "It\'s a bun. It\'s good!" Then I go.')).toEqual(['I say: "It\'s a bun. It\'s good!"', 'Then I go.'])
  })
  it('splits Cantonese on full-width marks, not inside 「」', () => {
    expect(splitSentences('我話：「呢個係菠蘿包，好好食㗎！」Ana食一個。佢好開心！')).toEqual(['我話：「呢個係菠蘿包，好好食㗎！」', 'Ana食一個。', '佢好開心！'])
  })
})

describe('listening list', () => {
  it('has pieces for every level the course has content for', () => {
    expect(listeningPieces.length).toBeGreaterThan(50)
    const withContent = new Set([...readers.map((r) => r.level), ...unitDialogues.filter((u) => u.dialogues.length).map((u) => u.id.split('.')[0])])
    for (const lvl of levels) if (withContent.has(lvl.id)) expect(listeningPieces.some((p) => p.level === lvl.id)).toBe(true)
  })

  it('is deterministic and independent of input order', () => {
    const again = buildListening([...readers].reverse(), [...unitDialogues].reverse())
    expect(again.map((p) => p.id)).toEqual(listeningPieces.map((p) => p.id))
    expect(JSON.stringify(again)).toBe(JSON.stringify(listeningPieces))
  })

  it('has unique, stable, URL-safe ids', () => {
    const ids = listeningPieces.map((p) => p.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const p of listeningPieces) {
      expect(p.id).toMatch(/^[a-z0-9.-]+$/)
      expect(listeningPiece(p.id)).toBe(p)
      if (p.kind === 'dialogue') expect(p.id).toMatch(/^d\.[a-c][12]\.u\d{2}\.d\d+$/)
      else expect(p.id).toMatch(/^r\.[a-z0-9.-]+\.p\d+$/)
    }
  })

  it('is ordered by level', () => {
    const order = listeningPieces.map((p) => LEVEL_ORDER.indexOf(p.level))
    expect([...order].sort((a, b) => a - b)).toEqual(order)
  })

  it('pieces are short: dialogues have two or more speakers, passages a few sentences', () => {
    for (const p of listeningPieces) {
      expect(p.lines.length).toBeGreaterThanOrEqual(2)
      expect(p.title.trim()).not.toBe('')
      expect(p.seconds).toBeGreaterThan(0)
      for (const l of p.lines) expect(l.text.trim()).not.toBe('')
      if (p.kind === 'dialogue') {
        expect(p.speakers.length).toBeGreaterThanOrEqual(2)
        expect(p.lines.every((l) => l.speaker && p.speakers.includes(l.speaker))).toBe(true)
      } else {
        expect(p.speakers).toEqual([])
        expect(p.lines.length).toBeLessThanOrEqual(12)
      }
    }
    expect(listeningPieces.some((p) => p.kind === 'dialogue')).toBe(true)
    expect(listeningPieces.some((p) => p.kind === 'passage')).toBe(true)
  })

  it('cuts reader texts into passages that keep every sentence in order', () => {
    for (const r of readers) {
      const parts = readerPieces(r)
      expect(parts.length).toBeGreaterThan(0)
      const strip = (s: string) => s.replace(/\s+/g, '')
      expect(strip(parts.flatMap((p) => p.lines.map((l) => l.text)).join(''))).toBe(strip(r.paragraphs.map((p) => p.es).join('')))
      if (parts.length > 1) parts.forEach((p, i) => expect(p.part).toEqual({ n: i + 1, of: parts.length }))
    }
  })

  it('a short reader stays one piece with its authored questions', () => {
    const r: Reader = {
      id: 'r.a1.test', level: 'a1', title: 'Test', kind: 'text', paragraphs: [{ es: 'Uno dos tres. Cuatro cinco seis.', en: 'One two three. Four five six.', altEs: [], altEn: [] }],
      questions: [{ q: 'Q?', options: ['a', 'b'], answer: 1 }], glossary: [], allow: [],
    }
    const [p, ...rest] = readerPieces(r)
    expect(rest).toEqual([])
    expect(p!.id).toBe('r.a1.test.p1')
    expect(p!.part).toBeUndefined()
    expect(p!.questions).toHaveLength(1)
    expect(p!.lines.map((l) => l.en)).toEqual(['One two three.', 'Four five six.'])
  })

  it('formats durations', () => {
    expect(formatDuration(40)).toBe('~40 s')
    expect(formatDuration(130)).toBe('~2 min')
    expect(estimateSeconds([{ text: 'hola' }])).toBeGreaterThanOrEqual(5)
  })
})

describe('listening quiz', () => {
  // As the player builds it: other passages of the same text give extra distractors.
  const buildQuiz = (p: ListenPiece, attempt = 0) => quizOf(p, attempt, siblingEnglish(p, listeningPieces))
  const check = (p: ListenPiece) => {
    const quiz = buildQuiz(p)
    expect(quiz.questions.length + (quiz.dictation ? 1 : 0)).toBeGreaterThanOrEqual(2)
    for (const q of quiz.questions) {
      expect(q.options.length).toBeGreaterThanOrEqual(2)
      expect(new Set(q.options).size).toBe(q.options.length)
      expect(q.answer).toBeGreaterThanOrEqual(0)
      expect(q.answer).toBeLessThan(q.options.length)
      expect(q.prompt.trim()).not.toBe('')
      if (q.line !== undefined) expect(p.lines[q.line]).toBeDefined()
      if (q.kind === 'who') expect(q.options[q.answer]).toBe(p.lines[q.line!]!.speaker)
      if (q.kind === 'meaning') expect(q.options[q.answer]).toBe(p.lines[q.line! + (q.span ?? 1) - 1]!.en)
    }
    if (quiz.dictation) {
      expect(p.lines[quiz.dictation.line]!.text).toBe(quiz.dictation.text)
      // The line itself grades as correct with the course's matcher.
      expect(languagePack.match(quiz.dictation.text, [quiz.dictation.text]).verdict).toBe('correct')
    }
    return quiz
  }

  it('every piece gets a valid quiz with a dictation', () => {
    for (const p of listeningPieces) {
      const quiz = check(p)
      expect(quiz.dictation).toBeDefined()
    }
  })

  it('uses the dialogue’s own questions where present, else generates some', () => {
    for (const p of listeningPieces) {
      const quiz = buildQuiz(p)
      if (p.questions.length) {
        expect(quiz.questions.every((q) => q.kind === 'authored')).toBe(true)
        expect(quiz.questions.map((q) => q.prompt)).toEqual(p.questions.map((q) => q.q))
        for (const q of quiz.questions) {
          const src = p.questions.find((s) => s.q === q.prompt)!
          expect(q.options[q.answer]).toBe(src.options[src.answer])
        }
      } else {
        expect(quiz.questions.every((q) => q.kind !== 'authored')).toBe(true)
      }
    }
    const generated = listeningPieces.filter((p) => !p.questions.length)
    expect(generated.length).toBeGreaterThan(0)
    // Nearly every passage without authored questions still gets generated ones.
    expect(generated.filter((p) => buildQuiz(p).questions.length >= 2).length / generated.length).toBeGreaterThan(0.9)
  })

  it('generates who-said questions for dialogues without questions', () => {
    const dialogues = listeningPieces.filter((p) => p.kind === 'dialogue').map((d) => ({ ...d, questions: [] }))
    const quizzes = dialogues.map((d) => check(d))
    expect(quizzes.every((q) => q.questions.length >= 2)).toBe(true)
    expect(quizzes.filter((q) => q.questions.some((x) => x.kind === 'who')).length / quizzes.length).toBeGreaterThan(0.8)
    // A who-said line never names a speaker.
    quizzes.forEach((q, i) => q.questions.filter((x) => x.kind === 'who').forEach((x) => dialogues[i]!.speakers.forEach((s) => expect(x.prompt).not.toContain(` ${s} `))))
  })

  it('is deterministic per piece and attempt', () => {
    const p = listeningPieces[0]!
    expect(buildQuiz(p, 0)).toEqual(buildQuiz(p, 0))
    expect(buildQuiz(p, 3)).toEqual(buildQuiz(p, 3))
  })
})
