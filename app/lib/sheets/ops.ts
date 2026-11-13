import type { CellAlign, CellFmt, NumberFormat, Sheet, SheetTab, SheetView } from '../../types'
import { refText, rewriteRefs, type RefTok, type RefUnit } from './formula'
import { DEFAULT_COLS, DEFAULT_ROWS, MAX_COLS, MAX_ROWS, cellKey, parseKey, type Range } from './refs'

/**
 * Operações sobre uma planilha. Correm no browser (actualização imediata) e no servidor (que valida e grava).
 */

export const FILL_COLORS = ['#FDE4E5', '#FFEDE0', '#FFF4D6', '#DCF7F3', '#E0F6FD', '#E6EDFF', '#EEEAFF', '#FDE6F2', '#F1F0F6']

export const SHEET_LIMITS = {
  tabs: 20,
  cells: 100_000,
  value: 5000,
  perOp: 50_000,
  format: 60_000,
  title: 80,
  tabName: 40,
}

export class SheetOpError extends Error {}
const bad = (m: string): never => { throw new SheetOpError(m) }

export type FmtPatch = { b?: boolean | null; i?: boolean | null; align?: CellAlign | null; bg?: string | null; nf?: NumberFormat | null }
type Axis = 'rows' | 'cols'

export type SheetOp =
  | { type: 'sheet.update'; title: string }
  | { type: 'cells.set'; tabId: string; cells: Record<string, string> }
  | { type: 'format.set'; tabId: string; range: Range; fmt: FmtPatch }
  | { type: 'format.clear'; tabId: string; range: Range }
  | { type: 'rows.insert' | 'rows.delete' | 'cols.insert' | 'cols.delete'; tabId: string; at: number; count: number }
  | { type: 'size.add'; tabId: string; rows?: number; cols?: number }
  | { type: 'col.width'; tabId: string; col: number; width: number }
  | { type: 'tab.add'; id?: string; name?: string }
  | { type: 'tab.import'; id?: string; name: string; rows: number; cols: number; cells: Record<string, string>; fmt?: Record<string, CellFmt>; widths?: Record<string, number> }
  | { type: 'tab.rename'; tabId: string; name: string }
  | { type: 'tab.delete'; tabId: string }
  | { type: 'tab.move'; tabId: string; index: number }

export type SheetCtx = { now: number; newId: () => string }
type AnySheet = Sheet | SheetView

const SAFE_ID = /^[A-Za-z0-9_-]{8,64}$/
const ALIGNS: CellAlign[] = ['left', 'center', 'right']
const FORMATS: NumberFormat[] = ['num2', 'eur', 'pct']

const tabOf = (s: AnySheet, id: string) => s.tabs.find(t => t.id === id) ?? bad('Folha não encontrada')
const int = (v: unknown, min: number, max: number) => Math.max(min, Math.min(max, Math.floor(Number(v) || 0)))

export function cleanTabName(s: AnySheet, raw: unknown, except?: string) {
  const name = (typeof raw === 'string' ? raw : '').replace(/[[\]:*?/\\]/g, '').trim().slice(0, SHEET_LIMITS.tabName)
  if (!name) bad('Indica o nome da folha')
  if (s.tabs.some(t => t.id !== except && t.name.toLowerCase() === name.toLowerCase())) bad(`Já existe uma folha "${name}"`)
  return name
}

function freeName(s: AnySheet, base: string) {
  const clean = base.replace(/[[\]:*?/\\]/g, '').trim().slice(0, SHEET_LIMITS.tabName - 4) || 'Folha'
  let name = clean
  for (let i = 2; s.tabs.some(t => t.name.toLowerCase() === name.toLowerCase()); i++) name = `${clean} (${i})`
  return name
}

function countCells(s: AnySheet) {
  return s.tabs.reduce((n, t) => n + Object.keys(t.cells).length, 0)
}

function checkCells(s: AnySheet) {
  if (countCells(s) > SHEET_LIMITS.cells) bad(`Uma planilha tem no máximo ${SHEET_LIMITS.cells.toLocaleString('pt-PT')} células preenchidas`)
}

function cleanValue(v: unknown) {
  if (typeof v !== 'string' && typeof v !== 'number') bad('Valor inválido')
  return String(v).slice(0, SHEET_LIMITS.value)
}

