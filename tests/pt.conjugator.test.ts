import { describe, it, expect } from 'vitest'
import { conjugate, withReflexive, allForms, IRREGULAR, VERB_TRAINER, TENSES, TENSE_LABELS, PERSONS } from '@/lang/pt/verbs'
import { conjugate as conjugateWith, type Tense } from '@/lang/pt/conjugator'

type G = Partial<Record<Tense | 'participle' | 'gerund', string>>
// Golden forms: "eu,tu,ele,nós,vós,eles"
const GOLD: Record<string, G> = {
  // ---- regular paradigms, every tense
  falar: {
    pres: 'falo,falas,fala,falamos,falais,falam', pret: 'falei,falaste,falou,falamos,falastes,falaram',
    impf: 'falava,falavas,falava,falávamos,faláveis,falavam', mqp: 'falara,falaras,falara,faláramos,faláreis,falaram',
    fut: 'falarei,falarás,falará,falaremos,falareis,falarão', cond: 'falaria,falarias,falaria,falaríamos,falaríeis,falariam',
    subjPres: 'fale,fales,fale,falemos,faleis,falem', subjImpf: 'falasse,falasses,falasse,falássemos,falásseis,falassem',
    subjFut: 'falar,falares,falar,falarmos,falardes,falarem', persInf: 'falar,falares,falar,falarmos,falardes,falarem',
    impAff: '-,fala,fale,falemos,falai,falem', impNeg: '-,não fales,não fale,não falemos,não faleis,não falem',
    perf: 'tenho falado,tens falado,tem falado,temos falado,tendes falado,têm falado',
    pluperf: 'tinha falado,tinhas falado,tinha falado,tínhamos falado,tínheis falado,tinham falado',
    futPerf: 'terei falado,terás falado,terá falado,teremos falado,tereis falado,terão falado',
    condPerf: 'teria falado,terias falado,teria falado,teríamos falado,teríeis falado,teriam falado',
    subjPerf: 'tenha falado,tenhas falado,tenha falado,tenhamos falado,tenhais falado,tenham falado',
    subjPluperf: 'tivesse falado,tivesses falado,tivesse falado,tivéssemos falado,tivésseis falado,tivessem falado',
    subjFutPerf: 'tiver falado,tiveres falado,tiver falado,tivermos falado,tiverdes falado,tiverem falado',
    participle: 'falado', gerund: 'falando',
  },
  comer: {
    pres: 'como,comes,come,comemos,comeis,comem', pret: 'comi,comeste,comeu,comemos,comestes,comeram',
    impf: 'comia,comias,comia,comíamos,comíeis,comiam', mqp: 'comera,comeras,comera,comêramos,comêreis,comeram',
    fut: 'comerei,comerás,comerá,comeremos,comereis,comerão', cond: 'comeria,comerias,comeria,comeríamos,comeríeis,comeriam',
    subjPres: 'coma,comas,coma,comamos,comais,comam', subjImpf: 'comesse,comesses,comesse,comêssemos,comêsseis,comessem',
    subjFut: 'comer,comeres,comer,comermos,comerdes,comerem', persInf: 'comer,comeres,comer,comermos,comerdes,comerem',
    impAff: '-,come,coma,comamos,comei,comam', participle: 'comido', gerund: 'comendo',
  },
  partir: {
    pres: 'parto,partes,parte,partimos,partis,partem', pret: 'parti,partiste,partiu,partimos,partistes,partiram',
    impf: 'partia,partias,partia,partíamos,partíeis,partiam', mqp: 'partira,partiras,partira,partíramos,partíreis,partiram',
    subjPres: 'parta,partas,parta,partamos,partais,partam', subjImpf: 'partisse,partisses,partisse,partíssemos,partísseis,partissem',
    subjFut: 'partir,partires,partir,partirmos,partirdes,partirem', impAff: '-,parte,parta,partamos,parti,partam',
    participle: 'partido', gerund: 'partindo',
  },
  // ---- the big irregulars
  ser: {
    pres: 'sou,és,é,somos,sois,são', pret: 'fui,foste,foi,fomos,fostes,foram', impf: 'era,eras,era,éramos,éreis,eram',
    mqp: 'fora,foras,fora,fôramos,fôreis,foram', fut: 'serei,serás,será,seremos,sereis,serão',
    subjPres: 'seja,sejas,seja,sejamos,sejais,sejam', subjImpf: 'fosse,fosses,fosse,fôssemos,fôsseis,fossem',
    subjFut: 'for,fores,for,formos,fordes,forem', persInf: 'ser,seres,ser,sermos,serdes,serem',
    impAff: '-,sê,seja,sejamos,sede,sejam', participle: 'sido', gerund: 'sendo',
  },
  estar: {
    pres: 'estou,estás,está,estamos,estais,estão', pret: 'estive,estiveste,esteve,estivemos,estivestes,estiveram',
    impf: 'estava,estavas,estava,estávamos,estáveis,estavam', subjPres: 'esteja,estejas,esteja,estejamos,estejais,estejam',
    subjImpf: 'estivesse,estivesses,estivesse,estivéssemos,estivésseis,estivessem', subjFut: 'estiver,estiveres,estiver,estivermos,estiverdes,estiverem',
    impAff: '-,está,esteja,estejamos,estai,estejam',
  },
  ter: {
    pres: 'tenho,tens,tem,temos,tendes,têm', pret: 'tive,tiveste,teve,tivemos,tivestes,tiveram', impf: 'tinha,tinhas,tinha,tínhamos,tínheis,tinham',
    fut: 'terei,terás,terá,teremos,tereis,terão', subjPres: 'tenha,tenhas,tenha,tenhamos,tenhais,tenham',
    subjImpf: 'tivesse,tivesses,tivesse,tivéssemos,tivésseis,tivessem', subjFut: 'tiver,tiveres,tiver,tivermos,tiverdes,tiverem',
    mqp: 'tivera,tiveras,tivera,tivéramos,tivéreis,tiveram', impAff: '-,tem,tenha,tenhamos,tende,tenham', participle: 'tido', gerund: 'tendo',
  },
  haver: {
    pres: 'hei,hás,há,havemos,haveis,hão', pret: 'houve,houveste,houve,houvemos,houvestes,houveram', impf: 'havia,havias,havia,havíamos,havíeis,haviam',
    subjPres: 'haja,hajas,haja,hajamos,hajais,hajam', subjImpf: 'houvesse,houvesses,houvesse,houvéssemos,houvésseis,houvessem', subjFut: 'houver,houveres,houver,houvermos,houverdes,houverem',
  },
  ir: {
    pres: 'vou,vais,vai,vamos,ides,vão', pret: 'fui,foste,foi,fomos,fostes,foram', impf: 'ia,ias,ia,íamos,íeis,iam',
    fut: 'irei,irás,irá,iremos,ireis,irão', subjPres: 'vá,vás,vá,vamos,vades,vão', subjImpf: 'fosse,fosses,fosse,fôssemos,fôsseis,fossem',
    subjFut: 'for,fores,for,formos,fordes,forem', persInf: 'ir,ires,ir,irmos,irdes,irem',
    impAff: '-,vai,vá,vamos,ide,vão', impNeg: '-,não vás,não vá,não vamos,não vades,não vão', participle: 'ido', gerund: 'indo',
  },
  vir: {
    pres: 'venho,vens,vem,vimos,vindes,vêm', pret: 'vim,vieste,veio,viemos,viestes,vieram', impf: 'vinha,vinhas,vinha,vínhamos,vínheis,vinham',
    subjPres: 'venha,venhas,venha,venhamos,venhais,venham', subjImpf: 'viesse,viesses,viesse,viéssemos,viésseis,viessem',
    subjFut: 'vier,vieres,vier,viermos,vierdes,vierem', persInf: 'vir,vires,vir,virmos,virdes,virem',
    impAff: '-,vem,venha,venhamos,vinde,venham', participle: 'vindo', gerund: 'vindo',
  },
  fazer: {
    pres: 'faço,fazes,faz,fazemos,fazeis,fazem', pret: 'fiz,fizeste,fez,fizemos,fizestes,fizeram', fut: 'farei,farás,fará,faremos,fareis,farão',
    cond: 'faria,farias,faria,faríamos,faríeis,fariam', subjPres: 'faça,faças,faça,façamos,façais,façam',
    subjImpf: 'fizesse,fizesses,fizesse,fizéssemos,fizésseis,fizessem', subjFut: 'fizer,fizeres,fizer,fizermos,fizerdes,fizerem',
    impAff: '-,faz,faça,façamos,fazei,façam', participle: 'feito', perf: 'tenho feito,tens feito,tem feito,temos feito,tendes feito,têm feito',
  },
  dizer: {
    pres: 'digo,dizes,diz,dizemos,dizeis,dizem', pret: 'disse,disseste,disse,dissemos,dissestes,disseram', fut: 'direi,dirás,dirá,diremos,direis,dirão',
    subjPres: 'diga,digas,diga,digamos,digais,digam', subjFut: 'disser,disseres,disser,dissermos,disserdes,disserem', participle: 'dito',
  },
  trazer: {
    pres: 'trago,trazes,traz,trazemos,trazeis,trazem', pret: 'trouxe,trouxeste,trouxe,trouxemos,trouxestes,trouxeram', fut: 'trarei,trarás,trará,traremos,trareis,trarão',
    subjPres: 'traga,tragas,traga,tragamos,tragais,tragam', subjImpf: 'trouxesse,trouxesses,trouxesse,trouxéssemos,trouxésseis,trouxessem', participle: 'trazido',
  },
  poder: {
    pres: 'posso,podes,pode,podemos,podeis,podem', pret: 'pude,pudeste,pôde,pudemos,pudestes,puderam', subjPres: 'possa,possas,possa,possamos,possais,possam',
    subjFut: 'puder,puderes,puder,pudermos,puderdes,puderem', impAff: '-,-,-,-,-,-',
  },
  querer: {
    pres: 'quero,queres,quer,queremos,quereis,querem', pret: 'quis,quiseste,quis,quisemos,quisestes,quiseram', subjPres: 'queira,queiras,queira,queiramos,queirais,queiram',
    subjImpf: 'quisesse,quisesses,quisesse,quiséssemos,quisésseis,quisessem', fut: 'quererei,quererás,quererá,quereremos,querereis,quererão',
  },
  saber: {
    pres: 'sei,sabes,sabe,sabemos,sabeis,sabem', pret: 'soube,soubeste,soube,soubemos,soubestes,souberam', subjPres: 'saiba,saibas,saiba,saibamos,saibais,saibam',
    subjFut: 'souber,souberes,souber,soubermos,souberdes,souberem',
  },
  caber: { pres: 'caibo,cabes,cabe,cabemos,cabeis,cabem', pret: 'coube,coubeste,coube,coubemos,coubestes,couberam', subjPres: 'caiba,caibas,caiba,caibamos,caibais,caibam' },
  dar: {
    pres: 'dou,dás,dá,damos,dais,dão', pret: 'dei,deste,deu,demos,destes,deram', subjPres: 'dê,dês,dê,demos,deis,deem',
    subjImpf: 'desse,desses,desse,déssemos,désseis,dessem', subjFut: 'der,deres,der,dermos,derdes,derem', impAff: '-,dá,dê,demos,dai,deem',
  },
  ver: {
    pres: 'vejo,vês,vê,vemos,vedes,veem', pret: 'vi,viste,viu,vimos,vistes,viram', impf: 'via,vias,via,víamos,víeis,viam',
    subjPres: 'veja,vejas,veja,vejamos,vejais,vejam', subjImpf: 'visse,visses,visse,víssemos,vísseis,vissem', subjFut: 'vir,vires,vir,virmos,virdes,virem',
    impAff: '-,vê,veja,vejamos,vede,vejam', participle: 'visto', gerund: 'vendo',
  },
  pôr: {
    pres: 'ponho,pões,põe,pomos,pondes,põem', pret: 'pus,puseste,pôs,pusemos,pusestes,puseram', impf: 'punha,punhas,punha,púnhamos,púnheis,punham',
    fut: 'porei,porás,porá,poremos,poreis,porão', subjPres: 'ponha,ponhas,ponha,ponhamos,ponhais,ponham', subjImpf: 'pusesse,pusesses,pusesse,puséssemos,pusésseis,pusessem',
    subjFut: 'puser,puseres,puser,pusermos,puserdes,puserem', persInf: 'pôr,pores,pôr,pormos,pordes,porem', impAff: '-,põe,ponha,ponhamos,ponde,ponham',
    participle: 'posto', gerund: 'pondo',
  },
  ler: { pres: 'leio,lês,lê,lemos,ledes,leem', pret: 'li,leste,leu,lemos,lestes,leram', subjPres: 'leia,leias,leia,leiamos,leiais,leiam', subjImpf: 'lesse,lesses,lesse,lêssemos,lêsseis,lessem', participle: 'lido' },
  crer: { pres: 'creio,crês,crê,cremos,credes,creem', pret: 'cri,creste,creu,cremos,crestes,creram', subjPres: 'creia,creias,creia,creiamos,creiais,creiam' },
  rir: { pres: 'rio,ris,ri,rimos,rides,riem', pret: 'ri,riste,riu,rimos,ristes,riram', subjPres: 'ria,rias,ria,riamos,riais,riam', impAff: '-,ri,ria,riamos,ride,riam' },
  valer: { pres: 'valho,vales,vale,valemos,valeis,valem', subjPres: 'valha,valhas,valha,valhamos,valhais,valham' },
  ouvir: { pres: 'ouço,ouves,ouve,ouvimos,ouvis,ouvem', subjPres: 'ouça,ouças,ouça,ouçamos,ouçais,ouçam', impAff: '-,ouve,ouça,ouçamos,ouvi,ouçam' },
  pedir: { pres: 'peço,pedes,pede,pedimos,pedis,pedem', pret: 'pedi,pediste,pediu,pedimos,pedistes,pediram', subjPres: 'peça,peças,peça,peçamos,peçais,peçam', gerund: 'pedindo' },
  medir: { pres: 'meço,medes,mede,medimos,medis,medem', subjPres: 'meça,meças,meça,meçamos,meçais,meçam' },
  perder: { pres: 'perco,perdes,perde,perdemos,perdeis,perdem', subjPres: 'perca,percas,perca,percamos,percais,percam', pret: 'perdi,perdeste,perdeu,perdemos,perdestes,perderam' },
  requerer: { pres: 'requeiro,requeres,requer,requeremos,requereis,requerem', pret: 'requeri,requereste,requereu,requeremos,requerestes,requereram', subjPres: 'requeira,requeiras,requeira,requeiramos,requeirais,requeiram' },
  prover: { pres: 'provejo,provês,provê,provemos,provedes,proveem', pret: 'provi,proveste,proveu,provemos,provestes,proveram', participle: 'provido' },
  // ---- vowel stems
  sair: {
    pres: 'saio,sais,sai,saímos,saís,saem', pret: 'saí,saíste,saiu,saímos,saístes,saíram', impf: 'saía,saías,saía,saíamos,saíeis,saíam',
    subjPres: 'saia,saias,saia,saiamos,saiais,saiam', subjImpf: 'saísse,saísses,saísse,saíssemos,saísseis,saíssem',
    subjFut: 'sair,saíres,sair,sairmos,sairdes,saírem', persInf: 'sair,saíres,sair,sairmos,sairdes,saírem', mqp: 'saíra,saíras,saíra,saíramos,saíreis,saíram',
    impAff: '-,sai,saia,saiamos,saí,saiam', participle: 'saído', gerund: 'saindo',
  },
  cair: { pres: 'caio,cais,cai,caímos,caís,caem', pret: 'caí,caíste,caiu,caímos,caístes,caíram', participle: 'caído' },
  atrair: { pres: 'atraio,atrais,atrai,atraímos,atraís,atraem', participle: 'atraído' },
  incluir: {
    pres: 'incluo,incluis,inclui,incluímos,incluís,incluem', pret: 'incluí,incluíste,incluiu,incluímos,incluístes,incluíram',
    impf: 'incluía,incluías,incluía,incluíamos,incluíeis,incluíam', subjPres: 'inclua,incluas,inclua,incluamos,incluais,incluam', participle: 'incluído', gerund: 'incluindo',
  },
  construir: { pres: 'construo,constróis,constrói,construímos,construís,constroem', impAff: '-,constrói,construa,construamos,construí,construam', participle: 'construído' },
  destruir: { pres: 'destruo,destróis,destrói,destruímos,destruís,destroem' },
  roer: { pres: 'roo,róis,rói,roemos,roeis,roem', pret: 'roí,roeste,roeu,roemos,roestes,roeram', impf: 'roía,roías,roía,roíamos,roíeis,roíam', participle: 'roído' },
  doer: { pres: 'doo,dóis,dói,doemos,doeis,doem' },
  // ---- spelling changes
  ficar: { pret: 'fiquei,ficaste,ficou,ficamos,ficastes,ficaram', subjPres: 'fique,fiques,fique,fiquemos,fiqueis,fiquem', impAff: '-,fica,fique,fiquemos,ficai,fiquem' },
  chegar: { pret: 'cheguei,chegaste,chegou,chegamos,chegastes,chegaram', subjPres: 'chegue,chegues,chegue,cheguemos,chegueis,cheguem' },
  começar: { pret: 'comecei,começaste,começou,começamos,começastes,começaram', subjPres: 'comece,comeces,comece,comecemos,comeceis,comecem' },
  conhecer: { pres: 'conheço,conheces,conhece,conhecemos,conheceis,conhecem', subjPres: 'conheça,conheças,conheça,conheçamos,conheçais,conheçam' },
  proteger: { pres: 'protejo,proteges,protege,protegemos,protegeis,protegem', subjPres: 'proteja,protejas,proteja,protejamos,protejais,protejam' },
  dirigir: { pres: 'dirijo,diriges,dirige,dirigimos,dirigis,dirigem', subjPres: 'dirija,dirijas,dirija,dirijamos,dirijais,dirijam' },
  erguer: { pres: 'ergo,ergues,ergue,erguemos,ergueis,erguem', subjPres: 'erga,ergas,erga,ergamos,ergais,ergam' },
  distinguir: { pres: 'distingo,distingues,distingue,distinguimos,distinguis,distinguem', subjPres: 'distinga,distingas,distinga,distingamos,distingais,distingam' },
  // ---- stem changes
  seguir: { pres: 'sigo,segues,segue,seguimos,seguis,seguem', subjPres: 'siga,sigas,siga,sigamos,sigais,sigam', pret: 'segui,seguiste,seguiu,seguimos,seguistes,seguiram' },
  sentir: { pres: 'sinto,sentes,sente,sentimos,sentis,sentem', subjPres: 'sinta,sintas,sinta,sintamos,sintais,sintam', gerund: 'sentindo' },
  preferir: { pres: 'prefiro,preferes,prefere,preferimos,preferis,preferem', subjPres: 'prefira,prefiras,prefira,prefiramos,prefirais,prefiram' },
  servir: { pres: 'sirvo,serves,serve,servimos,servis,servem' },
  vestir: { pres: 'visto,vestes,veste,vestimos,vestis,vestem' },
  repetir: { pres: 'repito,repetes,repete,repetimos,repetis,repetem' },
  divertir: { pres: 'divirto,divertes,diverte,divertimos,divertis,divertem' },
  dormir: { pres: 'durmo,dormes,dorme,dormimos,dormis,dormem', subjPres: 'durma,durmas,durma,durmamos,durmais,durmam', pret: 'dormi,dormiste,dormiu,dormimos,dormistes,dormiram' },
  cobrir: { pres: 'cubro,cobres,cobre,cobrimos,cobris,cobrem', participle: 'coberto' },
  tossir: { pres: 'tusso,tosses,tosse,tossimos,tossis,tossem', subjPres: 'tussa,tussas,tussa,tussamos,tussais,tussam' },
  engolir: { pres: 'engulo,engoles,engole,engolimos,engolis,engolem' },
  subir: { pres: 'subo,sobes,sobe,subimos,subis,sobem', subjPres: 'suba,subas,suba,subamos,subais,subam', impAff: '-,sobe,suba,subamos,subi,subam' },
  fugir: { pres: 'fujo,foges,foge,fugimos,fugis,fogem', subjPres: 'fuja,fujas,fuja,fujamos,fujais,fujam' },
  consumir: { pres: 'consumo,consomes,consome,consumimos,consumis,consomem' },
  agredir: { pres: 'agrido,agrides,agride,agredimos,agredis,agridem', subjPres: 'agrida,agridas,agrida,agridamos,agridais,agridam' },
  prevenir: { pres: 'previno,prevines,previne,prevenimos,prevenis,previnem' },
  passear: { pres: 'passeio,passeias,passeia,passeamos,passeais,passeiam', subjPres: 'passeie,passeies,passeie,passeemos,passeeis,passeiem', pret: 'passeei,passeaste,passeou,passeamos,passeastes,passearam' },
  odiar: { pres: 'odeio,odeias,odeia,odiamos,odiais,odeiam', subjPres: 'odeie,odeies,odeie,odiemos,odieis,odeiem' },
  traduzir: { pres: 'traduzo,traduzes,traduz,traduzimos,traduzis,traduzem', impAff: '-,traduz,traduza,traduzamos,traduzi,traduzam' },
  reunir: { pres: 'reúno,reúnes,reúne,reunimos,reunis,reúnem', subjPres: 'reúna,reúnas,reúna,reunamos,reunais,reúnam' },
  proibir: { pres: 'proíbo,proíbes,proíbe,proibimos,proibis,proíbem' },
  saudar: { pres: 'saúdo,saúdas,saúda,saudamos,saudais,saúdam' },
  continuar: { pres: 'continuo,continuas,continua,continuamos,continuais,continuam' },
  voar: { pres: 'voo,voas,voa,voamos,voais,voam' },
  // ---- derived verbs
  manter: { pres: 'mantenho,manténs,mantém,mantemos,mantendes,mantêm', pret: 'mantive,mantiveste,manteve,mantivemos,mantivestes,mantiveram', impAff: '-,mantém,mantenha,mantenhamos,mantende,mantenham', participle: 'mantido' },
  obter: { pres: 'obtenho,obténs,obtém,obtemos,obtendes,obtêm', subjImpf: 'obtivesse,obtivesses,obtivesse,obtivéssemos,obtivésseis,obtivessem' },
  conter: { pres: 'contenho,conténs,contém,contemos,contendes,contêm' },
  intervir: { pres: 'intervenho,intervéns,intervém,intervimos,intervindes,intervêm', pret: 'intervim,intervieste,interveio,interviemos,interviestes,intervieram', participle: 'intervindo' },
  convir: { pres: 'convenho,convéns,convém,convimos,convindes,convêm' },
  compor: {
    pres: 'componho,compões,compõe,compomos,compondes,compõem', pret: 'compus,compuseste,compôs,compusemos,compusestes,compuseram',
    persInf: 'compor,compores,compor,compormos,compordes,comporem', fut: 'comporei,comporás,comporá,comporemos,comporeis,comporão', participle: 'composto', gerund: 'compondo',
  },
  propor: { pres: 'proponho,propões,propõe,propomos,propondes,propõem', subjFut: 'propuser,propuseres,propuser,propusermos,propuserdes,propuserem', participle: 'proposto' },
  supor: { pret: 'supus,supuseste,supôs,supusemos,supusestes,supuseram', participle: 'suposto' },
  satisfazer: { pres: 'satisfaço,satisfazes,satisfaz,satisfazemos,satisfazeis,satisfazem', pret: 'satisfiz,satisfizeste,satisfez,satisfizemos,satisfizestes,satisfizeram', fut: 'satisfarei,satisfarás,satisfará,satisfaremos,satisfareis,satisfarão', participle: 'satisfeito' },
  desfazer: { participle: 'desfeito', pret: 'desfiz,desfizeste,desfez,desfizemos,desfizestes,desfizeram' },
  prever: { pres: 'prevejo,prevês,prevê,prevemos,prevedes,preveem', participle: 'previsto' },
  descobrir: { pres: 'descubro,descobres,descobre,descobrimos,descobris,descobrem', participle: 'descoberto' },
  descrever: { participle: 'descrito' },
  inscrever: { participle: 'inscrito', pres: 'inscrevo,inscreves,inscreve,inscrevemos,inscreveis,inscrevem' },
  impedir: { pres: 'impeço,impedes,impede,impedimos,impedis,impedem' },
  despedir: { pres: 'despeço,despedes,despede,despedimos,despedis,despedem' },
  sorrir: { pres: 'sorrio,sorris,sorri,sorrimos,sorrides,sorriem' },
  // ---- participles
  escrever: { participle: 'escrito' },
  abrir: { participle: 'aberto' },
  ganhar: { participle: 'ganho', perf: 'tenho ganho,tens ganho,tem ganho,temos ganho,tendes ganho,têm ganho' },
  gastar: { participle: 'gasto' },
  pagar: { participle: 'pago', pret: 'paguei,pagaste,pagou,pagamos,pagastes,pagaram' },
  aceitar: { participle: 'aceitado', pluperf: 'tinha aceitado,tinhas aceitado,tinha aceitado,tínhamos aceitado,tínheis aceitado,tinham aceitado' },
}

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

