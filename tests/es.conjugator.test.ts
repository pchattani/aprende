import { describe, it, expect } from 'vitest'
import { conjugate, withReflexive } from '@/lang/es/verbs'
import type { Tense } from '@/lang/es/conjugator'

type G = Partial<Record<Tense | 'participle' | 'gerund', string>>
// Golden forms: "yo,tú,él,nosotros,vosotros,ellos"
const GOLD: Record<string, G> = {
  hablar: { pres: 'hablo,hablas,habla,hablamos,habláis,hablan', pret: 'hablé,hablaste,habló,hablamos,hablasteis,hablaron', impf: 'hablaba,hablabas,hablaba,hablábamos,hablabais,hablaban', fut: 'hablaré,hablarás,hablará,hablaremos,hablaréis,hablarán', cond: 'hablaría,hablarías,hablaría,hablaríamos,hablaríais,hablarían', subjPres: 'hable,hables,hable,hablemos,habléis,hablen', subjImpf: 'hablara,hablaras,hablara,habláramos,hablarais,hablaran', subjImpfSe: 'hablase,hablases,hablase,hablásemos,hablaseis,hablasen', impAff: '-,habla,hable,hablemos,hablad,hablen', impNeg: '-,no hables,no hable,no hablemos,no habléis,no hablen', participle: 'hablado', gerund: 'hablando', perf: 'he hablado,has hablado,ha hablado,hemos hablado,habéis hablado,han hablado' },
  comer: { pres: 'como,comes,come,comemos,coméis,comen', pret: 'comí,comiste,comió,comimos,comisteis,comieron', impf: 'comía,comías,comía,comíamos,comíais,comían', subjPres: 'coma,comas,coma,comamos,comáis,coman', subjImpf: 'comiera,comieras,comiera,comiéramos,comierais,comieran', impAff: '-,come,coma,comamos,comed,coman', gerund: 'comiendo', participle: 'comido' },
  vivir: { pres: 'vivo,vives,vive,vivimos,vivís,viven', pret: 'viví,viviste,vivió,vivimos,vivisteis,vivieron', impAff: '-,vive,viva,vivamos,vivid,vivan', gerund: 'viviendo' },
  ser: { pres: 'soy,eres,es,somos,sois,son', pret: 'fui,fuiste,fue,fuimos,fuisteis,fueron', impf: 'era,eras,era,éramos,erais,eran', fut: 'seré,serás,será,seremos,seréis,serán', subjPres: 'sea,seas,sea,seamos,seáis,sean', subjImpf: 'fuera,fueras,fuera,fuéramos,fuerais,fueran', impAff: '-,sé,sea,seamos,sed,sean', participle: 'sido', gerund: 'siendo' },
  estar: { pres: 'estoy,estás,está,estamos,estáis,están', pret: 'estuve,estuviste,estuvo,estuvimos,estuvisteis,estuvieron', subjPres: 'esté,estés,esté,estemos,estéis,estén', subjImpf: 'estuviera,estuvieras,estuviera,estuviéramos,estuvierais,estuvieran', impAff: '-,está,esté,estemos,estad,estén' },
  ir: { pres: 'voy,vas,va,vamos,vais,van', pret: 'fui,fuiste,fue,fuimos,fuisteis,fueron', impf: 'iba,ibas,iba,íbamos,ibais,iban', subjPres: 'vaya,vayas,vaya,vayamos,vayáis,vayan', impAff: '-,ve,vaya,vamos,id,vayan', impNeg: '-,no vayas,no vaya,no vayamos,no vayáis,no vayan', gerund: 'yendo', participle: 'ido' },
  tener: { pres: 'tengo,tienes,tiene,tenemos,tenéis,tienen', pret: 'tuve,tuviste,tuvo,tuvimos,tuvisteis,tuvieron', fut: 'tendré,tendrás,tendrá,tendremos,tendréis,tendrán', cond: 'tendría,tendrías,tendría,tendríamos,tendríais,tendrían', subjPres: 'tenga,tengas,tenga,tengamos,tengáis,tengan', impAff: '-,ten,tenga,tengamos,tened,tengan', subjImpf: 'tuviera,tuvieras,tuviera,tuviéramos,tuvierais,tuvieran' },
  hacer: { pres: 'hago,haces,hace,hacemos,hacéis,hacen', pret: 'hice,hiciste,hizo,hicimos,hicisteis,hicieron', fut: 'haré,harás,hará,haremos,haréis,harán', subjPres: 'haga,hagas,haga,hagamos,hagáis,hagan', impAff: '-,haz,haga,hagamos,haced,hagan', participle: 'hecho', pluperf: 'había hecho,habías hecho,había hecho,habíamos hecho,habíais hecho,habían hecho' },
  poder: { pres: 'puedo,puedes,puede,podemos,podéis,pueden', pret: 'pude,pudiste,pudo,pudimos,pudisteis,pudieron', fut: 'podré,podrás,podrá,podremos,podréis,podrán', subjPres: 'pueda,puedas,pueda,podamos,podáis,puedan', gerund: 'pudiendo' },
  poner: { pres: 'pongo,pones,pone,ponemos,ponéis,ponen', pret: 'puse,pusiste,puso,pusimos,pusisteis,pusieron', fut: 'pondré,pondrás,pondrá,pondremos,pondréis,pondrán', subjPres: 'ponga,pongas,ponga,pongamos,pongáis,pongan', impAff: '-,pon,ponga,pongamos,poned,pongan', participle: 'puesto' },
  querer: { pres: 'quiero,quieres,quiere,queremos,queréis,quieren', pret: 'quise,quisiste,quiso,quisimos,quisisteis,quisieron', fut: 'querré,querrás,querrá,querremos,querréis,querrán', subjPres: 'quiera,quieras,quiera,queramos,queráis,quieran' },
  saber: { pres: 'sé,sabes,sabe,sabemos,sabéis,saben', pret: 'supe,supiste,supo,supimos,supisteis,supieron', fut: 'sabré,sabrás,sabrá,sabremos,sabréis,sabrán', subjPres: 'sepa,sepas,sepa,sepamos,sepáis,sepan' },
  venir: { pres: 'vengo,vienes,viene,venimos,venís,vienen', pret: 'vine,viniste,vino,vinimos,vinisteis,vinieron', fut: 'vendré,vendrás,vendrá,vendremos,vendréis,vendrán', subjPres: 'venga,vengas,venga,vengamos,vengáis,vengan', impAff: '-,ven,venga,vengamos,venid,vengan', gerund: 'viniendo' },
  decir: { pres: 'digo,dices,dice,decimos,decís,dicen', pret: 'dije,dijiste,dijo,dijimos,dijisteis,dijeron', fut: 'diré,dirás,dirá,diremos,diréis,dirán', subjPres: 'diga,digas,diga,digamos,digáis,digan', subjImpf: 'dijera,dijeras,dijera,dijéramos,dijerais,dijeran', impAff: '-,di,diga,digamos,decid,digan', participle: 'dicho', gerund: 'diciendo' },
  dar: { pres: 'doy,das,da,damos,dais,dan', pret: 'di,diste,dio,dimos,disteis,dieron', subjPres: 'dé,des,dé,demos,deis,den', impAff: '-,da,dé,demos,dad,den' },
  ver: { pres: 'veo,ves,ve,vemos,veis,ven', pret: 'vi,viste,vio,vimos,visteis,vieron', impf: 'veía,veías,veía,veíamos,veíais,veían', subjPres: 'vea,veas,vea,veamos,veáis,vean', participle: 'visto', gerund: 'viendo' },
  salir: { pres: 'salgo,sales,sale,salimos,salís,salen', fut: 'saldré,saldrás,saldrá,saldremos,saldréis,saldrán', impAff: '-,sal,salga,salgamos,salid,salgan' },
  traer: { pres: 'traigo,traes,trae,traemos,traéis,traen', pret: 'traje,trajiste,trajo,trajimos,trajisteis,trajeron', participle: 'traído', gerund: 'trayendo', subjPres: 'traiga,traigas,traiga,traigamos,traigáis,traigan' },
  caer: { pres: 'caigo,caes,cae,caemos,caéis,caen', pret: 'caí,caíste,cayó,caímos,caísteis,cayeron', participle: 'caído', gerund: 'cayendo' },
  oír: { pres: 'oigo,oyes,oye,oímos,oís,oyen', pret: 'oí,oíste,oyó,oímos,oísteis,oyeron', subjPres: 'oiga,oigas,oiga,oigamos,oigáis,oigan', participle: 'oído', gerund: 'oyendo', impAff: '-,oye,oiga,oigamos,oíd,oigan' },
  leer: { pret: 'leí,leíste,leyó,leímos,leísteis,leyeron', participle: 'leído', gerund: 'leyendo', subjImpf: 'leyera,leyeras,leyera,leyéramos,leyerais,leyeran' },
  creer: { pret: 'creí,creíste,creyó,creímos,creísteis,creyeron', participle: 'creído' },
  construir: { pres: 'construyo,construyes,construye,construimos,construís,construyen', pret: 'construí,construiste,construyó,construimos,construisteis,construyeron', subjPres: 'construya,construyas,construya,construyamos,construyáis,construyan', gerund: 'construyendo', participle: 'construido' },
  huir: { pres: 'huyo,huyes,huye,huimos,huis,huyen', gerund: 'huyendo' },
  conocer: { pres: 'conozco,conoces,conoce,conocemos,conocéis,conocen', subjPres: 'conozca,conozcas,conozca,conozcamos,conozcáis,conozcan' },
  vencer: { pres: 'venzo,vences,vence,vencemos,vencéis,vencen', subjPres: 'venza,venzas,venza,venzamos,venzáis,venzan' },
  coger: { pres: 'cojo,coges,coge,cogemos,cogéis,cogen', subjPres: 'coja,cojas,coja,cojamos,cojáis,cojan' },
  dirigir: { pres: 'dirijo,diriges,dirige,dirigimos,dirigís,dirigen', subjPres: 'dirija,dirijas,dirija,dirijamos,dirijáis,dirijan' },
  seguir: { pres: 'sigo,sigues,sigue,seguimos,seguís,siguen', pret: 'seguí,seguiste,siguió,seguimos,seguisteis,siguieron', subjPres: 'siga,sigas,siga,sigamos,sigáis,sigan', gerund: 'siguiendo' },
  distinguir: { pres: 'distingo,distingues,distingue,distinguimos,distinguís,distinguen' },
  buscar: { pret: 'busqué,buscaste,buscó,buscamos,buscasteis,buscaron', subjPres: 'busque,busques,busque,busquemos,busquéis,busquen' },
  pagar: { pret: 'pagué,pagaste,pagó,pagamos,pagasteis,pagaron', subjPres: 'pague,pagues,pague,paguemos,paguéis,paguen' },
  empezar: { pres: 'empiezo,empiezas,empieza,empezamos,empezáis,empiezan', pret: 'empecé,empezaste,empezó,empezamos,empezasteis,empezaron', subjPres: 'empiece,empieces,empiece,empecemos,empecéis,empiecen' },
  averiguar: { pret: 'averigüé,averiguaste,averiguó,averiguamos,averiguasteis,averiguaron' },
  jugar: { pres: 'juego,juegas,juega,jugamos,jugáis,juegan', pret: 'jugué,jugaste,jugó,jugamos,jugasteis,jugaron', subjPres: 'juegue,juegues,juegue,juguemos,juguéis,jueguen' },
  pensar: { pres: 'pienso,piensas,piensa,pensamos,pensáis,piensan', subjPres: 'piense,pienses,piense,pensemos,penséis,piensen', impAff: '-,piensa,piense,pensemos,pensad,piensen' },
  volver: { pres: 'vuelvo,vuelves,vuelve,volvemos,volvéis,vuelven', participle: 'vuelto', subjPres: 'vuelva,vuelvas,vuelva,volvamos,volváis,vuelvan' },
  dormir: { pres: 'duermo,duermes,duerme,dormimos,dormís,duermen', pret: 'dormí,dormiste,durmió,dormimos,dormisteis,durmieron', subjPres: 'duerma,duermas,duerma,durmamos,durmáis,duerman', gerund: 'durmiendo', subjImpf: 'durmiera,durmieras,durmiera,durmiéramos,durmierais,durmieran' },
  sentir: { pres: 'siento,sientes,siente,sentimos,sentís,sienten', pret: 'sentí,sentiste,sintió,sentimos,sentisteis,sintieron', subjPres: 'sienta,sientas,sienta,sintamos,sintáis,sientan', gerund: 'sintiendo' },
  pedir: { pres: 'pido,pides,pide,pedimos,pedís,piden', pret: 'pedí,pediste,pidió,pedimos,pedisteis,pidieron', subjPres: 'pida,pidas,pida,pidamos,pidáis,pidan', gerund: 'pidiendo' },
  elegir: { pres: 'elijo,eliges,elige,elegimos,elegís,eligen', subjPres: 'elija,elijas,elija,elijamos,elijáis,elijan', pret: 'elegí,elegiste,eligió,elegimos,elegisteis,eligieron' },
  morir: { participle: 'muerto', pret: 'morí,moriste,murió,morimos,moristeis,murieron', gerund: 'muriendo' },
  reír: { pres: 'río,ríes,ríe,reímos,reís,ríen', pret: 'reí,reíste,rio,reímos,reísteis,rieron', gerund: 'riendo' },
  enviar: { pres: 'envío,envías,envía,enviamos,enviáis,envían', subjPres: 'envíe,envíes,envíe,enviemos,enviéis,envíen' },
  continuar: { pres: 'continúo,continúas,continúa,continuamos,continuáis,continúan' },
  prohibir: { pres: 'prohíbo,prohíbes,prohíbe,prohibimos,prohibís,prohíben' },
  reunir: { pres: 'reúno,reúnes,reúne,reunimos,reunís,reúnen' },
  escribir: { participle: 'escrito' },
  abrir: { participle: 'abierto' },
  andar: { pret: 'anduve,anduviste,anduvo,anduvimos,anduvisteis,anduvieron' },
  conducir: { pres: 'conduzco,conduces,conduce,conducimos,conducís,conducen', pret: 'conduje,condujiste,condujo,condujimos,condujisteis,condujeron' },
  haber: { pres: 'he,has,ha,hemos,habéis,han', pret: 'hube,hubiste,hubo,hubimos,hubisteis,hubieron', subjPres: 'haya,hayas,haya,hayamos,hayáis,hayan', fut: 'habré,habrás,habrá,habremos,habréis,habrán' },
  oler: { pres: 'huelo,hueles,huele,olemos,oléis,huelen' },
  gruñir: { pret: 'gruñí,gruñiste,gruñó,gruñimos,gruñisteis,gruñeron', gerund: 'gruñendo' },
  cambiar: { pres: 'cambio,cambias,cambia,cambiamos,cambiáis,cambian' },
  obtener: { pres: 'obtengo,obtienes,obtiene,obtenemos,obtenéis,obtienen', impAff: '-,obtén,obtenga,obtengamos,obtened,obtengan' },
}

