import { describe, it, expect } from 'vitest'
import { conjugate, conjugateWith, withReflexive, allForms, agreementVariants, IRREGULAR, TENSES, TENSE_LABELS, PERSONS, VERB_TRAINER, ISC_VERBS } from '@/lang/it/verbs'
import type { Tense } from '@/lang/it/conjugator'

type G = Partial<Record<Tense | 'participle' | 'gerund', string>>
// Golden forms: "io,tu,lui,noi,voi,loro" ("-" = no form)
const GOLD: Record<string, G> = {
  // ---- regular -are / -ere / -ire, all tenses
  parlare: {
    pres: 'parlo,parli,parla,parliamo,parlate,parlano', impf: 'parlavo,parlavi,parlava,parlavamo,parlavate,parlavano',
    pret: 'parlai,parlasti,parlò,parlammo,parlaste,parlarono', fut: 'parlerò,parlerai,parlerà,parleremo,parlerete,parleranno',
    cond: 'parlerei,parleresti,parlerebbe,parleremmo,parlereste,parlerebbero', subjPres: 'parli,parli,parli,parliamo,parliate,parlino',
    subjImpf: 'parlassi,parlassi,parlasse,parlassimo,parlaste,parlassero', impAff: '-,parla,parli,parliamo,parlate,parlino',
    impNeg: '-,non parlare,non parli,non parliamo,non parlate,non parlino', participle: 'parlato', gerund: 'parlando',
    perf: 'ho parlato,hai parlato,ha parlato,abbiamo parlato,avete parlato,hanno parlato',
    pluperf: 'avevo parlato,avevi parlato,aveva parlato,avevamo parlato,avevate parlato,avevano parlato',
    pretPerf: 'ebbi parlato,avesti parlato,ebbe parlato,avemmo parlato,aveste parlato,ebbero parlato',
    futPerf: 'avrò parlato,avrai parlato,avrà parlato,avremo parlato,avrete parlato,avranno parlato',
    condPerf: 'avrei parlato,avresti parlato,avrebbe parlato,avremmo parlato,avreste parlato,avrebbero parlato',
    subjPerf: 'abbia parlato,abbia parlato,abbia parlato,abbiamo parlato,abbiate parlato,abbiano parlato',
    subjPluperf: 'avessi parlato,avessi parlato,avesse parlato,avessimo parlato,aveste parlato,avessero parlato',
  },
  credere: {
    pres: 'credo,credi,crede,crediamo,credete,credono', impf: 'credevo,credevi,credeva,credevamo,credevate,credevano',
    pret: 'credei,credesti,credé,credemmo,credeste,crederono', fut: 'crederò,crederai,crederà,crederemo,crederete,crederanno',
    cond: 'crederei,crederesti,crederebbe,crederemmo,credereste,crederebbero', subjPres: 'creda,creda,creda,crediamo,crediate,credano',
    subjImpf: 'credessi,credessi,credesse,credessimo,credeste,credessero', impAff: '-,credi,creda,crediamo,credete,credano',
    impNeg: '-,non credere,non creda,non crediamo,non credete,non credano', participle: 'creduto', gerund: 'credendo',
  },
  dormire: {
    pres: 'dormo,dormi,dorme,dormiamo,dormite,dormono', impf: 'dormivo,dormivi,dormiva,dormivamo,dormivate,dormivano',
    pret: 'dormii,dormisti,dormì,dormimmo,dormiste,dormirono', fut: 'dormirò,dormirai,dormirà,dormiremo,dormirete,dormiranno',
    cond: 'dormirei,dormiresti,dormirebbe,dormiremmo,dormireste,dormirebbero', subjPres: 'dorma,dorma,dorma,dormiamo,dormiate,dormano',
    subjImpf: 'dormissi,dormissi,dormisse,dormissimo,dormiste,dormissero', impAff: '-,dormi,dorma,dormiamo,dormite,dormano',
    participle: 'dormito', gerund: 'dormendo',
  },
  partire: { pres: 'parto,parti,parte,partiamo,partite,partono', perf: 'sono partito,sei partito,è partito,siamo partiti,siete partiti,sono partiti', condPerf: 'sarei partito,saresti partito,sarebbe partito,saremmo partiti,sareste partiti,sarebbero partiti' },
  sentire: { pres: 'sento,senti,sente,sentiamo,sentite,sentono', subjPres: 'senta,senta,senta,sentiamo,sentiate,sentano' },
  // ---- -isc- verbs
  finire: {
    pres: 'finisco,finisci,finisce,finiamo,finite,finiscono', subjPres: 'finisca,finisca,finisca,finiamo,finiate,finiscano',
    impAff: '-,finisci,finisca,finiamo,finite,finiscano', impf: 'finivo,finivi,finiva,finivamo,finivate,finivano',
    pret: 'finii,finisti,finì,finimmo,finiste,finirono', fut: 'finirò,finirai,finirà,finiremo,finirete,finiranno', participle: 'finito', gerund: 'finendo',
  },
  capire: { pres: 'capisco,capisci,capisce,capiamo,capite,capiscono', subjPres: 'capisca,capisca,capisca,capiamo,capiate,capiscano' },
  preferire: { pres: 'preferisco,preferisci,preferisce,preferiamo,preferite,preferiscono' },
  pulire: { pres: 'pulisco,pulisci,pulisce,puliamo,pulite,puliscono', impAff: '-,pulisci,pulisca,puliamo,pulite,puliscano' },
  spedire: { pres: 'spedisco,spedisci,spedisce,spediamo,spedite,spediscono' },
  costruire: { pres: 'costruisco,costruisci,costruisce,costruiamo,costruite,costruiscono', participle: 'costruito' },
  ricostruire: { pres: 'ricostruisco,ricostruisci,ricostruisce,ricostruiamo,ricostruite,ricostruiscono' },
  // ---- spelling changes
  cercare: {
    pres: 'cerco,cerchi,cerca,cerchiamo,cercate,cercano', fut: 'cercherò,cercherai,cercherà,cercheremo,cercherete,cercheranno',
    cond: 'cercherei,cercheresti,cercherebbe,cercheremmo,cerchereste,cercherebbero', subjPres: 'cerchi,cerchi,cerchi,cerchiamo,cerchiate,cerchino',
    impAff: '-,cerca,cerchi,cerchiamo,cercate,cerchino', pret: 'cercai,cercasti,cercò,cercammo,cercaste,cercarono',
  },
  pagare: { pres: 'pago,paghi,paga,paghiamo,pagate,pagano', fut: 'pagherò,pagherai,pagherà,pagheremo,pagherete,pagheranno', subjPres: 'paghi,paghi,paghi,paghiamo,paghiate,paghino' },
  giocare: { pres: 'gioco,giochi,gioca,giochiamo,giocate,giocano', fut: 'giocherò,giocherai,giocherà,giocheremo,giocherete,giocheranno' },
  spiegare: { fut: 'spiegherò,spiegherai,spiegherà,spiegheremo,spiegherete,spiegheranno' },
  mangiare: {
    pres: 'mangio,mangi,mangia,mangiamo,mangiate,mangiano', fut: 'mangerò,mangerai,mangerà,mangeremo,mangerete,mangeranno',
    cond: 'mangerei,mangeresti,mangerebbe,mangeremmo,mangereste,mangerebbero', subjPres: 'mangi,mangi,mangi,mangiamo,mangiate,mangino',
    pret: 'mangiai,mangiasti,mangiò,mangiammo,mangiaste,mangiarono', impAff: '-,mangia,mangi,mangiamo,mangiate,mangino',
  },
  cominciare: { pres: 'comincio,cominci,comincia,cominciamo,cominciate,cominciano', fut: 'comincerò,comincerai,comincerà,cominceremo,comincerete,cominceranno', subjPres: 'cominci,cominci,cominci,cominciamo,cominciate,comincino' },
  lasciare: { pres: 'lascio,lasci,lascia,lasciamo,lasciate,lasciano', fut: 'lascerò,lascerai,lascerà,lasceremo,lascerete,lasceranno' },
  viaggiare: { pres: 'viaggio,viaggi,viaggia,viaggiamo,viaggiate,viaggiano', fut: 'viaggerò,viaggerai,viaggerà,viaggeremo,viaggerete,viaggeranno' },
  studiare: {
    pres: 'studio,studi,studia,studiamo,studiate,studiano', fut: 'studierò,studierai,studierà,studieremo,studierete,studieranno',
    subjPres: 'studi,studi,studi,studiamo,studiate,studino', impAff: '-,studia,studi,studiamo,studiate,studino',
  },
  inviare: { pres: 'invio,invii,invia,inviamo,inviate,inviano', subjPres: 'invii,invii,invii,inviamo,inviate,inviino', fut: 'invierò,invierai,invierà,invieremo,invierete,invieranno' },
  sciare: { pres: 'scio,scii,scia,sciamo,sciate,sciano', fut: 'scierò,scierai,scierà,scieremo,scierete,scieranno' },
  tagliare: { pres: 'taglio,tagli,taglia,tagliamo,tagliate,tagliano', fut: 'taglierò,taglierai,taglierà,taglieremo,taglierete,taglieranno' },
  // ---- the big irregulars
  essere: {
    pres: 'sono,sei,è,siamo,siete,sono', impf: 'ero,eri,era,eravamo,eravate,erano', pret: 'fui,fosti,fu,fummo,foste,furono',
    fut: 'sarò,sarai,sarà,saremo,sarete,saranno', cond: 'sarei,saresti,sarebbe,saremmo,sareste,sarebbero',
    subjPres: 'sia,sia,sia,siamo,siate,siano', subjImpf: 'fossi,fossi,fosse,fossimo,foste,fossero', impAff: '-,sii,sia,siamo,siate,siano',
    impNeg: '-,non essere,non sia,non siamo,non siate,non siano', participle: 'stato', gerund: 'essendo',
    perf: 'sono stato,sei stato,è stato,siamo stati,siete stati,sono stati',
  },
  avere: {
    pres: 'ho,hai,ha,abbiamo,avete,hanno', impf: 'avevo,avevi,aveva,avevamo,avevate,avevano', pret: 'ebbi,avesti,ebbe,avemmo,aveste,ebbero',
    fut: 'avrò,avrai,avrà,avremo,avrete,avranno', cond: 'avrei,avresti,avrebbe,avremmo,avreste,avrebbero',
    subjPres: 'abbia,abbia,abbia,abbiamo,abbiate,abbiano', subjImpf: 'avessi,avessi,avesse,avessimo,aveste,avessero',
    impAff: '-,abbi,abbia,abbiamo,abbiate,abbiano', participle: 'avuto', gerund: 'avendo', perf: 'ho avuto,hai avuto,ha avuto,abbiamo avuto,avete avuto,hanno avuto',
  },
  andare: {
    pres: 'vado,vai,va,andiamo,andate,vanno', fut: 'andrò,andrai,andrà,andremo,andrete,andranno', cond: 'andrei,andresti,andrebbe,andremmo,andreste,andrebbero',
    subjPres: 'vada,vada,vada,andiamo,andiate,vadano', subjImpf: 'andassi,andassi,andasse,andassimo,andaste,andassero',
    pret: 'andai,andasti,andò,andammo,andaste,andarono', impAff: "-,va',vada,andiamo,andate,vadano", impNeg: '-,non andare,non vada,non andiamo,non andate,non vadano',
    perf: 'sono andato,sei andato,è andato,siamo andati,siete andati,sono andati',
    pluperf: 'ero andato,eri andato,era andato,eravamo andati,eravate andati,erano andati',
    futPerf: 'sarò andato,sarai andato,sarà andato,saremo andati,sarete andati,saranno andati',
    subjPluperf: 'fossi andato,fossi andato,fosse andato,fossimo andati,foste andati,fossero andati',
  },
  fare: {
    pres: 'faccio,fai,fa,facciamo,fate,fanno', impf: 'facevo,facevi,faceva,facevamo,facevate,facevano', pret: 'feci,facesti,fece,facemmo,faceste,fecero',
    fut: 'farò,farai,farà,faremo,farete,faranno', subjPres: 'faccia,faccia,faccia,facciamo,facciate,facciano',
    subjImpf: 'facessi,facessi,facesse,facessimo,faceste,facessero', impAff: "-,fa',faccia,facciamo,fate,facciano", participle: 'fatto', gerund: 'facendo',
    subjPluperf: 'avessi fatto,avessi fatto,avesse fatto,avessimo fatto,aveste fatto,avessero fatto',
  },
  dire: {
    pres: 'dico,dici,dice,diciamo,dite,dicono', impf: 'dicevo,dicevi,diceva,dicevamo,dicevate,dicevano', pret: 'dissi,dicesti,disse,dicemmo,diceste,dissero',
    fut: 'dirò,dirai,dirà,diremo,direte,diranno', subjPres: 'dica,dica,dica,diciamo,diciate,dicano', subjImpf: 'dicessi,dicessi,dicesse,dicessimo,diceste,dicessero',
    impAff: "-,di',dica,diciamo,dite,dicano", participle: 'detto', gerund: 'dicendo',
  },
  dare: {
    pres: 'do,dai,dà,diamo,date,danno', pret: 'diedi,desti,diede,demmo,deste,diedero', fut: 'darò,darai,darà,daremo,darete,daranno',
    subjPres: 'dia,dia,dia,diamo,diate,diano', subjImpf: 'dessi,dessi,desse,dessimo,deste,dessero', impAff: "-,da',dia,diamo,date,diano", participle: 'dato',
  },
  stare: {
    pres: 'sto,stai,sta,stiamo,state,stanno', pret: 'stetti,stesti,stette,stemmo,steste,stettero', fut: 'starò,starai,starà,staremo,starete,staranno',
    subjPres: 'stia,stia,stia,stiamo,stiate,stiano', subjImpf: 'stessi,stessi,stesse,stessimo,steste,stessero', impAff: "-,sta',stia,stiamo,state,stiano",
    participle: 'stato', gerund: 'stando', perf: 'sono stato,sei stato,è stato,siamo stati,siete stati,sono stati',
  },
  venire: {
    pres: 'vengo,vieni,viene,veniamo,venite,vengono', pret: 'venni,venisti,venne,venimmo,veniste,vennero', fut: 'verrò,verrai,verrà,verremo,verrete,verranno',
    subjPres: 'venga,venga,venga,veniamo,veniate,vengano', impAff: '-,vieni,venga,veniamo,venite,vengano', participle: 'venuto',
    subjPerf: 'sia venuto,sia venuto,sia venuto,siamo venuti,siate venuti,siano venuti',
  },
  tenere: { pres: 'tengo,tieni,tiene,teniamo,tenete,tengono', pret: 'tenni,tenesti,tenne,tenemmo,teneste,tennero', fut: 'terrò,terrai,terrà,terremo,terrete,terranno', subjPres: 'tenga,tenga,tenga,teniamo,teniate,tengano', participle: 'tenuto' },
  volere: { pres: 'voglio,vuoi,vuole,vogliamo,volete,vogliono', pret: 'volli,volesti,volle,volemmo,voleste,vollero', fut: 'vorrò,vorrai,vorrà,vorremo,vorrete,vorranno', cond: 'vorrei,vorresti,vorrebbe,vorremmo,vorreste,vorrebbero', subjPres: 'voglia,voglia,voglia,vogliamo,vogliate,vogliano', participle: 'voluto' },
  potere: { pres: 'posso,puoi,può,possiamo,potete,possono', pret: 'potei,potesti,poté,potemmo,poteste,poterono', fut: 'potrò,potrai,potrà,potremo,potrete,potranno', subjPres: 'possa,possa,possa,possiamo,possiate,possano', impAff: '-,-,-,-,-,-', participle: 'potuto' },
  dovere: { pres: 'devo,devi,deve,dobbiamo,dovete,devono', fut: 'dovrò,dovrai,dovrà,dovremo,dovrete,dovranno', cond: 'dovrei,dovresti,dovrebbe,dovremmo,dovreste,dovrebbero', subjPres: 'debba,debba,debba,dobbiamo,dobbiate,debbano', impAff: '-,-,-,-,-,-', participle: 'dovuto' },
  sapere: { pres: 'so,sai,sa,sappiamo,sapete,sanno', pret: 'seppi,sapesti,seppe,sapemmo,sapeste,seppero', fut: 'saprò,saprai,saprà,sapremo,saprete,sapranno', subjPres: 'sappia,sappia,sappia,sappiamo,sappiate,sappiano', impAff: '-,sappi,sappia,sappiamo,sappiate,sappiano', participle: 'saputo' },
  uscire: { pres: 'esco,esci,esce,usciamo,uscite,escono', subjPres: 'esca,esca,esca,usciamo,usciate,escano', impAff: '-,esci,esca,usciamo,uscite,escano', fut: 'uscirò,uscirai,uscirà,usciremo,uscirete,usciranno', perf: 'sono uscito,sei uscito,è uscito,siamo usciti,siete usciti,sono usciti' },
  bere: { pres: 'bevo,bevi,beve,beviamo,bevete,bevono', impf: 'bevevo,bevevi,beveva,bevevamo,bevevate,bevevano', pret: 'bevvi,bevesti,bevve,bevemmo,beveste,bevvero', fut: 'berrò,berrai,berrà,berremo,berrete,berranno', subjImpf: 'bevessi,bevessi,bevesse,bevessimo,beveste,bevessero', participle: 'bevuto', gerund: 'bevendo' },
  rimanere: { pres: 'rimango,rimani,rimane,rimaniamo,rimanete,rimangono', pret: 'rimasi,rimanesti,rimase,rimanemmo,rimaneste,rimasero', fut: 'rimarrò,rimarrai,rimarrà,rimarremo,rimarrete,rimarranno', subjPres: 'rimanga,rimanga,rimanga,rimaniamo,rimaniate,rimangano', participle: 'rimasto', perf: 'sono rimasto,sei rimasto,è rimasto,siamo rimasti,siete rimasti,sono rimasti' },
  // ---- porre, -durre, -trarre and compounds
  porre: { pres: 'pongo,poni,pone,poniamo,ponete,pongono', impf: 'ponevo,ponevi,poneva,ponevamo,ponevate,ponevano', pret: 'posi,ponesti,pose,ponemmo,poneste,posero', fut: 'porrò,porrai,porrà,porremo,porrete,porranno', subjPres: 'ponga,ponga,ponga,poniamo,poniate,pongano', participle: 'posto', gerund: 'ponendo' },
  proporre: { pres: 'propongo,proponi,propone,proponiamo,proponete,propongono', pret: 'proposi,proponesti,propose,proponemmo,proponeste,proposero', participle: 'proposto', fut: 'proporrò,proporrai,proporrà,proporremo,proporrete,proporranno' },
  comporre: { participle: 'composto', pres: 'compongo,componi,compone,componiamo,componete,compongono' },
  tradurre: { pres: 'traduco,traduci,traduce,traduciamo,traducete,traducono', impf: 'traducevo,traducevi,traduceva,traducevamo,traducevate,traducevano', pret: 'tradussi,traducesti,tradusse,traducemmo,traduceste,tradussero', fut: 'tradurrò,tradurrai,tradurrà,tradurremo,tradurrete,tradurranno', participle: 'tradotto', gerund: 'traducendo' },
  produrre: { pres: 'produco,produci,produce,produciamo,producete,producono', pret: 'produssi,producesti,produsse,producemmo,produceste,produssero', participle: 'prodotto' },
  condurre: { participle: 'condotto', fut: 'condurrò,condurrai,condurrà,condurremo,condurrete,condurranno' },
  ridurre: { participle: 'ridotto', subjPres: 'riduca,riduca,riduca,riduciamo,riduciate,riducano' },
  trarre: { pres: 'traggo,trai,trae,traiamo,traete,traggono', pret: 'trassi,traesti,trasse,traemmo,traeste,trassero', participle: 'tratto', gerund: 'traendo' },
  distrarre: { pres: 'distraggo,distrai,distrae,distraiamo,distraete,distraggono', participle: 'distratto' },
  // ---- -gl- / -ng- presents
  scegliere: { pres: 'scelgo,scegli,sceglie,scegliamo,scegliete,scelgono', pret: 'scelsi,scegliesti,scelse,scegliemmo,sceglieste,scelsero', subjPres: 'scelga,scelga,scelga,scegliamo,scegliate,scelgano', participle: 'scelto' },
  cogliere: { pres: 'colgo,cogli,coglie,cogliamo,cogliete,colgono', participle: 'colto' },
  raccogliere: { pres: 'raccolgo,raccogli,raccoglie,raccogliamo,raccogliete,raccolgono', participle: 'raccolto', pret: 'raccolsi,raccogliesti,raccolse,raccogliemmo,raccoglieste,raccolsero' },
  togliere: { pres: 'tolgo,togli,toglie,togliamo,togliete,tolgono', participle: 'tolto' },
  spegnere: { pres: 'spengo,spegni,spegne,spegniamo,spegnete,spengono', pret: 'spensi,spegnesti,spense,spegnemmo,spegneste,spensero', participle: 'spento' },
  salire: { pres: 'salgo,sali,sale,saliamo,salite,salgono', subjPres: 'salga,salga,salga,saliamo,saliate,salgano', perf: 'sono salito,sei salito,è salito,siamo saliti,siete saliti,sono saliti' },
  valere: { pres: 'valgo,vali,vale,valiamo,valete,valgono', fut: 'varrò,varrai,varrà,varremo,varrete,varranno', participle: 'valso' },
  // ---- other irregular presents
  sedere: { pres: 'siedo,siedi,siede,sediamo,sedete,siedono', subjPres: 'sieda,sieda,sieda,sediamo,sediate,siedano', impAff: '-,siedi,sieda,sediamo,sedete,siedano' },
  possedere: { pres: 'possiedo,possiedi,possiede,possediamo,possedete,possiedono', perf: 'ho posseduto,hai posseduto,ha posseduto,abbiamo posseduto,avete posseduto,hanno posseduto' },
  morire: { pres: 'muoio,muori,muore,moriamo,morite,muoiono', subjPres: 'muoia,muoia,muoia,moriamo,moriate,muoiano', participle: 'morto', perf: 'sono morto,sei morto,è morto,siamo morti,siete morti,sono morti' },
  piacere: { pres: 'piaccio,piaci,piace,piacciamo,piacete,piacciono', pret: 'piacqui,piacesti,piacque,piacemmo,piaceste,piacquero', subjPres: 'piaccia,piaccia,piaccia,piacciamo,piacciate,piacciano', participle: 'piaciuto', perf: 'sono piaciuto,sei piaciuto,è piaciuto,siamo piaciuti,siete piaciuti,sono piaciuti' },
  apparire: { pres: 'appaio,appari,appare,appariamo,apparite,appaiono', pret: 'apparvi,apparisti,apparve,apparimmo,appariste,apparvero', participle: 'apparso' },
  udire: { pres: 'odo,odi,ode,udiamo,udite,odono', subjPres: 'oda,oda,oda,udiamo,udiate,odano', fut: 'udirò,udirai,udirà,udiremo,udirete,udiranno' },
  cuocere: { pres: 'cuocio,cuoci,cuoce,cuociamo,cuocete,cuociono', pret: 'cossi,cuocesti,cosse,cuocemmo,cuoceste,cossero', participle: 'cotto' },
  riempire: { pres: 'riempio,riempi,riempie,riempiamo,riempite,riempiono', gerund: 'riempiendo', participle: 'riempito' },
  // ---- strong passato remoto and irregular participles
  cadere: { pret: 'caddi,cadesti,cadde,cademmo,cadeste,caddero', fut: 'cadrò,cadrai,cadrà,cadremo,cadrete,cadranno', participle: 'caduto' },
  vedere: { pret: 'vidi,vedesti,vide,vedemmo,vedeste,videro', fut: 'vedrò,vedrai,vedrà,vedremo,vedrete,vedranno', participle: 'visto' },
  prevedere: { pret: 'previdi,prevedesti,previde,prevedemmo,prevedeste,previdero', participle: 'previsto' },
  vivere: { pret: 'vissi,vivesti,visse,vivemmo,viveste,vissero', fut: 'vivrò,vivrai,vivrà,vivremo,vivrete,vivranno', participle: 'vissuto' },
  nascere: { pret: 'nacqui,nascesti,nacque,nascemmo,nasceste,nacquero', participle: 'nato', perf: 'sono nato,sei nato,è nato,siamo nati,siete nati,sono nati' },
  conoscere: { pret: 'conobbi,conoscesti,conobbe,conoscemmo,conosceste,conobbero', participle: 'conosciuto', pres: 'conosco,conosci,conosce,conosciamo,conoscete,conoscono' },
  crescere: { pret: 'crebbi,crescesti,crebbe,crescemmo,cresceste,crebbero', participle: 'cresciuto' },
  prendere: { pret: 'presi,prendesti,prese,prendemmo,prendeste,presero', participle: 'preso' },
  comprendere: { pret: 'compresi,comprendesti,comprese,comprendemmo,comprendeste,compresero', participle: 'compreso' },
  mettere: { pret: 'misi,mettesti,mise,mettemmo,metteste,misero', participle: 'messo' },
  promettere: { pret: 'promisi,promettesti,promise,promettemmo,prometteste,promisero', participle: 'promesso' },
  leggere: { pret: 'lessi,leggesti,lesse,leggemmo,leggeste,lessero', participle: 'letto', pretPerf: 'ebbi letto,avesti letto,ebbe letto,avemmo letto,aveste letto,ebbero letto' },
  scrivere: { pret: 'scrissi,scrivesti,scrisse,scrivemmo,scriveste,scrissero', participle: 'scritto' },
  descrivere: { participle: 'descritto' },
  chiudere: { pret: 'chiusi,chiudesti,chiuse,chiudemmo,chiudeste,chiusero', participle: 'chiuso' },
  aprire: { pres: 'apro,apri,apre,apriamo,aprite,aprono', pret: 'aprii,apristi,aprì,aprimmo,apriste,aprirono', participle: 'aperto' },
  offrire: { participle: 'offerto', pres: 'offro,offri,offre,offriamo,offrite,offrono' },
  soffrire: { participle: 'sofferto' },
  scoprire: { participle: 'scoperto' },
  rispondere: { pret: 'risposi,rispondesti,rispose,rispondemmo,rispondeste,risposero', participle: 'risposto' },
  chiedere: { pret: 'chiesi,chiedesti,chiese,chiedemmo,chiedeste,chiesero', participle: 'chiesto' },
  decidere: { pret: 'decisi,decidesti,decise,decidemmo,decideste,decisero', participle: 'deciso' },
  correre: { pret: 'corsi,corresti,corse,corremmo,correste,corsero', participle: 'corso' },
  perdere: { pret: 'persi,perdesti,perse,perdemmo,perdeste,persero', participle: 'perso' },
  vincere: { pres: 'vinco,vinci,vince,vinciamo,vincete,vincono', pret: 'vinsi,vincesti,vinse,vincemmo,vinceste,vinsero', participle: 'vinto' },
  convincere: { participle: 'convinto' },
  accendere: { pret: 'accesi,accendesti,accese,accendemmo,accendeste,accesero', participle: 'acceso' },
  rompere: { pret: 'ruppi,rompesti,ruppe,rompemmo,rompeste,ruppero', participle: 'rotto' },
  ridere: { pret: 'risi,ridesti,rise,ridemmo,rideste,risero', participle: 'riso' },
  sorridere: { participle: 'sorriso' },
  scendere: { pret: 'scesi,scendesti,scese,scendemmo,scendeste,scesero', participle: 'sceso', perf: 'sono sceso,sei sceso,è sceso,siamo scesi,siete scesi,sono scesi' },
  piangere: { pret: 'piansi,piangesti,pianse,piangemmo,piangeste,piansero', participle: 'pianto' },
  giungere: { pret: 'giunsi,giungesti,giunse,giungemmo,giungeste,giunsero', participle: 'giunto' },
  aggiungere: { participle: 'aggiunto', perf: 'ho aggiunto,hai aggiunto,ha aggiunto,abbiamo aggiunto,avete aggiunto,hanno aggiunto' },
  muovere: { pret: 'mossi,muovesti,mosse,muovemmo,muoveste,mossero', participle: 'mosso' },
  ottenere: { pres: 'ottengo,ottieni,ottiene,otteniamo,ottenete,ottengono', fut: 'otterrò,otterrai,otterrà,otterremo,otterrete,otterranno' },
  divenire: { perf: 'sono divenuto,sei divenuto,è divenuto,siamo divenuti,siete divenuti,sono divenuti' },
  benedire: { pres: 'benedico,benedici,benedice,benediciamo,benedite,benedicono', impAff: '-,benedici,benedica,benediciamo,benedite,benedicano', participle: 'benedetto' },
  discutere: { pret: 'discussi,discutesti,discusse,discutemmo,discuteste,discussero', participle: 'discusso' },
  esprimere: { participle: 'espresso' },
  succedere: { participle: 'successo', perf: 'sono successo,sei successo,è successo,siamo successi,siete successi,sono successi' },
  esistere: { participle: 'esistito' },
  resistere: { participle: 'resistito' },
  dipingere: { participle: 'dipinto' },
  stringere: { participle: 'stretto' },
  distruggere: { participle: 'distrutto' },
  risolvere: { participle: 'risolto' },
  concludere: { participle: 'concluso' },
  // ---- essere-verbs that are otherwise regular
  arrivare: { pluperf: 'ero arrivato,eri arrivato,era arrivato,eravamo arrivati,eravate arrivati,erano arrivati' },
  diventare: { perf: 'sono diventato,sei diventato,è diventato,siamo diventati,siete diventati,sono diventati' },
  mangiare_perf: {},
}
delete GOLD.mangiare_perf