describe('participles', () => {
  it('lists abundant participles, the ter one first', () => {
    expect(conjugate('aceitar').participles).toEqual(['aceitado', 'aceito', 'aceite'])
    expect(conjugate('pagar').participles).toEqual(['pago', 'pagado'])
    expect(conjugate('entregar').participles).toEqual(['entregado', 'entregue'])
    expect(conjugate('morrer').participles).toContain('morto')
    expect(conjugate('imprimir').participles).toContain('impresso')
    expect(conjugate('eleger').participles).toContain('eleito')
  })
  it('allForms includes agreement forms of every participle', () => {
    const f = allForms('fazer')
    for (const x of ['feito', 'feita', 'feitos', 'feitas', 'faço', 'fizéssemos', 'fizer', 'fazendo', 'fazer']) expect(f).toContain(x)
    expect(allForms('aceitar')).toContain('aceitas')
    expect(allForms('entregar')).toContain('entregues')
    expect(allForms('morrer')).toContain('mortos')
  })
  it('allForms includes European variants', () => {
    expect(allForms('falar')).toContain('falámos')
    expect(allForms('ouvir')).toContain('oiço')
  })
})

describe('reflexive', () => {
  it('strips -se and attaches pronouns (Brazilian proclisis, enclisis in imperatives)', () => {
    const c = conjugate('levantar-se')
    expect(c.reflexive).toBe(true)
    expect(c.infinitive).toBe('levantar')
    expect(withReflexive(c.forms.pres[0], 0, 'pres')).toBe('me levanto')
    expect(withReflexive(c.forms.pres[3], 3, 'pres')).toBe('nos levantamos')
    expect(withReflexive(c.forms.pret[2], 2, 'pret')).toBe('se levantou')
    expect(withReflexive(c.forms.impAff[1], 1, 'impAff')).toBe('levanta-te')
    expect(withReflexive(c.forms.impAff[2], 2, 'impAff')).toBe('levante-se')
    expect(withReflexive(c.forms.impAff[3], 3, 'impAff')).toBe('levantemo-nos')
    expect(withReflexive(c.forms.impAff[4], 4, 'impAff')).toBe('levantai-vos')
    expect(withReflexive(c.forms.impNeg[1], 1, 'impNeg')).toBe('não te levantes')
    expect(withReflexive(c.forms.persInf[3], 3, 'persInf')).toBe('levantarmo-nos')
    expect(withReflexive(null, 0, 'impAff')).toBeNull()
  })
  it('conjugates irregular reflexive verbs from the table', () => {
    expect(conjugate('sentir-se').forms.pres[0]).toBe('sinto')
    expect(conjugate('despedir-se').forms.pres[0]).toBe('despeço')
    expect(conjugate('vestir-se').forms.subjPres[3]).toBe('vistamos')
    expect(conjugate('ir-se').forms.pres[0]).toBe('vou')
    expect(conjugate('ir-se').reflexive).toBe(true)
    expect(conjugate('pôr-se').forms.pret[2]).toBe('pôs')
  })
})

