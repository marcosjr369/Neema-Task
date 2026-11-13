import { colIndex, colName, parseKey, quoteTab } from './refs'

/**
 * Fórmulas das planilhas. Aceita os nomes em português e em inglês (=SOMA(A1:A3) ou =SUM(A1:A3)),
 * argumentos separados por ";" ou "," e decimais com ponto dentro das fórmulas.
 * Nas células, os números escrevem-se com vírgula ou ponto ("1,5" ou "1.5").
 */

/* ─── Valores ─────────────────────────────────────────────────────────── */

export class CellError {
  constructor(public code: string) {}
}

export type Val = number | string | boolean | null | CellError

const err = (code: string) => new CellError(code)
const isErr = (v: unknown): v is CellError => v instanceof CellError

const NUMBER = /^[+-]?(\d+([.,]\d+)?|[.,]\d+)([eE][+-]?\d+)?$/

/** O que se escreveu numa célula (sem "="): número, percentagem ou texto. "'123" fica texto. */
export function literal(raw: string): Val {
  const t = raw.trim()
  if (t === '') return null
  if (raw.startsWith("'")) return raw.slice(1)
  if (NUMBER.test(t)) return Number(t.replace(',', '.'))
  if (t.endsWith('%') && NUMBER.test(t.slice(0, -1).trim())) return Number(t.slice(0, -1).trim().replace(',', '.')) / 100
  return raw
}

export const isFormula = (raw: string | undefined): raw is string => !!raw && raw.length > 1 && raw.startsWith('=')

function toNum(v: Val): number | CellError {
  if (v === null) return 0
  if (typeof v === 'number') return v
  if (typeof v === 'boolean') return v ? 1 : 0
  if (isErr(v)) return v
  const l = literal(v)
  return typeof l === 'number' ? l : err('#VALOR!')
}

const TRUE_WORDS = ['TRUE', 'VERDADEIRO']
const FALSE_WORDS = ['FALSE', 'FALSO']

function toBool(v: Val): boolean | CellError {
  if (v === null) return false
  if (typeof v === 'boolean') return v
  if (typeof v === 'number') return v !== 0
  if (isErr(v)) return v
  const u = v.trim().toUpperCase()
  if (TRUE_WORDS.includes(u)) return true
  if (FALSE_WORDS.includes(u)) return false
  return err('#VALOR!')
}

function toStr(v: Val): string {
  if (v === null) return ''
  if (typeof v === 'boolean') return v ? 'VERDADEIRO' : 'FALSO'
  if (typeof v === 'number') return String(v).replace('.', ',')
  if (isErr(v)) return v.code
  return v
}

/* ─── Símbolos ────────────────────────────────────────────────────────── */

export type RefTok = { type: 'ref'; sheet?: string; col: number; row: number; absC: boolean; absR: boolean; start: number; end: number }
type Tok =
  | RefTok
  | { type: 'num'; value: number; start: number; end: number }
  | { type: 'str'; value: string; start: number; end: number }
  | { type: 'ident'; value: string; start: number; end: number }
  | { type: 'err'; value: string; start: number; end: number }
  | { type: 'op'; value: string; start: number; end: number }
  | { type: 'lp' | 'rp' | 'colon' | 'sep'; start: number; end: number }

class SyntaxErr extends Error {}

const REF = /^(\$?)([A-Za-z]{1,3})(\$?)(\d{1,5})$/

/** Com ";" a separar argumentos (Excel em português), a vírgula entre dígitos é decimal: =ARRED(2,5;0) */
function usesSemicolons(src: string) {
  let quote: string | null = null
  for (const ch of src) {
    if (quote) { if (ch === quote) quote = null }
    else if (ch === '"' || ch === "'") quote = ch
    else if (ch === ';') return true
  }
  return false
}

