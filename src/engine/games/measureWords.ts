/**
 * Measure words (Cantonese classifiers) for the "Measure words" game: the classifier each
 * noun is counted with, its "shape family", and questions 「三 ＿ 狗」 with four options whose
 * wrong answers are real classifiers that do not fit the noun (never one a speaker would also
 * accept: 隻/個 for 雞蛋, 部/架 for a phone, a container like 杯 or 碗 for food).
 * Pure functions over vocabulary entries, so they work with any course content.
 */
import type { VocabEntry } from '../schema'
import type { Rng } from '../random'

export interface ClassifierInfo {
  jp: string
  /** What the classifier counts, in a few words ("long, thin things"). */
  family: string
  /** Typical nouns, as a reminder after an answer. */
  examples: string
}

/** The classifiers the game asks about or offers as options, with their shape families. */
export const CLASSIFIERS: Record<string, ClassifierInfo> = {
  個: { jp: 'go3', family: 'the general measure word, for people, round things, places and ideas, and anything without a word of its own', examples: '個人, 個蘋果, 個問題' },
  隻: { jp: 'zek3', family: 'animals, one of a pair (a hand, an eye), and some small objects (spoons, boats, eggs)', examples: '隻狗, 隻手, 隻匙羹' },
  條: { jp: 'tiu4', family: 'long, thin, bendy things: fish, snakes, roads, trousers, keys', examples: '條魚, 條路, 條褲' },
  張: { jp: 'zoeng1', family: 'flat things with a surface: paper, tickets, cards, photos, tables, beds', examples: '張紙, 張枱, 張飛' },
  本: { jp: 'bun2', family: 'bound volumes: books, exercise books, magazines, passports', examples: '本書, 本雜誌, 本護照' },
  杯: { jp: 'bui1', family: 'a cup or glass of a drink (a container word)', examples: '杯茶, 杯咖啡, 杯水' },
  碗: { jp: 'wun2', family: 'a bowl of: rice, noodles, congee, soup', examples: '碗粥, 碗麵, 碗湯' },
  碟: { jp: 'dip2', family: 'a plate of: fried rice, fried noodles', examples: '碟炒飯, 碟意粉' },
  架: { jp: 'gaa3', family: 'vehicles and big machines: cars, buses, planes, bikes', examples: '架車, 架巴士, 架飛機' },
  部: { jp: 'bou6', family: 'machines and devices: phones, computers, TVs, cameras', examples: '部手機, 部電腦, 部相機' },
  間: { jp: 'gaan1', family: 'buildings and rooms you go into: shops, schools, banks, restaurants', examples: '間屋, 間學校, 間餐廳' },
  座: { jp: 'zo6', family: 'big things that stay put: tower blocks, mountains', examples: '座大廈, 座山' },
  件: { jp: 'gin6', family: 'items: tops and coats, pieces of cake, pieces of luggage, matters', examples: '件衫, 件事, 件行李' },
  對: { jp: 'deoi3', family: 'a pair: shoes, socks, chopsticks', examples: '對鞋, 對襪, 對筷子' },
  枝: { jp: 'zi1', family: 'stick-like, stiff things: pens, pencils, flowers on a stem, bottles', examples: '枝筆, 枝花' },
  支: { jp: 'zi1', family: 'stick-like things (another way of writing 枝): pens, sticks, fortune sticks', examples: '支筆, 支籤' },
  粒: { jp: 'nap1', family: 'small round things: sweets, dumplings, grapes, pills', examples: '粒糖, 粒燒賣, 粒藥' },
  塊: { jp: 'faai3', family: 'slices and flat pieces: toast, steak, pizza, a field, a face', examples: '塊多士, 塊牛扒, 塊面' },
  把: { jp: 'baa2', family: 'things you hold by a handle: umbrellas, knives; also a voice', examples: '把遮, 把刀, 把聲' },
  套: { jp: 'tou3', family: 'complete works and sets: films, TV series, suits', examples: '套戲, 套電影' },
  首: { jp: 'sau2', family: 'songs and poems', examples: '首歌, 首詩' },
  份: { jp: 'fan6', family: 'portions and copies: jobs, newspapers, presents, a serving', examples: '份工, 份報紙, 份禮物' },
  位: { jp: 'wai2', family: 'people, politely (guests, ladies and gentlemen)', examples: '位先生, 位小姐' },
  棵: { jp: 'po1', family: 'plants and trees', examples: '棵樹, 棵白菜' },
  頂: { jp: 'deng2', family: 'hats (things worn on top)', examples: '頂帽' },
  封: { jp: 'fung1', family: 'letters and emails (things you seal)', examples: '封信, 封電郵' },
  盞: { jp: 'zaan2', family: 'lamps and lights', examples: '盞燈' },
  副: { jp: 'fu3', family: 'a set that works together: glasses, a pack of cards', examples: '副眼鏡' },
  幅: { jp: 'fuk1', family: 'paintings and pictures hung up', examples: '幅畫' },
  度: { jp: 'dou6', family: 'doors (and bridges)', examples: '度門' },
  層: { jp: 'cang4', family: 'floors and flats', examples: '層樓' },
  陣: { jp: 'zan6', family: 'a spell of something passing: wind, a smell', examples: '陣風' },
  嚿: { jp: 'gau6', family: 'a lump or chunk: a cloud, a piece of meat', examples: '嚿雲' },
  種: { jp: 'zung2', family: 'a kind of, a type of', examples: '種語言' },
  場: { jp: 'coeng4', family: 'events that take place: matches, showings, a downpour', examples: '場比賽' },
  朵: { jp: 'doe2', family: 'blossoms and clouds', examples: '朵花, 朵荷花' },
  餐: { jp: 'caan1', family: 'meals', examples: '餐飯' },
}

