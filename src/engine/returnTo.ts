/** Remember where to scroll back to on the course page (survives a PWA reload). */
export function rememberReturn(target: string): void {
  try {
    sessionStorage.setItem('returnTo', target)
  } catch {
    /* ignore */
  }
}
/** Read and clear the remembered spot. */
export function takeReturn(): string | undefined {
  try {
    const v = sessionStorage.getItem('returnTo') ?? undefined
    sessionStorage.removeItem('returnTo')
    return v
  } catch {
    return undefined
  }
}
