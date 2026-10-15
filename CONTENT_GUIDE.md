# Content guide

All course content lives in `content/es/` as YAML, validated by Zod schemas in `src/engine/schema.ts` and by `npm run content:check`. Nothing is generated at runtime; the app bundles exactly what is in this folder.

## Files

```
content/es/
  pack.yaml                 language metadata (locale, TTS voices, variety, slug, features)
  ui.yaml                   interface text in the target language (greetings, cheers, quest titles, dog lines…)
  journey.yaml              regions (one per level), stops (one per unit) with facts, souvenirs
  known.yaml                function words always known, extra A1-fact words, proper names
  syllabus.yaml             A1-C2 levels, units, can-do statements, grammar ids, authored flag
  grammar/<level>.yaml      grammar notes (id g.*)
  vocab/<level>.yaml        lemmas (id w.*)
  units/<level>/uNN.yaml    lessons, sentences, dialogues
  readers/<level>/*.yaml    graded texts with questions and glossary
  phonology/lessons.yaml    pronunciation course
  exams/<level>.yaml        level-check exams (one per level)
  errors/common-errors.yaml learner-error regexes for the checker
  verbs/irregular.yaml      irregular / stem-changing verbs for the conjugator
```

## Authoring a unit

1. Add the unit to `syllabus.yaml` with `authored: true`, 2–3 can-do statements and the grammar ids it teaches.
2. Add its vocabulary to `vocab/<level>.yaml` (`unit: a2.u05`). Nouns need `gender`; irregular plurals/feminines use `plural` / `feminine`; words the inflector cannot derive (articles, pronouns) list `forms`. Use `tags: [nationality]` for nationality adjectives, `tags: [passive]` for words that need not be introduced by a lesson. Give every word in an obvious semantic field a `topic` (see **Topics** below) so multiple-choice distractors come from the same field.
3. Create `units/<level>/uNN.yaml`:

```yaml
id: a2.u05
title: ¿Qué has hecho hoy?
lessons:
  - id: a2.u05.l1
    title: Esta semana
    teach: [g.present-perfect]          # grammar notes shown before the first attempt
    tip: "One-line hint shown on the teach screen."
    vocab: [w.hoy, w.esta-semana]       # new words introduced
    sentences:
      - { es: "Hoy he desayunado tarde.", en: "Today I had breakfast late.",
          altEs: ["Hoy desayuné tarde."], altEn: ["Today I've had breakfast late."],
          grammar: [g.present-perfect], vocab: [w.desayunar],
          transform: { instruction: "Change to 'we'", answer: "Hoy hemos desayunado tarde." },
          error: { wrong: "Hoy he desayunando tarde.", explain: "haber + participle, not gerund.", grammar: g.present-perfect } }
dialogues:
  - id: a2.u05.d1
    title: …
    lines: [{ speaker: Ana, es: "…", en: "…" }]
    questions: [{ q: "…", options: ["a", "b", "c"], answer: 1 }]
```

Rules enforced by `content:check`: at least 3 lessons per unit and 8 sentences per lesson; every id must exist; at most 10% of word forms in a unit may be outside the cumulative vocabulary for its level (readers: 6%); dialogue/exam answer indexes must be valid.

Write sentences the learner could plausibly say or hear. Give `altEs`/`altEn` generously (contractions, optional subject pronouns, synonyms). Tag `grammar` so weak-skill detection and "explain" work. Add `transform` and `error` to a few sentences per lesson so the production-stage exercises have material. Use `kinds:` to restrict exercise types for sentences that only make sense as lists (numbers, days).

## Grammar notes

One note per point, `id: g.kebab-case`, with `summary`, `explanation` (light markdown: `###`, bullets, pipe tables, `**bold**`, `*Spanish in italics*`), `examples`, `pitfalls`, optional `variant` (Latin America) and `drills` (pattern sentences used in review). Quote any `title`/`summary` containing a colon.

## Readers

Texts must stay within the level's cumulative vocabulary plus a `glossary` and `allow` list. Aim for 150–400 words at A1–A2, 400–800 at B1–B2, and public-domain literature at C1–C2 (`kind: literature`, `author`, `source`).

## Exams

Reading (text + 5 MCQ), listening (5 dictations + optional audio MCQ), grammar (15 MCQ), writing (prompt, minimum words, model answer, self-assessment checklist), speaking (6 sentences). Pass mark 80%.

## Adding a language pack

