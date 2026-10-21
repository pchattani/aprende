/** Stroke data of one character, as hanzi-writer reads it. */
export interface StrokeEntry {
  strokes: string[]
  medians: number[][][]
}
export declare const ROOT: string
export declare function strokesPath(lang: string, root?: string): string
export declare function collectWriteChars(contentDir: string): Map<string, string[]>
export declare function datasetEntry(char: string): StrokeEntry | undefined
export declare function datasetLicense(): string
export declare function writeCharIssues(chars: Map<string, string[]>, bundle: Record<string, StrokeEntry> | undefined): string[]
