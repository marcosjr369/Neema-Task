import { describe, expect, it } from 'vitest'
import {
  PollError, cleanAnswers, cleanFields, cleanSettings, cleanTheme, defaultSettings, isClosed, pagesOf, readyProblem, resultsVisible, starter, summarize, toCsv, visibleFields,
} from '../app/lib/polls'
import type { PollField, PollResponse } from '../app/types'

const opt = (id: string, label = id) => ({ id, label })
const form: PollField[] = [
  { id: 'q1', kind: 'single', title: 'Gostas?', required: true, options: [opt('sim'), opt('nao')], other: true },
  { id: 'q2', kind: 'long', title: 'Porquê?', required: true, showIf: { fieldId: 'q1', optionId: 'nao' } },
  { id: 'q3', kind: 'multi', title: 'O quê', options: [opt('a'), opt('b'), opt('c')], max: 2 },
  { id: 'q4', kind: 'email', title: 'Email' },
  { id: 'q5', kind: 'scale', title: 'Nota', max: 5 },
]

describe('respostas', () => {
  it('a lógica condicional esconde e mostra perguntas', () => {
    expect(visibleFields(form, { q1: 'sim' }).map(f => f.id)).toEqual(['q1', 'q3', 'q4', 'q5'])
    expect(visibleFields(form, { q1: 'nao' }).map(f => f.id)).toContain('q2')
  })

  it('pergunta escondida não é obrigatória e a resposta a ela é descartada', () => {
    const r = cleanAnswers({ fields: form }, { answers: { q1: 'sim', q2: 'texto que não devia ficar' } })
    expect(r.answers).toEqual({ q1: 'sim' })
    expect(() => cleanAnswers({ fields: form }, { answers: { q1: 'nao' } })).toThrow('Porquê?')
  })

  it('valida opções, máximo de escolhas, "Outra", email e escala', () => {
    expect(() => cleanAnswers({ fields: form }, { answers: {} })).toThrow(PollError)
    expect(() => cleanAnswers({ fields: form }, { answers: { q1: 'xx' } })).toThrow('Escolhe uma opção')
    expect(() => cleanAnswers({ fields: form }, { answers: { q1: 'sim', q3: ['a', 'b', 'c'] } })).toThrow('no máximo 2')
    expect(() => cleanAnswers({ fields: form }, { answers: { q1: 'other' } })).toThrow('Outra')
    expect(cleanAnswers({ fields: form }, { answers: { q1: 'other' }, other: { q1: ' Mais ou menos ' } }).other).toEqual({ q1: 'Mais ou menos' })
    expect(() => cleanAnswers({ fields: form }, { answers: { q1: 'sim', q4: 'não-é-email' } })).toThrow('Email inválido')
    expect(() => cleanAnswers({ fields: form }, { answers: { q1: 'sim', q5: 6 } })).toThrow()
    expect(cleanAnswers({ fields: form }, { answers: { q1: 'sim', q4: 'A@B.PT', q5: 4 } }).answers).toEqual({ q1: 'sim', q4: 'a@b.pt', q5: 4 })
  })

  it('só aceita ficheiros que o servidor recebeu, nunca escritos à mão', () => {
    const fields: PollField[] = [{ id: 'f', kind: 'file', title: 'Foto', required: true }]
    expect(() => cleanAnswers({ fields }, { answers: { f: { id: 'x', name: 'x', size: 1, type: 'image/png' } } })).toThrow('Foto')
    const file = { id: 'poll-1', name: 'a.png', size: 10, type: 'image/png' }
    expect(cleanAnswers({ fields }, { answers: {} }, { f: file }).answers.f).toEqual(file)
  })

  it('agendar: sim/talvez/não por data, ignora datas que não existem', () => {
    const fields: PollField[] = [{ id: 's', kind: 'slots', title: '', required: true, options: [{ id: 'd1', label: '', at: '2026-12-01T10:00' }] }]
    expect(cleanAnswers({ fields }, { answers: { s: { d1: 'maybe', d9: 'yes' } } }).answers.s).toEqual({ d1: 'maybe' })
    expect(() => cleanAnswers({ fields }, { answers: { s: { d9: 'yes' } } })).toThrow('datas')
  })

  it('eleição: voto em branco só onde é permitido', () => {
    const fields: PollField[] = [{ id: 'p', kind: 'single', title: 'Presidente', required: true, blank: true, options: [opt('a')] }]
    expect(cleanAnswers({ fields }, { answers: { p: 'blank' } }).answers.p).toBe('blank')
    expect(() => cleanAnswers({ fields: [{ ...fields[0], blank: false }] }, { answers: { p: 'blank' } })).toThrow()
  })
})

