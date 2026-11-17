import { rmSync } from 'fs'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import type { Member, Org, PresenceSegment, Session, Task, User } from '../app/types'

process.env.NEEMA_DATA_DIR = '.data-test/org-scopes'

/*
 * As rotas mais chamadas (de 30 em 30 s ou de minuto a minuto, por pessoa) carregam só o que é
 * de quem pede. Estes testes garantem que, mesmo lendo menos, devolvem o mesmo que antes.
 */

const base = { createdAt: 0, rankingVisibility: 'nome' as const, accountType: 'business' as const }
const users: Record<string, User> = {
  boss: { ...base, id: 'u-boss', email: 'boss@x.pt', name: 'Empresa', businessRole: 'company' },
  ana: { ...base, id: 'u-ana', email: 'ana@x.pt', name: 'Ana', businessRole: 'employee' },
  rui: { ...base, id: 'u-rui', email: 'rui@x.pt', name: 'Rui', businessRole: 'employee' },
  eva: { ...base, id: 'u-eva', email: 'eva@x.pt', name: 'Eva', businessRole: 'employee' },
}
let as: User | null = users.ana

vi.mock('../app/lib/server/auth', () => ({ currentUser: async () => as }))
vi.mock('../app/lib/server/push', () => ({ sendToUser: async () => 0, pushConfigured: () => false }))

