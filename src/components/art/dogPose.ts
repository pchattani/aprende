/** Moods and actions shared by the dog characters and the things they wear. */
export type Mood = 'happy' | 'curious' | 'sleepy'

/**
 * What a dog is doing, played by its rig (art/DogRig.tsx):
 *  idle    breathing, blinking, a little head sway (the default)
 *  talk    mouth moving
 *  cheer   hopping with ears flapping, mouth open, happy eyes, both paws up
 *  sad     ears and head droop, eyes half closed
 *  curious head tilt, one ear raised
 *  think   looking up and to the side
 *  sleepy  eyes closed, head nodding
 *  walk    bobbing step, ears bouncing
 *  wave    one paw raised and waving
 */
export type Act = 'idle' | 'talk' | 'cheer' | 'sad' | 'curious' | 'think' | 'sleepy' | 'walk' | 'wave'

/** The act a mood plays when no act is given. */
export const MOOD_ACT: Record<Mood, Act> = { happy: 'idle', curious: 'curious', sleepy: 'sleepy' }
