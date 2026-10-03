/** The Aprende mark: a speech bubble with a sunrise inside, in the brand gradient. */
export function Mark({ size = 40, className = '' }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true" className={className}>
      <defs>
        <linearGradient id="aprende-g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#7c5cff" />
          <stop offset="0.6" stopColor="#ff5fa2" />
          <stop offset="1" stopColor="#ff9f43" />
        </linearGradient>
      </defs>
      <path d="M32 6C17.6 6 6 16.3 6 29c0 7.4 3.9 14 10 18.2V58l10.6-6.3c1.8.3 3.6.5 5.4.5 14.4 0 26-10.3 26-23S46.4 6 32 6z" fill="url(#aprende-g)" />
      <path d="M20 34a12 12 0 0 1 24 0z" fill="#fff" fillOpacity="0.95" />
      <path d="M18 37h28" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeOpacity="0.95" />
      <path d="M32 15v4M22 19l3 3M42 19l-3 3" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeOpacity="0.9" />
    </svg>
  )
}