function tokenize(src: string, offset = 0): Tok[] {
  const out: Tok[] = []
  const numberRe = usesSemicolons(src) ? /^(\d+([.,]\d+)?|\.\d+)([eE][+-]?\d+)?/ : /^(\d+(\.\d+)?|\.\d+)([eE][+-]?\d+)?/
  let i = 0
  const at = (n = 0) => src[i + n]
  while (i < src.length) {
    const ch = at()
    const start = i + offset
    if (/\s/.test(ch)) { i++; continue }
    let m: RegExpExecArray | null
    if ((m = numberRe.exec(src.slice(i)))) {
      i += m[0].length
      out.push({ type: 'num', value: Number(m[0].replace(',', '.')), start, end: i + offset })
      continue
    }
    if (ch === '"') {
      let s = ''
      i++
      for (;;) {
        if (i >= src.length) throw new SyntaxErr('texto sem fim')
        if (at() === '"') {
          if (at(1) === '"') { s += '"'; i += 2; continue }
          i++
          break
        }
        s += at()
        i++
      }
      out.push({ type: 'str', value: s, start, end: i + offset })
      continue
    }
    if ((m = /^#[A-Za-zÀ-ÿ0-9/]+[!?]?/.exec(src.slice(i)))) {
      i += m[0].length
      out.push({ type: 'err', value: m[0].toUpperCase(), start, end: i + offset })
      continue
    }
    // nome de folha antes de "!": 'Folha 2'!A1 ou Folha2!A1
    let sheet: string | undefined
    if (ch === "'") {
      let s = ''
      let j = i + 1
      for (;;) {
        if (j >= src.length) throw new SyntaxErr('nome de folha sem fim')
        if (src[j] === "'") {
          if (src[j + 1] === "'") { s += "'"; j += 2; continue }
          j++
          break
        }
        s += src[j]
        j++
      }
      if (src[j] !== '!') throw new SyntaxErr('falta "!" depois do nome da folha')
      sheet = s
      i = j + 1
    }
    if ((m = /^[A-Za-zÀ-ÿ_$][\wÀ-ÿ.$]*/.exec(src.slice(i)))) {
      let word = m[0]
      if (!sheet && src[i + word.length] === '!') {
        sheet = word
        i += word.length + 1
        m = /^[A-Za-z$][A-Za-z0-9$]*/.exec(src.slice(i))
        if (!m) throw new SyntaxErr('referência inválida')
        word = m[0]
      }
      const r = REF.exec(word)
      if (r && src[i + word.length] !== '(') {
        i += word.length
        const col = colIndex(r[2])
        const row = Number(r[4]) - 1
        if (row < 0) throw new SyntaxErr('referência inválida')
        out.push({ type: 'ref', sheet, col, row, absC: !!r[1], absR: !!r[3], start, end: i + offset })
        continue
      }
      if (sheet) throw new SyntaxErr('referência inválida')
      i += word.length
      out.push({ type: 'ident', value: word, start, end: i + offset })
      continue
    }
    const two = src.slice(i, i + 2)
    if (two === '<=' || two === '>=' || two === '<>') {
      i += 2
      out.push({ type: 'op', value: two, start, end: i + offset })
      continue
    }
    i++
    if ('+-*/^&=<>%'.includes(ch)) out.push({ type: 'op', value: ch, start, end: i + offset })
    else if (ch === '(') out.push({ type: 'lp', start, end: i + offset })
    else if (ch === ')') out.push({ type: 'rp', start, end: i + offset })
    else if (ch === ':') out.push({ type: 'colon', start, end: i + offset })
    else if (ch === ';' || ch === ',') out.push({ type: 'sep', start, end: i + offset })
    else throw new SyntaxErr(`símbolo inesperado "${ch}"`)
  }
  return out
}

/* ─── Árvore ──────────────────────────────────────────────────────────── */

type Ref = { sheet?: string; col: number; row: number; absC: boolean; absR: boolean }
export type Node =
  | { t: 'num'; v: number }
  | { t: 'str'; v: string }
  | { t: 'bool'; v: boolean }
  | { t: 'err'; v: string }
  | { t: 'empty' }
  | { t: 'ref'; ref: Ref }
  | { t: 'range'; a: Ref; b: Ref }
  | { t: 'fn'; name: string; args: Node[] }
  | { t: 'bin'; op: string; l: Node; r: Node }
  | { t: 'un'; op: string; e: Node }
  | { t: 'pct'; e: Node }
  | { t: 'paren'; e: Node }

const plain = (n: string) => n.toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '')

