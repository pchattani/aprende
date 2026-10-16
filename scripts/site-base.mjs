// The site's base path on GitHub Pages: https://<owner>.github.io/<repository>/.
// In GitHub Actions it follows the repository's name (GITHUB_REPOSITORY), so renaming the
// repository moves the site without code changes; SITE_BASE overrides it; locally it is /pawsport/.
const repo = (process.env.GITHUB_REPOSITORY ?? '').split('/')[1]
export const SITE_BASE = process.env.SITE_BASE ?? `/${repo || 'pawsport'}/`
