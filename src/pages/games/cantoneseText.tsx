/** Cantonese text with known Jyutping, for the Measure words and Tone detective games. */
import { TL } from '../../engine/course'
import { useSettings } from '../../store/settings'

/**
 * Characters with the given Jyutping above them (one syllable per character), unless the
 * learner turned readings off in Settings. Unlike TargetText it never guesses a reading,
 * so a tone game shows exactly the syllables it plays.
 */
export function Ruby({ text, jp, className = '' }: { text: string; jp: string; className?: string }) {
  const show = useSettings((s) => s.romanization)
  const chars = [...text]
  const syl = jp.trim().split(/\s+/)
  if (!show || chars.length !== syl.length) {
    return (
      <span className={className} lang={TL}>
        {text}
      </span>
    )
  }
  return (
    <span className={className} lang={TL}>
      {chars.map((c, i) => (
        <ruby key={i} className="ruby-jp">
          {c}
          <rt>{syl[i]}</rt>
        </ruby>
      ))}
    </span>
  )
}
