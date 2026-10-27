/**
 * The learner's text with the scorer's issues marked: each issue is a button over its words
 * (keyboard: Tab between them, Enter to open), spelling in the gold of postage due, grammar
 * underlined in red ink, minor points dotted. Overlapping issues keep the first span.
 */
import { issueLabel, type WritingIssue } from '../../engine/writing'
import { TL } from '../../engine/course'

interface Props {
  text: string
  issues: WritingIssue[]
  selected?: number
  onSelect: (index: number) => void
}

function markClass(x: WritingIssue, on: boolean): string {
  const base = 'rounded-[4px] px-0.5 -mx-0.5 underline underline-offset-[5px] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--blue)]'
  const tone =
    x.category === 'spelling'
      ? `bg-[color-mix(in_srgb,var(--sun)_30%,transparent)] decoration-[#b07a0c] dark:decoration-sun ${x.severity === 'minor' ? 'decoration-dotted decoration-2' : 'decoration-wavy decoration-[1.5px]'}`
      : `bg-[color-mix(in_srgb,var(--red)_12%,transparent)] decoration-red ${x.severity === 'minor' ? 'decoration-dotted decoration-2' : 'decoration-wavy decoration-[1.5px]'}`
  // a mark on one or two characters (¿, 。) still needs a finger-sized target
  // (taller, and a little wider, without covering the neighbouring mark)
  const small = x.end - x.start <= 2 ? "relative !px-1 !mx-0 after:absolute after:inset-x-0 after:-inset-y-2 after:content-['']" : ''
  return `${base} ${tone} ${small} ${on ? 'ring-2 ring-[var(--ink)]' : ''}`
}

export function HighlightedText({ text, issues, selected, onSelect }: Props) {
  const parts: React.ReactNode[] = []
  let at = 0
  issues.forEach((x, i) => {
    if (x.start < at || x.end <= x.start || x.end > text.length) return
    if (x.start > at) parts.push(text.slice(at, x.start))
    parts.push(
      <button
        key={i}
        type="button"
        data-issue={i}
        className={markClass(x, selected === i)}
        aria-label={`${issueLabel(x)}: “${text.slice(x.start, x.end)}”. ${x.message}`}
        aria-pressed={selected === i}
        onClick={() => onSelect(i)}
      >
        {text.slice(x.start, x.end)}
      </button>,
    )
    at = x.end
  })
  if (at < text.length) parts.push(text.slice(at))
  return (
    <p className="whitespace-pre-wrap break-words text-lg leading-[2.1]" lang={TL}>
      {parts}
    </p>
  )
}
