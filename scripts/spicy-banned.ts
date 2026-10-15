/**
 * Words that never belong in "modo picante" sentences. The mode is cheeky and
 * flirty, PG-13, between consenting adults: humour over innuendo, no explicit
 * anatomy, no slurs, no violence, nothing involving minors. Checked by content:check.
 * Entries match whole words (accent-insensitive); a trailing * matches a prefix.
 */
export const SPICY_BANNED: string[] = [
  // explicit sexual vocabulary
  'follar', 'coger', 'joder', 'polla', 'verga', 'pija', 'coño', 'concha', 'chocho', 'culo', 'tetas', 'pene', 'vagina', 'orgasmo', 'sexo oral', 'masturb*',
  'puta', 'puto', 'zorra', 'cabrón', 'cabron', 'mierda', 'gilipollas', 'pendejo', 'boludo', 'hijo de puta',
  // minors
  'niño', 'niña', 'niños', 'niñas', 'menor', 'menores', 'colegio', 'escuela primaria', 'adolescente',
  // violence / coercion
  'violar', 'violación', 'forzar', 'golpear', 'matar', 'sangre',
  // drugs
  'droga', 'drogas', 'cocaína', 'porro',
]
