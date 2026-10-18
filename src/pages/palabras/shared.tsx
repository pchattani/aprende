/** Notices and buttons shared by the Palabras games. */
import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { LANGUAGE } from '../../engine/loader'
import { Button } from '../../components/ui/basics'
import { useNoVoice, type Audio } from './util'

export function NoAudioNotice({ audio, compact = false }: { audio: Audio; compact?: boolean }) {
  if (audio === 'ok') return null
  return (
    <div role="note" className={`rounded-xl border-[1.5px] border-dashed border-line bg-surface-2 text-sm ${compact ? 'px-3 py-2' : 'p-4'}`}>
      <p className="font-semibold">{audio === 'unsupported' ? 'Listening needs speech audio on this device' : 'Sound is off'}</p>
      <p className="text-muted">
        {audio === 'unsupported' ? (
          'This browser cannot speak words aloud. Try Chrome, Edge or Safari to play the listening games.'
        ) : (
          <>
            Turn sound on in <Link to="/settings" className="font-bold underline">Settings</Link> to hear the words.
          </>
        )}
      </p>
    </div>
  )
}

export function NoVoiceHint() {
  const none = useNoVoice()
  if (!none) return null
  return (
    <p className="mt-2 text-center text-xs text-muted">
      No {LANGUAGE} voice found on this device, so words may sound odd. <Link to="/settings" className="font-bold underline">Voices</Link>
    </p>
  )
}

export function TooFew({ onBack, children }: { onBack: () => void; children?: ReactNode }) {
  return (
    <div className="card text-center">
      <p className="font-semibold">Not enough words yet</p>
      <p className="mt-1 text-sm text-muted">{children ?? 'Complete a lesson or two and come back: the games use the words you have met.'}</p>
      <Button className="mt-3 w-full" onClick={onBack}>
        Back
      </Button>
    </div>
  )
}

/** The end-of-round buttons. */
export function RoundButtons({ onAgain, onDone }: { onAgain: () => void; onDone: () => void }) {
  return (
    <div className="mt-5 grid grid-cols-2 gap-2">
      <Button variant="ghost" onClick={onDone}>
        Done
      </Button>
      <Button onClick={onAgain}>Play again</Button>
    </div>
  )
}

