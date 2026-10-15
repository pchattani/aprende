import { describe, it, expect } from 'vitest'
import { conjugate, conjugateWith, withReflexive, allForms, agreementVariants, IRREGULAR, TENSES, TENSE_LABELS, PERSONS, VERB_TRAINER } from '@/lang/fr/verbs'
import type { Tense } from '@/lang/fr/conjugator'

type G = Partial<Record<Tense | 'participle' | 'gerund', string>>
// Golden forms: "je,tu,il,nous,vous,ils" ("-" = no form)
const GOLD: Record<string, G> = {
  // ---- regular -er / -ir / -re, all tenses
  parler: {
    pres: 'parle,parles,parle,parlons,parlez,parlent', impf: 'parlais,parlais,parlait,parlions,parliez,parlaient',
    pret: 'parlai,parlas,parla,parlâmes,parlâtes,parlèrent', fut: 'parlerai,parleras,parlera,parlerons,parlerez,parleront',
    cond: 'parlerais,parlerais,parlerait,parlerions,parleriez,parleraient', subjPres: 'parle,parles,parle,parlions,parliez,parlent',
    subjImpf: 'parlasse,parlasses,parlât,parlassions,parlassiez,parlassent', impAff: '-,parle,-,parlons,parlez,-',
    impNeg: '-,ne parle pas,-,ne parlons pas,ne parlez pas,-', participle: 'parlé', gerund: 'parlant',
    perf: 'ai parlé,as parlé,a parlé,avons parlé,avez parlé,ont parlé',
    pluperf: 'avais parlé,avais parlé,avait parlé,avions parlé,aviez parlé,avaient parlé',
    pretPerf: 'eus parlé,eus parlé,eut parlé,eûmes parlé,eûtes parlé,eurent parlé',
    futPerf: 'aurai parlé,auras parlé,aura parlé,aurons parlé,aurez parlé,auront parlé',
    condPerf: 'aurais parlé,aurais parlé,aurait parlé,aurions parlé,auriez parlé,auraient parlé',
    subjPerf: 'aie parlé,aies parlé,ait parlé,ayons parlé,ayez parlé,aient parlé',
    subjPluperf: 'eusse parlé,eusses parlé,eût parlé,eussions parlé,eussiez parlé,eussent parlé',
  },
  aimer: { pres: 'aime,aimes,aime,aimons,aimez,aiment', impNeg: "-,n'aime pas,-,n'aimons pas,n'aimez pas,-" },
  étudier: { impf: 'étudiais,étudiais,étudiait,étudiions,étudiiez,étudiaient', subjPres: 'étudie,étudies,étudie,étudiions,étudiiez,étudient' },
  créer: { pres: 'crée,crées,crée,créons,créez,créent', participle: 'créé', fut: 'créerai,créeras,créera,créerons,créerez,créeront' },
  finir: {
    pres: 'finis,finis,finit,finissons,finissez,finissent', impf: 'finissais,finissais,finissait,finissions,finissiez,finissaient',
    pret: 'finis,finis,finit,finîmes,finîtes,finirent', fut: 'finirai,finiras,finira,finirons,finirez,finiront',
    subjPres: 'finisse,finisses,finisse,finissions,finissiez,finissent', subjImpf: 'finisse,finisses,finît,finissions,finissiez,finissent',
    impAff: '-,finis,-,finissons,finissez,-', participle: 'fini', gerund: 'finissant',
  },
  choisir: { pres: 'choisis,choisis,choisit,choisissons,choisissez,choisissent' },
  réussir: { perf: 'ai réussi,as réussi,a réussi,avons réussi,avez réussi,ont réussi' },
  vendre: {
    pres: 'vends,vends,vend,vendons,vendez,vendent', impf: 'vendais,vendais,vendait,vendions,vendiez,vendaient',
    pret: 'vendis,vendis,vendit,vendîmes,vendîtes,vendirent', fut: 'vendrai,vendras,vendra,vendrons,vendrez,vendront',
    subjPres: 'vende,vendes,vende,vendions,vendiez,vendent', impAff: '-,vends,-,vendons,vendez,-', participle: 'vendu', gerund: 'vendant',
  },
  attendre: { pres: 'attends,attends,attend,attendons,attendez,attendent', participle: 'attendu' },
  rompre: { pres: 'romps,romps,rompt,rompons,rompez,rompent', participle: 'rompu' },
  interrompre: { pres: 'interromps,interromps,interrompt,interrompons,interrompez,interrompent' },
  // ---- spelling-change verbs
  manger: {
    pres: 'mange,manges,mange,mangeons,mangez,mangent', impf: 'mangeais,mangeais,mangeait,mangions,mangiez,mangeaient',
    pret: 'mangeai,mangeas,mangea,mangeâmes,mangeâtes,mangèrent', gerund: 'mangeant', subjImpf: 'mangeasse,mangeasses,mangeât,mangeassions,mangeassiez,mangeassent',
  },
  nager: { pres: 'nage,nages,nage,nageons,nagez,nagent' },
  commencer: {
    pres: 'commence,commences,commence,commençons,commencez,commencent', impf: 'commençais,commençais,commençait,commencions,commenciez,commençaient',
    pret: 'commençai,commenças,commença,commençâmes,commençâtes,commencèrent', gerund: 'commençant', impAff: '-,commence,-,commençons,commencez,-',
  },
  acheter: {
    pres: 'achète,achètes,achète,achetons,achetez,achètent', fut: 'achèterai,achèteras,achètera,achèterons,achèterez,achèteront',
    subjPres: 'achète,achètes,achète,achetions,achetiez,achètent', impf: 'achetais,achetais,achetait,achetions,achetiez,achetaient', participle: 'acheté',
  },
  lever: { pres: 'lève,lèves,lève,levons,levez,lèvent', fut: 'lèverai,lèveras,lèvera,lèverons,lèverez,lèveront' },
  mener: { pres: 'mène,mènes,mène,menons,menez,mènent' },
  promener: { pres: 'promène,promènes,promène,promenons,promenez,promènent' },
  geler: { pres: 'gèle,gèles,gèle,gelons,gelez,gèlent' },
  appeler: {
    pres: 'appelle,appelles,appelle,appelons,appelez,appellent', fut: 'appellerai,appelleras,appellera,appellerons,appellerez,appelleront',
    subjPres: 'appelle,appelles,appelle,appelions,appeliez,appellent', impAff: '-,appelle,-,appelons,appelez,-',
  },
  rappeler: { pres: 'rappelle,rappelles,rappelle,rappelons,rappelez,rappellent' },
  jeter: { pres: 'jette,jettes,jette,jetons,jetez,jettent', fut: 'jetterai,jetteras,jettera,jetterons,jetterez,jetteront' },
  préférer: {
    pres: 'préfère,préfères,préfère,préférons,préférez,préfèrent', fut: 'préférerai,préféreras,préférera,préférerons,préférerez,préféreront',
    subjPres: 'préfère,préfères,préfère,préférions,préfériez,préfèrent',
  },
  espérer: { pres: 'espère,espères,espère,espérons,espérez,espèrent' },
  répéter: { pres: 'répète,répètes,répète,répétons,répétez,répètent' },
  protéger: { pres: 'protège,protèges,protège,protégeons,protégez,protègent' },
  payer: { pres: 'paie,paies,paie,payons,payez,paient', fut: 'paierai,paieras,paiera,paierons,paierez,paieront', impf: 'payais,payais,payait,payions,payiez,payaient' },
  employer: { pres: 'emploie,emploies,emploie,employons,employez,emploient', fut: 'emploierai,emploieras,emploiera,emploierons,emploierez,emploieront' },
  nettoyer: { pres: 'nettoie,nettoies,nettoie,nettoyons,nettoyez,nettoient' },
  essuyer: { pres: 'essuie,essuies,essuie,essuyons,essuyez,essuient', fut: 'essuierai,essuieras,essuiera,essuierons,essuierez,essuieront' },
  envoyer: { pres: 'envoie,envoies,envoie,envoyons,envoyez,envoient', fut: 'enverrai,enverras,enverra,enverrons,enverrez,enverront', subjPres: 'envoie,envoies,envoie,envoyions,envoyiez,envoient' },
  // ---- être, avoir, aller, faire
  être: {
    pres: 'suis,es,est,sommes,êtes,sont', impf: 'étais,étais,était,étions,étiez,étaient', pret: 'fus,fus,fut,fûmes,fûtes,furent',
    fut: 'serai,seras,sera,serons,serez,seront', cond: 'serais,serais,serait,serions,seriez,seraient',
    subjPres: 'sois,sois,soit,soyons,soyez,soient', subjImpf: 'fusse,fusses,fût,fussions,fussiez,fussent', impAff: '-,sois,-,soyons,soyez,-',
    impNeg: '-,ne sois pas,-,ne soyons pas,ne soyez pas,-', participle: 'été', gerund: 'étant', perf: 'ai été,as été,a été,avons été,avez été,ont été',
  },
  avoir: {
    pres: 'ai,as,a,avons,avez,ont', impf: 'avais,avais,avait,avions,aviez,avaient', pret: 'eus,eus,eut,eûmes,eûtes,eurent',
    fut: 'aurai,auras,aura,aurons,aurez,auront', subjPres: 'aie,aies,ait,ayons,ayez,aient', subjImpf: 'eusse,eusses,eût,eussions,eussiez,eussent',
    impAff: '-,aie,-,ayons,ayez,-', impNeg: "-,n'aie pas,-,n'ayons pas,n'ayez pas,-", participle: 'eu', gerund: 'ayant', perf: 'ai eu,as eu,a eu,avons eu,avez eu,ont eu',
  },
  aller: {
    pres: 'vais,vas,va,allons,allez,vont', impf: 'allais,allais,allait,allions,alliez,allaient', fut: 'irai,iras,ira,irons,irez,iront',
    cond: 'irais,irais,irait,irions,iriez,iraient', subjPres: 'aille,ailles,aille,allions,alliez,aillent', pret: 'allai,allas,alla,allâmes,allâtes,allèrent',
    impAff: '-,va,-,allons,allez,-', impNeg: "-,ne va pas,-,n'allons pas,n'allez pas,-", participle: 'allé',
    perf: 'suis allé,es allé,est allé,sommes allés,êtes allés,sont allés', pluperf: 'étais allé,étais allé,était allé,étions allés,étiez allés,étaient allés',
    futPerf: 'serai allé,seras allé,sera allé,serons allés,serez allés,seront allés', condPerf: 'serais allé,serais allé,serait allé,serions allés,seriez allés,seraient allés',
    subjPerf: 'sois allé,sois allé,soit allé,soyons allés,soyez allés,soient allés',
  },
  faire: {
    pres: 'fais,fais,fait,faisons,faites,font', impf: 'faisais,faisais,faisait,faisions,faisiez,faisaient', pret: 'fis,fis,fit,fîmes,fîtes,firent',
    fut: 'ferai,feras,fera,ferons,ferez,feront', subjPres: 'fasse,fasses,fasse,fassions,fassiez,fassent', subjImpf: 'fisse,fisses,fît,fissions,fissiez,fissent',
    impAff: '-,fais,-,faisons,faites,-', participle: 'fait', gerund: 'faisant',
  },
  satisfaire: { pres: 'satisfais,satisfais,satisfait,satisfaisons,satisfaites,satisfont', participle: 'satisfait' },
  // ---- modals
  pouvoir: { pres: 'peux,peux,peut,pouvons,pouvez,peuvent', fut: 'pourrai,pourras,pourra,pourrons,pourrez,pourront', subjPres: 'puisse,puisses,puisse,puissions,puissiez,puissent', pret: 'pus,pus,put,pûmes,pûtes,purent', impAff: '-,-,-,-,-,-', participle: 'pu' },
  vouloir: { pres: 'veux,veux,veut,voulons,voulez,veulent', fut: 'voudrai,voudras,voudra,voudrons,voudrez,voudront', cond: 'voudrais,voudrais,voudrait,voudrions,voudriez,voudraient', subjPres: 'veuille,veuilles,veuille,voulions,vouliez,veuillent', impAff: '-,veuille,-,veuillons,veuillez,-', participle: 'voulu' },
  devoir: { pres: 'dois,dois,doit,devons,devez,doivent', fut: 'devrai,devras,devra,devrons,devrez,devront', subjPres: 'doive,doives,doive,devions,deviez,doivent', pret: 'dus,dus,dut,dûmes,dûtes,durent', participle: 'dû' },
  savoir: { pres: 'sais,sais,sait,savons,savez,savent', fut: 'saurai,sauras,saura,saurons,saurez,sauront', subjPres: 'sache,saches,sache,sachions,sachiez,sachent', impAff: '-,sache,-,sachons,sachez,-', participle: 'su', gerund: 'sachant', impf: 'savais,savais,savait,savions,saviez,savaient' },
  falloir: { pres: '-,-,faut,-,-,-', impf: '-,-,fallait,-,-,-', fut: '-,-,faudra,-,-,-', subjPres: '-,-,faille,-,-,-', perf: '-,-,a fallu,-,-,-', impAff: '-,-,-,-,-,-', participle: 'fallu' },
  pleuvoir: { pres: '-,-,pleut,-,-,-', impf: '-,-,pleuvait,-,-,-', fut: '-,-,pleuvra,-,-,-', pret: '-,-,plut,-,-,-', perf: '-,-,a plu,-,-,-', participle: 'plu' },
  valoir: { pres: 'vaux,vaux,vaut,valons,valez,valent', fut: 'vaudrai,vaudras,vaudra,vaudrons,vaudrez,vaudront', subjPres: 'vaille,vailles,vaille,valions,valiez,vaillent' },
  // ---- dire and compounds
  dire: { pres: 'dis,dis,dit,disons,dites,disent', impf: 'disais,disais,disait,disions,disiez,disaient', pret: 'dis,dis,dit,dîmes,dîtes,dirent', fut: 'dirai,diras,dira,dirons,direz,diront', subjPres: 'dise,dises,dise,disions,disiez,disent', impAff: '-,dis,-,disons,dites,-', participle: 'dit' },
  interdire: { pres: 'interdis,interdis,interdit,interdisons,interdisez,interdisent', participle: 'interdit', pret: 'interdis,interdis,interdit,interdîmes,interdîtes,interdirent' },
  redire: { pres: 'redis,redis,redit,redisons,redites,redisent' },
  // ---- venir, tenir and compounds
  venir: {
    pres: 'viens,viens,vient,venons,venez,viennent', pret: 'vins,vins,vint,vînmes,vîntes,vinrent', fut: 'viendrai,viendras,viendra,viendrons,viendrez,viendront',
    subjPres: 'vienne,viennes,vienne,venions,veniez,viennent', subjImpf: 'vinsse,vinsses,vînt,vinssions,vinssiez,vinssent', participle: 'venu',
    perf: 'suis venu,es venu,est venu,sommes venus,êtes venus,sont venus',
  },
  revenir: { pres: 'reviens,reviens,revient,revenons,revenez,reviennent', perf: 'suis revenu,es revenu,est revenu,sommes revenus,êtes revenus,sont revenus' },
  devenir: { fut: 'deviendrai,deviendras,deviendra,deviendrons,deviendrez,deviendront', perf: 'suis devenu,es devenu,est devenu,sommes devenus,êtes devenus,sont devenus' },
  prévenir: { pres: 'préviens,préviens,prévient,prévenons,prévenez,préviennent', perf: 'ai prévenu,as prévenu,a prévenu,avons prévenu,avez prévenu,ont prévenu' },
  tenir: { pres: 'tiens,tiens,tient,tenons,tenez,tiennent', pret: 'tins,tins,tint,tînmes,tîntes,tinrent', participle: 'tenu' },
  obtenir: { pres: 'obtiens,obtiens,obtient,obtenons,obtenez,obtiennent', fut: 'obtiendrai,obtiendras,obtiendra,obtiendrons,obtiendrez,obtiendront', participle: 'obtenu' },
  appartenir: { pres: 'appartiens,appartiens,appartient,appartenons,appartenez,appartiennent' },
  // ---- prendre, mettre and compounds
  prendre: { pres: 'prends,prends,prend,prenons,prenez,prennent', impf: 'prenais,prenais,prenait,prenions,preniez,prenaient', pret: 'pris,pris,prit,prîmes,prîtes,prirent', subjPres: 'prenne,prennes,prenne,prenions,preniez,prennent', participle: 'pris', gerund: 'prenant' },
  comprendre: { pres: 'comprends,comprends,comprend,comprenons,comprenez,comprennent', participle: 'compris' },
  apprendre: { subjPres: 'apprenne,apprennes,apprenne,apprenions,appreniez,apprennent', participle: 'appris' },
  surprendre: { participle: 'surpris' },
  mettre: { pres: 'mets,mets,met,mettons,mettez,mettent', pret: 'mis,mis,mit,mîmes,mîtes,mirent', participle: 'mis' },
  promettre: { pres: 'promets,promets,promet,promettons,promettez,promettent', participle: 'promis' },
  permettre: { participle: 'permis' },
  battre: { pres: 'bats,bats,bat,battons,battez,battent', participle: 'battu' },
  combattre: { pres: 'combats,combats,combat,combattons,combattez,combattent' },
  // ---- the rest of the table
  voir: { pres: 'vois,vois,voit,voyons,voyez,voient', impf: 'voyais,voyais,voyait,voyions,voyiez,voyaient', fut: 'verrai,verras,verra,verrons,verrez,verront', subjPres: 'voie,voies,voie,voyions,voyiez,voient', pret: 'vis,vis,vit,vîmes,vîtes,virent', participle: 'vu' },
  revoir: { fut: 'reverrai,reverras,reverra,reverrons,reverrez,reverront', participle: 'revu' },
  prévoir: { fut: 'prévoirai,prévoiras,prévoira,prévoirons,prévoirez,prévoiront', participle: 'prévu' },
  croire: { pres: 'crois,crois,croit,croyons,croyez,croient', subjPres: 'croie,croies,croie,croyions,croyiez,croient', pret: 'crus,crus,crut,crûmes,crûtes,crurent', participle: 'cru' },
  boire: { pres: 'bois,bois,boit,buvons,buvez,boivent', impf: 'buvais,buvais,buvait,buvions,buviez,buvaient', subjPres: 'boive,boives,boive,buvions,buviez,boivent', participle: 'bu', gerund: 'buvant' },
  recevoir: { pres: 'reçois,reçois,reçoit,recevons,recevez,reçoivent', fut: 'recevrai,recevras,recevra,recevrons,recevrez,recevront', pret: 'reçus,reçus,reçut,reçûmes,reçûtes,reçurent', participle: 'reçu' },
  apercevoir: { pres: 'aperçois,aperçois,aperçoit,apercevons,apercevez,aperçoivent', participle: 'aperçu' },
  décevoir: { participle: 'déçu' },
  lire: { pres: 'lis,lis,lit,lisons,lisez,lisent', pret: 'lus,lus,lut,lûmes,lûtes,lurent', participle: 'lu' },
  relire: { participle: 'relu' },
  écrire: { pres: 'écris,écris,écrit,écrivons,écrivez,écrivent', impf: 'écrivais,écrivais,écrivait,écrivions,écriviez,écrivaient', pret: 'écrivis,écrivis,écrivit,écrivîmes,écrivîtes,écrivirent', participle: 'écrit' },
  décrire: { pres: 'décris,décris,décrit,décrivons,décrivez,décrivent', participle: 'décrit' },
  inscrire: { participle: 'inscrit', pres: 'inscris,inscris,inscrit,inscrivons,inscrivez,inscrivent' },
  connaître: { pres: 'connais,connais,connaît,connaissons,connaissez,connaissent', pret: 'connus,connus,connut,connûmes,connûtes,connurent', fut: 'connaîtrai,connaîtras,connaîtra,connaîtrons,connaîtrez,connaîtront', participle: 'connu' },
  reconnaître: { pres: 'reconnais,reconnais,reconnaît,reconnaissons,reconnaissez,reconnaissent', participle: 'reconnu' },
  paraître: { participle: 'paru' },
  disparaître: { pres: 'disparais,disparais,disparaît,disparaissons,disparaissez,disparaissent', perf: 'ai disparu,as disparu,a disparu,avons disparu,avez disparu,ont disparu' },
  naître: { pres: 'nais,nais,naît,naissons,naissez,naissent', pret: 'naquis,naquis,naquit,naquîmes,naquîtes,naquirent', participle: 'né', perf: 'suis né,es né,est né,sommes nés,êtes nés,sont nés' },
  mourir: { pres: 'meurs,meurs,meurt,mourons,mourez,meurent', fut: 'mourrai,mourras,mourra,mourrons,mourrez,mourront', subjPres: 'meure,meures,meure,mourions,mouriez,meurent', participle: 'mort', perf: 'suis mort,es mort,est mort,sommes morts,êtes morts,sont morts' },
  ouvrir: { pres: 'ouvre,ouvres,ouvre,ouvrons,ouvrez,ouvrent', impAff: '-,ouvre,-,ouvrons,ouvrez,-', pret: 'ouvris,ouvris,ouvrit,ouvrîmes,ouvrîtes,ouvrirent', fut: 'ouvrirai,ouvriras,ouvrira,ouvrirons,ouvrirez,ouvriront', participle: 'ouvert' },
  couvrir: { pres: 'couvre,couvres,couvre,couvrons,couvrez,couvrent', participle: 'couvert' },
  découvrir: { participle: 'découvert' },
  offrir: { pres: 'offre,offres,offre,offrons,offrez,offrent', participle: 'offert' },
  souffrir: { pres: 'souffre,souffres,souffre,souffrons,souffrez,souffrent', participle: 'souffert' },
  cueillir: { pres: 'cueille,cueilles,cueille,cueillons,cueillez,cueillent', fut: 'cueillerai,cueilleras,cueillera,cueillerons,cueillerez,cueilleront' },
  accueillir: { pres: 'accueille,accueilles,accueille,accueillons,accueillez,accueillent', participle: 'accueilli' },
  partir: { pres: 'pars,pars,part,partons,partez,partent', pret: 'partis,partis,partit,partîmes,partîtes,partirent', participle: 'parti', perf: 'suis parti,es parti,est parti,sommes partis,êtes partis,sont partis' },
  sortir: { pres: 'sors,sors,sort,sortons,sortez,sortent', perf: 'suis sorti,es sorti,est sorti,sommes sortis,êtes sortis,sont sortis' },
  dormir: { pres: 'dors,dors,dort,dormons,dormez,dorment', subjPres: 'dorme,dormes,dorme,dormions,dormiez,dorment', participle: 'dormi' },
  endormir: { pres: 'endors,endors,endort,endormons,endormez,endorment' },
  servir: { pres: 'sers,sers,sert,servons,servez,servent' },
  sentir: { pres: 'sens,sens,sent,sentons,sentez,sentent' },
  ressentir: { pres: 'ressens,ressens,ressent,ressentons,ressentez,ressentent' },
  mentir: { pres: 'mens,mens,ment,mentons,mentez,mentent' },
  courir: { pres: 'cours,cours,court,courons,courez,courent', fut: 'courrai,courras,courra,courrons,courrez,courront', participle: 'couru' },
  parcourir: { pres: 'parcours,parcours,parcourt,parcourons,parcourez,parcourent', participle: 'parcouru' },
  vivre: { pres: 'vis,vis,vit,vivons,vivez,vivent', pret: 'vécus,vécus,vécut,vécûmes,vécûtes,vécurent', participle: 'vécu' },
  suivre: { pres: 'suis,suis,suit,suivons,suivez,suivent', participle: 'suivi' },
  poursuivre: { pres: 'poursuis,poursuis,poursuit,poursuivons,poursuivez,poursuivent' },
  conduire: { pres: 'conduis,conduis,conduit,conduisons,conduisez,conduisent', pret: 'conduisis,conduisis,conduisit,conduisîmes,conduisîtes,conduisirent', participle: 'conduit' },
  construire: { pres: 'construis,construis,construit,construisons,construisez,construisent', participle: 'construit' },
  traduire: { participle: 'traduit', impf: 'traduisais,traduisais,traduisait,traduisions,traduisiez,traduisaient' },
  produire: { participle: 'produit' },
  cuire: { pres: 'cuis,cuis,cuit,cuisons,cuisez,cuisent', participle: 'cuit' },
  nuire: { participle: 'nui' },
  craindre: { pres: 'crains,crains,craint,craignons,craignez,craignent', impf: 'craignais,craignais,craignait,craignions,craigniez,craignaient', participle: 'craint' },
  plaindre: { pres: 'plains,plains,plaint,plaignons,plaignez,plaignent', participle: 'plaint' },
  peindre: { pres: 'peins,peins,peint,peignons,peignez,peignent', participle: 'peint' },
  éteindre: { pres: 'éteins,éteins,éteint,éteignons,éteignez,éteignent', participle: 'éteint' },
  atteindre: { participle: 'atteint' },
  joindre: { pres: 'joins,joins,joint,joignons,joignez,joignent', participle: 'joint' },
  rejoindre: { pres: 'rejoins,rejoins,rejoint,rejoignons,rejoignez,rejoignent', participle: 'rejoint' },
  acquérir: { pres: 'acquiers,acquiers,acquiert,acquérons,acquérez,acquièrent', fut: 'acquerrai,acquerras,acquerra,acquerrons,acquerrez,acquerront', subjPres: 'acquière,acquières,acquière,acquérions,acquériez,acquièrent', participle: 'acquis' },
  conquérir: { participle: 'conquis' },
  résoudre: { pres: 'résous,résous,résout,résolvons,résolvez,résolvent', participle: 'résolu', subjPres: 'résolve,résolves,résolve,résolvions,résolviez,résolvent' },
  rire: { pres: 'ris,ris,rit,rions,riez,rient', impf: 'riais,riais,riait,riions,riiez,riaient', subjPres: 'rie,ries,rie,riions,riiez,rient', participle: 'ri' },
  sourire: { pres: 'souris,souris,sourit,sourions,souriez,sourient', participle: 'souri' },
  plaire: { pres: 'plais,plais,plaît,plaisons,plaisez,plaisent', participle: 'plu' },
  taire: { pres: 'tais,tais,tait,taisons,taisez,taisent', participle: 'tu' },
  vaincre: { pres: 'vaincs,vaincs,vainc,vainquons,vainquez,vainquent', participle: 'vaincu' },
  convaincre: { participle: 'convaincu' },
  fuir: { pres: 'fuis,fuis,fuit,fuyons,fuyez,fuient', subjPres: 'fuie,fuies,fuie,fuyions,fuyiez,fuient' },
  haïr: { pres: 'hais,hais,hait,haïssons,haïssez,haïssent', impNeg: '-,ne hais pas,-,ne haïssons pas,ne haïssez pas,-', participle: 'haï' },
  conclure: { pres: 'conclus,conclus,conclut,concluons,concluez,concluent', participle: 'conclu' },
  inclure: { participle: 'inclus' },
  suffire: { pres: 'suffis,suffis,suffit,suffisons,suffisez,suffisent', participle: 'suffi' },
  // ---- regular verbs that only look like an irregular one
  répartir: { pres: 'répartis,répartis,répartit,répartissons,répartissez,répartissent' },
  installer: { pres: 'installe,installes,installe,installons,installez,installent' },
  // ---- être verbs that are otherwise regular
  arriver: { perf: 'suis arrivé,es arrivé,est arrivé,sommes arrivés,êtes arrivés,sont arrivés', pluperf: 'étais arrivé,étais arrivé,était arrivé,étions arrivés,étiez arrivés,étaient arrivés' },
  tomber: { perf: 'suis tombé,es tombé,est tombé,sommes tombés,êtes tombés,sont tombés' },
  rester: { condPerf: 'serais resté,serais resté,serait resté,serions restés,seriez restés,seraient restés' },
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

describe('auxiliaries', () => {
  it('chooses être for the DR MRS VANDERTRAMP verbs, avoir otherwise', () => {
    for (const v of ['aller', 'venir', 'arriver', 'partir', 'naître', 'mourir', 'tomber', 'rester', 'entrer', 'devenir', 'revenir', 'retourner', 'monter', 'descendre', 'sortir', 'passer', 'rentrer', 'apparaître']) {
      expect(conjugate(v).auxiliary, v).toBe('être')
    }
    for (const v of ['parler', 'finir', 'faire', 'être', 'avoir', 'prendre', 'voir', 'courir', 'disparaître', 'prévenir', 'tenir']) expect(conjugate(v).auxiliary, v).toBe('avoir')
  })
  it('knows verbs with both auxiliaries', () => {
    expect(conjugate('sortir').auxiliaries).toEqual(['être', 'avoir'])
    expect(conjugate('monter').auxiliaries).toEqual(['être', 'avoir'])
    expect(conjugate('passer').auxiliaries).toEqual(['être', 'avoir'])
    expect(conjugate('aller').auxiliaries).toEqual(['être'])
    expect(conjugate('manger').auxiliaries).toEqual(['avoir'])
  })
  it('lists the four participle forms and agreement variants', () => {
    expect(conjugate('aller').participles).toEqual(['allé', 'allée', 'allés', 'allées'])
    expect(conjugate('prendre').participles).toEqual(['pris', 'prise', 'pris', 'prises'])
    expect(conjugate('devoir').participles).toEqual(['dû', 'due', 'dus', 'dues'])
    expect(conjugate('être').participles).toEqual(['été', 'été', 'été', 'été'])
    expect(agreementVariants('suis allé')).toEqual(['suis allé', 'suis allée'])
    expect(agreementVariants('sommes allés')).toEqual(['sommes allés', 'sommes allées'])
    expect(agreementVariants('êtes allés')).toEqual(['êtes allés', 'êtes allées', 'êtes allé', 'êtes allée'])
    expect(agreementVariants('serait parti')).toEqual(['serait parti', 'serait partie'])
    expect(agreementVariants('ai mangé')).toEqual(['ai mangé'])
    expect(agreementVariants('me suis levé')).toEqual(['me suis levé', 'me suis levée'])
    expect(agreementVariants("t'es levé")).toEqual(["t'es levé", "t'es levée"])
    expect(agreementVariants('nous sommes assis')).toEqual(['nous sommes assis', 'nous sommes assises'])
    expect(agreementVariants('ai été')).toEqual(['ai été'])
    expect(agreementVariants(null)).toEqual([])
  })
  it('allForms has every single-word form, participle forms, imperatives and alternates', () => {
    const f = allForms('aller')
    for (const w of ['vais', 'irai', 'allassent', 'allé', 'allée', 'allés', 'allées', 'va', 'aille', 'allant', 'aller']) expect(f.has(w), w).toBe(true)
    expect(allForms('payer').has('paye')).toBe(true)
    expect(allForms('payer').has('payerai')).toBe(true)
    expect(allForms('préférer').has('préfèrerai')).toBe(true)
    expect(allForms('pouvoir').has('puis')).toBe(true)
    expect(allForms('connaître').has('connait')).toBe(true)
    expect(allForms('s\'asseoir').has('assois')).toBe(true)
    expect(allForms('écrire').has('écrites')).toBe(true)
    expect(allForms('falloir').has('faut')).toBe(true)
  })
})

describe('pronominal verbs', () => {
  it('strips se / s’ and uses être', () => {
    const c = conjugate('se lever')
    expect(c.reflexive).toBe(true)
    expect(c.clitic).toBe('se')
    expect(c.infinitive).toBe('lever')
    expect(c.auxiliary).toBe('être')
    expect(withReflexive(c.forms.pres[0], 0, 'pres')).toBe('me lève')
    expect(withReflexive(c.forms.pres[2], 2, 'pres')).toBe('se lève')
    expect(withReflexive(c.forms.pres[3], 3, 'pres')).toBe('nous levons')
    expect(withReflexive(c.forms.perf[0], 0, 'perf')).toBe('me suis levé')
    expect(withReflexive(c.forms.perf[1], 1, 'perf')).toBe("t'es levé")
    expect(withReflexive(c.forms.perf[2], 2, 'perf')).toBe("s'est levé")
    expect(withReflexive(c.forms.perf[3], 3, 'perf')).toBe('nous sommes levés')
    expect(withReflexive(c.forms.fut[5], 5, 'fut')).toBe('se lèveront')
  })
  it('elides the pronoun before a vowel or silent h', () => {
    const c = conjugate("s'appeler")
    expect(c.infinitive).toBe('appeler')
    expect(withReflexive(c.forms.pres[0], 0, 'pres')).toBe("m'appelle")
    expect(withReflexive(c.forms.pres[1], 1, 'pres')).toBe("t'appelles")
    expect(withReflexive(c.forms.pres[3], 3, 'pres')).toBe('nous appelons')
    expect(withReflexive(conjugate("s'habiller").forms.pres[0], 0, 'pres')).toBe("m'habille")
    expect(conjugate('s’habiller').infinitive).toBe('habiller')
  })
  it('puts the stressed pronoun after the imperative', () => {
    const c = conjugate('se lever')
    expect(withReflexive(c.forms.impAff[1], 1, 'impAff')).toBe('lève-toi')
    expect(withReflexive(c.forms.impAff[3], 3, 'impAff')).toBe('levons-nous')
    expect(withReflexive(c.forms.impAff[4], 4, 'impAff')).toBe('levez-vous')
    expect(withReflexive(c.forms.impAff[0], 0, 'impAff')).toBeNull()
    expect(withReflexive(c.forms.impNeg[1], 1, 'impNeg')).toBe('ne te lève pas')
    expect(withReflexive(c.forms.impNeg[3], 3, 'impNeg')).toBe('ne nous levons pas')
    expect(withReflexive(conjugate("s'habiller").forms.impNeg[1], 1, 'impNeg')).toBe("ne t'habille pas")
    expect(withReflexive(conjugate("s'asseoir").forms.impAff[4], 4, 'impAff')).toBe('asseyez-vous')
  })
  it('handles s’en aller', () => {
    const c = conjugate("s'en aller")
    expect(c.clitic).toBe('sen')
    expect(c.infinitive).toBe('aller')
    expect(withReflexive(c.forms.pres[0], 0, 'pres', 'sen')).toBe("m'en vais")
    expect(withReflexive(c.forms.pres[3], 3, 'pres', 'sen')).toBe('nous en allons')
    expect(withReflexive(c.forms.perf[0], 0, 'perf', 'sen')).toBe("m'en suis allé")
    expect(withReflexive(c.forms.impAff[1], 1, 'impAff', 'sen')).toBe("va-t'en")
    expect(withReflexive(c.forms.impAff[4], 4, 'impAff', 'sen')).toBe('allez-vous-en')
    expect(withReflexive(c.forms.impNeg[1], 1, 'impNeg', 'sen')).toBe("ne t'en va pas")
  })
  it('derived pronominal verbs inherit irregular rows', () => {
    const c = conjugate('se souvenir')
    expect(c.forms.pres[0]).toBe('souviens')
    expect(withReflexive(c.forms.perf[0], 0, 'perf')).toBe('me suis souvenu')
    expect(conjugate("s'asseoir").participle).toBe('assis')
    expect(conjugate('se taire').forms.pres[2]).toBe('tait')
    expect(conjugate('se plaindre').forms.pres[3]).toBe('plaignons')
  })
})

describe('table and trainer', () => {
  it('has a full irregular table', () => {
    const withForms = [...IRREGULAR.values()].filter((v) => Object.keys(v).some((k) => !['lemma', 'aux', 'bothAux', 'note', 'regular'].includes(k)))
    expect(withForms.length).toBeGreaterThanOrEqual(70)
    expect(IRREGULAR.get('arriver')?.aux).toBe('être')
    for (const v of ['être', 'avoir', 'aller', 'faire', 'dire', 'pouvoir', 'vouloir', 'devoir', 'savoir', 'venir', 'tenir', 'prendre', 'mettre', 'voir', 'croire', 'boire', 'recevoir', 'lire', 'écrire', 'connaître', 'naître', 'mourir', 'ouvrir', 'offrir', 'souffrir', 'partir', 'sortir', 'dormir', 'servir', 'sentir', 'courir', 'vivre', 'suivre', 'conduire', 'craindre', 'peindre', 'joindre', 'falloir', 'pleuvoir', 'asseoir', 'valoir', 'envoyer', 'acquérir', 'résoudre', 'rire']) {
      expect(IRREGULAR.has(v), v).toBe(true)
    }
  })
  it('has labels and persons', () => {
    expect(PERSONS).toHaveLength(6)
    expect(PERSONS[0]).toBe('je')
    for (const t of TENSES) {
      expect(TENSE_LABELS[t].es.length).toBeGreaterThan(3)
      expect(['a1', 'a2', 'b1', 'b2', 'c1', 'c2']).toContain(TENSE_LABELS[t].level)
    }
    expect(TENSE_LABELS.perf.es).toBe('Passé composé')
    expect(TENSE_LABELS.pret.es).toBe('Passé simple')
    expect(TENSE_LABELS.pret.level).toBe('b2')
    expect(TENSES).toHaveLength(16)
  })
  it('recognises infinitives and base lemmas', () => {
    for (const w of ['parler', 'finir', 'vendre', 'être', 'avoir', 'pouvoir', 'haïr', 'se lever', "s'asseoir", 's’habiller', "s'en aller", 'se souvenir', 'dîner']) expect(VERB_TRAINER.isInfinitive(w), w).toBe(true)
    for (const w of ['maison', 'beau', 'parle', 'mère', 'hiver', 'plaisir', 'soir', 'livre', 'mer']) expect(VERB_TRAINER.isInfinitive(w), w).toBe(false)
    expect(VERB_TRAINER.baseLemma('se lever')).toBe('lever')
    expect(VERB_TRAINER.baseLemma("s'asseoir")).toBe('asseoir')
    expect(VERB_TRAINER.baseLemma("s'en aller")).toBe('aller')
    expect(VERB_TRAINER.baseLemma('parler')).toBe('parler')
    expect(VERB_TRAINER.defaultVerb).toBe('parler')
    expect(VERB_TRAINER.placeholder).toMatch(/parler/)
    expect(VERB_TRAINER.notAVerb).toMatch(/-er/)
    expect(VERB_TRAINER.skipInExercises).toContain('impAff')
  })
  it('conjugateWith works with any table and rejects non-verbs', () => {
    expect(conjugateWith('aller', new Map()).forms.pres[0]).toBe('alle') // regular without the table
    expect(conjugateWith('aller', IRREGULAR).forms.pres[0]).toBe('vais')
    expect(() => conjugate('maison')).toThrow()
  })
})
