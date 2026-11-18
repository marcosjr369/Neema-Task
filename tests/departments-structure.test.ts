import { rmSync } from 'fs'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import type { Department, Member, Org, User } from '../app/types'
import { canMoveUnder, departmentPath, departmentTree, descendantIds, managedDepartmentIds } from '../app/lib/org'
import { CARD_W, layoutTree } from '../app/empresa/_components/structure/layout'

process.env.NEEMA_DATA_DIR = '.data-test/departments'

const dept = (id: string, parentId?: string, supervisorIds: string[] = []): Department =>
  ({ id, orgId: 'o', name: id, color: '#000', supervisorIds, parentId })
const person = (id: string, role: Member['role'], departmentId?: string) =>
  ({ id, orgId: 'o', email: `${id}@x.pt`, name: id, role, status: 'activo', presence: 'offline', departmentId } as Member)

// Empresa → Corporate → (Tech → Dev), Legal ; Growth no topo
const tree = [dept('corp', undefined, ['hel']), dept('tech', 'corp', ['fra', 'dep']), dept('dev', 'tech'), dept('legal', 'corp'), dept('growth')]

describe('árvore de departamentos', () => {
  it('descendentes, caminho e ordem da árvore', () => {
    expect([...descendantIds(tree, 'corp')].sort()).toEqual(['corp', 'dev', 'legal', 'tech'])
    expect(departmentPath(tree, 'dev').map(d => d.id)).toEqual(['corp', 'tech', 'dev'])
    expect(departmentTree(tree).map(({ dept, depth }) => `${depth}:${dept.id}`)).toEqual(['0:corp', '1:tech', '2:dev', '1:legal', '0:growth'])
  })

  it('não deixa criar ciclos', () => {
    expect(canMoveUnder(tree, 'corp', 'dev')).toBe(false)
    expect(canMoveUnder(tree, 'tech', 'tech')).toBe(false)
    expect(canMoveUnder(tree, 'tech', 'growth')).toBe(true)
    expect(canMoveUnder(tree, 'tech', undefined)).toBe(true)
  })

  it('um ciclo antigo nos dados não bloqueia nem faz desaparecer departamentos', () => {
    const loop = [dept('a', 'b'), dept('b', 'a'), dept('c')]
    expect(departmentTree(loop).map(x => x.dept.id).sort()).toEqual(['a', 'b', 'c'])
    expect(departmentPath(loop, 'a').length).toBe(2)
  })

  it('o chefe de um departamento gere também os subdepartamentos', () => {
    const scope = managedDepartmentIds(tree, person('hel', 'supervisor', 'corp')) as Set<string>
    expect([...scope].sort()).toEqual(['corp', 'dev', 'legal', 'tech'])
    const deputy = managedDepartmentIds(tree, person('dep', 'supervisor', 'tech')) as Set<string>
    expect([...deputy].sort()).toEqual(['dev', 'tech'])
    expect(managedDepartmentIds(tree, person('x', 'membro', 'tech'))).toEqual(new Set())
  })

  it('organograma: os pais ficam centrados sobre os filhos e os ramos recolhidos escondem-se', () => {
    const root = { id: 'r', children: [{ id: 'a', children: [{ id: 'a1', children: [] }, { id: 'a2', children: [] }] }, { id: 'b', children: [] }] }
    const open = layoutTree(root, new Set())
    const at = (id: string) => open.nodes.find(n => n.id === id)!
    expect(at('a').x).toBeCloseTo((at('a1').x + at('a2').x) / 2)
    expect(open.nodes.every(n => n.x >= 0 && n.x + CARD_W <= open.width)).toBe(true)
    const closed = layoutTree(root, new Set(['a']))
    expect(closed.nodes.map(n => n.id)).toEqual(['r', 'a', 'b'])
    expect(closed.edges.map(e => e.to)).toEqual(['a', 'b'])
  })
})

/* ─── API ─── */

const base = { createdAt: 0, rankingVisibility: 'nome' as const, accountType: 'business' as const }
const admin: User = { ...base, id: 'u-adm', email: 'adm@x.pt', name: 'Adm', businessRole: 'company' }
const sup: User = { ...base, id: 'u-sup', email: 'sup@x.pt', name: 'Sup', businessRole: 'employee' }
let as: User = admin

vi.mock('../app/lib/server/auth', () => ({ currentUser: async () => as }))
vi.mock('../app/lib/server/push', () => ({ sendToUser: async () => 0, pushConfigured: () => false }))