describe('conjugate (golden)', () => {
  for (const [lemma, g] of Object.entries(GOLD)) {
    const c = conjugate(lemma)
    for (const [tense, expected] of Object.entries(g)) {
      it(`${lemma} ${tense}`, () => {
        if (tense === 'participle') expect(c.participle).toBe(expected)
        else if (tense === 'gerund') expect(c.gerund).toBe(expected)
        else {
          const got = c.forms[tense as Tense].map((f) => f ?? '-').join(',')
          expect(got).toBe(expected)
        }
      })
    }
  }
})

describe('reflexive', () => {
  it('strips -se and attaches pronouns', () => {
    const c = conjugate('levantarse')
    expect(c.reflexive).toBe(true)
    expect(withReflexive(c.forms.pres[0], 0, 'pres')).toBe('me levanto')
    expect(withReflexive(c.forms.impAff[1], 1, 'impAff')).toBe('levántate')
    expect(withReflexive(c.forms.impAff[3], 3, 'impAff')).toBe('levantémonos')
    expect(withReflexive(c.forms.impAff[4], 4, 'impAff')).toBe('levantaos')
    expect(withReflexive(c.forms.impNeg[1], 1, 'impNeg')).toBe('no te levantes')
  })
  it('uses the table for reflexive forms of listed verbs', () => {
    expect(conjugate('acostarse').forms.pres[0]).toBe('acuesto')
    expect(conjugate('despertarse').forms.pres[2]).toBe('despierta')
    expect(conjugate('dormirse').gerund).toBe('durmiendo')
  })
})