function cleanFmt(f: CellFmt | undefined): CellFmt | undefined {
  if (!f || typeof f !== 'object') return undefined
  const out: CellFmt = {}
  if (f.b) out.b = true
  if (f.i) out.i = true
  if (f.align && ALIGNS.includes(f.align)) out.align = f.align
  if (f.bg && FILL_COLORS.includes(f.bg)) out.bg = f.bg
  if (f.nf && FORMATS.includes(f.nf)) out.nf = f.nf
  return Object.keys(out).length ? out : undefined
}

/** Valida uma folha vinda de fora (importação ou criação) */
export function cleanTab(input: Partial<SheetTab>, id: string, name: string): SheetTab {
  const cells: Record<string, string> = {}
  const fmt: Record<string, CellFmt> = {}
  let rows = input.rows ? int(input.rows, 1, MAX_ROWS) : DEFAULT_ROWS
  let cols = input.cols ? int(input.cols, 1, MAX_COLS) : DEFAULT_COLS
  const entries = Object.entries(input.cells ?? {})
  if (entries.length > SHEET_LIMITS.cells) bad('A folha tem células a mais')
  for (const [k, v] of entries) {
    const p = parseKey(k)
    if (!p || p.r >= MAX_ROWS || p.c >= MAX_COLS) continue
    const value = cleanValue(v)
    if (value === '') continue
    cells[k] = value
    rows = Math.max(rows, p.r + 1)
    cols = Math.max(cols, p.c + 1)
  }
  for (const [k, f] of Object.entries(input.fmt ?? {})) {
    const p = parseKey(k)
    const clean = p && p.r < MAX_ROWS && p.c < MAX_COLS ? cleanFmt(f) : undefined
    if (clean) fmt[k] = clean
  }
  const widths: Record<string, number> = {}
  for (const [k, w] of Object.entries(input.widths ?? {})) {
    const c = Number(k)
    if (Number.isInteger(c) && c >= 0 && c < MAX_COLS) widths[c] = int(w, 40, 600)
  }
  return { id, name, rows, cols, cells, fmt, widths }
}

export const newTab = (id: string, name = 'Folha 1'): SheetTab => ({ id, name, rows: DEFAULT_ROWS, cols: DEFAULT_COLS, cells: {} })

/* ─── Inserir / apagar linhas e colunas ───────────────────────────────── */

/** Novo índice de uma linha/coluna depois da mudança (null = foi apagada) */
const mapper = (at: number, n: number) => (i: number): number | null => {
  if (n > 0) return i >= at ? i + n : i
  const count = -n
  if (i < at) return i
  return i >= at + count ? i - count : null
}

function remapKeys<T>(obj: Record<string, T> | undefined, axis: Axis, map: (i: number) => number | null) {
  if (!obj) return obj
  const out: Record<string, T> = {}
  for (const [k, v] of Object.entries(obj)) {
    const p = parseKey(k)
    if (!p) continue
    const i = map(axis === 'rows' ? p.r : p.c)
    if (i === null) continue
    out[axis === 'rows' ? cellKey(i, p.c) : cellKey(p.r, i)] = v
  }
  return out
}

/** Muda as referências de todas as fórmulas que apontam para a folha alterada */
function shiftFormulas(s: AnySheet, target: SheetTab, axis: Axis, at: number, n: number) {
  const map = mapper(at, n)
  const idx = (t: RefTok) => (axis === 'rows' ? t.row : t.col)
  const withIdx = (t: RefTok, i: number) => (axis === 'rows' ? { ...t, row: i } : { ...t, col: i })
  for (const tab of s.tabs) {
    const points = (u: RefUnit) => (u.a.sheet === undefined ? tab.id === target.id : u.a.sheet.toLowerCase() === target.name.toLowerCase())
    for (const [k, raw] of Object.entries(tab.cells)) {
      const next = rewriteRefs(raw, u => {
        if (!points(u)) return undefined
        if (!u.b) {
          const i = map(idx(u.a))
          if (i === null) return '#REF!'
          return i === idx(u.a) ? undefined : refText(withIdx(u.a, i), u.a.sheet)
        }
        // intervalo: as pontas apagadas encolhem para dentro; se desaparecer todo, #REF!
        const aLow = idx(u.a) <= idx(u.b)
        const lo = aLow ? u.a : u.b
        const hi = aLow ? u.b : u.a
        let loI = map(idx(lo))
        let hiI = map(idx(hi))
        if (n < 0) {
          if (loI === null) loI = at
          if (hiI === null) hiI = at - 1
          if (loI > hiI) return '#REF!'
        }
        if (loI === idx(lo) && hiI === idx(hi)) return undefined
        const a2 = withIdx(u.a, aLow ? loI! : hiI!)
        const b2 = withIdx(u.b, aLow ? hiI! : loI!)
        return `${refText(a2, u.a.sheet)}:${refText(b2, u.b.sheet)}`
      })
      if (next !== raw) tab.cells[k] = next
    }
  }
}