const orgId = 'org-d'
const call = async (handler: unknown, method: string, params: Record<string, string>, body?: unknown) => {
  const req = new Request('http://t/x', { method, headers: { 'content-type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) })
  const res = await (handler as (r: Request, c: unknown) => Promise<Response>)(req, { params: Promise.resolve(params) })
  return { status: res.status, json: await res.json() }
}
const m = (id: string, userId: string | undefined, role: Member['role']): Member =>
  ({ id, orgId, userId, email: `${id}@x.pt`, name: id, role, status: 'activo', presence: 'offline', joinedAt: 1, consentAt: 1 })

beforeAll(async () => {
  rmSync('.data-test/departments', { recursive: true, force: true })
  const { mutate } = await import('../app/lib/server/store')
  const org: Org = { id: orgId, name: 'Acme', sector: 'Outro', inviteCode: 'ACMED1', createdAt: 0, createdBy: 'u-adm' }
  await mutate('all', db => {
    db.users.push(admin, sup)
    db.orgs.push(org)
    db.members.push(m('m-adm', 'u-adm', 'admin'), m('m-sup', 'u-sup', 'membro'), m('m-ana', undefined, 'membro'), m('m-rui', undefined, 'membro'))
  })
})

describe('API da estrutura', () => {
  const ids: Record<string, string> = {}
  const db = async () => (await import('../app/lib/server/store')).read('all')

  it('cria departamento e subdepartamento com chefe, adjunto e funcionários', async () => {
    as = admin
    const list = await import('../app/api/orgs/[orgId]/departments/route')
    const corp = await call(list.POST, 'POST', { orgId }, { name: 'Corporate', description: ' Serviços ', supervisorIds: ['m-sup'] })
    expect(corp.status).toBe(200)
    ids.corp = corp.json.department.id
    expect(corp.json.department.description).toBe('Serviços')

    const tech = await call(list.POST, 'POST', { orgId }, { name: 'Tech', parentId: ids.corp, supervisorIds: ['m-ana', 'm-rui'], memberIds: ['m-rui'] })
    expect(tech.status).toBe(200)
    ids.tech = tech.json.department.id
    const data = await db()
    expect(data.departments.find(d => d.id === ids.tech)).toMatchObject({ parentId: ids.corp, supervisorIds: ['m-ana', 'm-rui'] })
    expect(data.members.find(x => x.id === 'm-rui')!.departmentId).toBe(ids.tech)
    // escolhido para a chefia passa a supervisor
    expect(data.members.find(x => x.id === 'm-sup')!.role).toBe('supervisor')
  })

  it('o chefe do departamento de cima pode atribuir tarefas a quem está no subdepartamento', async () => {
    as = sup
    const tasks = await import('../app/api/orgs/[orgId]/tasks/route')
    expect((await call(tasks.POST, 'POST', { orgId }, { title: 'Relatório', assigneeId: 'm-rui' })).status).toBe(200)
  })

  it('recusa ciclos e departamentos superiores inválidos', async () => {
    as = admin
    const one = await import('../app/api/orgs/[orgId]/departments/[deptId]/route')
    expect((await call(one.PATCH, 'PATCH', { orgId, deptId: ids.corp }, { parentId: ids.tech })).status).toBe(400)
    expect((await call(one.PATCH, 'PATCH', { orgId, deptId: ids.tech }, { parentId: 'nao-existe' })).status).toBe(400)
    expect((await call(one.PATCH, 'PATCH', { orgId, deptId: ids.tech }, { name: '  ' })).status).toBe(400)
  })

  it('tirar alguém da lista de funcionários deixa-o sem departamento', async () => {
    as = admin
    const one = await import('../app/api/orgs/[orgId]/departments/[deptId]/route')
    expect((await call(one.PATCH, 'PATCH', { orgId, deptId: ids.tech }, { memberIds: [] })).status).toBe(200)
    expect((await db()).members.find(x => x.id === 'm-rui')!.departmentId).toBeUndefined()
    await call(one.PATCH, 'PATCH', { orgId, deptId: ids.tech }, { memberIds: ['m-rui'] })
  })

  it('apagar passa subdepartamentos e pessoas para o departamento de cima', async () => {
    as = admin
    const list = await import('../app/api/orgs/[orgId]/departments/route')
    const dev = await call(list.POST, 'POST', { orgId }, { name: 'Dev', parentId: ids.tech })
    const one = await import('../app/api/orgs/[orgId]/departments/[deptId]/route')
    expect((await call(one.DELETE, 'DELETE', { orgId, deptId: ids.tech })).status).toBe(200)
    const data = await db()
    expect(data.departments.some(d => d.id === ids.tech)).toBe(false)
    expect(data.departments.find(d => d.id === dev.json.department.id)!.parentId).toBe(ids.corp)
    expect(data.members.find(x => x.id === 'm-rui')!.departmentId).toBe(ids.corp)
  })

  it('só administradores mexem na estrutura', async () => {
    as = sup
    const list = await import('../app/api/orgs/[orgId]/departments/route')
    expect((await call(list.POST, 'POST', { orgId }, { name: 'X' })).status).toBe(403)
  })
})