/** Nome interno (o do Excel em inglês) de cada função, a partir dos nomes aceites */
const FN_ALIASES: Record<string, string[]> = {
  SUM: ['SOMA'],
  AVERAGE: ['MEDIA'],
  MIN: [],
  MAX: [],
  COUNT: ['CONTAR'],
  COUNTA: ['CONTAR.VAL'],
  IF: ['SE'],
  IFERROR: ['SE.ERRO'],
  ROUND: ['ARRED'],
  ABS: [],
  CONCAT: ['CONCATENAR', 'CONCATENATE'],
  AND: ['E'],
  OR: ['OU'],
  NOT: ['NAO'],
  SUMIF: ['SOMA.SE'],
  COUNTIF: ['CONTAR.SE'],
  UPPER: ['MAIUSCULAS'],
  LOWER: ['MINUSCULAS'],
  LEN: ['NUM.CARACT'],
}
const FN_NAME = new Map<string, string>()
for (const [en, pt] of Object.entries(FN_ALIASES)) for (const n of [en, ...pt]) FN_NAME.set(n, en)

/** Funções mostradas na ajuda, com o nome em português */
export const FUNCTION_HELP = [
  ['SOMA(A1:A10)', 'soma os valores'],
  ['MÉDIA(A1:A10)', 'média'],
  ['MIN / MAX(A1:A10)', 'menor / maior valor'],
  ['CONTAR(A1:A10)', 'quantos números'],
  ['CONTAR.VAL(A1:A10)', 'quantas células preenchidas'],
  ['SE(A1>10; "sim"; "não")', 'condição'],
  ['SOMA.SE(A1:A10; ">5")', 'soma o que cumpre a condição'],
  ['CONTAR.SE(A1:A10; "pago")', 'conta o que cumpre a condição'],
  ['ARRED(A1; 2)', 'arredonda'],
  ['CONCATENAR(A1; " "; B1)', 'junta textos (também A1&B1)'],
  ['SE.ERRO(A1/B1; 0)', 'valor alternativo se der erro'],
  ['E / OU / NÃO', 'lógica'],
] as const

function parseTokens(toks: Tok[]): Node {
  let p = 0
  const peek = () => toks[p]
  const isOp = (...ops: string[]) => peek()?.type === 'op' && ops.includes((peek() as { value: string }).value)
  const take = () => toks[p++]

  const refOf = (t: RefTok): Ref => ({ sheet: t.sheet, col: t.col, row: t.row, absC: t.absC, absR: t.absR })

  function primary(): Node {
    const t = take()
    if (!t) throw new SyntaxErr('fórmula incompleta')
    switch (t.type) {
      case 'num': return { t: 'num', v: t.value }
      case 'str': return { t: 'str', v: t.value }
      case 'err': return { t: 'err', v: t.value }
      case 'ref': {
        if (peek()?.type === 'colon') {
          take()
          const b = take()
          if (b?.type !== 'ref') throw new SyntaxErr('intervalo inválido')
          return { t: 'range', a: refOf(t), b: { ...refOf(b), sheet: b.sheet ?? t.sheet } }
        }
        return { t: 'ref', ref: refOf(t) }
      }
      case 'lp': {
        const e = expr()
        if (take()?.type !== 'rp') throw new SyntaxErr('falta ")"')
        return { t: 'paren', e }
      }
      case 'ident': {
        const name = plain(t.value)
        if (peek()?.type === 'lp') {
          take()
          const args: Node[] = []
          if (peek()?.type === 'rp') take()
          else {
            for (;;) {
              args.push(peek()?.type === 'sep' || peek()?.type === 'rp' ? { t: 'empty' } : expr())
              const n = take()
              if (n?.type === 'rp') break
              if (n?.type !== 'sep') throw new SyntaxErr('falta ")"')
            }
          }
          return { t: 'fn', name: FN_NAME.get(name) ?? name, args }
        }
        if (TRUE_WORDS.includes(name)) return { t: 'bool', v: true }
        if (FALSE_WORDS.includes(name)) return { t: 'bool', v: false }
        return { t: 'err', v: '#NOME?' }
      }
      default:
        throw new SyntaxErr('fórmula inválida')
    }
  }
  function postfix(): Node {
    let e = primary()
    while (isOp('%')) { take(); e = { t: 'pct', e } }
    return e
  }
  function unary(): Node {
    if (isOp('+', '-')) {
      const op = (take() as { value: string }).value
      return { t: 'un', op, e: unary() }
    }
    return postfix()
  }
  const level = (next: () => Node, ops: string[]) => (): Node => {
    let l = next()
    while (isOp(...ops)) {
      const op = (take() as { value: string }).value
      l = { t: 'bin', op, l, r: next() }
    }
    return l
  }
  const pow = level(unary, ['^'])
  const mul = level(pow, ['*', '/'])
  const add = level(mul, ['+', '-'])
  const cat = level(add, ['&'])
  const cmp = level(cat, ['=', '<>', '<', '>', '<=', '>='])
  function expr(): Node { return cmp() }

  const root = expr()
  if (p < toks.length) throw new SyntaxErr('fórmula inválida')
  return root
}

