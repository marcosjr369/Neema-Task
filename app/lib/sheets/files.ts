import type { CellFmt, SheetTab } from '../../types'
import { Calc, display, isError, isFormula, literal, refText, rewriteRefs, toExcelFormula, type RefTok, type Val } from './formula'
import { FILL_COLORS } from './ops'
import { DEFAULT_WIDTH, MAX_COLS, MAX_ROWS, cellKey, colName, parseKey } from './refs'

/**
 * Importar e exportar ficheiros .xlsx e .csv, sem bibliotecas externas.
 * O .xlsx é um zip de XML: lemos os valores e as fórmulas (não a formatação) e escrevemos
 * valores, fórmulas (com o último resultado), negrito/itálico, cor de fundo, formatos de número e larguras.
 */

export type ImportedTab = Pick<SheetTab, 'name' | 'rows' | 'cols' | 'cells' | 'widths'>

const MAX_UNZIPPED = 60 * 1024 * 1024

/* ─── Zip ─────────────────────────────────────────────────────────────── */

const CRC_TABLE = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c >>> 0
  }
  return t
})()

function crc32(data: Uint8Array) {
  let c = 0xffffffff
  for (let i = 0; i < data.length; i++) c = CRC_TABLE[(c ^ data[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

/** Zip sem compressão (o Excel abre-o sem problemas) */
export function zip(files: { name: string; data: Uint8Array }[]): Uint8Array {
  const enc = new TextEncoder()
  const parts: Uint8Array[] = []
  const central: Uint8Array[] = []
  let offset = 0
  for (const f of files) {
    const name = enc.encode(f.name)
    const crc = crc32(f.data)
    const local = new DataView(new ArrayBuffer(30))
    local.setUint32(0, 0x04034b50, true)
    local.setUint16(4, 20, true)
    local.setUint16(6, 0x0800, true)
    local.setUint16(8, 0, true)
    local.setUint16(12, 0x21, true)
    local.setUint32(14, crc, true)
    local.setUint32(18, f.data.length, true)
    local.setUint32(22, f.data.length, true)
    local.setUint16(26, name.length, true)
    parts.push(new Uint8Array(local.buffer), name, f.data)
    const cen = new DataView(new ArrayBuffer(46))
    cen.setUint32(0, 0x02014b50, true)
    cen.setUint16(4, 20, true)
    cen.setUint16(6, 20, true)
    cen.setUint16(8, 0x0800, true)
    cen.setUint16(14, 0x21, true)
    cen.setUint32(16, crc, true)
    cen.setUint32(20, f.data.length, true)
    cen.setUint32(24, f.data.length, true)
    cen.setUint16(28, name.length, true)
    cen.setUint32(42, offset, true)
    central.push(new Uint8Array(cen.buffer), name)
    offset += 30 + name.length + f.data.length
  }
  const cenSize = central.reduce((n, p) => n + p.length, 0)
  const end = new DataView(new ArrayBuffer(22))
  end.setUint32(0, 0x06054b50, true)
  end.setUint16(8, files.length, true)
  end.setUint16(10, files.length, true)
  end.setUint32(12, cenSize, true)
  end.setUint32(16, offset, true)
  const all = [...parts, ...central, new Uint8Array(end.buffer)]
  const out = new Uint8Array(all.reduce((n, p) => n + p.length, 0))
  let pos = 0
  for (const p of all) { out.set(p, pos); pos += p.length }
  return out
}

async function inflate(data: Uint8Array, budget: { left: number }): Promise<Uint8Array> {
  const stream = new Blob([data as BlobPart]).stream().pipeThrough(new DecompressionStream('deflate-raw'))
  const reader = stream.getReader()
  const chunks: Uint8Array[] = []
  let size = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    size += value.length
    budget.left -= value.length
    if (budget.left < 0) {
      await reader.cancel()
      throw new Error('O ficheiro é demasiado grande')
    }
    chunks.push(value)
  }
  const out = new Uint8Array(size)
  let pos = 0
  for (const c of chunks) { out.set(c, pos); pos += c.length }
  return out
}

/** Lê os ficheiros de um zip pedidos por "want" */
export async function unzip(buf: Uint8Array, want: (name: string) => boolean): Promise<Map<string, Uint8Array>> {
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength)
  let eocd = -1
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 22 - 65535); i--) {
    if (view.getUint32(i, true) === 0x06054b50) { eocd = i; break }
  }
  if (eocd < 0) throw new Error('Não é um ficheiro .xlsx válido')
  const count = view.getUint16(eocd + 10, true)
  let p = view.getUint32(eocd + 16, true)
  const dec = new TextDecoder()
  const out = new Map<string, Uint8Array>()
  const budget = { left: MAX_UNZIPPED }
  for (let n = 0; n < count; n++) {
    if (p + 46 > buf.length || view.getUint32(p, true) !== 0x02014b50) throw new Error('Ficheiro .xlsx danificado')
    const method = view.getUint16(p + 10, true)
    const compSize = view.getUint32(p + 20, true)
    const nameLen = view.getUint16(p + 28, true)
    const extraLen = view.getUint16(p + 30, true)
    const commentLen = view.getUint16(p + 32, true)
    const local = view.getUint32(p + 42, true)
    const name = dec.decode(buf.subarray(p + 46, p + 46 + nameLen))
    p += 46 + nameLen + extraLen + commentLen
    if (!want(name)) continue
    if (local + 30 > buf.length) throw new Error('Ficheiro .xlsx danificado')
    const start = local + 30 + view.getUint16(local + 26, true) + view.getUint16(local + 28, true)
    const data = buf.subarray(start, start + compSize)
    if (method === 0) {
      budget.left -= data.length
      out.set(name, data)
    } else if (method === 8) out.set(name, await inflate(data, budget))
    else throw new Error('Compressão do ficheiro não suportada')
  }
  return out
}

