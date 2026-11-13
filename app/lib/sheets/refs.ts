/** Endereços de células: colunas A…AZ, linhas 1…2000 (índices internos a partir de 0) */

export const MAX_ROWS = 2000
export const MAX_COLS = 52
export const DEFAULT_ROWS = 100
export const DEFAULT_COLS = 26
export const DEFAULT_WIDTH = 110
export const ROW_HEIGHT = 28

export function colName(c: number) {
  let n = c + 1
  let s = ''
  while (n > 0) {
    const m = (n - 1) % 26
    s = String.fromCharCode(65 + m) + s
    n = Math.floor((n - 1) / 26)
  }
  return s
}

export function colIndex(name: string) {
  let n = 0
  for (const ch of name.toUpperCase()) n = n * 26 + (ch.charCodeAt(0) - 64)
  return n - 1
}

export const cellKey = (r: number, c: number) => `${colName(c)}${r + 1}`

const KEY = /^([A-Z]{1,3})(\d{1,5})$/

export function parseKey(key: string): { r: number; c: number } | null {
  const m = KEY.exec(key)
  if (!m) return null
  const r = Number(m[2]) - 1
  const c = colIndex(m[1])
  return r >= 0 && c >= 0 ? { r, c } : null
}

export type Range = { r1: number; c1: number; r2: number; c2: number }

export const normRange = (a: { r: number; c: number }, b: { r: number; c: number }): Range => ({
  r1: Math.min(a.r, b.r), c1: Math.min(a.c, b.c), r2: Math.max(a.r, b.r), c2: Math.max(a.c, b.c),
})

export const rangeLabel = (g: Range) =>
  g.r1 === g.r2 && g.c1 === g.c2 ? cellKey(g.r1, g.c1) : `${cellKey(g.r1, g.c1)}:${cellKey(g.r2, g.c2)}`

export function* rangeKeys(g: Range) {
  for (let r = g.r1; r <= g.r2; r++) for (let c = g.c1; c <= g.c2; c++) yield cellKey(r, c)
}

/** Nome de folha numa fórmula: entre plicas quando tem espaços ou símbolos */
export const quoteTab = (name: string) => (/^[A-Za-zÀ-ÿ_][\wÀ-ÿ.]*$/.test(name) ? name : `'${name.replace(/'/g, "''")}'`)