describe('conjugate (golden)', () => {
  for (const [lemma, g] of Object.entries(GOLD)) {
    const c = conjugate(lemma)
    for (const [tense, expected] of Object.entries(g)) {
      it(`${lemma} ${tense}`, () => {
        if (tense === 'participle') expect(c.participle).toBe(expected)
        else if (tense === 'gerund') expect(c.gerund).toBe(expected)
        else expect(c.forms[tense as Tense].map((f) => f ?? '-').join(',')).toBe(expected)
      })
    }
  }
})

describe('auxiliaries', () => {
  it('chooses essere for motion and change of state, avere otherwise', () => {
    expect(conjugate('mangiare').auxiliaries).toEqual(['avere'])
    expect(conjugate('andare').auxiliaries).toEqual(['essere'])
    expect(conjugate('arrivare').auxiliaries).toEqual(['essere'])
    expect(conjugate('piacere').auxiliary).toBe('essere')
    expect(conjugate('salire').auxiliaries).toEqual(['essere', 'avere'])
    expect(conjugate('correre').auxiliaries).toEqual(['avere', 'essere'])
    expect(conjugate('finire').auxiliary).toBe('avere')
    expect(conjugate('mangiare').forms.futPerf[0]).toBe('avrò mangiato')
  })
  it('compounds keep the auxiliary of their base verb unless listed', () => {
    expect(conjugate('divenire').auxiliary).toBe('essere')
    expect(conjugate('possedere').auxiliary).toBe('avere')
    expect(conjugate('occorrere').auxiliary).toBe('essere')
    expect(conjugate('occorrere').participle).toBe('occorso')
  })
  it('lists all four participle forms and agreement variants', () => {
    expect(conjugate('andare').participles).toEqual(['andato', 'andata', 'andati', 'andate'])
    expect(agreementVariants('sono andato')).toEqual(['sono andato', 'sono andata'])
    expect(agreementVariants('siamo andati')).toEqual(['siamo andati', 'siamo andate'])
    expect(agreementVariants('ho mangiato')).toEqual(['ho mangiato'])
    expect(agreementVariants('mi sono alzato')).toEqual(['mi sono alzato', 'mi sono alzata'])
    expect(agreementVariants(null)).toEqual([])
  })
  it('allForms has every participle form, alternates and imperatives', () => {
    const f = allForms('andare')
    for (const w of ['vado', 'andrò', 'andassero', 'andato', 'andata', 'andati', 'andate', "va'", 'vai', 'andando', 'andare']) expect(f.has(w), w).toBe(true)
    expect(allForms('credere').has('credette')).toBe(true)
    expect(allForms('dovere').has('debbo')).toBe(true)
    expect(allForms('vedere').has('veduto')).toBe(true)
    expect(allForms('dire').has('dì')).toBe(true)
    expect(allForms('scrivere').has('scritte')).toBe(true)
  })
})