const PARSED = new Map<string, Node | SyntaxErr>()

/** Árvore da fórmula (com cache); erro de sintaxe vira SyntaxErr */
export function parseFormula(raw: string): Node | SyntaxErr {
  let n = PARSED.get(raw)
  if (n) return n
  try {
    n = parseTokens(tokenize(raw.slice(1)))
  } catch (e) {
    n = e instanceof SyntaxErr ? e : new SyntaxErr('fórmula inválida')
  }
  if (PARSED.size > 5000) PARSED.clear()
  PARSED.set(raw, n)
  return n
}

/* ─── Cálculo ─────────────────────────────────────────────────────────── */

type TabLike = { id: string; name: string; rows: number; cols: number; cells: Record<string, string> }

const MAX_RANGE = 200_000

function matcher(crit: Val): (v: Val) => boolean {
  if (typeof crit === 'number') return v => typeof v === 'number' ? v === crit : (typeof v === 'string' && literal(v) === crit)
  if (typeof crit === 'boolean') return v => v === crit
  const s = toStr(crit)
  const m = /^(<=|>=|<>|=|<|>)?([\s\S]*)$/.exec(s)!
  const op = m[1] ?? '='
  const target = literal(m[2])
  return v => {
    if (isErr(v)) return false
    if (typeof target === 'number') {
      const n = typeof v === 'number' ? v : typeof v === 'string' ? literal(v) : null
      if (typeof n !== 'number') return op === '<>'
      switch (op) {
        case '<': return n < target
        case '>': return n > target
        case '<=': return n <= target
        case '>=': return n >= target
        case '<>': return n !== target
        default: return n === target
      }
    }
    const a = toStr(v).toLowerCase()
    const b = toStr(target).toLowerCase()
    if (op === '<>') return a !== b
    if (op === '=') return a === b
    return op === '<' ? a < b : op === '>' ? a > b : op === '<=' ? a <= b : a >= b
  }
}

function compare(a: Val, b: Val): number {
  // vazio vale 0 com números e "" com texto
  if (a === null) a = typeof b === 'string' ? '' : typeof b === 'boolean' ? false : 0
  if (b === null) b = typeof a === 'string' ? '' : typeof a === 'boolean' ? false : 0
  const rank = (v: Val) => (typeof v === 'number' ? 0 : typeof v === 'string' ? 1 : 2)
  if (rank(a) !== rank(b)) return rank(a) - rank(b)
  if (typeof a === 'string') return a.toLowerCase().localeCompare((b as string).toLowerCase())
  return Number(a) - Number(b)
}

const finite = (n: number): number | CellError => (Number.isFinite(n) ? n : err('#NÚM!'))

export class Calc {
  private cache = new Map<string, Val>()
  private visiting = new Set<string>()
  private byId = new Map<string, TabLike>()
  private byName = new Map<string, TabLike>()

  constructor(tabs: TabLike[]) {
    for (const t of tabs) {
      this.byId.set(t.id, t)
      this.byName.set(t.name.toLowerCase(), t)
    }
  }

