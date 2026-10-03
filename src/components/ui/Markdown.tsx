import { inline } from './inline'
import { Fragment, type ReactNode } from 'react'

/**
 * Tiny markdown renderer for grammar notes: ### headings, bullet lists,
 * pipe tables, paragraphs, numbered lists, **bold**, *italic*, `code`.
 * Produces React elements (no HTML injection).
 */
export function Markdown({ text, className = 'prose-note' }: { text: string; className?: string }) {
  return <div className={className}>{renderBlocks(text)}</div>
}

function renderBlocks(text: string): ReactNode[] {
  const lines = text.replace(/\r/g, '').split('\n')
  const out: ReactNode[] = []
  let i = 0
  let key = 0
  while (i < lines.length) {
    const line = lines[i]!
    if (!line.trim()) {
      i++
      continue
    }
    if (line.startsWith('### ')) {
      out.push(<h3 key={key++}>{inline(line.slice(4))}</h3>)
      i++
      continue
    }
    if (line.startsWith('## ')) {
      out.push(<h3 key={key++}>{inline(line.slice(3))}</h3>)
      i++
      continue
    }
    if (line.trim().startsWith('|')) {
      const rows: string[][] = []
      while (i < lines.length && lines[i]!.trim().startsWith('|')) {
        const cells = lines[i]!.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => c.trim())
        if (!cells.every((c) => /^:?-{2,}:?$/.test(c))) rows.push(cells)
        i++
      }
      const [head, ...body] = rows
      out.push(
        <div key={key++} className="overflow-x-auto">
          <table>
            {head && (
              <thead>
                <tr>{head.map((c, j) => <th key={j}>{inline(c)}</th>)}</tr>
              </thead>
            )}
            <tbody>
              {body.map((r, ri) => (
                <tr key={ri}>{r.map((c, j) => <td key={j}>{inline(c)}</td>)}</tr>
              ))}
            </tbody>
          </table>
        </div>,
      )
      continue
    }
    if (/^\s*[-*] /.test(line)) {
      const items: string[] = []
      while (i < lines.length && /^\s*[-*] /.test(lines[i]!)) {
        items.push(lines[i]!.replace(/^\s*[-*] /, ''))
        i++
      }
      out.push(<ul key={key++}>{items.map((it, j) => <li key={j}>{inline(it)}</li>)}</ul>)
      continue
    }
    if (/^\s*\d+\. /.test(line)) {
      const items: string[] = []
      while (i < lines.length && /^\s*\d+\. /.test(lines[i]!)) {
        items.push(lines[i]!.replace(/^\s*\d+\. /, ''))
        i++
      }
      out.push(<ol key={key++} className="my-2 list-decimal pl-5 space-y-1">{items.map((it, j) => <li key={j}>{inline(it)}</li>)}</ol>)
      continue
    }
    // paragraph: gather until blank line or block start
    const para: string[] = []
    while (i < lines.length && lines[i]!.trim() && !lines[i]!.startsWith('#') && !lines[i]!.trim().startsWith('|') && !/^\s*[-*] /.test(lines[i]!) && !/^\s*\d+\. /.test(lines[i]!)) {
      para.push(lines[i]!)
      i++
    }
    out.push(
      <p key={key++}>
        {para.map((l, j) => (
          <Fragment key={j}>
            {inline(l)}
            {j < para.length - 1 && <br />}
          </Fragment>
        ))}
      </p>,
    )
  }
  return out
}

