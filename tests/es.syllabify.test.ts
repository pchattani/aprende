import { describe, it, expect } from 'vitest'
import { syllabify } from '@/lang/es/syllabify'
import { analyzeAccent, explainAccent } from '@/lang/es/accents'

const GOLDEN: Record<string, string> = {
  casa: 'ca-sa', perro: 'pe-rro', coche: 'co-che', calle: 'ca-lle', queso: 'que-so', guerra: 'gue-rra',
  pingüino: 'pin-güi-no', ciudad: 'ciu-dad', país: 'pa-ís', caer: 'ca-er', raíz: 'ra-íz', baúl: 'ba-úl',
  oír: 'o-ír', ahí: 'a-hí', ahumar: 'ahu-mar', alcohol: 'al-co-hol', prohibir: 'prohi-bir',
  instruir: 'ins-truir', constante: 'cons-tan-te', transporte: 'trans-por-te', atlas: 'at-las',
  rey: 'rey', muy: 'muy', yo: 'yo', ayer: 'a-yer', hoy: 'hoy', Uruguay: 'U-ru-guay', buey: 'buey',
  canción: 'can-ción', teléfono: 'te-lé-fo-no', música: 'mú-si-ca', árbol: 'ár-bol', lápiz: 'lá-piz',
  examen: 'e-xa-men', estudiante: 'es-tu-dian-te', familia: 'fa-mi-lia', idea: 'i-de-a', poeta: 'po-e-ta',
  aire: 'ai-re', europa: 'eu-ro-pa', aeropuerto: 'a-e-ro-puer-to', obstruir: 'obs-truir', abrir: 'a-brir',
  padre: 'pa-dre', hablar: 'ha-blar', inglés: 'in-glés', también: 'tam-bién', después: 'des-pués',
  cuídate: 'cuí-da-te', día: 'dí-a', río: 'rí-o', frío: 'frí-o', leer: 'le-er', veo: 've-o', héroe: 'hé-ro-e',
  actriz: 'ac-triz', acción: 'ac-ción', excelente: 'ex-ce-len-te', reír: 're-ír', construcción: 'cons-truc-ción',
  nosotros: 'no-so-tros', vosotros: 'vo-so-tros', dígamelo: 'dí-ga-me-lo', fácilmente: 'fá-cil-men-te',
  a: 'a', y: 'y', el: 'el', sí: 'sí', chimenea: 'chi-me-ne-a', llorar: 'llo-rar', aún: 'a-ún', aun: 'aun',
  Paraguay: 'Pa-ra-guay', averiguáis: 'a-ve-ri-guáis', limpiáis: 'lim-piáis', envidia: 'en-vi-dia',
}

describe('syllabify', () => {
  for (const [w, s] of Object.entries(GOLDEN)) {
    it(`${w} -> ${s}`, () => {
      expect(syllabify(w).join('-')).toBe(s)
    })
  }
})

describe('analyzeAccent', () => {
  const valid = [
    'casa', 'canción', 'café', 'jamás', 'reloj', 'hablar', 'árbol', 'lápiz', 'bíceps', 'música', 'dígamelo',
    'país', 'raíz', 'baúl', 'oír', 'sí', 'más', 'él', 'tú', 'qué', 'cómo', 'dónde', 'aún', 'sol', 'pan',
    'examen', 'exámenes', 'joven', 'jóvenes', 'imagen', 'imágenes', 'feliz', 'felices', 'teléfono', 'también',
    'después', 'inglés', 'ingleses', 'día', 'río', 'frío', 'leí', 'oído', 'ahí', 'cuídate', 'fácil', 'difícil',
    'estudiante', 'familia', 'ciudad', 'ciudades', 'actriz', 'virus', 'crisis', 'martes', 'robots',
  ]
  for (const w of valid) {
    it(`${w} is written correctly`, () => {
      const a = analyzeAccent(w)
      expect(a.valid, `${w}: ${JSON.stringify(a)}`).toBe(true)
    })
  }
  // Only forms that are internally inconsistent can be judged without a dictionary
  // ('cancion' alone is a valid llana word; the checker compares against the dictionary form).
  const invalid = ['exámen', 'hablár', 'cáma', 'sól', 'fué', 'cantár']
  for (const w of invalid) {
    it(`${w} is misaccented`, () => {
      expect(analyzeAccent(w).valid, w).toBe(false)
    })
  }
  it('classifies word types', () => {
    expect(analyzeAccent('canción').type).toBe('aguda')
    expect(analyzeAccent('casa').type).toBe('llana')
    expect(analyzeAccent('música').type).toBe('esdrújula')
    expect(analyzeAccent('dígamelo').type).toBe('sobresdrújula')
  })
  it('explains', () => {
    expect(explainAccent('canción')).toMatch(/can-CIÓN: aguda/)
    expect(explainAccent('país')).toMatch(/hiatus/)
  })
})
