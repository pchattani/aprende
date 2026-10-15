/** The sister courses published side by side (same site, one path each). */
export interface CourseLink {
  id: string
  name: string
  native: string
  app: string
  flag: string
  href: string
}

export const COURSES: CourseLink[] = [
  { id: 'es', name: 'Spanish', native: 'Español', app: 'Aprende', flag: '🇪🇸', href: '/aprende/' },
  { id: 'yue', name: 'Cantonese', native: '廣東話', app: 'Gong 講', flag: '🇭🇰', href: '/aprende/cantonese/' },
  { id: 'pt', name: 'Portuguese', native: 'Português', app: 'Aprenda', flag: '🇧🇷', href: '/aprende/portuguese/' },
  { id: 'it', name: 'Italian', native: 'Italiano', app: 'Impara', flag: '🇮🇹', href: '/aprende/italian/' },
]
