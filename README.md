# Pawsport — free language courses that travel, from first words to fluency

**Live app:** https://pchattani.github.io/aprende/ (install it to your phone's home screen; it works offline)

Pawsport (formerly *Aprende*) is one app with five complete courses, each from A1 to C2. The home page is the **Pawsport hub**: every language you can learn, your progress in each (level, lessons, words learned, days on the road) and a summary across all of them. Each course is its own journey with Leo, Bonchita and Luna:

| Course | Link | Journey |
|---|---|---|
| 🇦🇷 Spanish | https://pchattani.github.io/aprende/spanish/ | Argentina: Buenos Aires, the Pampa, the North, Cuyo, Patagonia and the end of the world |
| 🇭🇰 Cantonese | https://pchattani.github.io/aprende/cantonese/ | Hong Kong Island, Kowloon, the New Territories and islands, Macau, Guangzhou; traditional characters with Jyutping |
| 🇧🇷 Portuguese | https://pchattani.github.io/aprende/portuguese/ | Rio round Brazil, then Portugal; Brazilian with European notes |
| 🇮🇹 Italian | https://pchattani.github.io/aprende/italian/ | Rome, Tuscany, the North, the South, Sicily and Sardinia, then back to Rome |
| 🇫🇷 French | https://pchattani.github.io/aprende/french/ | Paris round France, then Brussels, Geneva, Dakar, the Antilles and Montréal to Québec |

Each course keeps its own progress, settings and offline install on your device; the hub only reads them. Old Spanish links (`/aprende/#/…`) still work: they forward to `/aprende/spanish/#/…` and your progress is kept. See [docs/SITE.md](docs/SITE.md) for how the site is put together and [docs/SISTER_COURSES.md](docs/SISTER_COURSES.md) for how a course is built.

