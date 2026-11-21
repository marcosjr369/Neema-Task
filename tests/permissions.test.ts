import { rmSync } from 'fs'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import type { Department, Member, Org, User } from '../app/types'
import { canUse, cleanPermissions } from '../app/lib/permissions'

process.env.NEEMA_DATA_DIR = '.data-test/permissions'

const dept = (id: string, parentId?: string): Department => ({ id, orgId: 'o', name: id, color: '#000', supervisorIds: [], parentId })
const tree = [dept('vendas'), dept('norte', 'vendas'), dept('ti')]
const who = (id: string, role: Member['role'], departmentId?: string) => ({ id, role, departmentId })

describe('permissões: regras', () => {
  it('sem regra todos podem; administradores podem sempre', () => {
    expect(canUse(undefined, tree, who('a', 'membro'), 'inqueritos')).toBe(true)
    expect(canUse({ inqueritos: { mode: 'admins' } }, tree, who('a', 'admin'), 'inqueritos')).toBe(true)
    expect(canUse({ inqueritos: { mode: 'admins' } }, tree, who('a', 'supervisor'), 'inqueritos')).toBe(false)
  })

  it('"chefias e administradores" deixa as chefias, não os funcionários', () => {
    const p = { quadros: { mode: 'managers' as const } }
    expect(canUse(p, tree, who('a', 'supervisor'), 'quadros')).toBe(true)
    expect(canUse(p, tree, who('a', 'membro'), 'quadros')).toBe(false)
  })

  it('"escolher": pessoas e departamentos (com os subdepartamentos)', () => {
    const p = { inqueritos: { mode: 'some' as const, memberIds: ['m-x'], departmentIds: ['vendas'] } }
    expect(canUse(p, tree, who('m-x', 'membro', 'ti'), 'inqueritos')).toBe(true)
    expect(canUse(p, tree, who('m-y', 'membro', 'norte'), 'inqueritos')).toBe(true)
    expect(canUse(p, tree, who('m-z', 'membro', 'ti'), 'inqueritos')).toBe(false)
    expect(canUse(p, tree, who('m-w', 'membro'), 'inqueritos')).toBe(false)
  })

  it('limpa o que chega: só ids desta empresa, e "todos" não se guarda', () => {
    const clean = cleanPermissions(
      { inqueritos: { mode: 'some', memberIds: ['m1', 'intruso'], departmentIds: ['d1', 'd-outra'] }, quadros: { mode: 'all' }, jogos: { mode: 'hack' } },
      new Set(['m1']), new Set(['d1']),
    )
    expect(clean).toEqual({ inqueritos: { mode: 'some', memberIds: ['m1'], departmentIds: ['d1'] } })
    // nomes herdados de Object (toString, constructor…) não são modos válidos
    expect(cleanPermissions({ quadros: { mode: 'toString' } }, new Set(), new Set())).toEqual({})
  })
})

/* ─── API ─── */

const base = { createdAt: 0, rankingVisibility: 'nome' as const, accountType: 'business' as const }
const users: Record<string, User> = {
  adm: { ...base, id: 'u-adm', email: 'adm@x.pt', name: 'Adm' },
  ana: { ...base, id: 'u-ana', email: 'ana@x.pt', name: 'Ana' },
  rui: { ...base, id: 'u-rui', email: 'rui@x.pt', name: 'Rui' },
}
let as: User = users.adm

vi.mock('../app/lib/server/auth', () => ({ currentUser: async () => as }))
vi.mock('../app/lib/server/push', () => ({ sendToUser: async () => 0, pushConfigured: () => false }))