describe('reflexive verbs', () => {
  it('strips -si and uses essere', () => {
    const c = conjugate('alzarsi')
    expect(c.reflexive).toBe(true)
    expect(c.infinitive).toBe('alzare')
    expect(c.auxiliary).toBe('essere')
    expect(withReflexive(c.forms.pres[0], 0, 'pres')).toBe('mi alzo')
    expect(withReflexive(c.forms.pres[2], 2, 'pres')).toBe('si alza')
    expect(withReflexive(c.forms.pres[4], 4, 'pres')).toBe('vi alzate')
    expect(withReflexive(c.forms.perf[0], 0, 'perf')).toBe('mi sono alzato')
    expect(withReflexive(c.forms.perf[3], 3, 'perf')).toBe('ci siamo alzati')
    expect(withReflexive(c.forms.fut[5], 5, 'fut')).toBe('si alzeranno')
  })
  it('attaches pronouns to imperatives', () => {
    const c = conjugate('alzarsi')
    expect(withReflexive(c.forms.impAff[1], 1, 'impAff')).toBe('alzati')
    expect(withReflexive(c.forms.impAff[2], 2, 'impAff')).toBe('si alzi')
    expect(withReflexive(c.forms.impAff[3], 3, 'impAff')).toBe('alziamoci')
    expect(withReflexive(c.forms.impAff[4], 4, 'impAff')).toBe('alzatevi')
    expect(withReflexive(c.forms.impAff[5], 5, 'impAff')).toBe('si alzino')
    expect(withReflexive(c.forms.impNeg[1], 1, 'impNeg')).toBe('non alzarti')
    expect(withReflexive(c.forms.impNeg[2], 2, 'impNeg')).toBe('non si alzi')
    expect(withReflexive(c.forms.impNeg[4], 4, 'impNeg')).toBe('non alzatevi')
    expect(withReflexive(c.forms.impAff[0], 0, 'impAff')).toBeNull()
  })
  it('handles -ersi, -irsi, -rsi and monosyllabic imperatives', () => {
    expect(withReflexive(conjugate('vestirsi').forms.impAff[1], 1, 'impAff')).toBe('vestiti')
    expect(withReflexive(conjugate('mettersi').forms.perf[0], 0, 'perf')).toBe('mi sono messo')
    const porsi = conjugate('porsi')
    expect(porsi.infinitive).toBe('porre')
    expect(withReflexive(porsi.forms.pres[0], 0, 'pres')).toBe('mi pongo')
    expect(withReflexive(porsi.forms.impNeg[1], 1, 'impNeg')).toBe('non porti')
    expect(withReflexive(conjugate('farsi').forms.impAff[1], 1, 'impAff')).toBe('fatti')
    expect(withReflexive(conjugate('sedersi').forms.impAff[1], 1, 'impAff')).toBe('siediti')
    expect(conjugate('accorgersi').forms.pret[0]).toBe('accorsi')
    expect(conjugate('accorgersi').participle).toBe('accorto')
    expect(conjugate('distrarsi').infinitive).toBe('distrarre')
  })
  it('handles andarsene', () => {
    const c = conjugate('andarsene')
    expect(c.clitic).toBe('sene')
    expect(withReflexive(c.forms.pres[0], 0, 'pres', 'sene')).toBe('me ne vado')
    expect(withReflexive(c.forms.perf[0], 0, 'perf', 'sene')).toBe('me ne sono andato')
    expect(withReflexive(c.forms.impAff[1], 1, 'impAff', 'sene')).toBe('vattene')
    expect(withReflexive(c.forms.impAff[4], 4, 'impAff', 'sene')).toBe('andatevene')
    expect(withReflexive(c.forms.impAff[2], 2, 'impAff', 'sene')).toBe('se ne vada')
    expect(withReflexive(c.forms.impNeg[1], 1, 'impNeg', 'sene')).toBe('non andartene')
  })
})