  /** Valor calculado de uma célula */
  value(tabId: string, key: string): Val {
    const k = `${tabId}!${key}`
    if (this.cache.has(k)) return this.cache.get(k)!
    const tab = this.byId.get(tabId)
    const raw = tab?.cells[key]
    if (!tab || raw === undefined || raw === '') return null
    if (!isFormula(raw)) {
      const v = literal(raw)
      this.cache.set(k, v)
      return v
    }
    if (this.visiting.has(k)) return err('#CIRC!')
    this.visiting.add(k)
    const node = parseFormula(raw)
    let v: Val
    try {
      v = node instanceof SyntaxErr ? err('#ERRO!') : this.scalar(node, tab)
    } catch {
      v = err('#ERRO!')
    }
    this.visiting.delete(k)
    // uma referência a uma célula vazia mostra 0, como no Excel
    if (v === null) v = 0
    this.cache.set(k, v)
    return v
  }

  private tabOf(ref: Ref, here: TabLike) {
    return ref.sheet === undefined ? here : this.byName.get(ref.sheet.toLowerCase())
  }

  private cell(ref: Ref, here: TabLike): Val {
    const tab = this.tabOf(ref, here)
    if (!tab) return err('#REF!')
    return this.value(tab.id, `${colName(ref.col)}${ref.row + 1}`)
  }

  private range(a: Ref, b: Ref, here: TabLike): Val[] | CellError {
    const tab = this.tabOf(a, here)
    if (!tab) return err('#REF!')
    const r1 = Math.min(a.row, b.row)
    const r2 = Math.min(Math.max(a.row, b.row), tab.rows - 1)
    const c1 = Math.min(a.col, b.col)
    const c2 = Math.min(Math.max(a.col, b.col), tab.cols - 1)
    if ((r2 - r1 + 1) * (c2 - c1 + 1) > MAX_RANGE) return err('#NÚM!')
    const out: Val[] = []
    for (let r = r1; r <= r2; r++) for (let c = c1; c <= c2; c++) out.push(this.value(tab.id, `${colName(c)}${r + 1}`))
    return out
  }

  /** Valores de um argumento: intervalo → lista; resto → um valor */
  private values(n: Node, here: TabLike): { list: Val[]; fromRange: boolean } | CellError {
    if (n.t === 'range') {
      const r = this.range(n.a, n.b, here)
      return isErr(r) ? r : { list: r, fromRange: true }
    }
    return { list: [this.scalar(n, here)], fromRange: false }
  }

  /** Números dos argumentos: nos intervalos ignora texto e vazios; valores soltos são convertidos */
  private numbers(args: Node[], here: TabLike): number[] | CellError {
    const out: number[] = []
    for (const a of args) {
      if (a.t === 'empty') continue
      const vs = this.values(a, here)
      if (isErr(vs)) return vs
      for (const v of vs.list) {
        if (isErr(v)) return v
        if (vs.fromRange) { if (typeof v === 'number') out.push(v) }
        else {
          const n = toNum(v)
          if (isErr(n)) return n
          out.push(n)
        }
      }
    }
    return out
  }

  private scalar(n: Node, here: TabLike): Val {
    switch (n.t) {
      case 'num': return n.v
      case 'str': return n.v
      case 'bool': return n.v
      case 'err': return err(n.v)
      case 'empty': return null
      case 'paren': return this.scalar(n.e, here)
      case 'ref': return this.cell(n.ref, here)
      case 'range': {
        // intervalo fora de uma função: só serve se for uma célula
        if (n.a.row === n.b.row && n.a.col === n.b.col) return this.cell(n.a, here)
        return err('#VALOR!')
      }
      case 'pct': {
        const v = toNum(this.scalar(n.e, here))
        return isErr(v) ? v : v / 100
      }
      case 'un': {
        const v = toNum(this.scalar(n.e, here))
        return isErr(v) ? v : n.op === '-' ? -v : v
      }
      case 'bin': {
        const l = this.scalar(n.l, here)
        const r = this.scalar(n.r, here)
        if (isErr(l)) return l
        if (isErr(r)) return r
        if (n.op === '&') return toStr(l) + toStr(r)
        if (['=', '<>', '<', '>', '<=', '>='].includes(n.op)) {
          const c = compare(l, r)
          return n.op === '=' ? c === 0 : n.op === '<>' ? c !== 0 : n.op === '<' ? c < 0 : n.op === '>' ? c > 0 : n.op === '<=' ? c <= 0 : c >= 0
        }
        const a = toNum(l)
        const b = toNum(r)
        if (isErr(a)) return a
        if (isErr(b)) return b
        switch (n.op) {
          case '+': return finite(a + b)
          case '-': return finite(a - b)
          case '*': return finite(a * b)
          case '/': return b === 0 ? err('#DIV/0!') : finite(a / b)
          case '^': return finite(a ** b)
        }
        return err('#ERRO!')
      }
      case 'fn': return this.call(n.name, n.args, here)
    }
  }

