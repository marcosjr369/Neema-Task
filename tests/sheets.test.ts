import { describe, expect, it } from 'vitest'
import { applySheetOp, newTab, SheetOpError, type SheetOp } from '../app/lib/sheets/ops'
import { colIndex, colName, normRange, parseKey, rangeLabel } from '../app/lib/sheets/refs'
import { readCsv, readXlsx, unzip, writeCsv, writeXlsx, zip } from '../app/lib/sheets/files'
import { Calc } from '../app/lib/sheets/formula'
import type { Sheet, SheetTab } from '../app/types'

let n = 0
const ctx = { now: 1, newId: () => `id-test-${++n}` }

function sheet(cells: Record<string, string> = {}): Sheet {
  const tab = newTab('tab-aaaaaaaa')
  tab.cells = cells
  return { id: 's', title: 'T', ownerId: 'u', createdAt: 0, updatedAt: 0, tabs: [tab], sharing: { visibility: 'private', token: 'x' } }
}
const run = (s: Sheet, ...ops: SheetOp[]) => ops.forEach(op => applySheetOp(s, op, ctx))
const tabId = 'tab-aaaaaaaa'

describe('refs', () => {
  it('converte colunas em letras e de volta', () => {
    expect(colName(0)).toBe('A')
    expect(colName(25)).toBe('Z')
    expect(colName(26)).toBe('AA')
    expect(colIndex('AA')).toBe(26)
    for (const c of [0, 5, 25, 26, 51, 701, 702]) expect(colIndex(colName(c))).toBe(c)
  })
  it('lê endereços de células', () => {
    expect(parseKey('B3')).toEqual({ r: 2, c: 1 })
    expect(parseKey('3B')).toBeNull()
  })
  it('normaliza e escreve intervalos', () => {
    const g = normRange({ r: 4, c: 2 }, { r: 1, c: 0 })
    expect(rangeLabel(g)).toBe('A2:C5')
    expect(rangeLabel(normRange({ r: 0, c: 0 }, { r: 0, c: 0 }))).toBe('A1')
  })
})

describe('operações', () => {
  it('escreve e apaga células', () => {
    const s = sheet()
    run(s, { type: 'cells.set', tabId, cells: { A1: '10', B2: 'olá' } })
    expect(s.tabs[0].cells).toMatchObject({ A1: '10', B2: 'olá' })
    run(s, { type: 'cells.set', tabId, cells: { A1: '' } })
    expect(s.tabs[0].cells.A1).toBeUndefined()
  })
  it('recusa células fora dos limites ou inválidas', () => {
    const s = sheet()
    expect(() => run(s, { type: 'cells.set', tabId, cells: { 'ZZZZ1': '1' } })).toThrow(SheetOpError)
    expect(() => run(s, { type: 'cells.set', tabId, cells: { '1A': '1' } })).toThrow(SheetOpError)
  })
  it('inserir uma linha desce as células e corrige as fórmulas', () => {
    const s = sheet({ A1: '1', A2: '2', A3: '=SOMA(A1:A2)' })
    run(s, { type: 'rows.insert', tabId, at: 1, count: 1 })
    const c = s.tabs[0].cells
    expect(c.A1).toBe('1')
    expect(c.A2).toBeUndefined()
    expect(c.A3).toBe('2')
    expect(c.A4).toBe('=SOMA(A1:A3)')
    expect(new Calc(s.tabs).value(tabId, 'A4')).toBe(3)
  })
  it('apagar uma linha referida deixa #REF! nas fórmulas que a usavam sozinha', () => {
    const s = sheet({ A1: '5', A2: '=A1*2' })
    run(s, { type: 'rows.delete', tabId, at: 0, count: 1 })
    expect(s.tabs[0].cells.A1).toContain('#REF!')
  })
  it('inserir uma coluna move as células para a direita', () => {
    const s = sheet({ A1: '1', B1: '=A1+1' })
    run(s, { type: 'cols.insert', tabId, at: 0, count: 1 })
    expect(s.tabs[0].cells.B1).toBe('1')
    expect(s.tabs[0].cells.C1).toBe('=B1+1')
  })
  it('folhas: criar, mudar o nome (sem repetir), apagar (fica sempre uma)', () => {
    const s = sheet()
    run(s, { type: 'tab.add', id: 'tab-bbbbbbbb', name: 'Vendas' })
    expect(s.tabs.map(t => t.name)).toContain('Vendas')
    expect(() => run(s, { type: 'tab.rename', tabId: 'tab-bbbbbbbb', name: s.tabs[0].name })).toThrow(/Já existe/)
    run(s, { type: 'tab.delete', tabId: 'tab-bbbbbbbb' })
    expect(() => run(s, { type: 'tab.delete', tabId })).toThrow(/pelo menos uma/)
  })
  it('mudar o nome de uma folha actualiza as fórmulas que a referem', () => {
    const s = sheet({ A1: '=Vendas!A1' })
    run(s, { type: 'tab.add', id: 'tab-bbbbbbbb', name: 'Vendas' })
    run(s, { type: 'tab.rename', tabId: 'tab-bbbbbbbb', name: 'Receitas' })
    expect(s.tabs[0].cells.A1).toBe('=Receitas!A1')
  })
  it('formatação só aceita valores conhecidos', () => {
    const s = sheet()
    const range = { r1: 0, c1: 0, r2: 0, c2: 1 }
    run(s, { type: 'format.set', tabId, range, fmt: { b: true, align: 'center' } })
    expect(s.tabs[0].fmt?.A1).toMatchObject({ b: true, align: 'center' })
    expect(() => run(s, { type: 'format.set', tabId, range, fmt: { bg: '#123456' } })).toThrow(/Cor/)
  })
  it('operação desconhecida é recusada', () => {
    expect(() => run(sheet(), { type: 'nada' } as unknown as SheetOp)).toThrow(SheetOpError)
  })
})