describe('table and trainer', () => {
  it('has at least 80 irregular verbs', () => {
    const withForms = [...IRREGULAR.values()].filter((v) => Object.keys(v).some((k) => !['lemma', 'aux', 'bothAux', 'stressedI', 'note'].includes(k)))
    expect(withForms.length).toBeGreaterThanOrEqual(80)
    expect(IRREGULAR.get('arrivare')?.aux).toBe('essere')
  })
  it('lists the -isc- verbs', () => {
    for (const v of ['finire', 'capire', 'preferire', 'pulire', 'spedire', 'costruire', 'unire']) expect(ISC_VERBS.has(v), v).toBe(true)
    for (const v of ['dormire', 'partire', 'sentire', 'aprire', 'seguire']) expect(ISC_VERBS.has(v), v).toBe(false)
  })
  it('has labels and persons', () => {
    expect(PERSONS).toHaveLength(6)
    for (const t of TENSES) {
      expect(TENSE_LABELS[t].es.length).toBeGreaterThan(3)
      expect(['a1', 'a2', 'b1', 'b2', 'c1', 'c2']).toContain(TENSE_LABELS[t].level)
    }
    expect(TENSE_LABELS.pret.es).toBe('Passato remoto')
    expect(TENSE_LABELS.perf.es).toBe('Passato prossimo')
    expect(TENSES).toHaveLength(16)
  })
  it('recognises infinitives and base lemmas', () => {
    for (const w of ['parlare', 'avere', 'finire', 'porre', 'alzarsi', 'mettersi', 'vestirsi', 'porsi', 'andarsene']) expect(VERB_TRAINER.isInfinitive(w), w).toBe(true)
    for (const w of ['casa', 'bello', 'parlo']) expect(VERB_TRAINER.isInfinitive(w), w).toBe(false)
    expect(VERB_TRAINER.baseLemma('alzarsi')).toBe('alzare')
    expect(VERB_TRAINER.baseLemma('porsi')).toBe('porre')
    expect(VERB_TRAINER.baseLemma('tradursi')).toBe('tradurre')
    expect(VERB_TRAINER.baseLemma('andarsene')).toBe('andare')
    expect(VERB_TRAINER.baseLemma('parlare')).toBe('parlare')
    expect(VERB_TRAINER.defaultVerb).toBe('essere')
    expect(VERB_TRAINER.skipInExercises).toContain('impAff')
  })
  it('conjugateWith works with any table and rejects non-verbs', () => {
    expect(conjugateWith('andare', new Map()).forms.pres[0]).toBe('ando') // regular without the table
    expect(conjugateWith('andare', IRREGULAR).forms.pres[0]).toBe('vado')
    expect(() => conjugate('casa')).toThrow()
  })
})
