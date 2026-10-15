import { storageKey } from './course'

const KEY = storageKey('returnTo')

/** Remember where to scroll back to on the course page (survives a PWA reload). */
export function rememberReturn(target: string): void {
  try {
    sessionStorage.setItem(KEY, target)
  } catch {
    /* ignore */
  }
}
/** Read and clear the remembered spot. */
export function takeReturn(): string | undefined {
  try {
    const v = sessionStorage.getItem(KEY) ?? undefined
    sessionStorage.removeItem(KEY)
    return v
  } catch {
    return undefined
  }
}
