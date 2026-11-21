import { rmSync } from 'fs'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import type { User } from '../app/types'

process.env.NEEMA_DATA_DIR = '.data-test/api-polls'

/* Rotas de verdade (app/api/...), com a store em ficheiro. Só o login é simulado. */

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
type H = (r: Request, c: { params: Promise<Record<string, string>> }) => Promise<Response>
async function call(handler: unknown, method: string, params: Record<string, string> = {}, body?: unknown, url?: string) {
  const res = await (handler as H)(req(method, body, url), ctx(params))
  return { status: res.status, json: await res.json() }
}

const list = () => import('../app/api/inqueritos/route')
const one = () => import('../app/api/inqueritos/[id]/route')
const answers = () => import('../app/api/inqueritos/[id]/respostas/route')
const entries = () => import('../app/api/inqueritos/[id]/entradas/route')
const share = () => import('../app/api/inqueritos/[id]/share/route')
const publicLink = () => import('../app/api/partilha/[token]/route')
const publicAnswer = () => import('../app/api/partilha/[token]/responder/route')

async function create(type: string, extra: Record<string, unknown> = {}) {
  as = users.ana
  const r = await call((await list()).POST, 'POST', {}, { type, sample: true, ...extra })
  expect(r.status).toBe(200)
  return r.json.id as string
}
async function invite(id: string) {
  as = users.ana
  expect((await call((await share()).POST, 'POST', { id }, { email: 'rui@x.pt', role: 'view' })).status).toBe(200)
}
const publish = async (id: string, settings?: Record<string, unknown>) => {
  as = users.ana
  if (settings) expect((await call((await one()).PATCH, 'PATCH', { id }, { settings })).status).toBe(200)
  const r = await call((await one()).PATCH, 'PATCH', { id }, { status: 'open' })
  expect(r.status).toBe(200)
  return r.json
}

beforeAll(async () => {
  rmSync('.data-test/api-polls', { recursive: true, force: true })
  const { mutate } = await import('../app/lib/server/store')
  await mutate('all', db => { db.users.push(users.ana, users.rui) })
})

