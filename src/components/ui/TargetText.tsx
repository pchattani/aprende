import { languagePack } from '@lang'
import { useSettings } from '../../store/settings'
import { TL } from '../../engine/course'

/**
 * Target-language text. For courses with a romanisation (Cantonese), each word gets
 * its reading above it as <ruby>, unless the learner turned readings off in Settings.
 */
export function TargetText({ text, className }: { text: string; className?: string }) {
  const show = useSettings((s) => s.romanization)
  if (!languagePack.romanize || !show) return <span className={className} lang={TL}>{text}</span>
  return (
    <span className={className} lang={TL}>
      {languagePack.romanize(text).map((seg, i) =>
        seg.reading ? (
          <ruby key={i} className="ruby-jp">
            {seg.text}
            <rt>{seg.reading}</rt>
          </ruby>
        ) : (
          <span key={i}>{seg.text}</span>
        ),
      )}
    </span>
  )
}

/** A child that may be target-language text: strings get readings, anything else passes through. */
export function MaybeTarget({ children }: { children: React.ReactNode }) {
  return typeof children === 'string' ? <TargetText text={children} /> : <>{children}</>
}