function insertOrDelete(s: AnySheet, op: Extract<SheetOp, { at: number }>) {
  const tab = tabOf(s, op.tabId)
  const axis: Axis = op.type.startsWith('rows') ? 'rows' : 'cols'
  const size = axis === 'rows' ? tab.rows : tab.cols
  const max = axis === 'rows' ? MAX_ROWS : MAX_COLS
  const at = int(op.at, 0, size)
  const count = int(op.count, 1, max)
  const insert = op.type.endsWith('insert')
  if (insert && size + count > max) bad(`Uma folha tem no máximo ${max} ${axis === 'rows' ? 'linhas' : 'colunas'}`)
  if (!insert && at >= size) bad('Fora da folha')
  if (!insert && count >= size) bad(`A folha tem de ficar com pelo menos uma ${axis === 'rows' ? 'linha' : 'coluna'}`)
  const n = insert ? count : -Math.min(count, size - at)
  const map = mapper(at, n)
  tab.cells = remapKeys(tab.cells, axis, map)!
  tab.fmt = remapKeys(tab.fmt, axis, map)
  if (axis === 'cols' && tab.widths) {
    const widths: Record<string, number> = {}
    for (const [k, w] of Object.entries(tab.widths)) {
      const i = map(Number(k))
      if (i !== null) widths[i] = w
    }
    tab.widths = widths
  }
  shiftFormulas(s, tab, axis, at, n)
  if (axis === 'rows') tab.rows = size + n
  else tab.cols = size + n
}

/* ─── Aplicar ─────────────────────────────────────────────────────────── */

