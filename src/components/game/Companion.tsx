/**
 * The companion dog standing on the edge of the answer sheet, played by its puppet rig: it cheers a
 * right answer and then says its line, or droops for a moment at a wrong one and says something kind.
 */
import type { GradeResult } from '../../engine/types'
import type { DogId } from '../art/dogRegistry'
import { Leo, Bonchita, Luna } from '../ui/Dogs'
import { TargetText } from '../ui/TargetText'
import { ACTS, useActs } from './useActs'

const FIGURE = { leo: Leo, bonchita: Bonchita, luna: Luna } as const

export function Companion({ dog, verdict, line }: { dog: DogId; verdict: GradeResult['verdict']; line: string }) {
  const Dog = FIGURE[dog]
  const act = useActs(verdict === 'wrong' ? ACTS.wrong : ACTS.correct, `${dog}|${verdict}|${line}`)
  return (
    <div className="companion flex items-end gap-0.5" data-dog={dog} data-verdict={verdict} data-act={act}>
      <span className="companion-bubble mb-11 max-w-[11rem] rounded-2xl rounded-br-sm border border-line bg-card px-3 py-1.5 text-center font-hand text-[1.55rem] font-bold leading-[1.05] text-ink shadow-card">
        <TargetText text={line} />
      </span>
      <span className="companion-dog">
        <Dog size={86} act={act} />
      </span>
    </div>
  )
}
