import { describe, expect, it } from 'vitest'
import { applyOp, cardsOf, OpError, type BoardOp } from '../app/lib/boards'
import { initials, managedDepartmentIds, parseCsv } from '../app/lib/org'
import { LESSONS, lessonsFor, welcomeLessons } from '../app/lib/tutorial'
import { navGroups, type NavMode } from '../app/lib/nav'
import type { Board, Department, Member } from '../app/types'

let n = 0
const ctx = { userId: 'u1', name: 'Ana', now: 1, newId: () => `id-test-${++n}`, people: new Set(['u1', 'u2']) }

function board(): Board {
  return {
    id: 'b', title: 'Q', color: '#7B61FF', ownerId: 'u1', createdAt: 0, updatedAt: 0, labels: [], cards: [],
    lists: [{ id: 'l1', title: 'A fazer', createdAt: 0 }, { id: 'l2', title: 'Feito', createdAt: 0 }],
    sharing: { visibility: 'private', token: 't' },
  }
}
const run = (b: Board, op: BoardOp, c: Partial<typeof ctx> & { moderator?: boolean } = {}) => applyOp(b, op, { ...ctx, ...c })
const titles = (b: Board, listId: string) => cardsOf(b, listId).map(c => c.title)

describe('quadros', () => {
  it('cria cartões no fim ou no topo', () => {
    const b = board()
    run(b, { type: 'card.add', listId: 'l1', title: 'Um' })
    run(b, { type: 'card.add', listId: 'l1', title: 'Dois' })
    run(b, { type: 'card.add', listId: 'l1', title: 'Zero', top: true })
    expect(titles(b, 'l1')).toEqual(['Zero', 'Um', 'Dois'])
  })
  it('move cartões entre listas para a posição pedida', () => {
    const b = board()
    for (const t of ['A', 'B', 'C']) run(b, { type: 'card.add', listId: 'l1', title: t })
    run(b, { type: 'card.add', listId: 'l2', title: 'X' })
    const a = b.cards.find(c => c.title === 'A')!
    run(b, { type: 'card.move', cardId: a.id, listId: 'l2', index: 0 })
    expect(titles(b, 'l1')).toEqual(['B', 'C'])
    expect(titles(b, 'l2')).toEqual(['A', 'X'])
    const c = b.cards.find(x => x.title === 'C')!
    run(b, { type: 'card.move', cardId: c.id, listId: 'l1', index: 0 })
    expect(titles(b, 'l1')).toEqual(['C', 'B'])
  })
  it('só se apaga o que foi arquivado primeiro', () => {
    const b = board()
    run(b, { type: 'card.add', listId: 'l1', title: 'A' })
    const id = b.cards[0].id
    expect(() => run(b, { type: 'card.delete', cardId: id })).toThrow(/Arquiva/)
    run(b, { type: 'card.archive', cardId: id, archived: true })
    run(b, { type: 'card.delete', cardId: id })
    expect(b.cards).toHaveLength(0)
    expect(() => run(b, { type: 'list.delete', listId: 'l1' })).toThrow(/Arquiva/)
  })
  it('título vazio é recusado', () => {
    expect(() => run(board(), { type: 'card.add', listId: 'l1', title: '   ' })).toThrow(OpError)
  })
  it('membros: só pessoas com acesso ao quadro', () => {
    const b = board()
    run(b, { type: 'card.add', listId: 'l1', title: 'A' })
    const id = b.cards[0].id
    run(b, { type: 'card.update', cardId: id, patch: { memberIds: ['u2'] } })
    expect(b.cards[0].memberIds).toEqual(['u2'])
    expect(() => run(b, { type: 'card.update', cardId: id, patch: { memberIds: ['intruso'] } })).toThrow(/acesso/)
  })
  it('comentários: cada um apaga os seus; o moderador apaga qualquer um', () => {
    const b = board()
    run(b, { type: 'card.add', listId: 'l1', title: 'A' })
    const id = b.cards[0].id
    run(b, { type: 'card.comment', cardId: id, text: 'olá' })
    const cid = b.cards[0].comments![0].id
    expect(b.cards[0].comments![0]).toMatchObject({ userId: 'u1', name: 'Ana', text: 'olá' })
    expect(() => run(b, { type: 'card.uncomment', cardId: id, commentId: cid }, { userId: 'u2' })).toThrow(/teus/)
    run(b, { type: 'card.uncomment', cardId: id, commentId: cid }, { userId: 'u2', moderator: true })
    expect(b.cards[0].comments).toHaveLength(0)
  })
  it('operação desconhecida é recusada', () => {
    expect(() => run(board(), { type: 'xpto' } as unknown as BoardOp)).toThrow(OpError)
  })
})