/** Drinks in the course without a `cl`: counted by the cup in the game (一杯茶). */
const CUP_DRINKS = new Set(['茶', '咖啡', '奶茶', '水', '果汁', '檸檬茶', '檸茶', '凍檸茶', '啤酒', '酒', '奶', '普洱', '香片'])

/** Nouns left out: self-counting units (日, 年), titles (先生 "Mr", 生, 太), and odd counters for a picture game. */
const SKIP = new Set(['日', '年', '班', '隊', '生', '太', '先生', '太太', '小姐', '膊頭', '煙', '嘢', '折', '味', '工'])

/** Classifiers never offered as wrong options: they fit almost any noun (種 a kind of, 對 a pair of, 位 polite for people…). */
const NEVER_WRONG = new Set(['種', '樣', '啲', '款', '對', '副', '位', '名', '份', '陣', '場', '餐', '層', '朵', '碟', '支'])

/** Classifiers that can stand in for each other: one is never a wrong option for the other. */
const SAME_JOB: string[][] = [['枝', '支'], ['隻', '對'], ['部', '架'], ['間', '座', '棟'], ['套', '部']]

/** Containers and portions: with food or drink they are real answers (一杯雪糕, 一件蛋糕, 一碗藥), so never wrong options there. */
const FOOD_COUNTERS = new Set(['杯', '碗', '碟', '件', '塊', '嚿', '份', '粒', '隻', '個', '枝', '支', '片', '盤', '籠', '盒', '包', '罐', '壺', '煲'])

/** Everyday speech also uses 個 for many shops and companies (個公司), devices (個手機) and body parts (個耳仔). */
const ALSO_OK_FOR: Record<string, string[]> = { 間: ['個'], 部: ['個'], 位: ['個'] }

/** Other classifiers speakers also use with these nouns (一個雞蛋 beside 一隻雞蛋), so they are never wrong options. */
const ALSO_OK: Record<string, string[]> = {
  窗: ['個', '度', '扇'], 雞蛋: ['個'], 蛋: ['個'], 匙羹: ['把', '個'], 叉: ['把', '個'], 船: ['條', '艘'], 小輪: ['條', '架', '艘'],
  顏色: ['種', '個'], 餃子: ['粒', '個'], 手錶: ['個'], 糯米雞: ['個'], 菇: ['粒', '個'], 手指: ['條'], 牙: ['粒'], 鎖匙: ['把'],
  香蕉: ['隻', '梳'], 春卷: ['個', '件'], 漁村: ['個'], 魚: ['尾'], 金魚: ['尾'], 聲: ['個'], 聲音: ['個', '種'], 椅: ['把'], 面: ['張'],
  畫: ['張'], 眼鏡: ['對'], 燈: ['個', '枝'], 電郵: ['個'], 雪糕: ['個', '筒', '盒', '球'], 花: ['朵', '紮', '束'], 荷花: ['枝'],
  籤: ['枝'], 語言: ['個'], 病: ['個'], 蝦餃: ['隻', '個'], 燒賣: ['隻', '個'], 雲吞: ['隻', '個'], 魚蛋: ['個', '串'],
  士多啤梨: ['個'], 提子: ['個'], 朱古力: ['塊', '盒', '排'], 糖: ['包'], 藥: ['碗', '杯', '包', '樽', '隻'], 薄餅: ['個', '件'],
  牛扒: ['份'], 多士: ['件', '片'], 壽司: ['個', '嚿'], 三文治: ['份', '個'], 紀念品: ['份', '個'], 行李: ['個'], 鋼琴: ['個'], 樓: ['間', '個'],
  大廈: ['棟', '幢'], 山: ['個'], 高樓: ['棟', '幢'], 門: ['道', '扇'], 帽: ['個'], 工作: ['個'], 報紙: ['張'], 禮物: ['個', '件'],
  手信: ['個', '件', '盒'], 比賽: ['個', '次'], 歌: ['隻'], 電影: ['部', '齣', '個'], 戲: ['部', '齣'], 劇: ['部', '齣'],
  電視劇: ['部', '齣'], 雲: ['朵', '片'], 菜單: ['本'], 餐牌: ['本'], 地圖: ['本'], 紙巾: ['包', '盒'], 麵包: ['條', '塊', '片'],
  頸: ['個'], 腰: ['個'], 頭髮: ['啲'], 蛋糕: ['件', '塊'], 樹: ['條'], 白菜: ['條'], 單: ['張'], 寵物: ['個'],
}

