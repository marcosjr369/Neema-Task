import type { GameId, GameStats } from '../types'

/**
 * Minijogos para descontrair entre blocos de foco. Aqui fica só a lógica (sem ecrã), usada
 * pelos componentes em components/games e pelo servidor (validar e guardar recordes).
 */

/** número de pares do jogo de memória (grelha 4×4) */
export const PAIRS = 8

export type GameRule = {
  id: GameId
  /** 'high': mais é melhor (acertos); 'low': menos é melhor (jogadas, tempo); 'time': só conta quanto durou */
  better: 'high' | 'low' | 'time'
  /** limites aceites pelo servidor (um resultado fora disto não é real) */
  min: number
  max: number
  /** [singular, plural]; 'clock' mostra o tempo como 4:05 */
  unit: [string, string] | 'clock'
}

export const GAME_RULES: Record<GameId, GameRule> = {
  respirar: { id: 'respirar', better: 'time', min: 10, max: 30 * 60, unit: 'clock' },
  pares: { id: 'pares', better: 'low', min: PAIRS, max: 500, unit: ['jogada', 'jogadas'] },
  contas: { id: 'contas', better: 'high', min: 0, max: 300, unit: ['certa', 'certas'] },
  cores: { id: 'cores', better: 'high', min: 0, max: 300, unit: ['certa', 'certas'] },
  galo: { id: 'galo', better: 'high', min: 0, max: 1000, unit: ['vitória seguida', 'vitórias seguidas'] },
  forca: { id: 'forca', better: 'high', min: 0, max: 1000, unit: ['palavra seguida', 'palavras seguidas'] },
  sudoku: { id: 'sudoku', better: 'low', min: 20, max: 4 * 60 * 60, unit: 'clock' },
  deslizar: { id: 'deslizar', better: 'low', min: 1, max: 5000, unit: ['jogada', 'jogadas'] },
}

/** "12 certas", "1 jogada", "4:05" */
export function formatScore(id: GameId, score: number) {
  const unit = GAME_RULES[id].unit
  if (unit === 'clock') return `${Math.floor(score / 60)}:${String(score % 60).padStart(2, '0')}`
  return `${score} ${score === 1 ? unit[0] : unit[1]}`
}

export const GAME_IDS = Object.keys(GAME_RULES) as GameId[]
export const isGameId = (v: unknown): v is GameId => typeof v === 'string' && v in GAME_RULES

/** Duração das rondas com tempo (segundos) */
export const MATH_SECONDS = 60
export const COLORS_SECONDS = 45

export function isBetter(id: GameId, score: number, best: number | undefined) {
  if (best === undefined) return true
  const rule = GAME_RULES[id]
  return rule.better === 'low' ? score < best : score > best
}

/** Junta um resultado novo às estatísticas (recorde, vezes jogadas) */
export function recordScore(prev: GameStats | undefined, id: GameId, score: number, now = Date.now()): GameStats {
  const best = prev && !isBetter(id, score, prev.best) ? prev.best : score
  return { best, plays: (prev?.plays ?? 0) + 1, lastAt: now }
}

/** Um resultado que o servidor aceita: número inteiro dentro dos limites do jogo */
export function validScore(id: GameId, score: unknown): score is number {
  const rule = GAME_RULES[id]
  return typeof score === 'number' && Number.isInteger(score) && score >= rule.min && score <= rule.max
}

/* ─── Aleatório (com semente nos testes) ──────────────────────────────── */

export type Rand = () => number