describe('resultados', () => {
  const r = (answers: PollResponse['answers'], t = 0): PollResponse => ({ id: String(Math.random()), pollId: 'p', kind: 'answer', answers, createdAt: t, updatedAt: t })

  it('conta votos, aponta o vencedor e calcula médias', () => {
    const res = summarize({ fields: form }, [r({ q1: 'sim', q5: 4 }), r({ q1: 'sim', q5: 5 }), r({ q1: 'nao', q2: 'x', q5: 3 })])
    const q1 = res.fields.find(f => f.fieldId === 'q1')!
    expect(res.total).toBe(3)
    expect(q1.counts).toMatchObject({ sim: 2, nao: 1, other: 0 })
    expect(q1.winner).toEqual(['sim'])
    expect(res.fields.find(f => f.fieldId === 'q5')!.avg).toBe(4)
    expect(res.fields.find(f => f.fieldId === 'q2')!.texts).toEqual(['x'])
  })

  it('empate dá vários vencedores; "em branco" nunca ganha', () => {
    const fields: PollField[] = [{ id: 'p', kind: 'single', title: 'P', blank: true, options: [opt('a'), opt('b')] }]
    const res = summarize({ fields }, [r({ p: 'a' }), r({ p: 'b' }), r({ p: 'blank' }), r({ p: 'blank' }), r({ p: 'blank' })])
    expect(res.fields[0].winner).toEqual(['a', 'b'])
  })

  it('agendar: a melhor data conta "sim" a dobrar do "talvez"', () => {
    const fields: PollField[] = [{ id: 's', kind: 'slots', title: '', options: [{ id: 'd1', label: '', at: '2026-12-01T10:00' }, { id: 'd2', label: '', at: '2026-12-02T10:00' }] }]
    const res = summarize({ fields }, [r({ s: { d1: 'maybe', d2: 'yes' } }), r({ s: { d1: 'maybe', d2: 'no' } }), r({ s: { d1: 'maybe' } })])
    expect(res.fields[0].slots!.d1).toEqual({ yes: 0, maybe: 3, no: 0 })
    expect(res.fields[0].winner).toEqual(['d1'])
  })
})

describe('definições e estado', () => {
  it('eleições são sempre secretas, só com conta e sem mudar o voto', () => {
    const s = cleanSettings('election', { anonymous: false, publicLink: true, canChange: true, onePerPerson: false }, defaultSettings('election'))
    expect(s).toMatchObject({ anonymous: true, publicLink: false, canChange: false, onePerPerson: true })
  })

  it('fecha pela data e pelo número máximo de respostas', () => {
    const base = { status: 'open' as const, settings: defaultSettings('vote'), count: 0 }
    expect(isClosed(base)).toBe(false)
    expect(isClosed({ ...base, settings: { ...base.settings, closesAt: Date.now() - 1 } })).toBe(true)
    expect(isClosed({ ...base, count: 5, settings: { ...base.settings, maxResponses: 5 } })).toBe(true)
    expect(isClosed({ ...base, status: 'draft' })).toBe(false)
  })

  it('quando os participantes vêem os resultados', () => {
    const p = { status: 'open' as const, settings: defaultSettings('vote'), count: 1 }
    expect(resultsVisible(p, false)).toBe(false)
    expect(resultsVisible(p, true)).toBe(true)
    expect(resultsVisible({ ...p, settings: { ...p.settings, results: 'closed' } }, true)).toBe(false)
    expect(resultsVisible({ ...p, status: 'closed', settings: { ...p.settings, results: 'closed' } }, false)).toBe(true)
    expect(resultsVisible({ ...p, status: 'closed', settings: { ...p.settings, results: 'managers' } }, true)).toBe(false)
  })

  it('os exemplos de cada tipo estão prontos a publicar', () => {
    for (const type of ['vote', 'election', 'form', 'contest', 'ideas', 'schedule'] as const) {
      const s = starter(type, true)
      expect(readyProblem(type, cleanFields(type, s.fields)), type).toBeNull()
    }
    expect(readyProblem('vote', starter('vote', false).fields)).toMatch(/pergunta/)
  })

  it('recusa campos que o tipo não aceita e condições inválidas', () => {
    expect(() => cleanFields('vote', [{ kind: 'long', title: 'x' }])).toThrow()
    const f = cleanFields('form', [{ id: 'a', kind: 'short', title: 'A', showIf: { fieldId: 'zz', optionId: 'x' } }])
    expect(f[0].showIf).toBeUndefined()
  })

  it('CSV: separador ";", aspas e fórmulas neutralizadas', () => {
    expect(toCsv([['a;b', '=SOMA(1)', 'x"y']])).toBe('﻿"a;b";\'=SOMA(1);"x""y"')
  })
})