/** For each classifier, the wrong options learners actually mix it up with; other options fill in from the whole set. */
const CONFUSED_WITH: Record<string, string[]> = {
  個: ['隻', '件', '張', '條', '間', '粒'], 隻: ['個', '條', '粒', '架', '枝', '張'], 條: ['枝', '隻', '張', '把', '件'],
  張: ['塊', '本', '條', '把', '幅', '件'], 本: ['張', '封', '件', '套', '首'], 杯: ['碗', '枝', '粒', '件', '個'],
  碗: ['杯', '粒', '件', '個'], 碟: ['碗', '杯', '件'], 架: ['部', '隻', '間', '座', '張'], 部: ['架', '本', '張', '個', '隻'],
  間: ['座', '個', '架', '張'], 座: ['間', '架', '個', '棵'], 件: ['個', '條', '隻', '張', '塊'], 對: ['隻', '條', '件'],
  枝: ['條', '把', '隻', '粒'], 支: ['條', '把', '隻', '粒'], 粒: ['隻', '個', '件', '塊'], 塊: ['張', '件', '粒', '條'],
  把: ['張', '枝', '條', '隻'], 套: ['本', '首', '件', '張'], 首: ['套', '本', '條', '張'], 份: ['本', '件', '張', '套'],
  位: ['隻', '條', '張', '間'], 棵: ['枝', '條', '座', '隻'], 頂: ['件', '隻', '個', '張'], 封: ['本', '張', '首', '件'],
  盞: ['枝', '架', '個', '部'], 副: ['隻', '套', '件', '條'], 幅: ['張', '本', '塊', '套'], 度: ['隻', '張', '條', '間'],
  層: ['間', '座', '個'], 陣: ['條', '架', '嚿', '塊'], 嚿: ['塊', '粒', '個', '張'], 種: ['個', '隻', '件'], 場: ['套', '首', '件'],
  朵: ['枝', '棵', '粒', '塊'], 餐: ['碗', '碟', '件'],
}

/** Topics whose 個 nouns are concrete enough to count in a picture (people, food, places, objects). */
const COUNTABLE_TOPICS = new Set(['family', 'relationships', 'jobs', 'food', 'shopping', 'house', 'city', 'nature', 'transport', 'travel', 'clothing', 'furniture', 'animals', 'tech'])

const isFood = (v: VocabEntry) => v.topic === 'food' || CUP_DRINKS.has(v.lemma)

/** The measure word the game expects for a noun: its `cl` (drinks without one: 杯), or undefined when the noun is not played. */
export function classifierOf(v: VocabEntry): string | undefined {
  if (v.pos !== 'noun' || !v.jp || SKIP.has(v.lemma)) return undefined
  const cl = v.cl ?? (CUP_DRINKS.has(v.lemma) ? '杯' : undefined)
  if (!cl || cl === v.lemma || !CLASSIFIERS[cl]) return undefined
  // 個 counts abstract nouns too (個號, 個問題); the counter scene wants things you can picture
  if (cl === '個' && !NOUN_EMOJI[v.lemma] && !COUNTABLE_TOPICS.has(v.topic ?? '')) return undefined
  return cl
}

