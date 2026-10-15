# Sister courses: Cantonese, Portuguese, Italian

The same app, method and journey, built for other languages from the same code.
Spanish (`content/es`) is the reference course: **match its scale and quality**.
Read `CONTENT_GUIDE.md` first; everything there applies, with the differences below.

| Course | Code | Path | App name | Journey |
|---|---|---|---|---|
| Cantonese (Hong Kong) | `yue` | /aprende/cantonese/ | Gong 講 | Hong Kong, Macau, Guangzhou |
| Portuguese (Brazilian, European notes) | `pt` | /aprende/portuguese/ | Aprenda | Brazil, ending in Portugal |
| Italian | `it` | /aprende/italian/ | Impara | Italy |

## Field names

Content files keep the Spanish course's field names. **`es` always means "the
target-language text"** (Cantonese characters, Portuguese, Italian), `altEs` its
accepted alternatives, `en` the English. Ids look the same (`a1.u01.l1`, `w.casa`,
`g.present-regular`).

## Files per course (content/<code>/)

```
pack.yaml            (exists)            ui.yaml          journey.yaml        known.yaml
syllabus.yaml        grammar/<level>.yaml                 vocab/<level>[-n].yaml
units/<level>/uNN.yaml                   readers/<level>/<id>.yaml            exams/<level>.yaml
phonology/lessons.yaml                   errors/common-errors.yaml            synonyms.yaml
spicy-banned.yaml    verbs/… (pt, it: irregular-verb table owned by the language engine)
```

Look at the Spanish file of the same name for the exact shape of each. Schemas are
in `src/engine/schema.ts` (`UiSchema`, `JourneySchema`, `SyllabusSchema`, …).

## Scale (per course, matching Spanish)

| | A1 | A2 | B1 | B2 | C1 | C2 |
|---|---|---|---|---|---|---|
| Units (= journey stops) | 12 | 12 | 12 | 12 | 10 | 8 |
| New vocabulary lemmas | ~700 | ~650 | ~950 | ~1,050 | ~850 | ~680 |
| Graded readers | 6 | 8 | 12 | 12 | 10 | 8 |

Every unit: 4 lessons; each lesson 12–16 `sentences` (minimum 8), 4–6 `exchanges`,
1–2 `texts`, 4–5 `spicy`; one dialogue per unit (6–12 lines) with at least 3
comprehension `questions`. About 200+ grammar notes in total. One level check per
level. Every vocabulary word an obvious `topic` where one applies (see CONTENT_GUIDE).
Units must stay within the cumulative vocabulary of their level (≤ 10 % unknown word
forms; readers ≤ 6 %, literature ≤ 12 %): **add every word a unit uses to the vocabulary**.

## ui.yaml and journey.yaml

`ui.yaml`: copy `content/es/ui.yaml` and translate every target-language value
(greetings, `feedback`, `stampEarned`, `spicyName`, `games`, `dogsPage`, `quizGreat`,
`whatDoesItMean` with `{word}`, `badgeName` with `{region}`, `typePlaceholder`,
`voiceTest`, `cheers` with English, `quests` (all 8 ids), `dogLines` (5 per dog),
`unitStickers` (one emoji per unit id)). `appName`, `tagline`, `welcome`,
`voiceHelp`, `pronunciationIntro` are English.

`journey.yaml`: 6 regions (`level`, `name`, `es` caption), one stop per unit in
unit order (`name`, `emoji`, `es` caption, `en`, `fact: { es, en }`), and about
33 souvenirs (`id`, `level`, `emoji`, `es`, `en`, `blurb`, optional `slot`: hat,
neck, mouth or paw; at least 20 wearable). Facts are true and checkable; A1 facts
use present tense, A1 vocabulary plus names and ≤ 30 words (Cantonese: ≤ 45
characters); A2 ≤ 35 words; B1+ ≤ 45 words (Cantonese ≤ 68 characters).

`known.yaml`: `always` (function words treated as known at every level), `facts`
(a few extra common nouns allowed in A1 facts), `names` (proper nouns and place
names that may appear anywhere; essential for Cantonese, where names are not
capitalised).

## Modo picante

Same tone guide as Spanish (cheeky, flirty, PG-13, consenting adults, humour over
innuendo; never explicit, crude, coercive, about minors or slurs). Each course has
`spicy-banned.yaml`: a YAML list of whole words that fail the check (crude and
sexual vocabulary, slurs, minors, violence, drugs) in that language.

## Cantonese (`yue`)

