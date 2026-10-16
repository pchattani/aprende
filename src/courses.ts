/** The sister courses published side by side (same site, one path each). Source of truth: courses.json. */
import courses from '../courses.json'

export interface CourseLink {
  id: string
  name: string
  native: string
  app: string
  flag: string
  href: string
}

/** Courses that are live on the site, for the sister-course switcher. */
export const COURSES: CourseLink[] = courses
  .filter((c) => c.live)
  .map((c) => ({ id: c.id, name: c.name, native: c.native, app: c.app, flag: c.flag, href: c.slug ? `/aprende/${c.slug}/` : '/aprende/' }))

/** The Pawsport hub (all languages and your progress in each), at the site root. */
export const HUB_URL = '/aprende/'
