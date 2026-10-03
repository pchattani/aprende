/** The Aprende mark: a rising sun over a horizon line, in the brand terracotta and saffron. */
export function Mark({ size = 40, className = '' }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true" className={className}>
      <defs>
        <linearGradient id="aprende-sun" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#d9a431" />
          <stop offset="1" stopColor="#cf5f3d" />
        </linearGradient>
      </defs>
      <circle cx="32" cy="32" r="30" fill="#fffdf8" stroke="#e6d9c3" strokeWidth="2" />
      <path d="M14 40a18 18 0 0 1 36 0z" fill="url(#aprende-sun)" />
      <path d="M12 44h40" stroke="#2b2117" strokeWidth="3" strokeLinecap="round" />
      <path d="M32 12v6M18 18l4 4M46 18l-4 4" stroke="#d9a431" strokeWidth="3" strokeLinecap="round" />
    </svg>
  )
}