/** Gerador com semente: os testes repetem sempre o mesmo jogo */
export function seeded(seed: number): Rand {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function shuffle<T>(items: T[], rand: Rand = Math.random): T[] {
  const out = [...items]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

const int = (rand: Rand, min: number, max: number) => min + Math.floor(rand() * (max - min + 1))

/* ─── Pares (memória) ─────────────────────────────────────────────────── */

export type PairCard = { id: number; face: number }

/** Baralho de pares baralhado: cada face aparece duas vezes */
export function pairsDeck(rand: Rand = Math.random, pairs = PAIRS): PairCard[] {
  const faces = Array.from({ length: pairs }, (_, f) => [f, f]).flat()
  return shuffle(faces, rand).map((face, id) => ({ id, face }))
}

/** Estrelas no fim: perfeito são `pairs` jogadas (cada par à primeira) */
export function pairsStars(moves: number, pairs = PAIRS) {
  if (moves <= pairs * 1.5) return 3
  if (moves <= pairs * 2.25) return 2
  return 1
}

/* ─── Contas rápidas ──────────────────────────────────────────────────── */

export type MathQuestion = { text: string; answer: number; options: number[] }

/** Nível a partir dos acertos seguidos: começa fácil e vai apertando */
export const mathLevel = (streak: number) => Math.min(3, Math.floor(streak / 4))

export function mathQuestion(level: number, rand: Rand = Math.random): MathQuestion {
  let a: number, b: number, op: '+' | '−' | '×' | '÷'
  const pick = level >= 3 ? int(rand, 0, 3) : level === 2 ? int(rand, 0, 2) : level === 1 ? int(rand, 0, 1) : 0
  if (pick === 0) {
    const top = [10, 30, 60, 99][level] ?? 99
    a = int(rand, 1, top); b = int(rand, 1, top); op = '+'
  } else if (pick === 1) {
    const top = [10, 30, 60, 99][level] ?? 99
    a = int(rand, 2, top); b = int(rand, 1, a); op = '−'
  } else if (pick === 2) {
    a = int(rand, 2, level >= 3 ? 12 : 9); b = int(rand, 2, 9); op = '×'
  } else {
    b = int(rand, 2, 9); a = b * int(rand, 2, 9); op = '÷'
  }
  const answer = op === '+' ? a + b : op === '−' ? a - b : op === '×' ? a * b : a / b
  return { text: `${a} ${op} ${b}`, answer, options: mathOptions(answer, rand) }
}

/** A resposta certa e 3 erradas parecidas (perto da certa, nunca negativas nem repetidas) */
export function mathOptions(answer: number, rand: Rand = Math.random): number[] {
  const near = [1, 2, 3, 10, -1, -2, -3, -10].map(d => answer + d).filter(n => n >= 0)
  const wrong = shuffle([...new Set(near)], rand).slice(0, 3)
  for (let n = answer + 4; wrong.length < 3; n++) if (!wrong.includes(n)) wrong.push(n)
  return shuffle([answer, ...wrong], rand)
}

/* ─── Cores (atenção) ─────────────────────────────────────────────────── */

export const COLOR_NAMES = ['Vermelho', 'Azul', 'Verde', 'Roxo'] as const
export const COLOR_HEX = ['#E5484D', '#3B6EF5', '#12A150', '#8E4EC6'] as const

export type ColorRound = { word: number; ink: number }

/**
 * Uma ronda: o nome de uma cor escrito noutra cor. Na maioria das vezes não batem certo
 * (é aí que o cérebro trabalha); de vez em quando batem, para não dar para adivinhar.
 */
export function colorRound(rand: Rand = Math.random, prev?: ColorRound): ColorRound {
  for (;;) {
    const word = int(rand, 0, COLOR_NAMES.length - 1)
    const same = rand() < 0.25
    const ink = same ? word : (word + int(rand, 1, COLOR_NAMES.length - 1)) % COLOR_NAMES.length
    if (!prev || prev.word !== word || prev.ink !== ink) return { word, ink }
  }
}

/* ─── Respirar ────────────────────────────────────────────────────────── */

/** Respiração calma: inspirar 4 s, segurar 4 s, expirar 6 s (14 s por ciclo) */
export const BREATH = [
  { label: 'Inspira', seconds: 4, scale: 1 },
  { label: 'Segura', seconds: 4, scale: 1 },
  { label: 'Expira', seconds: 6, scale: 0.55 },
] as const
export const BREATH_CYCLE = BREATH.reduce((s, p) => s + p.seconds, 0)

/** Em que fase da respiração estamos ao fim de `elapsed` segundos */
export function breathAt(elapsed: number) {
  let t = ((elapsed % BREATH_CYCLE) + BREATH_CYCLE) % BREATH_CYCLE
  for (let i = 0; i < BREATH.length; i++) {
    if (t < BREATH[i].seconds) return { index: i, phase: BREATH[i], left: Math.ceil(BREATH[i].seconds - t) }
    t -= BREATH[i].seconds
  }
  return { index: 0, phase: BREATH[0], left: BREATH[0].seconds }
}

/* ─── Sugestão de pausa ───────────────────────────────────────────────── */

/** A partir de quanto foco no dia a app sugere uma pausa com um jogo */
export const SUGGEST_AFTER_SECONDS = 90 * 60

/**
 * Qual jogo sugerir: muito tempo de foco pede descanso (respirar); senão, um jogo diferente
 * por dia, para variar.
 */
export function suggestedGame(todaySeconds: number, now = Date.now()): GameId {
  if (todaySeconds >= 3 * 60 * 60) return 'respirar'
  const day = Math.floor(now / 86_400_000)
  // jogos curtos (o sudoku e o deslizar demoram mais do que uma pausa)
  const brain: GameId[] = ['pares', 'contas', 'cores', 'galo', 'forca']
  return brain[day % brain.length]
}

/* ─── Jogo do Galo ────────────────────────────────────────────────────── */

export type Mark = 'X' | 'O'
export type GaloBoard = (Mark | null)[]
export const GALO_LINES = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]]