describe('formulário ao estilo Microsoft Forms', () => {
  const opt2 = (id: string) => ({ id, label: id })
  const fields: PollField[] = [
    { id: 'q', kind: 'single', title: 'Cliente?', required: true, options: [opt2('sim'), opt2('nao')] },
    { id: 's1', kind: 'section', title: 'Clientes', showIf: { fieldId: 'q', optionId: 'sim' } },
    { id: 'n', kind: 'nps', title: 'Recomendas?', required: true },
    { id: 't', kind: 'text', title: 'Obrigado', help: '**Quase** a acabar' },
    { id: 's2', kind: 'section', title: 'Fim' },
    { id: 'r', kind: 'ranking', title: 'Ordena', options: [opt2('a'), opt2('b'), opt2('c')] },
    { id: 'l', kind: 'likert', title: 'Concordas?', required: true, options: [opt2('nao'), opt2('sim')], rows: [opt2('x'), opt2('y')] },
    { id: 'h', kind: 'time', title: 'Hora' },
  ]

  it('uma secção escondida esconde as perguntas dela (ramificação) e as secções viram páginas', () => {
    const no = visibleFields(fields, { q: 'nao' }).map(f => f.id)
    expect(no).not.toContain('n')
    expect(no).toContain('r')
    expect(pagesOf(visibleFields(fields, { q: 'sim' })).map(p => p.section?.id ?? '-')).toEqual(['-', 's1', 's2'])
  })

  it('o conteúdo (texto, secção) não é pergunta: não se responde nem entra nos resultados', () => {
    const r = cleanAnswers({ fields }, { answers: { q: 'nao', t: 'x', l: { x: 'sim', y: 'nao' } } })
    expect(Object.keys(r.answers).sort()).toEqual(['l', 'q'])
    expect(summarize({ fields }, []).fields.map(f => f.fieldId)).not.toContain('t')
  })

  it('valida NPS, ordenação completa, grelha e hora', () => {
    const base = { q: 'sim', l: { x: 'sim', y: 'sim' } }
    expect(() => cleanAnswers({ fields }, { answers: { ...base, n: 11 } })).toThrow('0 a 10')
    expect(() => cleanAnswers({ fields }, { answers: { ...base, n: 9, r: ['a', 'b'] } })).toThrow('Ordena')
    expect(() => cleanAnswers({ fields }, { answers: { q: 'nao', l: { x: 'sim' } } })).toThrow('todas as linhas')
    expect(() => cleanAnswers({ fields }, { answers: { q: 'nao', ...{ l: base.l }, h: '25:00' } })).toThrow('Hora')
    expect(cleanAnswers({ fields }, { answers: { ...base, n: 10, r: ['c', 'a', 'b'], h: '09:30' } }).answers).toMatchObject({ n: 10, r: ['c', 'a', 'b'], h: '09:30' })
  })

  it('resultados: NPS, posição média e grelha', () => {
    const r = (answers: PollResponse['answers']): PollResponse => ({ id: String(Math.random()), pollId: 'p', kind: 'answer', answers, createdAt: 0, updatedAt: 0 })
    const res = summarize({ fields }, [
      r({ n: 10, r: ['a', 'b', 'c'], l: { x: 'sim', y: 'nao' } }),
      r({ n: 9, r: ['a', 'c', 'b'], l: { x: 'sim', y: 'sim' } }),
      r({ n: 3, r: ['b', 'a', 'c'], l: { x: 'nao', y: 'sim' } }),
    ])
    const get = (id: string) => res.fields.find(f => f.fieldId === id)!
    expect(get('n').nps).toEqual({ score: 33, promoters: 2, passives: 0, detractors: 1 })
    expect(get('r').ranks).toEqual({ a: 1.3, b: 2, c: 2.7 })
    expect(get('r').winner).toEqual(['a'])
    expect(get('l').grid).toEqual({ x: { nao: 1, sim: 2 }, y: { nao: 1, sim: 2 } })
  })

  it('o tema só aceita cores, fundos, letras e imagens válidos', () => {
    const t = cleanTheme('form', { color: 'red; background:url(x)', background: 'image', font: 'comic' as never, header: { id: '../../etc/passwd' } })
    expect(t).toMatchObject({ color: '#7B61FF', background: 'tint', font: 'sans' })
    expect(t.header).toBeUndefined()
    const ok = cleanTheme('form', { color: '#12B5A6', background: 'image', backgroundImage: { id: 'pollimg-1234abcd-ef' }, font: 'serif', size: 'large', align: 'center' })
    expect(ok).toMatchObject({ color: '#12B5A6', background: 'image', font: 'serif', size: 'large', align: 'center' })
  })
})