describe('API dos inquéritos', () => {
  it('votação: rascunho escondido, publicar, responder, mudar a resposta e ver resultados', async () => {
    const id = await create('vote')
    await invite(id)

    as = users.rui
    expect((await call((await one()).GET, 'GET', { id })).status).toBe(403)
    expect((await call((await list()).GET, 'GET')).json.polls).toHaveLength(0)

    const opened = await publish(id)
    const [a, b] = opened.poll.fields[0].options

    as = users.rui
    const got = await call((await one()).GET, 'GET', { id })
    expect(got.json.access).toBe('view')
    expect(got.json.results).toBeUndefined()
    const field = got.json.poll.fields[0].id
    const voted = await call((await answers()).POST, 'POST', { id }, { answers: { [field]: a.id } })
    expect(voted.status).toBe(200)
    expect(voted.json.results.fields[0].counts[a.id]).toBe(1)

    // mudar o voto não conta duas vezes
    const changed = await call((await answers()).POST, 'POST', { id }, { answers: { [field]: b.id } })
    expect(changed.json.results.total).toBe(1)
    expect(changed.json.results.fields[0].counts[b.id]).toBe(1)
    expect(changed.json.poll.count).toBe(1)

    const mine = await call((await list()).GET, 'GET')
    expect(mine.json.polls[0]).toMatchObject({ id, answered: true, status: 'open' })

    // só quem gere vê cada resposta
    expect((await call((await answers()).GET, 'GET', { id })).status).toBe(403)
    as = users.ana
    const rows = await call((await answers()).GET, 'GET', { id })
    expect(rows.json.responses[0]).toMatchObject({ name: 'Rui' })
  })

  it('eleição: voto secreto (ninguém sabe quem votou) e não se vota duas vezes', async () => {
    const id = await create('election')
    await invite(id)
    const opened = await publish(id)
    const fields = opened.poll.fields as { id: string; options: { id: string }[] }[]
    expect(opened.poll.settings.anonymous).toBe(true)

    as = users.rui
    const ballot = Object.fromEntries(fields.map(f => [f.id, f.options[0].id]))
    expect((await call((await answers()).POST, 'POST', { id }, { answers: ballot })).status).toBe(200)
    const again = await call((await answers()).POST, 'POST', { id }, { answers: ballot })
    expect(again.status).toBe(400)

    as = users.ana
    const rows = await call((await answers()).GET, 'GET', { id })
    expect(rows.json.responses[0].name).toBeUndefined()
    const { read } = await import('../app/lib/server/store')
    const db = await read('all')
    const vote = db.responses.find(r => r.pollId === id)!
    expect(vote.voter).not.toBe(users.rui.id)
    expect(vote.userId).toBeUndefined()
    // não dá para tirar o anonimato depois de haver votos
    expect((await call((await one()).PATCH, 'PATCH', { id }, { settings: { anonymous: false } })).json.poll.settings.anonymous).toBe(true)
  })

  it('formulário pelo link: visitantes sem conta respondem; com "uma por pessoa" têm de entrar', async () => {
    const id = await create('form')
    const opened = await publish(id, { publicLink: true, onePerPerson: false })
    const token = opened.poll.sharing.token as string
    const scale = opened.poll.fields.find((f: { kind: string }) => f.kind === 'scale')
    const single = opened.poll.fields.find((f: { kind: string }) => f.kind === 'single')

    as = null
    const page = await call((await publicLink()).GET, 'GET', { token })
    expect(page.json).toMatchObject({ status: 'ok', kind: 'poll' })
    expect(page.json.detail.poll.ownerId).toBe('')
    const body = { answers: { [scale.id]: 4, [single.id]: single.options[0].id }, name: 'Cliente' }
    expect((await call((await publicAnswer()).POST, 'POST', { token }, body)).status).toBe(200)
    expect((await call((await publicAnswer()).POST, 'POST', { token }, body)).status).toBe(200)

    as = users.ana
    const rows = await call((await answers()).GET, 'GET', { id })
    expect(rows.json.responses).toHaveLength(2)
    expect(rows.json.responses[0]).toMatchObject({ name: 'Cliente', guest: true })

    // num formulário, "uma por pessoa" vale para quem tem conta: visitantes continuam a preencher
    await call((await one()).PATCH, 'PATCH', { id }, { settings: { onePerPerson: true } })
    as = null
    expect((await call((await publicAnswer()).POST, 'POST', { token }, body)).status).toBe(200)
  })

  it('formulário novo já aceita pessoas sem conta pelo link (como no Bitrix)', async () => {
    const id = await create('form', { orgId: undefined })
    const opened = await publish(id)
    expect(opened.poll.settings.publicLink).toBe(true)
    const scale = opened.poll.fields.find((f: { kind: string }) => f.kind === 'scale')
    const single = opened.poll.fields.find((f: { kind: string }) => f.kind === 'single')
    as = null
    const r = await call((await publicAnswer()).POST, 'POST', { token: opened.poll.sharing.token }, { answers: { [scale.id]: 5, [single.id]: single.options[0].id } })
    expect(r.status).toBe(200)
  })

  it('votação aberta pelo link com "uma por pessoa": quem não tem conta tem de entrar', async () => {
    const id = await create('vote')
    const opened = await publish(id, { publicLink: true })
    const f = opened.poll.fields[0]
    as = null
    const blocked = await call((await publicAnswer()).POST, 'POST', { token: opened.poll.sharing.token }, { answers: { [f.id]: f.options[0].id } })
    expect(blocked.status).toBe(400)
    expect(blocked.json.error).toMatch(/Entra na tua conta/)
  })

  it('sem link aberto, visitantes não respondem', async () => {
    const id = await create('vote')
    const opened = await publish(id)
    as = null
    const r = await call((await publicAnswer()).POST, 'POST', { token: opened.poll.sharing.token }, { answers: {} })
    expect(r.status).toBe(403)
  })

  it('link de um inquérito pessoal ainda em rascunho: ecrã de privado, sem erro', async () => {
    const id = await create('vote')
    as = users.ana
    await call((await share()).PATCH, 'PATCH', { id }, { visibility: 'link' })
    const { read } = await import('../app/lib/server/store')
    const token = (await read('all')).polls.find(p => p.id === id)!.sharing.token
    as = null
    const r = await call((await publicLink()).GET, 'GET', { token })
    expect(r.status).toBe(200)
    expect(r.json.status).toBe('private')
  })

  it('mudar a resposta mantém o ficheiro que não foi trocado', async () => {
    const id = await create('form')
    as = users.ana
    const fields = [{ id: 'cv', kind: 'file', title: 'CV' }, { id: 'nota', kind: 'short', title: 'Nota' }]
    await call((await one()).PATCH, 'PATCH', { id }, { fields, settings: { onePerPerson: true, canChange: true } })
    await publish(id)
    const answers = await import('../app/api/inqueritos/[id]/respostas/route')
    const form = new FormData()
    form.set('data', JSON.stringify({ answers: { nota: 'primeira' } }))
    form.set('file:cv', new File([new Uint8Array([37, 80, 68, 70])], 'cv.pdf', { type: 'application/pdf' }))
    const first = await answers.POST(new Request('http://t/x', { method: 'POST', body: form }), { params: Promise.resolve({ id }) })
    expect(first.status).toBe(200)
    const { read } = await import('../app/lib/server/store')
    const file = (await read('all')).responses.find(r => r.pollId === id)!.answers.cv as { id: string }
    // muda só o texto e manda o mesmo ficheiro (como o browser faz)
    const again = await call(answers.POST, 'POST', { id }, { answers: { nota: 'segunda', cv: file } })
    expect(again.status).toBe(200)
    const after = (await read('all')).responses.filter(r => r.pollId === id)
    expect(after).toHaveLength(1)
    expect(after[0].answers).toMatchObject({ nota: 'segunda', cv: { id: file.id } })
    const { readFile } = await import('../app/lib/server/files')
    expect(await readFile(file.id)).not.toBeNull()
  })

  it('ideias: propor, votar com limite e mudar o estado', async () => {
    const id = await create('ideas')
    await invite(id)
    await publish(id, { votesPerPerson: 1 })

    as = users.rui
    const one1 = await call((await entries()).POST, 'POST', { id }, { text: 'Máquina de café nova' })
    expect(one1.status).toBe(200)
    const two = await call((await entries()).POST, 'POST', { id }, { text: 'Plantas no escritório' })
    const [e1, e2] = two.json.entries as { id: string }[]
    expect((await call((await entries()).PATCH, 'PATCH', { id }, { entryId: e1.id, vote: 1 })).status).toBe(200)
    const over = await call((await entries()).PATCH, 'PATCH', { id }, { entryId: e2.id, vote: 1 })
    expect(over.status).toBe(400)
    // quem não gere não muda o estado
    expect((await call((await entries()).PATCH, 'PATCH', { id }, { entryId: e1.id, status: 'approved' })).status).toBe(403)

    as = users.ana
    const done = await call((await entries()).PATCH, 'PATCH', { id }, { entryId: e1.id, status: 'approved' })
    const top = done.json.entries[0]
    expect(top).toMatchObject({ id: e1.id, score: 1, status: 'approved', author: 'Rui' })
    expect(top.votes).toBe(1)
    // quem votou em quê nunca chega ao browser (só as contagens)
    expect(JSON.stringify(done.json.entries)).not.toContain('u-rui')
  })

  it('aspeto: imagem de cabeçalho visível a todos só enquanto o inquérito a usa', async () => {
    const id = await create('form')
    const images = await import('../app/api/inqueritos/[id]/imagens/route')
    const form = new FormData()
    form.set('file', new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47, 1, 2, 3])], 'logo.png', { type: 'image/png' }))
    const up = await images.POST(new Request('http://t/x', { method: 'POST', body: form }), { params: Promise.resolve({ id }) })
    const { id: imageId } = await up.json()
    expect(imageId).toMatch(/^pollimg-/)

    const get = async (f: string) => (await images.GET(new Request(`http://t/x?f=${f}`), { params: Promise.resolve({ id }) })).status
    // enviada mas ainda não usada no tema: não se mostra
    expect(await get(imageId)).toBe(404)
    const saved = await call((await one()).PATCH, 'PATCH', { id }, { theme: { color: '#12B5A6', background: 'dots', font: 'serif', header: { id: imageId } } })
    expect(saved.json.poll.theme).toMatchObject({ color: '#12B5A6', background: 'dots', font: 'serif', header: { id: imageId } })
    as = null
    expect(await get(imageId)).toBe(200)
    expect(await get('pollimg-nao-existe-0000')).toBe(404)

    // tirar o cabeçalho apaga a imagem
    as = users.ana
    await call((await one()).PATCH, 'PATCH', { id }, { theme: { ...saved.json.poll.theme, header: undefined } })
    const { readFile } = await import('../app/lib/server/files')
    expect(await readFile(imageId)).toBeNull()
  })

  it('exporta as respostas para uma planilha e apaga tudo ao apagar o inquérito', async () => {
    const id = await create('schedule')
    const opened = await publish(id)
    const f = opened.poll.fields[0]
    await call((await answers()).POST, 'POST', { id }, { answers: { [f.id]: { [f.options[0].id]: 'yes' } } })
    const exp = await import('../app/api/inqueritos/[id]/exportar/route')
    const sheet = await call(exp.POST, 'POST', { id })
    expect(sheet.status).toBe(200)
    const { read } = await import('../app/lib/server/store')
    let db = await read('all')
    const s = db.sheets.find(x => x.id === sheet.json.id)!
    expect(s.tabs[0].cells.A1).toBe('Data')
    expect(s.tabs[0].cells.B1).toBe('Nome')
    expect(s.tabs[0].cells.B2).toBe('Ana')

    expect((await call((await one()).DELETE, 'DELETE', { id })).status).toBe(200)
    db = await read('all')
    expect(db.polls.some(p => p.id === id)).toBe(false)
    expect(db.responses.some(r => r.pollId === id)).toBe(false)
  })
})
