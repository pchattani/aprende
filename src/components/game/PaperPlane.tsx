/** Our airmail paper plane, nose to the right, folded in three tones of the current colour. */
export function PaperPlane({ className = '', size }: { className?: string; size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} className={className} aria-hidden="true">
      <path d="M1.8 10.6 22.2 3.6 9.4 13.4z" fill="currentColor" />
      <path d="M9.4 13.4 22.2 3.6 15.6 20.4z" fill="currentColor" opacity="0.78" />
      <path d="M9.4 13.4 10.6 19.6 13.1 15.9z" fill="currentColor" opacity="0.55" />
    </svg>
  )
}
