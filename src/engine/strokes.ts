/**
 * Stroke-order data for the characters this course teaches to write, bundled at build time
 * (scripts/build-strokes.mjs → src/lang/<lang>/data/strokes.json) and loaded on first use, so
 * hanzi-writer never fetches from a CDN: the app stays offline.
 */
export interface StrokeData {
  /** SVG outline of each stroke, in stroke order (1024-unit box, y up). */
  strokes: string[]
  /** Centre line of each stroke: the path a learner's stroke is compared with. */
  medians: number[][][]
}

const files = import.meta.glob('@lang/data/strokes.json', { import: 'default' }) as Record<string, () => Promise<Record<string, StrokeData>>>
let bundle: Promise<Record<string, StrokeData>> | undefined

/** Every character with stroke data in this course (empty for a course that teaches no writing). */
export function loadStrokes(): Promise<Record<string, StrokeData>> {
  bundle ??= (Object.values(files)[0]?.() ?? Promise.resolve({})).catch(() => ({}))
  return bundle
}

export async function strokeData(char: string): Promise<StrokeData | undefined> {
  return (await loadStrokes())[char]
}

/** hanzi-writer's `charDataLoader`: reads the bundle instead of the network. */
export function charDataLoader(char: string, onLoad: (data: StrokeData) => void, onError: (err?: unknown) => void): void {
  void strokeData(char).then((d) => (d ? onLoad(d) : onError(new Error(`No stroke data for ${char}`))), onError)
}