/* ─── XML ─────────────────────────────────────────────────────────────── */

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
    // caracteres de controlo não são válidos em XML
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '')

const unesc = (s: string) =>
  s.replace(/&(#x[0-9a-f]+|#\d+|lt|gt|amp|quot|apos);/gi, (_, e: string) => {
    if (e[0] === '#') return String.fromCodePoint(e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : Number(e.slice(1)))
    return ({ lt: '<', gt: '>', amp: '&', quot: '"', apos: "'" } as Record<string, string>)[e.toLowerCase()]
  })

const attr = (attrs: string, name: string) => {
  const m = new RegExp(`(?:^|\\s)${name}="([^"]*)"`).exec(attrs)
  return m ? unesc(m[1]) : undefined
}

/** Texto de todos os <t> (ignora as leituras fonéticas <rPh>) */
const texts = (xml: string) =>
  [...xml.replace(/<rPh\b[\s\S]*?<\/rPh>/g, '').matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>|<t(?:\s[^>]*)?\/>/g)].map(m => unesc(m[1] ?? '')).join('')

/* ─── Ler .xlsx ───────────────────────────────────────────────────────── */

/** Texto guardado como texto, mesmo que pareça número ou fórmula */
const asText = (s: string) => (typeof literal(s) !== 'string' || s.startsWith('=') || s.startsWith("'") ? `'${s}` : s)

