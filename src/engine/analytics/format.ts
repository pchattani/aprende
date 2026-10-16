/** Number formatting shared by the engine's suggestion text and the Insights page. */

const finite = (x: number) => Number.isFinite(x)

/** 0.8734 → "87%" (digits = decimals). */
export function pct(p: number, digits = 0): string {
  return finite(p) ? `${(p * 100).toFixed(digits)}%` : '–'
}

/** Signed percentage points: 0.031 → "+3.1 pp". */
export function pp(d: number, digits = 1): string {
  return finite(d) ? `${d >= 0 ? '+' : '−'}${Math.abs(d * 100).toFixed(digits)} pp` : '–'
}

/** Wilson interval "81–90%". */
export function ci(lo: number, hi: number): string {
  return finite(lo) && finite(hi) ? `${Math.round(lo * 100)}–${Math.round(hi * 100)}%` : '–'
}

/** Fixed decimals with a real minus sign. */
export function num(x: number, digits = 0): string {
  if (!finite(x)) return '–'
  const s = Math.abs(x).toFixed(digits)
  return x < 0 && Number(s) !== 0 ? `−${s}` : s
}

/** Signed number: "+12.3" / "−4.0". */
export function signed(x: number, digits = 0): string {
  if (!finite(x)) return '–'
  const s = Math.abs(x).toFixed(digits)
  return Number(s) === 0 ? s : `${x > 0 ? '+' : '−'}${s}`
}

/** Days as a compact duration: 0.4 → "10 h", 3.2 → "3.2 d", 45 → "45 d", 400 → "1.1 y". */
export function days(d: number): string {
  if (!finite(d)) return '∞'
  if (d < 1) return `${Math.round(d * 24)} h`
  if (d < 10) return `${d.toFixed(1)} d`
  if (d < 365) return `${Math.round(d)} d`
  return `${(d / 365).toFixed(1)} y`
}

/** "12 Oct" from a YYYY-MM-DD key. */
export function shortDate(key: string | undefined): string {
  if (!key) return '–'
  const [y, m, d] = key.split('-').map(Number) as [number, number, number]
  return new Date(y, m - 1, d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

/** p-value: "p < 0.001" or "p = 0.03". */
export function pval(p: number): string {
  if (!finite(p)) return 'p = –'
  return p < 0.001 ? 'p < 0.001' : `p = ${p < 0.01 ? p.toFixed(3) : p.toFixed(2)}`
}