describe('empresa', () => {
  const dept = (id: string, sup: string[]): Department => ({ id, orgId: 'o', name: id, color: '#000', supervisorIds: sup })
  const me = (p: Partial<Member>) => ({ id: 'm1', orgId: 'o', role: 'membro', status: 'activo', name: 'A', ...p } as Member)
  it('admin vê tudo; supervisor vê os que chefia e o seu; membro não gere ninguém', () => {
    const ds = [dept('d1', ['m1']), dept('d2', []), dept('d3', [])]
    expect(managedDepartmentIds(ds, me({ role: 'admin' }))).toBe('all')
    expect([...managedDepartmentIds(ds, me({ role: 'supervisor', departmentId: 'd3' })) as Set<string>].sort()).toEqual(['d1', 'd3'])
    expect((managedDepartmentIds(ds, me({ role: 'membro', departmentId: 'd1' })) as Set<string>).size).toBe(0)
  })
  it('CSV de funcionários: separador ; ou , e aspas', () => {
    expect(parseCsv('nome;email\nAna Silva;ana@x.pt\n')).toEqual([['nome', 'email'], ['Ana Silva', 'ana@x.pt']])
    expect(parseCsv('nome,cargo\n"Silva, Ana","Chefe ""Vendas"""\n')[1]).toEqual(['Silva, Ana', 'Chefe "Vendas"'])
  })
  it('iniciais', () => {
    expect(initials('Ana Maria Silva')).toBe('AS')
    expect(initials('rui')).toBe('R')
    expect(initials('  ')).toBe('?')
  })
})

describe('tutorial', () => {
  const modes: NavMode[] = ['person', 'manager', 'admin', 'company']
  it('cada lição tem 4 fases com título e texto', () => {
    for (const l of LESSONS) {
      expect(l.steps, l.id).toHaveLength(4)
      for (const s of l.steps) expect(s.title.length * s.text.length, l.id).toBeGreaterThan(0)
    }
  })
  it('ids únicos e cada lição leva a uma página que existe no menu de quem a vê', () => {
    expect(new Set(LESSONS.map(l => l.id)).size).toBe(LESSONS.length)
    for (const mode of modes) {
      const hrefs = navGroups(mode).flatMap(g => g.items.map(i => i.href))
      for (const l of lessonsFor(mode)) {
        expect(hrefs.some(h => l.href === h || (h !== '/' && l.href.startsWith(h))) || l.href === '/', `${mode}: ${l.id} → ${l.href}`).toBe(true)
      }
    }
  })
  it('as boas-vindas só mostram lições que a conta pode ver', () => {
    for (const mode of modes) {
      const ws = welcomeLessons(mode)
      expect(ws.length).toBeGreaterThan(0)
      for (const l of ws) expect(l.modes).toContain(mode)
    }
  })
  it('o menu tem sempre o Tutorial', () => {
    for (const mode of modes) expect(navGroups(mode).flatMap(g => g.items).some(i => i.href === '/tutorial')).toBe(true)
  })
})

describe('tutorial: cenas', () => {
  it('cada lição tem a sua cena animada', async () => {
    const { SCENES } = await import('../app/components/tutorial/scenes')
    for (const l of LESSONS) expect(typeof SCENES[l.id], l.id).toBe('function')
  })
})
