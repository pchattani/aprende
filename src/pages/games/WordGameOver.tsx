/** The end card and loading line shared by the word-spelling games (Word search, Fetch!, Scramble). */
import type { ReactNode } from 'react'
import { TL } from '../../engine/course'
import { Leo, Luna, Bonchita } from '../../components/ui/Dogs'
import { Confetti } from '../../components/ui/Confetti'
import { RoundButtons } from '../palabras/shared'

const DOGS = { leo: Leo, luna: Luna, bonchita: Bonchita }

/** End-of-round card: a dog, the headline result, a line of detail and Play again / Done. */
export function GameOver({ dog = 'leo', happy, title, big, children, party, onAgain, onDone }: { dog?: keyof typeof DOGS; happy: boolean; title?: string; big?: ReactNode; children?: ReactNode; party?: boolean; onAgain: () => void; onDone: () => void }) {
  const Dog = DOGS[dog]
  return (
    <div className="card mt-4 text-center" role="status">
      {party && <Confetti />}
      <div className="mx-auto -mt-1 w-fit">
        <Dog size={92} act={happy ? 'cheer' : 'sad'} />
      </div>
      {title && (
        <p className="text-2xl font-semibold" lang={TL}>
          {title}
        </p>
      )}
      {big !== undefined && <p className="mt-1 font-display text-5xl">{big}</p>}
      {children && <p className="mt-1 text-sm text-muted">{children}</p>}
      <RoundButtons onAgain={onAgain} onDone={onDone} />
    </div>
  )
}

/** Shown while the learner's words load. */
export function Loading() {
  return <p className="py-10 text-center text-sm text-muted">Fetching your words…</p>
}
