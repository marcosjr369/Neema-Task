import { describe, expect, it } from 'vitest'
import { Calc, CellError, display, isFormula, literal, refText, rewriteRefs, toExcelFormula, type RefTok } from '../app/lib/sheets/formula'

type Tab = { id: string; name: string; rows: number; cols: number; cells: Record<string, string> }
const sheet = (id: string, name: string, cells: Record<string, string>): Tab => ({ id, name, rows: 100, cols: 26, cells })

/** Calcula uma fórmula numa folha com as células dadas */
function calc(formula: string, cells: Record<string, string> = {}, more: Tab[] = []) {
  const tab = sheet('t1', 'Folha1', { ...cells, Z99: formula })
  return new Calc([tab, ...more]).value('t1', 'Z99')
}
const code = (v: unknown) => (v instanceof CellError ? v.code : v)

describe('literal', () => {
  it('lê números com vírgula ou ponto', () => {
    expect(literal('1,5')).toBe(1.5)
    expect(literal('1.5')).toBe(1.5)
    expect(literal(' 42 ')).toBe(42)
    expect(literal('-3')).toBe(-3)
  })
  it('lê percentagens', () => {
    expect(literal('15%')).toBeCloseTo(0.15)
  })
  it('apóstrofo força texto', () => {
    expect(literal("'123")).toBe('123')
  })
  it('vazio é nulo e texto fica texto', () => {
    expect(literal('')).toBeNull()
    expect(literal('olá')).toBe('olá')
  })
})

describe('isFormula', () => {
  it('só começa por = e tem conteúdo', () => {
    expect(isFormula('=1+1')).toBe(true)
    expect(isFormula('=')).toBe(false)
    expect(isFormula('1+1')).toBe(false)
    expect(isFormula(undefined)).toBe(false)
  })
})

describe('Calc: aritmética', () => {
  it('respeita a precedência', () => {
    expect(calc('=1+2*3')).toBe(7)
    expect(calc('=(1+2)*3')).toBe(9)
    expect(calc('=2^3')).toBe(8)
    expect(calc('=-2+5')).toBe(3)
  })
  it('divisão por zero dá erro', () => {
    expect(code(calc('=1/0'))).toBe('#DIV/0!')
  })
  it('usa células, vazias contam como 0', () => {
    expect(calc('=A1+A2', { A1: '10', A2: '2,5' })).toBe(12.5)
    expect(calc('=A1+B7', { A1: '4' })).toBe(4)
  })
  it('texto em contas dá erro de valor', () => {
    expect(code(calc('=A1+1', { A1: 'abc' }))).toBe('#VALOR!')
  })
})

describe('Calc: funções', () => {
  const nums = { A1: '1', A2: '2', A3: '3', A4: 'x' }
  it('SOMA e SUM, com ; ou ,', () => {
    expect(calc('=SOMA(A1:A3)', nums)).toBe(6)
    expect(calc('=SUM(A1:A3)', nums)).toBe(6)
    expect(calc('=SOMA(A1;A2;10)', nums)).toBe(13)
    expect(calc('=SOMA(A1,A2)', nums)).toBe(3)
  })
  it('MÉDIA, MIN, MAX ignoram texto', () => {
    expect(calc('=MÉDIA(A1:A4)', nums)).toBe(2)
    expect(calc('=MIN(A1:A4)', nums)).toBe(1)
    expect(calc('=MAX(A1:A4)', nums)).toBe(3)
  })
  it('CONTAR e CONTAR.VAL', () => {
    expect(calc('=CONTAR(A1:A4)', nums)).toBe(3)
    expect(calc('=CONTAR.VAL(A1:A5)', nums)).toBe(4)
  })
  it('SE / IF', () => {
    expect(calc('=SE(A3>2;"sim";"não")', nums)).toBe('sim')
    expect(calc('=IF(A1>2,"sim","não")', nums)).toBe('não')
  })
  it('SOMA.SE e CONTAR.SE', () => {
    const c = { A1: '5', A2: '10', A3: '20', B1: 'pago', B2: 'pago', B3: 'não' }
    expect(calc('=SOMA.SE(A1:A3;">5")', c)).toBe(30)
    expect(calc('=CONTAR.SE(B1:B3;"pago")', c)).toBe(2)
  })
  it('ARRED', () => {
    expect(calc('=ARRED(2,345;2)')).toBeCloseTo(2.35)
    expect(calc('=ARRED(A1;0)', { A1: '2,5' })).toBe(3)
  })
  it('CONCATENAR e &', () => {
    expect(calc('=CONCATENAR("a";" ";"b")')).toBe('a b')
    expect(calc('=A1&"-"&A2', { A1: 'x', A2: '1' })).toBe('x-1')
  })
  it('SE.ERRO apanha erros', () => {
    expect(calc('=SE.ERRO(1/0;0)')).toBe(0)
  })
  it('E / OU / NÃO', () => {
    expect(calc('=E(1>0;2>1)')).toBe(true)
    expect(calc('=OU(1>2;2>1)')).toBe(true)
    expect(calc('=NÃO(1>2)')).toBe(true)
  })
  it('função desconhecida dá erro de nome', () => {
    expect(code(calc('=XPTO(1)'))).toBe('#NOME?')
  })
})

describe('Calc: referências', () => {
  it('lê outra folha pelo nome', () => {
    const other = sheet('t2', 'Vendas', { A1: '7' })
    expect(calc('=Vendas!A1*2', {}, [other])).toBe(14)
    expect(calc("='Vendas'!A1+1", {}, [other])).toBe(8)
  })
  it('folha inexistente dá #REF!', () => {
    expect(code(calc('=Nada!A1'))).toBe('#REF!')
  })
  it('detecta referências circulares', () => {
    const tab = sheet('t1', 'F', { A1: '=B1', B1: '=A1' })
    expect(code(new Calc([tab]).value('t1', 'A1'))).toBe('#CIRC!')
  })
  it('fórmula mal escrita dá #ERRO!', () => {
    expect(code(calc('=1+'))).toBe('#ERRO!')
    expect(code(calc('=SOMA(A1'))).toBe('#ERRO!')
  })
})

describe('rewriteRefs', () => {
  it('reescreve cada referência e intervalo', () => {
    // desce uma linha tudo o que está da linha 2 para baixo (como ao inserir uma linha acima)
    const down = (t: RefTok) => (t.row >= 1 ? refText({ ...t, row: t.row + 1 }) : refText(t))
    const out = rewriteRefs('=SOMA(A1:A3)+B2*$C$5', u => (u.b ? down(u.a) + ':' + down(u.b) : down(u.a)))
    expect(out).toBe('=SOMA(A1:A4)+B3*$C$6')
  })
  it('deixa fórmulas inválidas como estão', () => {
    expect(rewriteRefs('=1+', () => 'X')).toBe('=1+')
  })
})

describe('toExcelFormula', () => {
  it('converte nomes portugueses para os do Excel', () => {
    const f = toExcelFormula('=SOMA(A1:A3;2)')
    expect(f).not.toBeNull()
    expect(f!.toUpperCase()).toContain('SUM(')
    expect(f).not.toContain(';')
  })
  it('devolve null para fórmulas inválidas', () => {
    expect(toExcelFormula('=1+')).toBeNull()
  })
})

describe('display', () => {
  it('mostra valores como na grelha', () => {
    expect(display(null)).toBe('')
    expect(display(true)).toBe('VERDADEIRO')
    expect(display(new CellError('#DIV/0!'))).toBe('#DIV/0!')
    expect(display(1.5)).toContain('1,5')
  })
})