/** Every classifier a speaker would accept with this noun (its own first). */
export function acceptableClassifiers(v: VocabEntry): Set<string> {
  const cl = classifierOf(v)
  const ok = new Set<string>(cl ? [cl] : [])
  for (const c of ALSO_OK[v.lemma] ?? []) ok.add(c)
  for (const c of (cl && ALSO_OK_FOR[cl]) || []) ok.add(c)
  if (v.topic === 'body') ok.add('個')
  for (const group of SAME_JOB) if (cl && group.includes(cl)) for (const c of group) ok.add(c)
  return ok
}

/** Could `c` be offered as a wrong option for noun `v`? */
export function isWrongFor(c: string, v: VocabEntry): boolean {
  if (!CLASSIFIERS[c] || NEVER_WRONG.has(c)) return false
  if (acceptableClassifiers(v).has(c)) return false
  if (isFood(v) && FOOD_COUNTERS.has(c)) return false
  return true
}

/**
 * Three wrong options for a noun: the classifiers it is usually confused with first, then any other
 * that clearly does not fit. With `met` (the classifiers of the learner's finished words, see
 * metClassifiers) only those are offered when there are enough; the rest fill in when not.
 */
export function distractorClassifiers(v: VocabEntry, rng: Rng, n = 3, met?: ReadonlySet<string>): string[] {
  const cl = classifierOf(v)
  if (!cl) return []
  const near = rng.shuffle((CONFUSED_WITH[cl] ?? []).filter((c) => isWrongFor(c, v)))
  const far = rng.shuffle(Object.keys(CLASSIFIERS).filter((c) => !near.includes(c) && isWrongFor(c, v)))
  // mostly near misses, but always one from further away so the round is not all hair-splitting
  const choose = (nearer: string[], further: string[]) => {
    const picked = [...nearer.slice(0, n - 1)]
    for (const c of [...further, ...nearer.slice(n - 1)]) {
      if (picked.length >= n) break
      if (!picked.includes(c)) picked.push(c)
    }
    return picked.slice(0, n)
  }
  if (!met) return choose(near, far)
  const picked = choose(near.filter((c) => met.has(c)), far.filter((c) => met.has(c)))
  for (const c of [...near, ...far]) {
    if (picked.length >= n) break
    if (!picked.includes(c)) picked.push(c)
  }
  return picked
}

/** The classifiers the learner has met: those of their (finished) nouns, and classifiers that are words of theirs. */
export function metClassifiers(words: Iterable<VocabEntry>): Set<string> {
  const met = new Set<string>()
  for (const v of words) {
    const cl = classifierOf(v)
    if (cl) met.add(cl)
    if (CLASSIFIERS[v.lemma]) met.add(v.lemma)
  }
  return met
}

/** Numbers 1–10 as said before a measure word: 兩 (loeng5), not 二, for two. */
export const COUNT_WORDS: readonly { n: number; ch: string; jp: string; en: string }[] = [
  { n: 1, ch: '一', jp: 'jat1', en: 'one' },
  { n: 2, ch: '兩', jp: 'loeng5', en: 'two' },
  { n: 3, ch: '三', jp: 'saam1', en: 'three' },
  { n: 4, ch: '四', jp: 'sei3', en: 'four' },
  { n: 5, ch: '五', jp: 'ng5', en: 'five' },
  { n: 6, ch: '六', jp: 'luk6', en: 'six' },
  { n: 7, ch: '七', jp: 'cat1', en: 'seven' },
  { n: 8, ch: '八', jp: 'baat3', en: 'eight' },
  { n: 9, ch: '九', jp: 'gau2', en: 'nine' },
  { n: 10, ch: '十', jp: 'sap6', en: 'ten' },
]

export interface MeasureQuestion {
  noun: VocabEntry
  /** The right classifier (the noun's `cl`). */
  cl: string
  count: (typeof COUNT_WORDS)[number]
  /** Four classifiers, shuffled. */
  options: string[]
  answer: number
  /** 三隻狗 */
  phrase: string
  /** saam1 zek3 gau2 */
  phraseJp: string
}

export function measureQuestion(noun: VocabEntry, rng: Rng, count = rng.pick(COUNT_WORDS), met?: ReadonlySet<string>): MeasureQuestion | undefined {
  const cl = classifierOf(noun)
  if (!cl) return undefined
  const wrong = distractorClassifiers(noun, rng, 3, met)
  if (wrong.length < 3) return undefined
  const options = rng.shuffle([cl, ...wrong])
  return { noun, cl, count, options, answer: options.indexOf(cl), phrase: `${count.ch}${cl}${noun.lemma}`, phraseJp: `${count.jp} ${CLASSIFIERS[cl]!.jp} ${noun.jp}` }
}

