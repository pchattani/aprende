/**
 * JavaScript's `\b` only knows ASCII word characters, even with the `u` flag: in "parecía el" it sees a
 * boundary between "í" and "a", so a rule like `\ba el\b` fires inside the word. Content rules are written
 * with `\b`; this rewrites each unescaped `\b` into a boundary between letters/digits and anything else.
 */
const B = '(?:(?<=[\\p{L}\\p{N}_])(?![\\p{L}\\p{N}_])|(?<![\\p{L}\\p{N}_])(?=[\\p{L}\\p{N}_]))'

export function unicodeWordBoundaries(pattern: string): string {
  // a `\b` preceded by an odd number of backslashes is the escape; `\\b` is a literal backslash + b
  return pattern.replace(/(\\+)b/g, (m, slashes: string) => (slashes.length % 2 === 1 ? slashes.slice(1) + B : m))
}

/** `new RegExp` for content-authored patterns, with Unicode-aware `\b`. */
export function contentRegExp(pattern: string, flags: string): RegExp {
  return new RegExp(unicodeWordBoundaries(pattern), flags)
}
