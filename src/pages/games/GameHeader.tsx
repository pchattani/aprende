/** The top bar shared by the mini games. */
import type { ReactNode } from 'react'
import { PageHeader } from '../../components/ui/basics'
import { IconArrowLeft } from '../../components/ui/icons'

/** Title bar for a game page with a back button to the hub. */
export function GameHeader({ title, subtitle, right, onBack }: { title: string; subtitle?: string; right?: ReactNode; onBack: () => void }) {
  return (
    <div className="flex items-start gap-2">
      <button type="button" onClick={onBack} className="-ml-1 mt-1 rounded-full p-1.5 text-ink-2 hover:bg-card" aria-label="Back to games">
        <IconArrowLeft width={22} height={22} />
      </button>
      <div className="min-w-0 flex-1">
        <PageHeader title={title} subtitle={subtitle} right={right} />
      </div>
    </div>
  )
}
