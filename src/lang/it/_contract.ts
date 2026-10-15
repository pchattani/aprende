/** Compile-time check that this pack provides the module surface in lang/contract.ts. */
import type { NormalizeModule, TokenizeModule, VerbsModule, InflectModule, NumbersModule, CheckerModule, ExplainModule, LanguagePackFull } from '../contract'
import * as normalize from './normalize'
import * as tokenize from './tokenize'
import * as verbs from './verbs'
import * as inflect from './inflect'
import * as numbers from './numbers'
import * as checker from './checker'
import * as explain from './explain'
import { languagePack } from './index'

export const contract: [NormalizeModule, TokenizeModule, VerbsModule, InflectModule, NumbersModule, CheckerModule, ExplainModule, LanguagePackFull] = [
  normalize,
  tokenize,
  verbs,
  inflect,
  numbers,
  checker,
  explain,
  languagePack,
]
