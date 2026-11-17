import { rmSync } from 'fs'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import type { Member, Org, User } from '../app/types'

process.env.NEEMA_DATA_DIR = '.data-test/member-leave'

/*
 * Quem sai da empresa perde o acesso, mas o que fez fica com a empresa:
 * a administração continua a ver as tarefas, as reuniões, os quadros e o tempo.
 */

const base = { createdAt: 0, rankingVisibility: 'nome' as const, accountType: 'business' as const }
const users: Record<string, User> = {
  boss: { ...base, id: 'u-boss', email: 'boss@x.pt', name: 'Empresa', businessRole: 'company' },
  ana: { ...base, id: 'u-ana', email: 'ana@x.pt', name: 'Ana', businessRole: 'employee' },
  rui: { ...base, id: 'u-rui', email: 'rui@x.pt', name: 'Rui', businessRole: 'employee' },
}
let as: User | null = users.ana

vi.mock('../app/lib/server/auth', () => ({ currentUser: async () => as }))
vi.mock('../app/lib/server/push', () => ({ sendToUser: async () => 0, pushConfigured: () => false }))

const req = (method: string, body?: unknown, url = 'http://t/x') =>
  new Request(url, { method, headers: { 'content-type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) })
const ctx = (params: Record<string, string>) => ({ params: Promise.resolve(params) })
async function call(handler: unknown, method: string, params: Record<string, string> = {}, body?: unknown, url?: string) {
  const res = await (handler as (r: Request, c: unknown) => Promise<Response>)(req(method, body, url), ctx(params))
  return { status: res.status, json: await res.json() }
}

const orgId = 'org-1'
const member = (id: string, userId: string, name: string, role: Member['role']): Member => ({
  id, orgId, userId, email: `${name.toLowerCase()}@x.pt`, name, role, status: 'activo', presence: 'offline', joinedAt: 1, consentAt: 1,
})

beforeAll(async () => {
  rmSync('.data-test/member-leave', { recursive: true, force: true })
  const { mutate } = await import('../app/lib/server/store')
  const org: Org = { id: orgId, name: 'Acme', sector: 'Outro', inviteCode: 'ACME42', createdAt: 0, createdBy: 'u-boss' }
  await mutate('all', db => {
    db.users.push(users.boss, users.ana, users.rui)
    db.orgs.push(org)
    db.members.push(member('m-boss', 'u-boss', 'Empresa', 'admin'), member('m-ana', 'u-ana', 'Ana', 'admin'), member('m-rui', 'u-rui', 'Rui', 'membro'))
  })
})

describe('membro que sai da empresa', () => {
  let taskId = ''
  let eventId = ''
  let boardId = ''

  it('antes de sair: o Rui tem uma tarefa, marca uma reunião e cria um quadro privado', async () => {
    as = users.ana
    const tasks = await import('../app/api/orgs/[orgId]/tasks/route')
    const t = await call(tasks.POST, 'POST', { orgId }, { title: 'Relatório', assigneeId: 'm-rui' })
    expect(t.status).toBe(200)
    taskId = t.json.task.id

    as = users.rui
    const events = await import('../app/api/orgs/[orgId]/events/route')
    const e = await call(events.POST, 'POST', { orgId }, { title: 'Reunião', start: Date.now() + 3600e3, end: Date.now() + 7200e3 })
    expect(e.status).toBe(200)
    eventId = e.json.event.id

    const boards = await import('../app/api/quadros/route')
    const b = await call(boards.POST, 'POST', {}, { title: 'Plano', orgId, visibility: 'private' })
    expect(b.status).toBe(200)
    boardId = b.json.id
  })

  it('sair não apaga o registo: fica "saiu"', async () => {
    as = users.rui
    const one = await import('../app/api/orgs/[orgId]/members/[memberId]/route')
    expect((await call(one.DELETE, 'DELETE', { orgId, memberId: 'm-rui' })).status).toBe(200)
    const { read } = await import('../app/lib/server/store')
    const db = await read('all')
    const rui = db.members.find(m => m.id === 'm-rui')!
    expect(rui.status).toBe('saiu')
    expect(rui.leftAt).toBeGreaterThan(0)
  })

  it('quem saiu perde o acesso à empresa e aos quadros que lá criou', async () => {
    as = users.rui
    const org = await import('../app/api/orgs/[orgId]/route')
    expect((await call(org.GET, 'GET', { orgId })).status).toBe(403)
    const board = await import('../app/api/quadros/[boardId]/route')
    expect((await call(board.GET, 'GET', { boardId })).status).toBe(403)
  })

  it('o admin continua a ver a tarefa, a reunião e o quadro', async () => {
    as = users.ana
    const tasks = await import('../app/api/orgs/[orgId]/tasks/route')
    const team = await call(tasks.GET, 'GET', { orgId }, undefined, 'http://t/x?scope=team')
    expect(team.json.tasks.map((t: { id: string }) => t.id)).toContain(taskId)

    const events = await import('../app/api/orgs/[orgId]/events/route')
    const ev = await call(events.GET, 'GET', { orgId })
    expect(ev.json.events.map((e: { id: string }) => e.id)).toContain(eventId)

    const board = await import('../app/api/quadros/[boardId]/route')
    const b = await call(board.GET, 'GET', { boardId })
    expect(b.status).toBe(200)
  })

  it('a equipa já não o mostra, mas o admin recebe-o em "former"', async () => {
    as = users.ana
    const org = await import('../app/api/orgs/[orgId]/route')
    const got = await call(org.GET, 'GET', { orgId })
    expect(got.json.members.map((m: Member) => m.id)).not.toContain('m-rui')
    expect(got.json.former.map((m: Member) => m.id)).toEqual(['m-rui'])
  })

  it('não se atribuem tarefas a quem saiu', async () => {
    as = users.ana
    const tasks = await import('../app/api/orgs/[orgId]/tasks/route')
    expect((await call(tasks.POST, 'POST', { orgId }, { title: 'Outra', assigneeId: 'm-rui' })).status).toBe(400)
  })

  it('se voltar com o código, retoma o mesmo registo (com o histórico) como membro', async () => {
    as = users.rui
    const join = await import('../app/api/orgs/join/route')
    const res = await call(join.POST, 'POST', {}, { code: 'ACME42' })
    expect(res.status).toBe(200)
    expect(res.json.member).toMatchObject({ id: 'm-rui', status: 'activo', role: 'membro' })
    const board = await import('../app/api/quadros/[boardId]/route')
    expect((await call(board.GET, 'GET', { boardId })).status).toBe(200)
  })
})