export async function readXlsx(buf: ArrayBuffer): Promise<ImportedTab[]> {
  const files = await unzip(new Uint8Array(buf), n => n.startsWith('xl/') && (n.endsWith('.xml') || n.endsWith('.rels')) && !n.includes('/theme/') && !n.includes('drawings'))
  const dec = new TextDecoder()
  const get = (n: string) => { const f = files.get(n); return f ? dec.decode(f) : undefined }
  const workbook = get('xl/workbook.xml') ?? (() => { throw new Error('Não é um ficheiro .xlsx válido') })()
  const rels = get('xl/_rels/workbook.xml.rels') ?? ''
  const targets = new Map<string, string>()
  for (const m of rels.matchAll(/<Relationship\b([^>]*)\/?>/g)) {
    const id = attr(m[1], 'Id')
    const target = attr(m[1], 'Target')
    if (id && target) targets.set(id, target.startsWith('/') ? target.slice(1) : `xl/${target.replace(/^\.\//, '')}`)
  }
  const shared = [...(get('xl/sharedStrings.xml') ?? '').matchAll(/<si>([\s\S]*?)<\/si>/g)].map(m => texts(m[1]))

  const tabs: ImportedTab[] = []
  for (const m of workbook.matchAll(/<sheet\b([^>]*)\/?>/g)) {
    const name = attr(m[1], 'name') ?? `Folha ${tabs.length + 1}`
    const rid = attr(m[1], 'r:id')
    const xml = rid ? get(targets.get(rid) ?? '') : undefined
    if (!xml) continue
    const cells: Record<string, string> = {}
    // fórmulas partilhadas: o Excel guarda a fórmula só na primeira célula do bloco
    const masters = new Map<string, { formula: string; r: number; c: number }>()
    let rows = 1
    let cols = 1
    for (const c of xml.matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const ref = attr(c[1], 'r')
      const p = ref ? parseKey(ref) : null
      if (!p || p.r >= MAX_ROWS || p.c >= MAX_COLS) continue
      const type = attr(c[1], 't')
      const inner = c[2] ?? ''
      const f = /<f\b([^>]*)>([\s\S]*?)<\/f>|<f\b([^>]*)\/>/.exec(inner)
      const fAttrs = f ? f[1] ?? f[3] ?? '' : ''
      const fText = f?.[2] ? unesc(f[2]) : ''
      const si = attr(fAttrs, 'si')
      const v = /<v>([\s\S]*?)<\/v>/.exec(inner)
      let value: string | undefined
      if (fText.trim()) {
        value = `=${fText}`
        if (si !== undefined && attr(fAttrs, 't') === 'shared') masters.set(si, { formula: value, r: p.r, c: p.c })
      } else if (si !== undefined && masters.has(si)) {
        const m = masters.get(si)!
        const dr = p.r - m.r, dc = p.c - m.c
        const move = (t: RefTok) => ({ ...t, row: t.absR ? t.row : t.row + dr, col: t.absC ? t.col : t.col + dc })
        value = rewriteRefs(m.formula, u => (u.b ? `${refText(move(u.a), u.a.sheet)}:${refText(move(u.b), u.b.sheet)}` : refText(move(u.a), u.a.sheet)))
      }
      // sem fórmula: o valor guardado
      if (value === undefined) {
        if (type === 's') value = v ? asText(shared[Number(v[1])] ?? '') : undefined
      else if (type === 'inlineStr') value = asText(texts(/<is>([\s\S]*?)<\/is>/.exec(inner)?.[1] ?? ''))
      else if (type === 'str') value = v ? asText(unesc(v[1])) : undefined
      else if (type === 'b') value = v ? (v[1] === '1' ? 'VERDADEIRO' : 'FALSO') : undefined
      else if (type === 'e') value = v ? `'${unesc(v[1])}` : undefined
        else value = v ? unesc(v[1]) : undefined
      }
      if (!value) continue
      cells[cellKey(p.r, p.c)] = value
      rows = Math.max(rows, p.r + 1)
      cols = Math.max(cols, p.c + 1)
    }
    const widths: Record<string, number> = {}
    for (const col of xml.matchAll(/<col\b([^>]*)\/?>/g)) {
      const min = Number(attr(col[1], 'min')), max = Number(attr(col[1], 'max')), w = Number(attr(col[1], 'width'))
      if (!w || !min) continue
      for (let i = min; i <= Math.min(max, MAX_COLS); i++) widths[i - 1] = Math.max(40, Math.min(600, Math.round(w * 7)))
    }
    tabs.push({ name, rows: Math.max(rows + 20, 100), cols: Math.max(cols, 26), cells, widths })
  }
  if (!tabs.length) throw new Error('O ficheiro não tem folhas')
  return tabs.map(t => ({ ...t, rows: Math.min(t.rows, MAX_ROWS), cols: Math.min(t.cols, MAX_COLS) }))
}

/* ─── Escrever .xlsx ──────────────────────────────────────────────────── */

type ExportTab = Pick<SheetTab, 'id' | 'name' | 'rows' | 'cols' | 'cells' | 'fmt' | 'widths'>

const NUM_FMT_ID = { num2: 2, pct: 10, eur: 164 }

