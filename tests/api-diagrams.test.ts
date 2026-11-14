import { rmSync } from 'fs'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import type { User } from '../app/types'

process.env.NEEMA_DATA_DIR = '.data-test/api-diagrams'

/*
 * Rotas de verdade (app/api/...), com a store em ficheiro numa pasta dos testes (.data-test).
 * Só o login é simulado: currentUser() devolve quem estiver em "as".
 */

const users: Record<string, User> = {
  ana: { id: 'u-ana', email: 'ana@x.pt', name: 'Ana', createdAt: 0, rankingVisibility: 'nome' },
  rui: { id: 'u-rui', email: 'rui@x.pt', name: 'Rui', createdAt: 0, rankingVisibility: 'nome' },
}
let as: User | null = users.ana

vi.mock('../app/lib/server/auth', () => ({ currentUser: async () => as }))
vi.mock('../app/lib/server/push', () => ({ sendToUser: async () => 0, pushConfigured: () => false }))

const req = (method: string, body?: unknown, url = 'http://t/x') =>
  new Request(url, { method, headers: { 'content-type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) })
const ctx = (params: Record<string, string>) => ({ params: Promise.resolve(params) })
async function call(handler: (r: Request, c: { params: Promise<Record<string, string>> }) => Promise<Response>, method: string, params: Record<string, string> = {}, body?: unknown, url?: string) {
  const res = await handler(req(method, body, url), ctx(params))
  return { status: res.status, json: await res.json() }
}

beforeAll(async () => {
  rmSync('.data-test/api-diagrams', { recursive: true, force: true })
  const { mutate } = await import('../app/lib/server/store')
  await mutate('all', db => { db.users.push(users.ana, users.rui) })
})

describe('API dos diagramas', () => {
  let id = ''

  it('cria um diagrama (vazio por defeito) e lista-o', async () => {
    const list = await import('../app/api/diagramas/route')
    const created = await call(list.POST as never, 'POST', {}, { title: '  Processo  ', visibility: 'private' })
    expect(created.status).toBe(200)
    id = created.json.id
    const got = await call(list.GET as never, 'GET')
    expect(got.json.diagrams).toHaveLength(1)
    expect(got.json.diagrams[0]).toMatchObject({ title: 'Processo', mine: true, access: 'owner' })
  })

  it('recusa nome vazio e XML que não é do draw.io', async () => {
    const list = await import('../app/api/diagramas/route')
    expect((await call(list.POST as never, 'POST', {}, { title: '' })).status).toBe(400)
    expect((await call(list.POST as never, 'POST', {}, { title: 'X', xml: '<html/>' })).status).toBe(400)
  })

  it('grava com a versão certa e sobe a versão', async () => {
    const one = await import('../app/api/diagramas/[id]/route')
    const before = await call(one.GET as never, 'GET', { id })
    expect(before.json.rev).toBe(1)
    const saved = await call(one.PATCH as never, 'PATCH', { id }, { xml: '<mxfile><diagram>v2</diagram></mxfile>', rev: 1 })
    expect(saved.status).toBe(200)
    expect(saved.json.rev).toBe(2)
  })

  it('com a versão antiga dá conflito (409); com force grava por cima', async () => {
    const one = await import('../app/api/diagramas/[id]/route')
    const stale = await call(one.PATCH as never, 'PATCH', { id }, { xml: '<mxfile><diagram>velho</diagram></mxfile>', rev: 1 })
    expect(stale.status).toBe(409)
    const forced = await call(one.PATCH as never, 'PATCH', { id }, { xml: '<mxfile><diagram>meu</diagram></mxfile>', rev: 1, force: true })
    expect(forced.json.rev).toBe(3)
  })

  it('?rev= igual não reenvia o conteúdo', async () => {
    const one = await import('../app/api/diagramas/[id]/route')
    const same = await call(one.GET as never, 'GET', { id }, undefined, `http://t/x?rev=3`)
    expect(same.json.unchanged).toBe(true)
    expect(same.json.diagram).toBeUndefined()
  })

  it('outra pessoa sem convite não vê nem grava', async () => {
    const one = await import('../app/api/diagramas/[id]/route')
    as = users.rui
    expect((await call(one.GET as never, 'GET', { id })).status).toBe(403)
    expect((await call(one.PATCH as never, 'PATCH', { id }, { title: 'roubado' })).status).toBe(403)
    as = users.ana
  })

  it('convidado só para ver não pode gravar', async () => {
    const share = await import('../app/api/diagramas/[id]/share/route')
    const one = await import('../app/api/diagramas/[id]/route')
    const invited = await call(share.POST as never, 'POST', { id }, { email: 'rui@x.pt', role: 'view' })
    expect(invited.status).toBe(200)
    as = users.rui
    const seen = await call(one.GET as never, 'GET', { id })
    expect(seen.json.access).toBe('view')
    expect(seen.json.diagram.sharing.token).toBeUndefined() // o link só aparece ao dono
    expect((await call(one.PATCH as never, 'PATCH', { id }, { title: 'x' })).status).toBe(403)
    as = users.ana
  })

  it('link público: quem não tem conta vê, sem dados do dono', async () => {
    const share = await import('../app/api/diagramas/[id]/share/route')
    const one = await import('../app/api/diagramas/[id]/route')
    const link = await import('../app/api/partilha/[token]/route')
    await call(share.PATCH as never, 'PATCH', { id }, { visibility: 'link' })
    const token = (await call(one.GET as never, 'GET', { id })).json.diagram.sharing.token
    as = null
    const pub = await call(link.GET as never, 'GET', { token })
    expect(pub.json.status).toBe('ok')
    expect(pub.json.kind).toBe('diagram')
    expect(pub.json.diagram.ownerId).toBe('')
    expect(pub.json.diagram.sharing.token).toBeUndefined()
    as = users.ana
  })

  it('só o dono apaga', async () => {
    const one = await import('../app/api/diagramas/[id]/route')
    as = users.rui
    expect((await call(one.DELETE as never, 'DELETE', { id })).status).toBe(403)
    as = users.ana
    expect((await call(one.DELETE as never, 'DELETE', { id })).status).toBe(200)
    expect((await call(one.GET as never, 'GET', { id })).status).toBe(404)
  })
})

describe('partilhas por ver (ponto no menu)', () => {
  it('ao partilhar conta como novidade até a pessoa abrir', async () => {
    const list = await import('../app/api/diagramas/route')
    const one = await import('../app/api/diagramas/[id]/route')
    const share = await import('../app/api/diagramas/[id]/share/route')
    const news = await import('../app/api/me/novidades/route')
    as = users.ana
    const id = (await call(list.POST as never, 'POST', {}, { title: 'Novo fluxo', visibility: 'private' })).json.id
    await call(share.POST as never, 'POST', { id }, { email: 'rui@x.pt', role: 'edit' })

    // a dona não tem novidades; o Rui tem uma, e a lista marca-a como nova
    expect((await call(news.GET as never, 'GET')).json.diagram).toBe(0)
    as = users.rui
    expect((await call(news.GET as never, 'GET')).json).toMatchObject({ diagram: 1, board: 0, sheet: 0 })
    const listed = (await call(list.GET as never, 'GET')).json.diagrams.find((d: { id: string }) => d.id === id)
    expect(listed.fresh).toBe(true)

    // abriu: deixa de contar
    expect((await call(one.GET as never, 'GET', { id })).status).toBe(200)
    expect((await call(news.GET as never, 'GET')).json.diagram).toBe(0)
    expect((await call(list.GET as never, 'GET')).json.diagrams.find((d: { id: string }) => d.id === id).fresh).toBe(false)

    // mudar só a permissão não volta a acender o ponto
    as = users.ana
    await call(share.POST as never, 'POST', { id }, { email: 'rui@x.pt', role: 'view' })
    as = users.rui
    expect((await call(news.GET as never, 'GET')).json.diagram).toBe(0)
    as = users.ana
  })
})

describe('painel: dados em memória', () => {
  it('pedidos seguidos partilham a mesma leitura; uma escrita obriga a ler de novo', async () => {
    const { panelData } = await import('../app/lib/server/panel')
    const { mutate } = await import('../app/lib/server/store')
    const a = panelData()
    expect(panelData()).toBe(a)
    const before = (await a).users.length
    await mutate('all', db => { db.users.push({ id: 'u-novo', email: 'novo@x.pt', name: 'Novo', createdAt: 0, rankingVisibility: 'nome' }) })
    const b = panelData()
    expect(b).not.toBe(a)
    expect((await b).users.length).toBe(before + 1)
  })
})