> The GitHub repository and the URL path are still called `aprende` until the repository is renamed; see [Renaming the repository](docs/SITE.md#renaming-the-repository).

The rest of this page describes the Spanish course, the reference that every other course matches. Pawsport is a free, open, no-account language course that actually teaches the language instead of leaving you with a bag of random words. Short daily lessons and a visible rhythm keep you coming back, and underneath them sits a real course: explicit grammar, a frequency-ordered vocabulary of thousands of words, spaced repetition that runs the show, a reading library with coverage metering, a full verb trainer, a pronunciation course, and checkpoint exams for every CEFR level.

There is **no AI and no server**: every explanation was written by hand, and every piece of feedback is computed on your device by deterministic Spanish language engines (a full conjugator, accent rules, an agreement checker, a dictionary built from the course vocabulary) plus your browser's free text-to-speech and speech recognition.

## What's inside

| | |
|---|---|
| **The journey** | Three dogs, Leo, Bonchita and Luna, tour Argentina from Ezeiza to Ushuaia. Each CEFR level is a region and each of the 66 units is a stop. Every stop is open from day one: the placement test or your own choice only marks where the journey begins. Lessons show a mastery state (new, in progress, learned, solid) computed from real retention, and a level check closes each region. |
| **Quests, souvenirs and passport** | Three daily quests (reviews, lessons, minutes, a clean lesson, new words) reward souvenirs from the region you are travelling through; finishing a lesson sometimes turns up a lucky find. Earning a stop's stamp shows a short fact about the place in Spanish and English. Once half a region is stamped, a 12-question **region quiz** (dialogues, grammar, words; new every day) awards the region badge at 80%. Souvenirs double as outfits: dress Leo, Bonchita and Luna with a boina, a poncho or an alfajor on the Dogs page, and tap them to hear them. No points, no lives: mistakes simply come back later in the lesson and in your reviews. |
| **Palabras** | Two vocabulary games fed by your due and weakest words: Memoria (match 8 Spanish/English pairs against the clock) and Rápido (60 seconds of quick-fire meanings with a streak multiplier). Every answer counts as a review. |
| **Modo picante 🌶️** | Optional, off by default: 3–5 cheeky, flirty sentences per lesson (PG-13, between consenting adults, reusing the lesson's grammar) mixed into sessions when switched on in Settings. |
| **Your rhythm** | Progress is measured in minutes practised and words you can use: a daily minutes goal ring, a seven-day rhythm strip and an activity calendar. |
| **Feedback that teaches** | After every answer you see what you practised in Spanish (with audio) and in English, so a listening item never stays a mystery. A wrong answer gets a word-by-word diff and a specific reason (“Article: *la*, because *ciudad* is feminine”), and is **pinned** for a focused re-test: a fill-in-the-blank on exactly the word you missed, with your wrong form among the options. Two correct answers in a row unpin it. |
| **Lenient where it should be** | Capitalisation and punctuation never matter. Missing accents and a single small typo still count as correct in translation exercises (with a reminder); dictation and conjugation stay strict. Digits and number words compare equal (*quince* = *15* = *fifteen*). Multiple-choice distractors come from the same semantic field, so *derecha* is tested against *izquierda*, *arriba* and *detrás*, not *ojo* and *bolsa*. |
| **Sessions that fit** | 12 exercises by default (9 or 16 in Settings), never the same item twice in a row, and a replayed lesson draws on different sentences from last time. Finishing a lesson returns you to that spot on the course, not the top. Speaking exercises (read aloud, repeat a word, answer a question aloud) can be dialled from off to lots. |
| **Sixteen exercise types** | Multiple choice, word bank, typing in both directions, listening, dictation, matching, fill-the-blank, conjugation, transformation, find-the-error, ordering words, ordering the sentences of a mini-text, replying to a question, speaking (speech recognition). The type is chosen by how deeply you know each item: recognition → recall → production. |
| **Spaced repetition** | Every word, sentence and grammar point becomes a card scheduled by FSRS. The Review tab is where learning consolidates. Weak grammar points are detected and can be practised on their own. |
| **Grammar reference** | ~230 searchable notes with tables, examples, pitfalls and Latin American variants. Every exercise can explain itself. |
| **Verb trainer** | Conjugation tables for any verb in sixteen tenses (including vosotros), plus timed drills. |
| **Reader** | Graded texts and dialogues per level, plus import any Spanish text. Tap a word for its meaning and add it to your reviews. A coverage meter tells you if a text is at your level. |
| **Pronunciation** | Eight lessons on Castilian sounds, stress and the written accent, with minimal pairs and shadowing. |
| **Equivalent answers** | Typed answers are accepted when they mean the same thing: synonyms and regional variants (coche / carro / auto, ordenador / computadora, echar de menos / extrañar in every tense), dropped or kept subject pronouns, a mí me vs me, British and American spelling in English. The feedback shows the other wording too. |
| **Writing checker** | Spelling, accents (with the rule that applies), gender/number agreement, verb-form validity, punctuation and ~50 classic learner errors — all rule-based. |
| **Castilian default** | vosotros, distinción, Spain vocabulary. Latin American forms appear as variant notes from A2. |

## Pedagogy

CEFR can-do statements per unit · frequency-driven vocabulary · explicit grammar then inductive practice · spaced repetition with a modern scheduler · recognition→production ladder · comprehensible input at 95–98% coverage · four skills every day · mastery-based progression · error-focused feedback. Details in `CONTENT_GUIDE.md`.

## Content status

| Level | Region of the journey | Units | Content |
|---|---|---|---|
| A1 | Buenos Aires | 12 | 715 words, 48 lessons, 618 sentences, 12 dialogues, 6 readers, level check |
| A2 | Pampa y Litoral | 12 | 642 new words, 48 lessons, 667 sentences, 12 dialogues, 8 readers, level check |
| B1 | El Norte | 12 | 972 new words, 48 lessons, 765 sentences, 12 dialogues, 12 readers, level check |
| B2 | Cuyo | 12 | 1,060 new words, 48 lessons, 768 sentences, 12 dialogues, 12 readers, level check |
| C1 | Patagonia | 10 | 857 new words, 40 lessons, 638 sentences, 10 dialogues, 10 readers, level check |
| C2 | Fin del mundo | 8 | 681 new words, 32 lessons, 512 sentences, 8 dialogues, 8 readers, level check |

The whole course is authored: 66 units, 264 lessons, 3,968 sentences, 1,217 question-and-reply exchanges, 454 mini-texts, 1,318 optional modo-picante sentences, 222 dialogue comprehension questions feeding the region quizzes, 66 stop facts, 4,927 lemmas (2,818 tagged with a semantic topic), 230 grammar notes, 56 graded readers (C1–C2 include public-domain literature: Cervantes, Quevedo, Bécquer, Darío, Machado, Quiroga) and 6 level checks. `npm run content:stats` prints the live numbers.

## Run it locally

```bash
npm install
npm run dev            # Spanish course: http://localhost:5173/aprende/spanish/
VITE_LANG=fr npm run dev   # any other course (yue, pt, it, fr)
npm run dev:hub        # the Pawsport hub: http://localhost:5173/aprende/
npm test               # unit tests (Vitest)
npm run content:check  # validate all course content
npm run build:all      # hub → dist/, every course → dist/<slug>/
npm run serve:dist     # serve dist/ at http://localhost:4173/aprende/ (like GitHub Pages)
npm run test:e2e       # Playwright against dist/ (needs build:all and: npx playwright install chromium)
```

## Tech

Vite · React · TypeScript · Tailwind · Dexie (IndexedDB) · ts-fsrs · Playwright · GitHub Pages. No backend, no analytics, no tracking. Your progress lives in your browser; export it from Settings.

## Adding a language

The engine is language-agnostic. A language is a `LanguagePack` (normaliser, tokenizer, inflector, conjugator, checker) under `src/lang/<code>/` plus content under `content/<code>/`. See `CONTENT_GUIDE.md`.

## Independence

Pawsport is an independent, open-source project by an individual. It is not affiliated with, endorsed by, sponsored by or connected to Duolingo, Inc. or any other language-learning company or product, and it uses none of their content, code, characters or trademarks. Any product names mentioned belong to their respective owners.

## License

MIT. Literary excerpts used in C1–C2 readers are public domain.

The Cantonese course bundles stroke-order data for the characters it teaches to write (`src/lang/yue/data/strokes.json`, built by `npm run strokes` from [hanzi-writer-data](https://github.com/chanind/hanzi-writer-data), derived from Make Me a Hanzi and the Arphic PL fonts). That data is under the Arphic Public License, whose text is kept beside it in `src/lang/yue/data/strokes.LICENSE.txt`; it is drawn with [Hanzi Writer](https://hanziwriter.org) (MIT). Jyutping readings come from [rime-cantonese](https://github.com/rime/rime-cantonese) (CC BY 4.0).