function stylesXml(styles: string[]) {
  const fonts = ['<font><sz val="11"/><name val="Calibri"/></font>', '<font><b/><sz val="11"/><name val="Calibri"/></font>',
    '<font><i/><sz val="11"/><name val="Calibri"/></font>', '<font><b/><i/><sz val="11"/><name val="Calibri"/></font>']
  const fills = ['<fill><patternFill patternType="none"/></fill>', '<fill><patternFill patternType="gray125"/></fill>',
    ...FILL_COLORS.map(c => `<fill><patternFill patternType="solid"><fgColor rgb="FF${c.slice(1)}"/><bgColor indexed="64"/></patternFill></fill>`)]
  const xfs = ['<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>', ...styles.map(key => {
    const f = JSON.parse(key) as CellFmt
    const font = (f.b ? 1 : 0) + (f.i ? 2 : 0)
    const fill = f.bg ? 2 + FILL_COLORS.indexOf(f.bg) : 0
    const num = f.nf ? NUM_FMT_ID[f.nf] : 0
    const align = f.align ? `<alignment horizontal="${f.align}"/>` : ''
    return `<xf numFmtId="${num}" fontId="${font}" fillId="${fill}" borderId="0" xfId="0"${num ? ' applyNumberFormat="1"' : ''}${font ? ' applyFont="1"' : ''}${fill ? ' applyFill="1"' : ''}${align ? ' applyAlignment="1">' + align + '</xf>' : '/>'}`
  })]
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><numFmts count="1"><numFmt numFmtId="164" formatCode="#,##0.00\\ &quot;€&quot;"/></numFmts><fonts count="${fonts.length}">${fonts.join('')}</fonts><fills count="${fills.length}">${fills.join('')}</fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="${xfs.length}">${xfs.join('')}</cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`
}

function cachedValue(v: Val): { t?: string; v: string } | null {
  if (v === null) return null
  if (isError(v)) {
    const code = v.code === '#NOME?' ? '#NAME?' : v.code === '#VALOR!' ? '#VALUE!' : v.code === '#NÚM!' ? '#NUM!' : v.code
    return { t: 'e', v: ['#DIV/0!', '#NAME?', '#VALUE!', '#NUM!', '#REF!', '#N/A', '#NULL!'].includes(code) ? code : '#VALUE!' }
  }
  if (typeof v === 'boolean') return { t: 'b', v: v ? '1' : '0' }
  if (typeof v === 'number') return { v: String(v) }
  return { t: 'str', v: esc(v) }
}

export function writeXlsx(tabs: ExportTab[]): Uint8Array {
  const enc = new TextEncoder()
  const calc = new Calc(tabs)
  const styleIndex = new Map<string, number>()
  const styleOf = (f?: CellFmt) => {
    if (!f || !Object.keys(f).length) return 0
    const key = JSON.stringify({ b: f.b, i: f.i, align: f.align, bg: f.bg, nf: f.nf })
    if (!styleIndex.has(key)) styleIndex.set(key, styleIndex.size + 1)
    return styleIndex.get(key)!
  }

  const sheets = tabs.map(tab => {
    const keys = new Set([...Object.keys(tab.cells), ...Object.keys(tab.fmt ?? {})])
    const byRow = new Map<number, { c: number; key: string }[]>()
    for (const key of keys) {
      const p = parseKey(key)
      if (!p) continue
      if (!byRow.has(p.r)) byRow.set(p.r, [])
      byRow.get(p.r)!.push({ c: p.c, key })
    }
    const rows = [...byRow.entries()].sort((a, b) => a[0] - b[0]).map(([r, list]) => {
      const cells = list.sort((a, b) => a.c - b.c).map(({ key }) => {
        const raw = tab.cells[key]
        const s = styleOf(tab.fmt?.[key])
        const sAttr = s ? ` s="${s}"` : ''
        if (raw === undefined || raw === '') return `<c r="${key}"${sAttr}/>`
        if (isFormula(raw)) {
          const f = toExcelFormula(raw)
          const cached = cachedValue(calc.value(tab.id, key))
          if (!f) return `<c r="${key}"${sAttr} t="inlineStr"><is><t xml:space="preserve">${esc(raw)}</t></is></c>`
          return `<c r="${key}"${sAttr}${cached?.t ? ` t="${cached.t}"` : ''}><f>${esc(f)}</f>${cached ? `<v>${cached.v}</v>` : ''}</c>`
        }
        const v = literal(raw)
        if (typeof v === 'number') return `<c r="${key}"${sAttr}><v>${v}</v></c>`
        return `<c r="${key}"${sAttr} t="inlineStr"><is><t xml:space="preserve">${esc(String(v ?? ''))}</t></is></c>`
      })
      return `<row r="${r + 1}">${cells.join('')}</row>`
    })
    const widths = Object.entries(tab.widths ?? {}).sort((a, b) => Number(a[0]) - Number(b[0]))
    const cols = widths.length
      ? `<cols>${widths.map(([c, w]) => `<col min="${Number(c) + 1}" max="${Number(c) + 1}" width="${((w || DEFAULT_WIDTH) / 7).toFixed(2)}" customWidth="1"/>`).join('')}</cols>`
      : ''
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><dimension ref="A1:${colName(Math.max(0, tab.cols - 1))}${Math.max(1, tab.rows)}"/>${cols}<sheetData>${rows.join('')}</sheetData></worksheet>`
  })

  const ns = 'xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"'
  const files = [
    { name: '[Content_Types].xml', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${sheets.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}</Types>` },
    { name: '_rels/.rels', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>` },
    { name: 'xl/workbook.xml', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook ${ns}><sheets>${tabs.map((t, i) => `<sheet name="${esc(t.name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')}</sheets><calcPr calcId="191029" fullCalcOnLoad="1"/></workbook>` },
    { name: 'xl/_rels/workbook.xml.rels', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('')}<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>` },
    ...sheets.map((data, i) => ({ name: `xl/worksheets/sheet${i + 1}.xml`, data })),
  ]
  // os estilos só se conhecem depois de escrever as folhas
  files.push({ name: 'xl/styles.xml', data: stylesXml([...styleIndex.keys()]) })
  return zip(files.map(f => ({ name: f.name, data: enc.encode(f.data) })))
}

/* ─── CSV ─────────────────────────────────────────────────────────────── */

export function readCsv(text: string, name: string): ImportedTab {
  const src = text.replace(/^﻿/, '')
  const firstLine = src.split(/\r?\n/, 1)[0] ?? ''
  const count = (ch: string) => firstLine.split(ch).length - 1
  const sep = [';', '\t', ','].sort((a, b) => count(b) - count(a))[0]
  const cells: Record<string, string> = {}
  let r = 0, c = 0, field = '', quoted = false, cols = 1
  const push = () => {
    if (field !== '' && r < MAX_ROWS && c < MAX_COLS) cells[cellKey(r, c)] = field.startsWith('=') ? `'${field}` : field
    field = ''
    c++
    cols = Math.max(cols, c)
  }
  for (let i = 0; i < src.length; i++) {
    const ch = src[i]
    if (quoted) {
      if (ch === '"') {
        if (src[i + 1] === '"') { field += '"'; i++ } else quoted = false
      } else field += ch
    } else if (ch === '"' && field === '') quoted = true
    else if (ch === sep) push()
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i++
      push()
      r++
      c = 0
    } else field += ch
  }
  if (field !== '' || c > 0) { push(); r++ }
  return { name: name.replace(/\.[^.]+$/, '').slice(0, 40) || 'Importada', rows: Math.min(MAX_ROWS, Math.max(r + 20, 100)), cols: Math.min(MAX_COLS, Math.max(cols, 26)), cells }
}