/**
 * Nouns for a round: the learner's own nouns with a classifier first (due and weak ones), topped
 * up from `pool` (the games pass the rest of the finished nouns). At most `perClassifier` share an answer (個 at most 3), so the round shows
 * many shapes, and no two nouns share a gloss.
 */
export function pickMeasureNouns(learner: VocabEntry[], pool: VocabEntry[], rng: Rng, n = 12, perClassifier = 2): VocabEntry[] {
  const out: VocabEntry[] = []
  const per = new Map<string, number>()
  const seen = new Set<string>()
  const cap = (cl: string) => (cl === '個' ? 3 : perClassifier)
  const take = (list: VocabEntry[]) => {
    for (const v of list) {
      if (out.length >= n) return
      const cl = classifierOf(v)
      const gloss = v.en[0]?.toLowerCase() ?? v.id
      if (!cl || seen.has(v.lemma) || seen.has(gloss) || (per.get(cl) ?? 0) >= cap(cl)) continue
      if (distractorClassifiers(v, rng, 3).length < 3) continue
      out.push(v)
      seen.add(v.lemma)
      seen.add(gloss)
      per.set(cl, (per.get(cl) ?? 0) + 1)
    }
  }
  take(rng.shuffle(learner))
  // top up preferring classifiers the round has not shown yet
  const rest = rng.shuffle(pool)
  take(rest.filter((v) => classifierOf(v) !== '個' && !per.has(classifierOf(v) ?? '')))
  take(rest)
  return rng.shuffle(out)
}

export function measureRound(learner: VocabEntry[], pool: VocabEntry[], rng: Rng, n = 12, met?: ReadonlySet<string>): MeasureQuestion[] {
  return pickMeasureNouns(learner, pool, rng, n)
    .map((v) => measureQuestion(v, rng, undefined, met))
    .filter((q): q is MeasureQuestion => Boolean(q))
}

export interface SortBoard {
  /** The classifier baskets. */
  bins: string[]
  /** Nouns to drop into them, shuffled; each fits exactly one basket. */
  nouns: VocabEntry[]
}

/**
 * The bonus round: `bins` classifiers (not 個) with `per` nouns each, every noun fitting its
 * own basket and none of the others. Prefers nouns from `prefer` (the round just played).
 */
export function sortBoard(prefer: VocabEntry[], pool: VocabEntry[], rng: Rng, bins = 3, per = 2): SortBoard | undefined {
  const all = [...rng.shuffle(prefer), ...rng.shuffle(pool)]
  const byCl = new Map<string, VocabEntry[]>()
  const seen = new Set<string>()
  for (const v of all) {
    const cl = classifierOf(v)
    // 個 and the catch-all classifiers (份, 種…) would fit too many nouns to make a fair basket
    if (!cl || cl === '個' || NEVER_WRONG.has(cl) || seen.has(v.lemma)) continue
    seen.add(v.lemma)
    byCl.set(cl, [...(byCl.get(cl) ?? []), v])
  }
  // classifiers from the round first, in the order they came up
  const order = [...byCl.keys()].filter((cl) => byCl.get(cl)!.length >= per)
  /** Nouns of basket `cl` that fit none of the other baskets in `set`. */
  const fitting = (cl: string, set: string[]) => byCl.get(cl)!.filter((v) => set.every((other) => other === cl || isWrongFor(other, v)))
  let chosen: string[] = []
  for (const cl of order) {
    if (chosen.length >= bins) break
    // two baskets that can stand in for each other (部/架) would make the sort ambiguous
    if (chosen.some((c) => SAME_JOB.some((g) => g.includes(c) && g.includes(cl)))) continue
    const next = [...chosen, cl]
    if (next.every((c) => fitting(c, next).length >= per)) chosen = next
  }
  if (chosen.length < bins) return undefined
  const nouns = chosen.flatMap((cl) => fitting(cl, chosen).slice(0, per))
  return { bins: rng.shuffle(chosen), nouns: rng.shuffle(nouns) }
}

/** Points for a sorting-round noun dropped in the right basket at the first try. */
export const SORT_POINTS = 15