export function applySheetOp(s: AnySheet, op: SheetOp, ctx: SheetCtx): void {
  if (!op || typeof op !== 'object') bad('Pedido inválido')
  switch (op.type) {
    case 'sheet.update': {
      const t = typeof op.title === 'string' ? op.title.trim().slice(0, SHEET_LIMITS.title) : ''
      s.title = t || bad('Indica o nome da planilha')
      break
    }
    case 'cells.set': {
      const tab = tabOf(s, op.tabId)
      const entries = Object.entries(op.cells ?? {})
      if (entries.length > SHEET_LIMITS.perOp) bad('Demasiadas células de uma vez')
      for (const [k, v] of entries) {
        const p = parseKey(k) ?? bad('Célula inválida')
        if (p.r >= MAX_ROWS || p.c >= MAX_COLS) bad('Fora dos limites da folha')
        const value = cleanValue(v)
        if (value === '') delete tab.cells[k]
        else {
          tab.cells[k] = value
          tab.rows = Math.max(tab.rows, p.r + 1)
          tab.cols = Math.max(tab.cols, p.c + 1)
        }
      }
      checkCells(s)
      break
    }
    case 'format.set':
    case 'format.clear': {
      const tab = tabOf(s, op.tabId)
      const g = op.range ?? bad('Selecção inválida')
      const r1 = int(g.r1, 0, MAX_ROWS - 1), r2 = int(g.r2, 0, MAX_ROWS - 1)
      const c1 = int(g.c1, 0, MAX_COLS - 1), c2 = int(g.c2, 0, MAX_COLS - 1)
      if (r2 < r1 || c2 < c1) bad('Selecção inválida')
      if ((r2 - r1 + 1) * (c2 - c1 + 1) > SHEET_LIMITS.format) bad('Selecção demasiado grande para formatar')
      const patch = op.type === 'format.set' ? op.fmt ?? bad('Formato inválido') : null
      if (patch) {
        if (patch.align != null && !ALIGNS.includes(patch.align)) bad('Alinhamento inválido')
        if (patch.bg != null && !FILL_COLORS.includes(patch.bg)) bad('Cor inválida')
        if (patch.nf != null && !FORMATS.includes(patch.nf)) bad('Formato de número inválido')
      }
      tab.fmt ??= {}
      for (let r = r1; r <= r2; r++) {
        for (let c = c1; c <= c2; c++) {
          const k = cellKey(r, c)
          if (!patch) { delete tab.fmt[k]; continue }
          const f: CellFmt = { ...tab.fmt[k] }
          for (const key of ['b', 'i', 'align', 'bg', 'nf'] as const) {
            const v = patch[key]
            if (v === undefined) continue
            if (v === null || v === false) delete f[key]
            else (f as Record<string, unknown>)[key] = v
          }
          if (Object.keys(f).length) tab.fmt[k] = f
          else delete tab.fmt[k]
        }
      }
      break
    }
    case 'rows.insert':
    case 'rows.delete':
    case 'cols.insert':
    case 'cols.delete':
      insertOrDelete(s, op)
      break
    case 'size.add': {
      const tab = tabOf(s, op.tabId)
      if (op.rows) tab.rows = int(tab.rows + int(op.rows, 0, MAX_ROWS), 1, MAX_ROWS)
      if (op.cols) tab.cols = int(tab.cols + int(op.cols, 0, MAX_COLS), 1, MAX_COLS)
      break
    }
    case 'col.width': {
      const tab = tabOf(s, op.tabId)
      const col = int(op.col, 0, MAX_COLS - 1)
      tab.widths = { ...tab.widths, [col]: int(op.width, 40, 600) }
      break
    }
    case 'tab.add': {
      if (s.tabs.length >= SHEET_LIMITS.tabs) bad(`Uma planilha tem no máximo ${SHEET_LIMITS.tabs} folhas`)
      const id = op.id && SAFE_ID.test(op.id) && !s.tabs.some(t => t.id === op.id) ? op.id : ctx.newId()
      s.tabs.push(newTab(id, op.name ? cleanTabName(s, op.name) : freeName(s, `Folha ${s.tabs.length + 1}`)))
      break
    }
    case 'tab.import': {
      if (s.tabs.length >= SHEET_LIMITS.tabs) bad(`Uma planilha tem no máximo ${SHEET_LIMITS.tabs} folhas`)
      const id = op.id && SAFE_ID.test(op.id) && !s.tabs.some(t => t.id === op.id) ? op.id : ctx.newId()
      s.tabs.push(cleanTab(op, id, freeName(s, typeof op.name === 'string' ? op.name : 'Importada')))
      checkCells(s)
      break
    }
    case 'tab.rename': {
      const tab = tabOf(s, op.tabId)
      const name = cleanTabName(s, op.name, tab.id)
      const old = tab.name.toLowerCase()
      tab.name = name
      // as fórmulas que apontavam para o nome antigo passam a usar o novo
      for (const t of s.tabs) {
        for (const [k, raw] of Object.entries(t.cells)) {
          const next = rewriteRefs(raw, u => {
            if (u.a.sheet?.toLowerCase() !== old) return undefined
            return u.b ? `${refText(u.a, name)}:${refText(u.b, u.b.sheet === undefined ? undefined : name)}` : refText(u.a, name)
          })
          if (next !== raw) t.cells[k] = next
        }
      }
      break
    }
    case 'tab.delete': {
      const tab = tabOf(s, op.tabId)
      if (s.tabs.length <= 1) bad('A planilha tem de ter pelo menos uma folha')
      s.tabs = s.tabs.filter(t => t !== tab)
      const old = tab.name.toLowerCase()
      for (const t of s.tabs) {
        for (const [k, raw] of Object.entries(t.cells)) {
          const next = rewriteRefs(raw, u => (u.a.sheet?.toLowerCase() === old ? '#REF!' : undefined))
          if (next !== raw) t.cells[k] = next
        }
      }
      break
    }
    case 'tab.move': {
      const tab = tabOf(s, op.tabId)
      const rest = s.tabs.filter(t => t !== tab)
      rest.splice(int(op.index, 0, rest.length), 0, tab)
      s.tabs = rest
      break
    }
    default:
      bad('Operação desconhecida')
  }
}