One codebase builds every course: `VITE_LANG=<code>` selects `src/lang/<code>/` (the language engine) and `content/<code>/` (the course). The engine must provide the modules listed in `src/lang/contract.ts`; `_contract.ts` in each pack checks this at compile time. See `docs/SISTER_COURSES.md` for the Cantonese, Portuguese and Italian courses.

## Lesson variety: exchanges and mini-texts

Besides `sentences`, every lesson should carry conversational and text material so exercises are not all single sentences:

```yaml
    exchanges:            # 3–6 per lesson: a question or line, and the natural reply
      - q: { es: "¿A qué hora cierra el museo?", en: "What time does the museum close?" }
        a: { es: "A las siete, pero la taquilla cierra a las seis.", en: "At seven, but the ticket office closes at six." }
        alt: ["Cierra a las siete."]          # other correct replies (Spanish)
        grammar: [g.time-telling]
        vocab: [w.taquilla]
    texts:                # 1–2 per lesson: a 2–4 sentence message, note, caption or announcement
      - title: "Mensaje de Ana"
        es: ["Hola, llego tarde.", "El metro no funciona y voy andando.", "Pedid sin mí, por favor."]
        en: ["Hi, I'm running late.", "The metro isn't working and I'm walking.", "Order without me, please."]
        grammar: [g.imperative-vosotros]
```

The generator turns exchanges into *reply* exercises (pick or type the natural answer) and mini-texts into
*orderText* (put the sentences in order), dictation and translation in context. Vary the sentence types in
`sentences` too: questions, negatives, exclamations, commands, two-clause sentences, and give `altEs` /
`altEn` alternatives wherever more than one wording is natural (including Latin American variants).

## Topics (plausible distractors)

Multiple-choice distractors are sampled in tiers: same lesson → same unit → same `topic` and part of speech → same part of speech and level → anything. A learner asked for *derecha* should see *izquierda*, *arriba*, *detrás*, never *ojo* or *bolsa*. Tag words with one of these slugs (lowercase, hyphens):

`directions`, `food`, `drink`, `family`, `body`, `clothing`, `weather`, `time`, `days`, `months`, `colours`, `numbers`, `transport`, `jobs`, `feelings`, `house`, `furniture`, `animals`, `school`, `health`, `shopping`, `travel`, `nature`, `tech`, `sport`, `money`, `city`, `countries`, `greetings`, `verbs-daily`, `verbs-motion`, `verbs-speech`, `adjectives-people`, `adjectives-things`, `connectors`, `quantity`, `politics`, `work`, `media`, `law`, `science`, `arts`, `environment`, `economy`, `relationships`.

Add a topic only when it is unambiguous; a topic with fewer than 4 words at a level is flagged, because it cannot supply three distractors. Topics are optional on everything else.

## Dialogue questions

Every dialogue should carry **at least 3** comprehension questions (`questions:`), in Spanish at the unit's level, with 3–4 options and an optional `explain`. The region quiz (one per level, 12 items) draws one question per unit from them, so thin dialogues make a thin quiz.

## Modo picante (optional spicy sentences)

Each lesson may carry 3–5 `spicy:` sentences, shown only when the learner switches **Modo picante** on in Settings. They are drilled like ordinary sentences (ids `p.<lesson>.<n>`), so they follow the same shape (`es`, `en`, `altEs`, `altEn`, `grammar`, `vocab`) and must reuse the lesson's grammar point and vocabulary level.

Tone guide: **cheeky and flirty, PG-13, between consenting adults.** Think compliments, dates, dancing, a cheeky wink, the dogs stealing a kiss-shaped alfajor: humour over innuendo. At A1–A2 keep to compliments and light flirting ("Tienes una sonrisa muy bonita."). From B1 the humour can be sharper and the situations more adult (dates that go wrong, double meanings handled with a wink), but never explicit anatomy, never crude vocabulary, nothing coercive, nothing involving minors, no slurs. `scripts/spicy-banned.ts` lists words that fail the check outright; use judgement for the rest. Every spicy sentence must still be a *useful* sentence a learner might say.

```yaml
    spicy:
      - { es: "¿Bailas conmigo o solo me miras?", en: "Are you dancing with me or just looking?", altEs: ["¿Bailas conmigo o sólo me miras?"], grammar: [g.present-regular], vocab: [w.bailar, w.mirar] }
```

## Stop facts

Each stop in `journey.yaml` carries a `fact: { es, en }`, shown when the stop's passport stamp is earned. A1 facts: present tense, A1 vocabulary plus proper nouns, at most 30 words. A2: up to 35 words, past tenses allowed. B1 and above: up to 45 words. Facts must be true and checkable (geography, history, food, culture); no superlatives you cannot source.