- Hong Kong Cantonese, **traditional characters**, colloquial written Cantonese
  (口語): 係, 喺, 冇, 嘅, 咗, 佢, 哋, 唔, 啲, 嘢, 嚟, 乜嘢, 點解, 邊度. Not Mandarin and
  not written Standard Chinese (書面語), except in C1–C2 lessons that teach the
  contrast. English loanwords used in Hong Kong speech are fine where natural.
- Full-width punctuation: ，。？！「」、. Numbers in characters (十五, 兩個).
- Vocabulary: `lemma` in characters, **`jp` required** (toned Jyutping, syllables
  separated by spaces: `nei5 hou2`), no `gender`, nouns carry their measure word in
  `cl` (`cl: 隻`); parts of speech include `classifier` (個, 隻, 本) and `particle`
  (呀, 啦, 咗, 緊, 過, 嘅, 嗎). Ids: `w.` + Jyutping with tones, hyphenated:
  `w.nei5-hou2`, `w.hai6`; add `.b` etc. for homophones.
- Every character must have a reading in the bundled dictionary, and each `jp`
  syllable must be one of its character's readings (the checker enforces both).
  Run `npm run yue:data` after writing content (it updates the word list used for
  readings), then `VITE_LANG=yue npm run content:check`.
- The app shows Jyutping above characters and accepts typed answers in Jyutping
  (tones optional, with a reminder) or characters. `altEs` lists other natural
  wordings in characters.
- Grammar progression: A1 係/喺/有, pronouns and 哋, measure words, 唔/冇, questions
  with 嗎/未/唔, numbers and money, time; A2 aspect 咗/緊/過, verb complements,
  comparisons 比 and 過, 會/可以/識, sentence-final particles; B1 resultative and
  directional complements, 畀 passives, 將, relative clauses with 嘅, more particles;
  B2 particles of attitude (喎, 囉, 啩, 嘛), idioms, 連…都, 一…就; C1 written vs spoken
  Cantonese, formal registers, 成語; C2 slang, wordplay, Cantonese opera, poetry read
  in Cantonese. CEFR levels map to these stages.

## Portuguese (`pt`)

- **Brazilian Portuguese** (current orthography), *você* as the default "you",
  *a gente* taught from A2, *tu* noted regionally. European Portuguese appears as
  notes: vocabulary `variant: { pt-PT: autocarro }`, sentence `variant` notes, and
  synonym groups (ônibus/autocarro, trem/comboio, celular/telemóvel,
  café da manhã/pequeno-almoço). The C2 region is Portugal: its units may use
  European forms (tu, estar a + infinitive, mesoclisis) with Brazilian alternatives
  in `altEs`.
- Nouns need `gender` (m, f, mf). Verb lemmas are infinitives; reflexive verbs end
  in `-se` (`levantar-se`).
- Grammar includes ser/estar, ficar, personal infinitive, future subjunctive,
  contractions (do, na, pelo, à), clitic placement (Brazilian proclisis vs European
  enclisis), *a gente*, *tem* for "there is" in Brazil.

## Italian (`it`)

- Standard Italian. Nouns need `gender`. Irregular plurals in `plural`
  (`uovo → uova`), invariable nouns noted (`città`). Elision with apostrophe
  (l'amico, un'amica, dell'acqua) is normal text.
- Grammar includes articles (il/lo/la/l'/i/gli/le), articulated prepositions,
  essere vs avere in compound tenses with participle agreement, ci and ne, pronoun
  combinations (glielo), passato remoto (recognition from B1, production C1),
  congiuntivo, periodo ipotetico, *Lei* formal address.

## Readers, exams, phonology, errors

Same shapes as Spanish. C1–C2 readers include public-domain literature:
Portuguese (Machado de Assis, Eça de Queirós, Camões, Pessoa), Italian (Dante,
Manzoni, Verga, Collodi, Leopardi, Pirandello), Cantonese (Cantonese folk rhymes
such as 月光光, Zhao Ziyong's 粵謳 (1828), Tang poems read in Cantonese, with
glossaries). Phonology: Cantonese covers the six tones, Jyutping initials and finals,
entering tones and tone pairs; Portuguese nasal vowels, open/closed e and o, r/rr,
lh/nh, Brazilian vs European; Italian double consonants, c/g + e/i, gl/gn, open/closed
vowels, stress.

## Checking

```
VITE_LANG=<code> npx tsx scripts/check-schema.ts   # schemas only (works before the engine exists)
VITE_LANG=<code> npm run content:check             # full check with the language engine
VITE_LANG=<code> npx vitest run                    # engine + course tests for that course
```