/** CSV com ";" e vírgula decimal (o que o Excel em português abre directamente) */
export function writeCsv(tab: ExportTab, calc: Calc): string {
  let maxR = -1, maxC = -1
  for (const k of Object.keys(tab.cells)) {
    const p = parseKey(k)
    if (p) { maxR = Math.max(maxR, p.r); maxC = Math.max(maxC, p.c) }
  }
  const lines: string[] = []
  for (let r = 0; r <= maxR; r++) {
    const row: string[] = []
    for (let c = 0; c <= maxC; c++) {
      const s = display(calc.value(tab.id, cellKey(r, c)))
      row.push(/[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s)
    }
    lines.push(row.join(';'))
  }
  return '﻿' + lines.join('\r\n')
}

export function download(name: string, data: BlobPart, type: string) {
  const url = URL.createObjectURL(new Blob([data], { type }))
  const a = document.createElement('a')
  a.href = url
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export async function readSheetFile(file: File): Promise<ImportedTab[]> {
  if (file.size > 15 * 1024 * 1024) throw new Error('O ficheiro tem mais de 15 MB')
  const lower = file.name.toLowerCase()
  if (lower.endsWith('.xlsx')) return readXlsx(await file.arrayBuffer())
  if (lower.endsWith('.csv') || lower.endsWith('.txt') || lower.endsWith('.tsv')) return [readCsv(await file.text(), file.name)]
  throw new Error('Escolhe um ficheiro .xlsx ou .csv')
}
