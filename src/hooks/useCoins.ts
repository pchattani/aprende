import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import { useKvValue } from './useProgress'
import { COINS_KEY } from '../db/progress'
import { travellerLevel, type TravellerLevel } from '../engine/traveller'

export { awardCoins, buySouvenir } from '../db/progress'

/** Live coin balance (0 until the kv row loads). */
export function useCoins(): number {
  return useKvValue<number>(COINS_KEY, 0) ?? 0
}

/** Live total km and traveller level (undefined while loading). */
export function useTraveller(): (TravellerLevel & { km: number }) | undefined {
  const km = useLiveQuery(async () => (await db.days.toArray()).reduce((s, d) => s + d.xp, 0), [])
  return km === undefined ? undefined : { ...travellerLevel(km), km }
}
