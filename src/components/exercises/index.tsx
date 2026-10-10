import type { Exercise } from '../../engine/types'
import type { ExerciseProps } from './shared'
import { Choice } from './Choice'
import { WordBank } from './WordBank'
import { TypeAnswer } from './Type'
import { Match } from './Match'
import { Speak } from './Speak'

export function ExerciseView(props: ExerciseProps<Exercise>) {
  const ex = props.exercise
  switch (ex.kind) {
    case 'choiceEs':
    case 'choiceEn':
    case 'listen':
    case 'fillBlank':
    case 'reply':
      return <Choice {...(props as ExerciseProps<typeof ex>)} />
    case 'wordBank':
    case 'order':
    case 'orderText':
      return <WordBank {...(props as ExerciseProps<typeof ex>)} />
    case 'match':
      return <Match {...(props as ExerciseProps<typeof ex>)} />
    case 'speak':
      return <Speak {...(props as ExerciseProps<typeof ex>)} />
    default:
      return <TypeAnswer {...(props as ExerciseProps<typeof ex>)} />
  }
}