describe('table and trainer', () => {
  it('has at least 50 irregular verbs, all conjugable', () => {
    expect(IRREGULAR.size).toBeGreaterThanOrEqual(50)
    for (const lemma of IRREGULAR.keys()) expect(() => conjugate(lemma)).not.toThrow()
  })
  it('derived verbs listed in the table conjugate', () => {
    for (const v of IRREGULAR.values()) for (const d of v.derived ?? []) expect(conjugate(d).infinitive).toBe(d)
  })
  it('works with an empty table (regular rules only)', () => {
    expect(conjugateWith('falar').forms.pres[0]).toBe('falo')
    expect(conjugateWith('sentir').forms.pres[0]).toBe('sinto')
  })
  it('rejects non-infinitives', () => {
    expect(() => conjugate('casa')).toThrow()
    expect(() => conjugate('falar bem')).toThrow()
  })
  it('has labels for every tense and six persons', () => {
    for (const t of TENSES) expect(TENSE_LABELS[t].en).toBeTruthy()
    expect(PERSONS).toHaveLength(6)
    for (const t of TENSES) expect(conjugate('falar').forms[t]).toHaveLength(6)
  })
  it('verb trainer helpers', () => {
    expect(VERB_TRAINER.defaultVerb).toBe('ser')
    for (const w of ['falar', 'comer', 'partir', 'pôr', 'compor', 'ir', 'levantar-se', 'ser']) expect(VERB_TRAINER.isInfinitive(w)).toBe(true)
    for (const w of ['casa', 'falo', 'bonito']) expect(VERB_TRAINER.isInfinitive(w)).toBe(false)
    expect(VERB_TRAINER.baseLemma('Levantar-se')).toBe('levantar')
    expect(VERB_TRAINER.skipInExercises).toEqual(expect.arrayContaining(['impAff', 'impNeg', 'persInf']))
  })
  it('caches conjugations', () => {
    expect(conjugate('falar')).toBe(conjugate('falar'))
  })
})