const req = (method: string, body?: unknown, url = 'http://t/x') =>
  new Request(url, { method, headers: { 'content-type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) })
async function call(handler: unknown, method: string, params: Record<string, string> = {}, body?: unknown, url?: string) {
  const res = await (handler as (r: Request, c: unknown) => Promise<Response>)(req(method, body, url), { params: Promise.resolve(params) })
  return { status: res.status, json: await res.json() }
}

const orgId = 'org-1'
const member = (id: string, userId: string, name: string, role: Member['role']): Member => ({
  id, orgId, userId, email: `${name.toLowerCase()}@x.pt`, name, role, status: 'activo', presence: 'offline', joinedAt: 1, consentAt: 1,
})
const task = (id: string, assigneeId: string, extra: Partial<Task> = {}): Task => ({
  id, orgId, assigneeId, createdBy: 'm-ana', title: id, category: 'trabalho', priority: 'media', status: 'todo', createdAt: 1, ...extra,
} as Task)
const session = (id: string, memberId: string, taskId: string, start: number): Session => ({
  id, taskId, memberId, category: 'trabalho', start, end: start + 60_000, seconds: 60,
} as Session)

const DAY = 86_400_000
const now = Date.now()

beforeAll(async () => {
  rmSync('.data-test/org-scopes', { recursive: true, force: true })
  const { mutate } = await import('../app/lib/server/store')
  const org: Org = { id: orgId, name: 'Acme', sector: 'Outro', inviteCode: 'ACME42', createdAt: 0, createdBy: 'u-boss' }
  await mutate('all', db => {
    db.users.push(...Object.values(users))
    db.orgs.push(org, { ...org, id: 'org-2', inviteCode: 'OUTRA1' })
    db.members.push(
      member('m-boss', 'u-boss', 'Empresa', 'admin'),
      member('m-ana', 'u-ana', 'Ana', 'admin'),
      member('m-rui', 'u-rui', 'Rui', 'membro'),
      member('m-eva', 'u-eva', 'Eva', 'membro'),
    )
    db.tasks.push(
      task('t-rui', 'm-rui'),
      task('t-eva', 'm-eva'),
      // a mesma tarefa para os dois: a da Eva já está entregue
      task('g-rui', 'm-rui', { groupId: 'g' }),
      task('g-eva', 'm-eva', { groupId: 'g', status: 'done', completedAt: now }),
    )
    db.sessions.push(
      session('s-rui-old', 'm-rui', 't-rui', now - 40 * DAY),
      session('s-rui', 'm-rui', 't-rui', now - DAY),
      session('s-eva', 'm-eva', 't-eva', now - DAY),
    )
    const seg = (id: string, memberId: string, start: number, end: number | null, o = orgId): PresenceSegment => ({ id, orgId: o, memberId, status: 'trabalho', start, end })
    db.presence.push(
      seg('p-rui', 'm-rui', now - DAY, now - DAY + 3600e3),
      seg('p-rui-old', 'm-rui', now - 40 * DAY, now - 40 * DAY + 3600e3),
      seg('p-eva', 'm-eva', now - DAY, now - DAY + 3600e3),
    )
  })
})

describe('rotas da empresa com âmbito reduzido', () => {
  it('as minhas tarefas: só as minhas, com o resumo do grupo (que precisa das tarefas dos outros)', async () => {
    as = users.rui
    const tasks = await import('../app/api/orgs/[orgId]/tasks/route')
    const got = await call(tasks.GET, 'GET', { orgId }, undefined, 'http://t/x?scope=mine')
    expect(got.json.tasks.map((t: Task) => t.id).sort()).toEqual(['g-rui', 't-rui'])
    expect(got.json.tasks.find((t: Task) => t.id === 'g-rui').groupSummary).toEqual({ total: 2, done: 1 })
  })

  it('a equipa (admin): todas as tarefas', async () => {
    as = users.ana
    const tasks = await import('../app/api/orgs/[orgId]/tasks/route')
    const got = await call(tasks.GET, 'GET', { orgId }, undefined, 'http://t/x?scope=team')
    expect(got.json.tasks).toHaveLength(4)
  })

  it('as minhas sessões: só as minhas, a partir de "from"', async () => {
    as = users.rui
    const sessions = await import('../app/api/orgs/[orgId]/sessions/route')
    const all = await call(sessions.GET, 'GET', { orgId })
    expect(all.json.sessions.map((s: Session) => s.id).sort()).toEqual(['s-rui', 's-rui-old'])
    const recent = await call(sessions.GET, 'GET', { orgId }, undefined, `http://t/x?from=${now - 7 * DAY}`)
    expect(recent.json.sessions.map((s: Session) => s.id)).toEqual(['s-rui'])
  })

  it('relatório de uma pessoa: o admin recebe só as sessões e a presença dela', async () => {
    as = users.ana
    const sessions = await import('../app/api/orgs/[orgId]/sessions/route')
    const s = await call(sessions.GET, 'GET', { orgId }, undefined, `http://t/x?scope=team&memberId=m-rui&from=${now - 7 * DAY}`)
    expect(s.json.sessions.map((x: Session) => x.id)).toEqual(['s-rui'])
    const team = await call(sessions.GET, 'GET', { orgId }, undefined, `http://t/x?scope=team&from=${now - 7 * DAY}`)
    expect(team.json.sessions.map((x: Session) => x.id).sort()).toEqual(['s-eva', 's-rui'])

    const presence = await import('../app/api/orgs/[orgId]/presence/route')
    const p = await call(presence.GET, 'GET', { orgId }, undefined, `http://t/x?memberId=m-rui&from=${now - 7 * DAY}`)
    expect(p.json.segments.map((x: PresenceSegment) => x.id)).toEqual(['p-rui'])
  })

  it('um membro não vê as sessões nem a presença de outro', async () => {
    as = users.rui
    const sessions = await import('../app/api/orgs/[orgId]/sessions/route')
    expect((await call(sessions.GET, 'GET', { orgId }, undefined, 'http://t/x?scope=team&memberId=m-eva')).status).toBe(403)
    const presence = await import('../app/api/orgs/[orgId]/presence/route')
    expect((await call(presence.GET, 'GET', { orgId }, undefined, 'http://t/x?memberId=m-eva')).status).toBe(403)
  })

  it('sinal de presença: começa, mantém e termina o dia num só segmento', async () => {
    as = users.rui
    const presence = await import('../app/api/orgs/[orgId]/presence/route')
    const start = await call(presence.POST, 'POST', { orgId }, { work: 'start' })
    expect(start.json.presence).toBe('trabalho')
    expect((await call(presence.POST, 'POST', { orgId }, { status: 'trabalho', beat: true })).json.presence).toBe('trabalho')
    expect((await call(presence.POST, 'POST', { orgId }, { status: 'pausa' })).json.presence).toBe('pausa')
    expect((await call(presence.POST, 'POST', { orgId }, { work: 'end' })).json.presence).toBe('offline')

    const { read } = await import('../app/lib/server/store')
    const db = await read('all')
    const mine = db.presence.filter(p => p.memberId === 'm-rui' && p.start > now - 60_000)
    expect(mine.map(p => p.status)).toEqual(['trabalho', 'pausa'])
    expect(mine.every(p => p.end !== null)).toBe(true)
  })

  it('sinal de presença: a conta da empresa e quem não é membro são recusados', async () => {
    const presence = await import('../app/api/orgs/[orgId]/presence/route')
    as = users.boss
    expect((await call(presence.POST, 'POST', { orgId }, { work: 'start' })).status).toBe(403)
    as = users.rui
    expect((await call(presence.POST, 'POST', { orgId: 'org-2' }, { work: 'start' })).status).toBe(403)
    expect((await call(presence.POST, 'POST', { orgId: 'nao-existe' }, { work: 'start' })).status).toBe(404)
  })
})