/** Quem ganhou (e a linha), empate, ou ainda a decorrer (null) */
export function galoResult(b: GaloBoard): { winner: Mark | 'draw'; line?: number[] } | null {
  for (const line of GALO_LINES) {
    const [a, c, d] = line
    if (b[a] && b[a] === b[c] && b[a] === b[d]) return { winner: b[a]!, line }
  }
  return b.every(Boolean) ? { winner: 'draw' } : null
}

const other = (m: Mark): Mark => (m === 'X' ? 'O' : 'X')
const empties = (b: GaloBoard) => b.map((v, i) => (v ? -1 : i)).filter(i => i >= 0)

/** Jogada que fecha uma linha para `m` (ganhar ou, para o outro, bloquear) */
function closing(b: GaloBoard, m: Mark) {
  for (const i of empties(b)) {
    const t = [...b]; t[i] = m
    if (galoResult(t)?.winner === m) return i
  }
  return -1
}

function minimax(b: GaloBoard, turn: Mark, me: Mark, depth: number): number {
  const r = galoResult(b)
  if (r) return r.winner === 'draw' ? 0 : r.winner === me ? 10 - depth : depth - 10
  const scores = empties(b).map(i => { const t = [...b]; t[i] = turn; return minimax(t, other(turn), me, depth + 1) })
  return turn === me ? Math.max(...scores) : Math.min(...scores)
}

/**
 * A jogada da Udacha. Difícil: perfeita (nunca perde). Fácil: ganha quando vê, bloqueia metade
 * das vezes e de resto joga ao acaso (dá para ganhar e continua a ter graça).
 */
export function galoMove(b: GaloBoard, me: Mark, level: 'facil' | 'dificil', rand: Rand = Math.random): number {
  const free = empties(b)
  if (!free.length) return -1
  if (level === 'facil') {
    const win = closing(b, me)
    if (win >= 0 && rand() < 0.9) return win
    const block = closing(b, other(me))
    if (block >= 0 && rand() < 0.5) return block
    return free[Math.floor(rand() * free.length)]
  }
  // primeira jogada: centro ou canto (poupa a busca toda)
  if (free.length >= 8) return b[4] ? [0, 2, 6, 8][Math.floor(rand() * 4)] : 4
  let best = -Infinity
  let moves: number[] = []
  for (const i of free) {
    const t = [...b]; t[i] = me
    const s = minimax(t, other(me), me, 1)
    if (s > best) { best = s; moves = [i] } else if (s === best) moves.push(i)
  }
  return moves[Math.floor(rand() * moves.length)]
}

/* ─── Forca ───────────────────────────────────────────────────────────── */

export const FORCA_ERRORS = 6

/** Palavras do dia a dia (com a pista da categoria) */
export const FORCA_WORDS: { word: string; hint: string }[] = [
  ...['ANANÁS', 'BANANA', 'LARANJA', 'MORANGO', 'MELANCIA', 'LIMÃO', 'CEREJA', 'PÊSSEGO', 'TANGERINA', 'FRAMBOESA'].map(word => ({ word, hint: 'Fruta' })),
  ...['GIRAFA', 'ELEFANTE', 'GOLFINHO', 'TARTARUGA', 'BORBOLETA', 'PINGUIM', 'CORUJA', 'ESQUILO', 'CAMALEÃO', 'LEÃO'].map(word => ({ word, hint: 'Animal' })),
  ...['LISBOA', 'PORTO', 'LUANDA', 'MAPUTO', 'BRASÍLIA', 'COIMBRA', 'BRAGA', 'PRAIA', 'MADRID', 'PARIS'].map(word => ({ word, hint: 'Cidade' })),
  ...['VIOLINO', 'GUITARRA', 'PIANO', 'TAMBOR', 'TROMPETE', 'FLAUTA', 'ACORDEÃO', 'SAXOFONE'].map(word => ({ word, hint: 'Instrumento' })),
  ...['CADERNO', 'AGENDA', 'TECLADO', 'CALENDÁRIO', 'REUNIÃO', 'PROJETO', 'RELATÓRIO', 'CAFÉ', 'ESCRITÓRIO', 'EQUIPA'].map(word => ({ word, hint: 'Trabalho' })),
  ...['FUTEBOL', 'NATAÇÃO', 'CICLISMO', 'XADREZ', 'BASQUETEBOL', 'ATLETISMO', 'SURF', 'IOGA'].map(word => ({ word, hint: 'Desporto' })),
  ...['MONTANHA', 'OCEANO', 'FLORESTA', 'CASCATA', 'DESERTO', 'VULCÃO', 'ARCO-ÍRIS', 'ILHA'].map(word => ({ word, hint: 'Natureza' })),
]

