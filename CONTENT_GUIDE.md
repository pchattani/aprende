# Content guide

All course content lives in `content/es/` as YAML, validated by Zod schemas in `src/engine/schema.ts` and by `npm run content:check`. Nothing is generated at runtime; the app bundles exactly what is in this folder.

## Files

```
content/es/
  pack.yaml                 language metadata (locale, TTS voices, variety)
  syllabus.yaml             A1-C2 levels, units, can-do statements, grammar ids, authored flag
  grammar/<level>.yaml      grammar notes (id g.*)
  vocab/<level>.yaml        lemmas (id w.*)
  units/<level>/uNN.yaml    lessons, sentences, dialogues
  readers/<level>/*.yaml    graded texts with questions and glossary
  phonology/lessons.yaml    pronunciation course
  exams/<level>.yaml        checkpoint exams
  errors/common-errors.yaml learner-error regexes for the checker
  verbs/irregular.yaml      irregular / stem-changing verbs for the conjugator
```

## Authoring a unit

1. Add the unit to `syllabus.yaml` with `authored: true`, 2–3 can-do statements and the grammar ids it teaches.
2. Add its vocabulary to `vocab/<level>.yaml` (`unit: a2.u05`). Nouns need `gender`; irregular plurals/feminines use `plural` / `feminine`; words the inflector cannot derive (articles, pronouns) list `forms`. Use `tags: [nationality]` for nationality adjectives, `tags: [passive]` for words that need not be introduced by a lesson.
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

Implement `LanguagePack` from `src/lang/types.ts` under `src/lang/<code>/` (normalize, tokenize, match, words). Optional engines (conjugator, inflector, checker) plug into the generator and grader. Create `content/<code>/` with the same file layout and update the loader paths.
