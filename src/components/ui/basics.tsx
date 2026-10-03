import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { IconSpeaker, IconTurtle } from './icons'
import { useSpeak } from '../../hooks/useSpeak'

export function Button({ variant = 'primary', className = '', ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'ok' | 'bad' | 'ghost' }) {
  return <button type="button" className={`btn btn-${variant} ${className}`} {...props} />
}

export function ProgressBar({ value, max = 1, tone = 'ok', className = '' }: { value: number; max?: number; tone?: 'ok' | 'brand' | 'gold' | 'sky'; className?: string }) {
  const pct = Math.max(0, Math.min(100, (value / (max || 1)) * 100))
  const color = tone === 'ok' ? 'bg-ok-500' : tone === 'gold' ? 'bg-gold-500' : tone === 'sky' ? 'bg-sky-500' : 'bg-brand-500'
  return (
    <div className={`h-3 w-full overflow-hidden rounded-full bg-surface-2 ${className}`} role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}>
      <div className={`h-full rounded-full transition-all duration-300 ${color}`} style={{ width: `${pct}%` }} />
    </div>
  )
}

export function SpeakerButton({ text, slow = false, size = 'md', autoPlay = false, className = '' }: { text: string; slow?: boolean; size?: 'sm' | 'md' | 'lg'; autoPlay?: boolean; className?: string }) {
  const { say, supported } = useSpeak()
  const dim = size === 'lg' ? 'h-20 w-20' : size === 'sm' ? 'h-9 w-9' : 'h-12 w-12'
  const icon = size === 'lg' ? 40 : size === 'sm' ? 18 : 24
  if (!supported) return null
  return (
    <button
      type="button"
      onClick={() => void say(text, slow)}
      ref={(el) => {
        if (el && autoPlay && !el.dataset.played) {
          el.dataset.played = '1'
          void say(text, slow)
        }
      }}
      className={`inline-flex items-center justify-center rounded-2xl bg-sky-500 text-white shadow-[0_4px_0_0_var(--color-sky-600)] active:translate-y-[2px] active:shadow-none ${dim} ${className}`}
      aria-label={slow ? 'Play slowly' : 'Play audio'}
    >
      {slow ? <IconTurtle width={icon} height={icon} /> : <IconSpeaker width={icon} height={icon} />}
    </button>
  )
}

export function Chip({ children, tone = 'default', className = '' }: { children: ReactNode; tone?: 'default' | 'ok' | 'bad' | 'brand' | 'gold' | 'sky'; className?: string }) {
  const c =
    tone === 'ok' ? 'bg-ok-100 text-ok-700' : tone === 'bad' ? 'bg-bad-100 text-bad-700' : tone === 'brand' ? 'bg-brand-100 text-brand-800' : tone === 'gold' ? 'bg-amber-100 text-amber-800' : tone === 'sky' ? 'bg-sky-100 text-sky-700' : 'bg-surface-2 text-muted'
  return <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold ${c} ${className}`}>{children}</span>
}

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="card text-center">
      <p className="font-bold">{title}</p>
      {children && <div className="mt-2 text-sm text-muted">{children}</div>}
    </div>
  )
}

export function PageHeader({ title, subtitle, right }: { title: string; subtitle?: string; right?: ReactNode }) {
  return (
    <header className="mb-4 flex items-start justify-between gap-3">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">{title}</h1>
        {subtitle && <p className="text-sm text-muted">{subtitle}</p>}
      </div>
      {right}
    </header>
  )
}
