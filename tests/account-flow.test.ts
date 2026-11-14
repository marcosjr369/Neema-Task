import { rmSync } from 'fs'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import type { User } from '../app/types'
import { accountTypeOf, businessRoleOf, loginUrl, safeReturnPath } from '../app/lib/account'

/*
 * Abertura de conta e entrada: tipo de conta (pessoal / empresa / funcionário), criar empresa,
 * entrar com código ou pelo domínio do email, e o regresso depois do login (?volta=).
 * Rotas de verdade com a store em ficheiro (pasta própria deste ficheiro); o login é simulado.
 */
process.env.NEEMA_DATA_DIR = '.data-test/account-flow'

const u = (id: string, email: string, extra: Partial<User> = {}): User =>
  ({ id, email, name: id, createdAt: 0, rankingVisibility: 'nome', emailVerified: true, ...extra })

const users = {
  pessoal: u('u-pessoal', 'pessoal@gmail.com'),
  empresa: u('u-empresa', 'geral@acme.pt'),
  func: u('u-func', 'joana@gmail.com'),
  colega: u('u-colega', 'rui@acme.pt'),
  falso: u('u-falso', 'intruso@acme.pt', { emailVerified: false }),
  convidada: u('u-convidada', 'nova@acme.pt'),
}
let as: User | null = null

vi.mock('../app/lib/server/auth', () => ({ currentUser: async () => as }))
vi.mock('../app/lib/server/push', () => ({ sendToUser: async () => 0, pushConfigured: () => false }))