/** Sem acentos nem cedilha: "Ç" e "Ã" contam como "C" e "A" */
export const plainLetter = (ch: string) => ch.normalize('NFD').replace(/[\u0300-\u036f]/g, '')

export function forcaPick(rand: Rand = Math.random, last?: string) {
  for (;;) {
    const w = FORCA_WORDS[Math.floor(rand() * FORCA_WORDS.length)]
    if (w.word !== last) return w
  }
}

/** As letras a adivinhar (sem repetir), já sem acentos */
export const forcaLetters = (word: string) => new Set([...word].map(plainLetter).filter(ch => /[A-Z]/.test(ch)))

/** A palavra como se vê: letras descobertas, "_" nas outras; hífens e espaços sempre à vista */
export function forcaShown(word: string, guessed: Set<string>) {
  return [...word].map(ch => (/[A-ZÀ-Ü]/i.test(ch) && !guessed.has(plainLetter(ch)) ? null : ch))
}

export function forcaState(word: string, guessed: Set<string>) {
  const letters = forcaLetters(word)
  const errors = [...guessed].filter(g => !letters.has(g)).length
  const won = [...letters].every(l => guessed.has(l))
  return { errors, won, lost: !won && errors >= FORCA_ERRORS }
}

/* ─── Sudoku ──────────────────────────────────────────────────────────── */

/** Grelha resolvida aleatória: um padrão válido baralhado (linhas, colunas, blocos e números) */
export function sudokuSolution(rand: Rand = Math.random): number[] {
  const groups = () => shuffle([0, 1, 2], rand).flatMap(g => shuffle([0, 1, 2], rand).map(i => g * 3 + i))
  const rows = groups()
  const cols = groups()
  const digits = shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9], rand)
  const pattern = (r: number, c: number) => (3 * (r % 3) + Math.floor(r / 3) + c) % 9
  return rows.flatMap(r => cols.map(c => digits[pattern(r, c)]))
}

const peersOf = Array.from({ length: 81 }, (_, i) => {
  const r = Math.floor(i / 9), c = i % 9, br = r - (r % 3), bc = c - (c % 3)
  const set = new Set<number>()
  for (let k = 0; k < 9; k++) { set.add(r * 9 + k); set.add(k * 9 + c); set.add((br + Math.floor(k / 3)) * 9 + bc + (k % 3)) }
  set.delete(i)
  return [...set]
})

/** Quantas soluções tem a grelha (pára em `limit`): 1 = puzzle justo */
export function sudokuCount(grid: number[], limit = 2): number {
  const g = [...grid]
  let count = 0
  const solve = (): boolean => {
    let best = -1, bestOptions: number[] = []
    for (let i = 0; i < 81; i++) {
      if (g[i]) continue
      const used = new Set(peersOf[i].map(p => g[p]))
      const options = [1, 2, 3, 4, 5, 6, 7, 8, 9].filter(d => !used.has(d))
      if (!options.length) return false
      if (best < 0 || options.length < bestOptions.length) { best = i; bestOptions = options }
      if (options.length === 1) break
    }
    if (best < 0) { count++; return count >= limit }
    for (const d of bestOptions) {
      g[best] = d
      if (solve()) return true
    }
    g[best] = 0
    return false
  }
  solve()
  return count
}

export const SUDOKU_LEVELS = { facil: 38, medio: 48 } as const
export type SudokuLevel = keyof typeof SUDOKU_LEVELS

/** Puzzle com solução única: tira números enquanto a solução continuar a ser só uma */
export function sudokuPuzzle(level: SudokuLevel, rand: Rand = Math.random) {
  const solution = sudokuSolution(rand)
  const puzzle = [...solution]
  let removed = 0
  for (const i of shuffle(Array.from({ length: 81 }, (_, k) => k), rand)) {
    if (removed >= SUDOKU_LEVELS[level]) break
    const keep = puzzle[i]
    puzzle[i] = 0
    if (sudokuCount(puzzle) !== 1) puzzle[i] = keep
    else removed++
  }
  return { puzzle, solution }
}

