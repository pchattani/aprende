# Aprende — a complete Spanish course, from first words to fluency

**Live app:** https://pchattani.github.io/aprende/ (install it to your phone's home screen; it works offline)

Aprende is a free, open, no-account language course that actually teaches Spanish instead of leaving you with a bag of random words. Short daily lessons, streaks and a visible path keep you coming back, and underneath them sits a real course: explicit grammar, a frequency-ordered vocabulary of thousands of words, spaced repetition that runs the show, a reading library with coverage metering, a full verb trainer, a pronunciation course, and checkpoint exams for every CEFR level.

There is **no AI and no server**: every explanation was written by hand, and every piece of feedback is computed on your device by deterministic Spanish language engines (a full conjugator, accent rules, an agreement checker, a dictionary built from the course vocabulary) plus your browser's free text-to-speech and speech recognition.

## What's inside

| | |
|---|---|
| **Path** | CEFR levels A1 → C2, 66 units, lessons of 12–15 exercises. Mastery rings show real retention, not clicks. Checkpoint exams gate each level, and you can take one early to test out. |
| **Start anywhere** | First launch offers a five-minute adaptive placement test (built from the checkpoint exams and vocabulary) or a manual level choice. Every level also has a "Start here" button. Earlier levels stay open for practice. |
| **Fourteen exercise types** | Multiple choice, word bank, typing in both directions, listening, dictation, matching, fill-the-blank, conjugation, transformation, find-the-error, ordering, speaking (speech recognition). The type is chosen by how deeply you know each item: recognition → recall → production. |
| **Spaced repetition** | Every word, sentence and grammar point becomes a card scheduled by FSRS. The Review tab is where learning consolidates. Weak grammar points are detected and can be practised on their own. |
| **Grammar reference** | ~230 searchable notes with tables, examples, pitfalls and Latin American variants. Every exercise can explain itself. |
| **Verb trainer** | Conjugation tables for any verb in sixteen tenses (including vosotros), plus timed drills. |
| **Reader** | Graded texts and dialogues per level, plus import any Spanish text. Tap a word for its meaning and add it to your reviews. A coverage meter tells you if a text is at your level. |
| **Pronunciation** | Eight lessons on Castilian sounds, stress and the written accent, with minimal pairs and shadowing. |
| **Writing checker** | Spelling, accents (with the rule that applies), gender/number agreement, verb-form validity, punctuation and ~50 classic learner errors — all rule-based. |
| **Castilian default** | vosotros, distinción, Spain vocabulary. Latin American forms appear as variant notes from A2. |

## Pedagogy

CEFR can-do statements per unit · frequency-driven vocabulary · explicit grammar then inductive practice · spaced repetition with a modern scheduler · recognition→production ladder · comprehensible input at 95–98% coverage · four skills every day · mastery-based progression · error-focused feedback. Details in `CONTENT_GUIDE.md`.

## Content status

| Level | Units | Status |
|---|---|---|
| A1 | 12 | complete: 714 words, 48 lessons, 618 sentences, 12 dialogues, 6 readers, exam |
| A2 | 12 | complete: 642 new words, 48 lessons, 667 sentences, 12 dialogues, 8 readers, exam |
| B1 | 12 | complete: 972 new words, 48 lessons, 765 sentences, 12 dialogues, 12 readers, exam |
| B2–C2 | 30 | syllabus, can-do statements and grammar notes authored; lessons to follow |

Cumulative through B1: 2,328 lemmas, 144 lessons, 2,050 sentences, 143 grammar notes with full lessons (230 notes in total), 26 graded readers, 3 checkpoint exams. `npm run content:stats` prints the live numbers.

## Run it locally

```bash
npm install
npm run dev            # http://localhost:5173/aprende/
npm test               # unit tests (Vitest)
npm run content:check  # validate all course content
npm run test:e2e       # Playwright (needs: npx playwright install chromium)
npm run build && npm run preview
```

## Tech

Vite · React · TypeScript · Tailwind · Dexie (IndexedDB) · ts-fsrs · Playwright · GitHub Pages. No backend, no analytics, no tracking. Your progress lives in your browser; export it from Settings.

## Adding a language

The engine is language-agnostic. A language is a `LanguagePack` (normaliser, tokenizer, inflector, conjugator, checker) under `src/lang/<code>/` plus content under `content/<code>/`. See `CONTENT_GUIDE.md`.

## Independence

Aprende is an independent, open-source project by an individual. It is not affiliated with, endorsed by, sponsored by or connected to Duolingo, Inc. or any other language-learning company or product, and it uses none of their content, code, characters or trademarks. Any product names mentioned belong to their respective owners.

## License

MIT. Literary excerpts used in C1–C2 readers are public domain.