  private call(name: string, args: Node[], here: TabLike): Val {
    const nums = () => this.numbers(args, here)
    const arg = (i: number) => (args[i] ? this.scalar(args[i], here) : null)
    switch (name) {
      case 'SUM': { const v = nums(); return isErr(v) ? v : finite(v.reduce((a, b) => a + b, 0)) }
      case 'AVERAGE': { const v = nums(); return isErr(v) ? v : v.length ? finite(v.reduce((a, b) => a + b, 0) / v.length) : err('#DIV/0!') }
      case 'MIN': { const v = nums(); return isErr(v) ? v : v.length ? Math.min(...v) : 0 }
      case 'MAX': { const v = nums(); return isErr(v) ? v : v.length ? Math.max(...v) : 0 }
      case 'COUNT':
      case 'COUNTA': {
        let count = 0
        for (const a of args) {
          if (a.t === 'empty') continue
          const vs = this.values(a, here)
          if (isErr(vs)) continue
          for (const v of vs.list) {
            if (name === 'COUNTA' ? v !== null && v !== '' : typeof v === 'number' || (!vs.fromRange && typeof toNum(v) === 'number')) count++
          }
        }
        return count
      }
      case 'IF': {
        const c = toBool(arg(0))
        if (isErr(c)) return c
        const v = c ? arg(1) : args.length > 2 ? arg(2) : false
        return v === null ? 0 : v
      }
      case 'IFERROR': {
        const v = arg(0)
        return isErr(v) ? arg(1) : v
      }
      case 'ROUND': {
        const n = toNum(arg(0))
        const d = toNum(arg(1))
        if (isErr(n)) return n
        if (isErr(d)) return d
        const f = 10 ** Math.trunc(d)
        return finite(Math.sign(n) * Math.round(Math.abs(n) * f + 1e-9) / f)
      }
      case 'ABS': { const n = toNum(arg(0)); return isErr(n) ? n : Math.abs(n) }
      case 'CONCAT': {
        let s = ''
        for (const a of args) {
          const vs = this.values(a, here)
          if (isErr(vs)) return vs
          for (const v of vs.list) { if (isErr(v)) return v; s += toStr(v) }
        }
        return s
      }
      case 'AND':
      case 'OR': {
        const bools: boolean[] = []
        for (const a of args) {
          const vs = this.values(a, here)
          if (isErr(vs)) return vs
          for (const v of vs.list) {
            if (vs.fromRange && (v === null || typeof v === 'string')) continue
            const b = toBool(v)
            if (isErr(b)) return b
            bools.push(b)
          }
        }
        if (!bools.length) return err('#VALOR!')
        return name === 'AND' ? bools.every(Boolean) : bools.some(Boolean)
      }
      case 'NOT': { const b = toBool(arg(0)); return isErr(b) ? b : !b }
      case 'SUMIF':
      case 'COUNTIF': {
        const range = args[0]
        if (range?.t !== 'range' && range?.t !== 'ref') return err('#VALOR!')
        const vs = this.values(range, here)
        if (isErr(vs)) return vs
        const test = matcher(arg(1))
        if (name === 'COUNTIF') return vs.list.filter(test).length
        let sumList = vs.list
        if (args[2]) {
          const s = this.values(args[2], here)
          if (isErr(s)) return s
          sumList = s.list
        }
        let total = 0
        vs.list.forEach((v, i) => { const x = sumList[i]; if (test(v) && typeof x === 'number') total += x })
        return finite(total)
      }
      case 'UPPER': { const v = arg(0); return isErr(v) ? v : toStr(v).toUpperCase() }
      case 'LOWER': { const v = arg(0); return isErr(v) ? v : toStr(v).toLowerCase() }
      case 'LEN': { const v = arg(0); return isErr(v) ? v : toStr(v).length }
      default: return err('#NOME?')
    }
  }
}