/** Casas em conflito (o mesmo número na linha, coluna ou bloco) */
export function sudokuConflicts(grid: number[]) {
  const bad = new Set<number>()
  grid.forEach((v, i) => { if (v && peersOf[i].some(p => grid[p] === v)) bad.add(i) })
  return bad
}

export const sudokuPeers = (i: number) => peersOf[i]

/* ─── Deslizar (puzzle de 15) ─────────────────────────────────────────── */

export const SLIDE_SIZE = 4
/** 1..15 por ordem e o espaço (0) no fim */
export const slideSolved = (n = SLIDE_SIZE) => [...Array.from({ length: n * n - 1 }, (_, i) => i + 1), 0]

const neighbours = (i: number, n: number) => {
  const r = Math.floor(i / n), c = i % n
  return [r > 0 ? i - n : -1, r < n - 1 ? i + n : -1, c > 0 ? i - 1 : -1, c < n - 1 ? i + 1 : -1].filter(x => x >= 0)
}

/**
 * Baralha andando ao acaso a partir da solução (por isso tem sempre solução), sem desfazer o
 * passo anterior, e garante que não fica já resolvido.
 */
export function slideScramble(n = SLIDE_SIZE, steps = 120, rand: Rand = Math.random): number[] {
  for (;;) {
    const t = slideSolved(n)
    let empty = t.length - 1, prev = -1
    for (let s = 0; s < steps; s++) {
      const options = neighbours(empty, n).filter(x => x !== prev)
      const next = options[Math.floor(rand() * options.length)]
      ;[t[empty], t[next]] = [t[next], t[empty]]
      prev = empty
      empty = next
    }
    if (!slideDone(t)) return t
  }
}

/**
 * Tocar numa peça na mesma linha ou coluna do espaço empurra todas as peças entre as duas
 * (uma jogada). Devolve a grelha nova, ou null se a peça não se pode mexer.
 */
export function slideMove(tiles: number[], index: number, n = SLIDE_SIZE): number[] | null {
  const empty = tiles.indexOf(0)
  if (index === empty) return null
  const er = Math.floor(empty / n), ec = empty % n, r = Math.floor(index / n), c = index % n
  if (er !== r && ec !== c) return null
  const step = er === r ? (c > ec ? 1 : -1) : (r > er ? n : -n)
  const t = [...tiles]
  for (let at = empty; at !== index; at += step) t[at] = t[at + step]
  t[index] = 0
  return t
}

export const slideDone = (tiles: number[]) => tiles.every((v, i) => v === (i === tiles.length - 1 ? 0 : i + 1))

/* ─── Tempo a jogar (relatórios da empresa) ───────────────────────────── */

/** Uma visita conta a partir de 5 s e no máximo 2 h (separador esquecido aberto não conta tudo) */
export const PLAY_MIN_SECONDS = 5
export const PLAY_MAX_SECONDS = 2 * 60 * 60
/** Visitas ao mesmo jogo com menos de 2 min de intervalo juntam-se numa só */
export const PLAY_MERGE_GAP = 2 * 60 * 1000

export type PlayTotals = {
  seconds: number
  sessions: number
  lastAt: number
  /** segundos por jogo */
  games: Partial<Record<GameId, number>>
}

/** Soma o tempo por pessoa (memberId) e por jogo */
export function playTotals(plays: { memberId?: string; game: GameId; seconds: number; end: number }[]) {
  const byMember = new Map<string, PlayTotals>()
  const byGame: Partial<Record<GameId, number>> = {}
  for (const p of plays) {
    if (!p.memberId) continue
    const t = byMember.get(p.memberId) ?? { seconds: 0, sessions: 0, lastAt: 0, games: {} }
    t.seconds += p.seconds
    t.sessions++
    t.lastAt = Math.max(t.lastAt, p.end)
    t.games[p.game] = (t.games[p.game] ?? 0) + p.seconds
    byMember.set(p.memberId, t)
    byGame[p.game] = (byGame[p.game] ?? 0) + p.seconds
  }
  return { byMember, byGame }
}

/** Jogos de uma pessoa, do mais jogado para o menos */
export const topGames = (games: Partial<Record<GameId, number>>) =>
  (Object.entries(games) as [GameId, number][]).filter(([, s]) => s > 0).sort((a, b) => b[1] - a[1])
