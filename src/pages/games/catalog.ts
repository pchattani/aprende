/**
 * The mini games in the Games tab beyond the original Palabras modes. Each game is its own
 * lazily loaded page at /games/<id> (see GamePage.tsx); the hub lists them by section.
 */
import type { ComponentType } from 'react'
import { FEATURES } from '../../engine/course'

export type GameSection = 'words' | 'verbs' | 'characters' | 'listening'
export interface GameProps {
  /** Back to the games hub. */
  onDone: () => void
}
export interface GameMeta {
  id: string
  section: GameSection
  icon: string
  /** Tailwind background for the icon tile. */
  tint: string
  title: string
  blurb: string
  /** Hidden in courses where it does not apply (verbs need conjugation, measure words need classifiers). */
  available: boolean
  load: () => Promise<{ default: ComponentType<GameProps> }>
}

const VERBS = FEATURES.conjugation
const CANTONESE = FEATURES.classifiers || FEATURES.romanization === 'jyutping'

export const GAMES: GameMeta[] = [
  { id: 'wordsearch', section: 'words', icon: '🔎', tint: 'bg-brand-gradient', title: 'Word search', blurb: 'Find your words hidden in a grid of letters. Swipe across them.', available: true, load: () => import('./WordSearch') },
  { id: 'fetch', section: 'words', icon: '🎾', tint: 'bg-sunset-gradient', title: 'Fetch!', blurb: 'Guess the word letter by letter before the ball rolls away from Leo.', available: true, load: () => import('./Fetch') },
  { id: 'scramble', section: 'words', icon: '🔀', tint: 'bg-mint-gradient', title: 'Scramble', blurb: 'Tap the jumbled letters back into the word that matches the clue.', available: true, load: () => import('./Scramble') },
  { id: 'rain', section: 'words', icon: '🌧️', tint: 'bg-pink-500', title: 'Word rain', blurb: 'Words fall from the sky: catch the one that matches before it lands.', available: true, load: () => import('./WordRain') },
  { id: 'sort', section: 'words', icon: '🧺', tint: 'bg-coral-500', title: 'Sort it', blurb: 'Food or clothes? Family or feelings? Flick each word into its basket.', available: true, load: () => import('./SortIt') },
  { id: 'daily', section: 'words', icon: '🟩', tint: 'bg-ok-500', title: 'Word of the day', blurb: 'One hidden word a day from your vocabulary. Six guesses, colour clues.', available: true, load: () => import('./DailyWord') },
  { id: 'slots', section: 'verbs', icon: '🎰', tint: 'bg-sunset-gradient', title: 'Verb slots', blurb: 'Spin a person, a verb and a tense, then write the form before the timer runs out.', available: VERBS, load: () => import('./VerbSlots') },
  { id: 'blitz', section: 'verbs', icon: '⚡', tint: 'bg-brand-gradient', title: 'Verb blitz', blurb: '60 seconds of conjugations: pick the right form, build a streak multiplier.', available: VERBS, load: () => import('./VerbBlitz') },
  { id: 'duel', section: 'verbs', icon: '🐾', tint: 'bg-pink-500', title: 'Verb duel', blurb: 'Race Luna to conjugate: first to ten points wins the bone.', available: VERBS, load: () => import('./VerbDuel') },
  { id: 'measure', section: 'characters', icon: '🥢', tint: 'bg-mint-gradient', title: 'Measure words', blurb: '一隻狗, 一本書, 一杯茶: pick the right measure word for each thing.', available: CANTONESE && FEATURES.classifiers, load: () => import('./MeasureWords') },
  { id: 'tones', section: 'characters', icon: '🎵', tint: 'bg-coral-500', title: 'Tone detective', blurb: 'Hear a word and catch its tones. Six tones, one ear.', available: CANTONESE, load: () => import('./ToneDetective') },
]

export const gameById = (id: string): GameMeta | undefined => GAMES.find((g) => g.id === id && g.available)