/** A picture for nouns where one is obvious (counter scenes show it once per item). */
export const NOUN_EMOJI: Record<string, string> = {
  狗: '🐕', 狗仔: '🐶', 狗狗: '🐶', 貓: '🐈', 貓仔: '🐱', 雀: '🐦', 馬: '🐎', 雞: '🐔', 雞蛋: '🥚', 蛋: '🥚', 蝦: '🦐', 匙羹: '🥄',
  叉: '🍴', 船: '⛵', 小輪: '⛴️', 手錶: '⌚', 牛: '🐄', 豬: '🐖', 老虎: '🐅', 猴子: '🐒', 熊貓: '🐼', 龍蝦: '🦞', 蟹: '🦀', 眼: '👁️',
  耳仔: '👂', 牙: '🦷', 手: '✋', 腳: '🦶', 菇: '🍄', 窗: '🪟', 魚: '🐟', 金魚: '🐠', 香蕉: '🍌', 褲: '👖', 牛仔褲: '👖', 裙: '👗',
  頸巾: '🧣', 蛇: '🐍', 鎖匙: '🔑', 書: '📖', 簿: '📓', 雜誌: '📰', 報紙: '🗞️', 護照: '🛂', 紙: '📄', 椅: '🪑', 床: '🛏️', 地圖: '🗺️',
  飛: '🎫', 機票: '🎫', 戲飛: '🎟️', 信用卡: '💳', 卡: '💳', 八達通: '💳', 紙巾: '🧻', 飛機: '✈️', 車: '🚗', 巴士: '🚌', 小巴: '🚐',
  的士: '🚕', 電車: '🚋', 叮叮: '🚋', 纜車: '🚡', 火車: '🚆', 單車: '🚲', 過山車: '🎢', 救護車: '🚑', 手機: '📱', 電話: '☎️',
  電腦: '💻', 電視: '📺', 鋼琴: '🎹', 相機: '📷', 屋: '🏠', 公司: '🏢', 銀行: '🏦', 學校: '🏫', 醫院: '🏥', 酒店: '🏨', 郵局: '🏤',
  便利店: '🏪', 超市: '🛒', 戲院: '🎦', 大廈: '🏢', 高樓: '🏙️', 山: '⛰️', 衫: '👕', 恤衫: '👔', 褸: '🧥', 外套: '🧥', 行李: '🧳',
  壽司: '🍣', 三文治: '🥪', 樹: '🌳', 白菜: '🥬', 鞋: '👞', 波鞋: '👟', 襪: '🧦', 筷子: '🥢', 眼睛: '👀', 帽: '🧢', 糖: '🍬',
  藥: '💊', 朱古力: '🍫', 提子: '🍇', 士多啤梨: '🍓', 粥: '🥣', 麵: '🍜', 雲吞麵: '🍜', 湯: '🍲', 炒飯: '🍛', 意粉: '🍝',
  歌: '🎵', 電影: '🎬', 雲: '☁️', 風: '🌬️', 薄餅: '🍕', 牛扒: '🥩', 多士: '🍞', 筆: '🖊️', 鉛筆: '✏️', 花: '🌸', 荷花: '🪷',
  信: '✉️', 電郵: '📧', 燈: '💡', 眼鏡: '👓', 畫: '🖼️', 雪糕: '🍨', 門: '🚪', 大門: '🚪', 蘋果: '🍎', 橙: '🍊', 西瓜: '🍉',
  芒果: '🥭', 蕃茄: '🍅', 薯仔: '🥔', 蛋糕: '🍰', 漢堡包: '🍔', 麵包: '🍞', 袋: '👜', 銀包: '👛', 鬧鐘: '⏰', 月亮: '🌙',
  茶: '🍵', 咖啡: '☕', 奶茶: '🧋', 啤酒: '🍺', 果汁: '🧃', 酒: '🍷', 奶: '🥛', 水: '🥛', 刀: '🔪', 遮: '☂️', 枱: '🍽️', 相: '🖼️',
  蛋撻: '🥧', 叉燒包: '🥟', 包: '🥟', 餃子: '🥟', 燒賣: '🥟', 蝦餃: '🥟', 雲吞: '🥟', 自助餐: '🍽️',
  人: '🧍', 學生: '🧑‍🎓', 老師: '🧑‍🏫', 醫生: '🧑‍⚕️', 護士: '🧑‍⚕️', 警察: '👮', 廚師: '🧑‍🍳', 男仔: '👦', 女仔: '👧', 細路: '🧒',
  爸爸: '👨', 媽媽: '👩', 爺爺: '👴', 嫲嫲: '👵', 公公: '👴', 婆婆: '👵', 朋友: '🧑', 海灘: '🏖️', 沙灘: '🏖️', 喼: '🧳', 鐘: '🕰️',
}