/* ─── Reescrever referências (inserir/apagar linhas, renomear folhas) ─── */

export type RefUnit = { a: RefTok; b?: RefTok }

/** Texto de uma referência, mudando o que for indicado (mantém os "$") */
export function refText(t: Pick<RefTok, 'col' | 'row' | 'absC' | 'absR'>, sheet?: string) {
  return `${sheet !== undefined ? `${quoteTab(sheet)}!` : ''}${t.absC ? '$' : ''}${colName(t.col)}${t.absR ? '$' : ''}${t.row + 1}`
}

/**
 * Passa cada referência (ou intervalo A1:B2) da fórmula por "fn"; se devolver texto, substitui-a.
 * Fórmulas com erros de sintaxe ficam como estão.
 */
export function rewriteRefs(raw: string, fn: (u: RefUnit) => string | undefined): string {
  if (!isFormula(raw)) return raw
  let toks: Tok[]
  try {
    toks = tokenize(raw.slice(1), 1)
  } catch {
    return raw
  }
  let out = ''
  let last = 0
  for (let i = 0; i < toks.length; i++) {
    const t = toks[i]
    if (t.type !== 'ref') continue
    let unit: RefUnit = { a: t }
    let end = t.end
    const b = toks[i + 2]
    if (toks[i + 1]?.type === 'colon' && b?.type === 'ref') {
      unit = { a: t, b }
      end = b.end
      i += 2
    }
    const rep = fn(unit)
    if (rep === undefined) continue
    out += raw.slice(last, t.start) + rep
    last = end
  }
  return last === 0 ? raw : out + raw.slice(last)
}

/* ─── Exportar para o Excel (nomes em inglês, separador ",") ─────────── */

function printRef(r: Ref, withSheet: boolean) {
  return refText(r, withSheet ? r.sheet : undefined)
}

function print(n: Node): string {
  switch (n.t) {
    case 'num': return String(n.v)
    case 'str': return `"${n.v.replace(/"/g, '""')}"`
    case 'bool': return n.v ? 'TRUE' : 'FALSE'
    case 'err': return n.v === '#NOME?' ? '#NAME?' : n.v === '#VALOR!' ? '#VALUE!' : n.v === '#NÚM!' ? '#NUM!' : n.v
    case 'empty': return ''
    case 'ref': return printRef(n.ref, true)
    case 'range': return `${printRef(n.a, true)}:${printRef(n.b, false)}`
    case 'fn': return `${n.name}(${n.args.map(print).join(',')})`
    case 'bin': return `${print(n.l)}${n.op}${print(n.r)}`
    case 'un': return `${n.op}${print(n.e)}`
    case 'pct': return `${print(n.e)}%`
    case 'paren': return `(${print(n.e)})`
  }
}

/** Fórmula no formato que o Excel guarda nos ficheiros (sem "="), ou null se for inválida */
export function toExcelFormula(raw: string): string | null {
  const n = parseFormula(raw)
  return n instanceof SyntaxErr ? null : print(n)
}

/* ─── Mostrar valores ─────────────────────────────────────────────────── */

const NUM = new Intl.NumberFormat('pt-PT', { maximumFractionDigits: 10, useGrouping: false })
const NUM2 = new Intl.NumberFormat('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const EUR = new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' })
const PCT = new Intl.NumberFormat('pt-PT', { style: 'percent', maximumFractionDigits: 2 })

export function display(v: Val, nf?: 'num2' | 'eur' | 'pct'): string {
  if (v === null) return ''
  if (isErr(v)) return v.code
  if (typeof v === 'boolean') return v ? 'VERDADEIRO' : 'FALSO'
  if (typeof v === 'number') {
    if (nf === 'eur') return EUR.format(v)
    if (nf === 'pct') return PCT.format(v)
    if (nf === 'num2') return NUM2.format(v)
    return Math.abs(v) >= 1e15 || (v !== 0 && Math.abs(v) < 1e-9) ? v.toExponential(4).replace('.', ',') : NUM.format(v)
  }
  return v
}

export const isError = isErr

/** Ajuda: chave A1 válida */
export const validKey = (k: string) => !!parseKey(k)