type Handler = (r: Request, c: { params: Promise<Record<string, string>> }) => Promise<Response>
async function call(handler: unknown, method: string, body?: unknown, url = 'http://t/x', headers: Record<string, string> = {}) {
  const req = new Request(url, {
    method,
    headers: { 'content-type': 'application/json', ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const res = await (handler as Handler)(req, { params: Promise.resolve({}) })
  return { status: res.status, json: await res.json() }
}

const db = async () => (await import('../app/lib/server/store')).read()
const me = async (id: string) => (await db()).users.find(x => x.id === id)!

beforeAll(async () => {
  rmSync('.data-test/account-flow', { recursive: true, force: true })
  const { mutate } = await import('../app/lib/server/store')
  await mutate('all', d => { d.users.push(...Object.values(users)) })
})

describe('regresso depois do login (?volta=)', () => {
  it('aceita caminhos da app, com pesquisa', () => {
    expect(safeReturnPath('/quadros/abc')).toBe('/quadros/abc')
    expect(safeReturnPath('/planilhas?x=1#a')).toBe('/planilhas?x=1#a')
    expect(safeReturnPath('/p/TOKEN')).toBe('/p/TOKEN')
  })

  it('recusa outros sites, a própria entrada e lixo', () => {
    for (const bad of ['https://mau.com', '//mau.com', '/\\mau.com', 'quadros', '', null, undefined, '/entrar', '/entrar?passo=login', '/', '/a\nb', `/${'x'.repeat(600)}`]) {
      expect(safeReturnPath(bad)).toBeNull()
    }
  })

  it('o endereço do login leva a volta codificada (e sem volta, só o login)', () => {
    expect(loginUrl('/quadros/a?b=1')).toBe('/entrar?passo=login&volta=%2Fquadros%2Fa%3Fb%3D1')
    expect(loginUrl('//mau.com')).toBe('/entrar?passo=login')
    expect(loginUrl()).toBe('/entrar?passo=login')
  })
})

describe('tipo de conta (contas antigas sem tipo gravado)', () => {
  it('deduz o tipo e o papel', () => {
    expect(accountTypeOf(u('a', 'a@x'), false)).toBeUndefined()
    expect(accountTypeOf(u('a', 'a@x'), true)).toBe('business')
    expect(accountTypeOf(u('a', 'a@x', { workspace: { kind: 'personal' } }), false)).toBe('personal')
    expect(accountTypeOf(u('a', 'a@x', { accountType: 'personal' }), true)).toBe('personal')
    expect(businessRoleOf(u('a', 'a@x'), true, true)).toBe('company')
    expect(businessRoleOf(u('a', 'a@x'), false, true)).toBe('employee')
    expect(businessRoleOf(u('a', 'a@x'), false, false)).toBeUndefined()
  })
})

describe('abrir conta', () => {
  let code = ''
  let orgId = ''

  it('conta nova: ainda sem tipo (a entrada pergunta)', async () => {
    const meRoute = await import('../app/api/me/route')
    as = users.pessoal
    const got = await call(meRoute.GET, 'GET')
    expect(got.json.user.id).toBe('u-pessoal')
    expect(accountTypeOf(got.json.user, got.json.memberships.length > 0)).toBeUndefined()
  })

  it('pessoal: grava o tipo e o espaço; repetir não estraga', async () => {
    const meRoute = await import('../app/api/me/route')
    as = users.pessoal
    expect((await call(meRoute.PATCH, 'PATCH', { accountType: 'personal' })).status).toBe(200)
    expect((await call(meRoute.PATCH, 'PATCH', { accountType: 'personal' })).status).toBe(200)
    expect(await me('u-pessoal')).toMatchObject({ accountType: 'personal', workspace: { kind: 'personal' } })
  })

  it('conta pessoal não cria empresas', async () => {
    const orgs = await import('../app/api/orgs/route')
    as = users.pessoal
    const res = await call(orgs.POST, 'POST', { name: 'Minha' })
    expect(res.status).toBe(403)
  })

  it('empresa: cria com nome limpo, departamentos e código; a conta passa a ser a empresa', async () => {
    const orgs = await import('../app/api/orgs/route')
    as = users.empresa
    expect((await call(orgs.POST, 'POST', { name: '   ' })).status).toBe(400)
    const res = await call(orgs.POST, 'POST', { name: '  Acme  ', sector: 'Tecnologia', domain: '@ACME.pt', departments: ['Comercial', ' ', 'TI'] })
    expect(res.status).toBe(200)
    expect(res.json.org).toMatchObject({ name: 'Acme', domain: 'acme.pt' })
    expect(res.json.org.inviteCode).toMatch(/^[A-Z2-9]{6}$/)
    code = res.json.org.inviteCode
    orgId = res.json.org.id
    expect((await db()).departments.filter(d => d.orgId === orgId).map(d => d.name)).toEqual(['Comercial', 'TI'])
    expect(await me('u-empresa')).toMatchObject({ accountType: 'business', businessRole: 'company', workspace: { kind: 'org', orgId } })
  })

  it('a conta da empresa não tem espaço pessoal nem entra noutra empresa', async () => {
    const meRoute = await import('../app/api/me/route')
    const join = await import('../app/api/orgs/join/route')
    as = users.empresa
    expect((await call(meRoute.PATCH, 'PATCH', { accountType: 'personal' })).status).toBe(409)
    expect((await call(join.POST, 'POST', { code })).status).toBe(403)
  })

  it('validar o código antes do login: só nome e sector; aceita minúsculas e o prefixo', async () => {
    const convite = await import('../app/api/orgs/convite/route')
    const ok = await call(convite.GET, 'GET', undefined, `http://t/x?codigo=neema-${code.toLowerCase()}`, { 'x-forwarded-for': '10.0.0.1' })
    expect(ok.json).toEqual({ name: 'Acme', sector: 'Tecnologia' })
    expect((await call(convite.GET, 'GET', undefined, 'http://t/x?codigo=ZZZZZZ', { 'x-forwarded-for': '10.0.0.1' })).status).toBe(404)
    expect((await call(convite.GET, 'GET', undefined, 'http://t/x?codigo=AB', { 'x-forwarded-for': '10.0.0.1' })).status).toBe(400)
  })

  it('adivinhar códigos: ao fim de 20 tentativas por IP, espera', async () => {
    const convite = await import('../app/api/orgs/convite/route')
    const statuses: number[] = []
    for (let i = 0; i < 22; i++) {
      statuses.push((await call(convite.GET, 'GET', undefined, 'http://t/x?codigo=QQQQQQ', { 'x-forwarded-for': '10.9.9.9' })).status)
    }
    expect(statuses.slice(0, 20).every(s => s === 404)).toBe(true)
    expect(statuses.at(-1)).toBe(429)
    // outro IP não é afectado
    expect((await call(convite.GET, 'GET', undefined, `http://t/x?codigo=${code}`, { 'x-forwarded-for': '10.0.0.2' })).status).toBe(200)
  })

  it('funcionário: entra com o código; já não pode criar empresas nem passar a pessoal', async () => {
    const join = await import('../app/api/orgs/join/route')
    const orgs = await import('../app/api/orgs/route')
    const meRoute = await import('../app/api/me/route')
    as = users.func
    expect((await call(join.POST, 'POST', { code: 'NOPE00' })).status).toBe(404)
    const res = await call(join.POST, 'POST', { code: ` ${code.toLowerCase()} ` })
    expect(res.status).toBe(200)
    expect(res.json.member).toMatchObject({ status: 'activo', role: 'membro', userId: 'u-func' })
    expect(await me('u-func')).toMatchObject({ accountType: 'business', businessRole: 'employee' })
    // entrar outra vez não duplica
    await call(join.POST, 'POST', { code })
    expect((await db()).members.filter(m => m.userId === 'u-func')).toHaveLength(1)
    expect((await call(orgs.POST, 'POST', { name: 'Outra' })).status).toBe(403)
    expect((await call(meRoute.PATCH, 'PATCH', { accountType: 'personal' })).status).toBe(409)
  })

  it('pessoal com convite: só passa a empresa se confirmar', async () => {
    const join = await import('../app/api/orgs/join/route')
    as = users.pessoal
    expect((await call(join.POST, 'POST', { code })).status).toBe(409)
    expect((await me('u-pessoal')).accountType).toBe('personal')
    expect((await call(join.POST, 'POST', { code, convert: true })).status).toBe(200)
    expect(await me('u-pessoal')).toMatchObject({ accountType: 'business', businessRole: 'employee' })
  })

  it('pelo domínio do email: só com o email confirmado', async () => {
    const join = await import('../app/api/orgs/join/route')
    as = users.falso
    expect((await call(join.POST, 'POST', { orgId })).status).toBe(404)
    as = users.colega
    expect((await call(join.POST, 'POST', { orgId })).status).toBe(200)
    // o domínio de outra empresa não serve
    as = users.func
    expect((await call(join.POST, 'POST', { orgId: 'outra' })).status).toBe(404)
  })

  it('convite pendente com o email: entrar ocupa esse lugar (sem duplicar)', async () => {
    const { mutate } = await import('../app/lib/server/store')
    const join = await import('../app/api/orgs/join/route')
    await mutate('all', d => {
      d.members.push({ id: 'm-pend', orgId, email: 'nova@acme.pt', name: 'Nova', role: 'supervisor', status: 'pendente', presence: 'offline' })
    })
    as = users.convidada
    const res = await call(join.POST, 'POST', { code })
    expect(res.json.member).toMatchObject({ id: 'm-pend', status: 'activo', role: 'supervisor', userId: 'u-convidada' })
    expect((await db()).members.filter(m => m.email === 'nova@acme.pt')).toHaveLength(1)
  })

  it('sem sessão: 401 em vez de criar coisas', async () => {
    const orgs = await import('../app/api/orgs/route')
    const join = await import('../app/api/orgs/join/route')
    as = null
    expect((await call(orgs.POST, 'POST', { name: 'X' })).status).toBe(401)
    expect((await call(join.POST, 'POST', { code })).status).toBe(401)
  })
})