describe('ficheiros', () => {
  it('zip e unzip devolvem o mesmo conteúdo', async () => {
    const enc = new TextEncoder()
    const z = zip([{ name: 'a.txt', data: enc.encode('olá mundo') }, { name: 'b/c.xml', data: enc.encode('<x/>') }])
    const out = await unzip(z, () => true)
    expect(new TextDecoder().decode(out.get('a.txt'))).toBe('olá mundo')
    expect(new TextDecoder().decode(out.get('b/c.xml'))).toBe('<x/>')
  })
  it('CSV: lê ; ou , e aspas, e volta a escrever', () => {
    const t = readCsv('Nome;Valor\n"Silva; Ana";10\nRui;"2,5"\n', 'dados.csv')
    expect(t.cells.A2).toBe('Silva; Ana')
    expect(t.cells.B3).toBe('2,5')
    const full = { ...t, id: 'x', fmt: {} }
    const csv = writeCsv(full, new Calc([full]))
    expect(readCsv(csv, 'de novo.csv').cells).toEqual(t.cells)
  })
  it('XLSX: o que se escreve lê-se igual (valores, fórmulas e várias folhas)', async () => {
    const tabs: SheetTab[] = [
      { id: 'a', name: 'Resumo', rows: 10, cols: 5, cells: { A1: 'Item', B1: 'Valor', A2: 'Rendas', B2: '120', B3: '=SOMA(B2:B2)' }, fmt: {}, widths: {} },
      { id: 'b', name: 'Notas', rows: 10, cols: 5, cells: { A1: 'Texto com "aspas" & <sinais>' }, fmt: {}, widths: {} },
    ]
    const bytes = writeXlsx(tabs)
    const back = await readXlsx(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer)
    expect(back.map(t => t.name)).toEqual(['Resumo', 'Notas'])
    expect(back[0].cells.A2).toBe('Rendas')
    expect(back[0].cells.B2).toBe('120')
    expect(back[0].cells.B3?.toUpperCase()).toMatch(/^=SO?U?MA?\(B2:B2\)$/)
    expect(back[1].cells.A1).toBe('Texto com "aspas" & <sinais>')
  })
})
