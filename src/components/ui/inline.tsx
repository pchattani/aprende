import { Fragment, type ReactNode } from 'react'

const INLINE = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g

export function inline(s: string): ReactNode {
  const parts = s.split(INLINE).filter((p) => p !== '')
  return parts.map((p, i) => {
    if (p.startsWith('**') && p.endsWith('**')) return <strong key={i}>{p.slice(2, -2)}</strong>
    if (p.startsWith('`') && p.endsWith('`')) return <code key={i}>{p.slice(1, -1)}</code>
    if (p.startsWith('*') && p.endsWith('*') && p.length > 2) return <em key={i} lang="es">{p.slice(1, -1)}</em>
    return <Fragment key={i}>{p}</Fragment>
  })
}