const orgId = 'org-perm'
const call = async (handler: unknown, method: string, params: Record<string, string>, body?: unknown, url = 'http://t/x') => {
  const req = new Request(url, { method, headers: { 'content-type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) })
  const res = await (handler as (r: Request, c: unknown) => Promise<Response>)(req, { params: Promise.resolve(params) })
  return { status: res.status, json: await res.json() }
}
const m = (id: string, userId: string, role: Member['role'], departmentId?: string): Member =>
  ({ id, orgId, userId, email: `${id}@x.pt`, name: id, role, status: 'activo', presence: 'offline', joinedAt: 1, consentAt: 1, departmentId })

beforeAll(async () => {
  rmSync('.data-test/permissions', { recursive: true, force: true })
  const { mutate } = await import('../app/lib/server/store')
  const org: Org = { id: orgId, name: 'Acme', sector: 'Outro', inviteCode: 'PERM01', createdAt: 0, createdBy: 'u-adm' }
  await mutate('all', db => {
    db.users.push(...Object.values(users))
    db.orgs.push(org)
    db.departments.push({ id: 'd-mkt', orgId, name: 'Marketing', color: '#000', supervisorIds: [] })
    db.members.push(m('m-adm', 'u-adm', 'admin'), m('m-ana', 'u-ana', 'membro', 'd-mkt'), m('m-rui', 'u-rui', 'membro'))
  })
})

describe('API das permissões', () => {
  const org = () => import('../app/api/orgs/[orgId]/route')
  const polls = () => import('../app/api/inqueritos/route')

  it('só administradores mudam as permissões', async () => {
    as = users.ana
    expect((await call((await org()).PATCH, 'PATCH', { orgId }, { permissions: { inqueritos: { mode: 'admins' } } })).status).toBe(403)
    as = users.adm
    const r = await call((await org()).PATCH, 'PATCH', { orgId }, {
      permissions: { inqueritos: { mode: 'some', departmentIds: ['d-mkt'] }, quadros: { mode: 'admins' }, ranking: { mode: 'admins' }, reunioes: { mode: 'managers' }, formulariosPublicos: { mode: 'admins' } },
    })
    expect(r.status).toBe(200)
    expect(r.json.org.permissions.inqueritos).toEqual({ mode: 'some', memberIds: [], departmentIds: ['d-mkt'] })
  })

  it('inquéritos: o Marketing cria, o Rui não; no espaço pessoal o Rui cria à vontade', async () => {
    as = users.ana
    expect((await call((await polls()).POST, 'POST', {}, { type: 'vote', sample: true, orgId })).status).toBe(200)
    as = users.rui
    const denied = await call((await polls()).POST, 'POST', {}, { type: 'vote', sample: true, orgId })
    expect(denied.status).toBe(403)
    expect(denied.json.error).toMatch(/criar inquéritos/)
    expect((await call((await polls()).POST, 'POST', {}, { type: 'vote', sample: true })).status).toBe(200)
  })

  it('quadros só administradores; ranking escondido; reuniões só chefias', async () => {
    as = users.ana
    const boards = await import('../app/api/quadros/route')
    expect((await call(boards.POST, 'POST', {}, { title: 'Q', orgId })).status).toBe(403)
    const ranking = await import('../app/api/orgs/[orgId]/ranking/route')
    expect((await call(ranking.GET, 'GET', { orgId })).status).toBe(403)
    const events = await import('../app/api/orgs/[orgId]/events/route')
    expect((await call(events.POST, 'POST', { orgId }, { title: 'Reunião', start: Date.now() + 3600e3, end: Date.now() + 7200e3 })).status).toBe(403)
    as = users.adm
    expect((await call(boards.POST, 'POST', {}, { title: 'Q', orgId })).status).toBe(200)
    expect((await call(ranking.GET, 'GET', { orgId })).status).toBe(200)
  })

  it('respostas sem conta: a Ana cria o inquérito mas não o abre a pessoas de fora', async () => {
    as = users.ana
    const { id } = (await call((await polls()).POST, 'POST', {}, { type: 'form', sample: true, orgId })).json
    const one = await import('../app/api/inqueritos/[id]/route')
    // os formulários novos vêm abertos ao link, mas não para quem não tem esta permissão
    expect((await call(one.GET, 'GET', { id })).json.poll.settings.publicLink).toBe(false)
    const again = await call(one.PATCH, 'PATCH', { id }, { settings: { publicLink: true } })
    expect(again.status).toBe(403)
    expect(again.json.error).toMatch(/pessoas de fora/)
  })
})
