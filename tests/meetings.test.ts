import { rmSync } from 'fs'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import type { Member, OfficeMap, Org, User } from '../app/types'
import { occupants, reservedSeats, whereIs } from '../app/lib/office'

process.env.NEEMA_DATA_DIR = '.data-test/meetings'

const now = Date.now()
const office: OfficeMap = {
  width: 30,
  depth: 20,
  rooms: [
    { id: 'ti', kind: 'sala', name: 'Sala de TI', x: 0, z: 0, w: 10, d: 10, color: '#fff' },
    { id: 'reunioes', kind: 'sala', name: 'Sala de reuniões', x: 12, z: 0, w: 8, d: 8, color: '#fff' },
  ],
  items: [
    { id: 't1', type: 'cadeira', label: 'Cadeira 1', x: 2, z: 2, rot: 0 },
    { id: 't2', type: 'cadeira', label: 'Cadeira 2', x: 4, z: 2, rot: 0 },
    { id: 'r1', type: 'cadeira', label: 'Cadeira 10', x: 14, z: 2, rot: 0 },
    { id: 'r2', type: 'cadeira', label: 'Cadeira 11', x: 16, z: 2, rot: 0 },
  ],
  updatedAt: 1,
}
const person = (id: string, p: Partial<Member>) =>
  ({ id, orgId: 'o', email: `${id}@x.pt`, name: id, role: 'membro', status: 'activo', presence: 'reuniao', seatAt: now - 1000, ...p } as Member)

describe('reuniões no mapa', () => {
  const meeting = { eventId: 'e', roomId: 'reunioes', mode: 'presencial' as const, until: now + 3600e3 }

  it('quem está numa reunião presencial aparece na sala da reunião; online fica no seu lugar', () => {
    expect(whereIs(person('a', { seatId: 't1', meeting }), office, now)).toMatchObject({ kind: 'meeting', room: { id: 'reunioes' } })
    expect(whereIs(person('b', { seatId: 't1', meeting: { ...meeting, mode: 'online', roomId: undefined } }), office, now).kind).toBe('seat')
    // a reunião acabou: volta ao seu lugar
    expect(whereIs(person('c', { seatId: 't1', meeting: { ...meeting, until: now - 1 } }), office, now).kind).toBe('seat')
  })

  it('no mapa, fica nas cadeiras da sala da reunião, e o lugar dele fica guardado', () => {
    const people = [person('ana', { seatId: 't1', meeting }), person('rui', { seatId: 't2', presence: 'trabalho' })]
    const taken = occupants(people, office, now)
    expect(taken.get('r1')?.id).toBe('ana')
    expect(taken.has('t1')).toBe(false)
    expect(taken.get('t2')?.id).toBe('rui')
    expect(reservedSeats(people, office, now).get('t1')?.id).toBe('ana')
  })
})

/* ─── API ─── */

const base = { createdAt: 0, rankingVisibility: 'nome' as const, accountType: 'business' as const }
const users: Record<string, User> = {
  empresa: { ...base, id: 'u-emp', email: 'emp@x.pt', name: 'Acme', businessRole: 'company' },
  ana: { ...base, id: 'u-ana', email: 'ana@x.pt', name: 'Ana', businessRole: 'employee' },
  rui: { ...base, id: 'u-rui', email: 'rui@x.pt', name: 'Rui', businessRole: 'employee' },
  eva: { ...base, id: 'u-eva', email: 'eva@x.pt', name: 'Eva', businessRole: 'employee' },
}
let as: User = users.ana

vi.mock('../app/lib/server/auth', () => ({ currentUser: async () => as }))
vi.mock('../app/lib/server/push', () => ({ sendToUser: async () => 0, pushConfigured: () => false }))

const orgId = 'org-m'
const req = (method: string, body?: unknown, url = 'http://t/x') =>
  new Request(url, { method, headers: { 'content-type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) })
async function call(handler: unknown, method: string, params: Record<string, string>, body?: unknown, url?: string) {
  const res = await (handler as (r: Request, c: unknown) => Promise<Response>)(req(method, body, url), { params: Promise.resolve(params) })
  return { status: res.status, json: await res.json().catch(() => null) }
}
const m = (id: string, userId: string, name: string, extra: Partial<Member> = {}): Member =>
  ({ id, orgId, userId, email: `${id}@x.pt`, name, role: 'membro', status: 'activo', presence: 'trabalho', lastSeen: Date.now(), joinedAt: 1, consentAt: 1, seatAt: Date.now(), ...extra })

beforeAll(async () => {
  rmSync('.data-test/meetings', { recursive: true, force: true })
  const { mutate } = await import('../app/lib/server/store')
  const org: Org = { id: orgId, name: 'Acme', sector: 'Outro', inviteCode: 'ACMEM1', createdAt: 0, createdBy: 'u-emp', office }
  await mutate('all', db => {
    db.users.push(...Object.values(users))
    db.orgs.push(org)
    db.members.push(
      m('m-emp', 'u-emp', 'Acme', { role: 'admin' }),
      m('m-ana', 'u-ana', 'Ana', { seatId: 't1' }),
      m('m-rui', 'u-rui', 'Rui', { seatId: 't2' }),
      m('m-eva', 'u-eva', 'Eva'),
    )
  })
})

describe('reuniões e salas', () => {
  const ids: Record<string, string> = {}
  const t0 = Date.now() - 5 * 60e3 // começou há 5 minutos
  const t1 = t0 + 3600e3

  it('marca uma reunião numa sala do mapa', async () => {
    as = users.ana
    const events = await import('../app/api/orgs/[orgId]/events/route')
    const res = await call(events.POST, 'POST', { orgId }, { title: 'Planeamento', kind: 'reuniao', start: t0, end: t1, roomId: 'reunioes', attendeeIds: ['m-rui'] })
    expect(res.status).toBe(200)
    ids.a = res.json.event.id
    expect(res.json.event.roomId).toBe('reunioes')
    expect((await call(events.POST, 'POST', { orgId }, { title: 'X', kind: 'reuniao', start: t0, end: t1, roomId: 'nao-existe' })).status).toBe(400)
  })

  it('outra reunião na mesma sala e horário: avisa (sem detalhes); só marca se confirmar', async () => {
    as = users.eva
    const events = await import('../app/api/orgs/[orgId]/events/route')
    const clash = await call(events.POST, 'POST', { orgId }, { title: 'Outra', kind: 'reuniao', start: t0 + 30 * 60e3, end: t1 + 30 * 60e3, roomId: 'reunioes' })
    expect(clash.status).toBe(409)
    expect(clash.json.error).toContain('Sala de reuniões já está reservada')
    expect(clash.json.error).not.toContain('Planeamento')
    const forced = await call(events.POST, 'POST', { orgId }, { title: 'Outra', kind: 'reuniao', start: t0 + 30 * 60e3, end: t1 + 30 * 60e3, roomId: 'reunioes', allowOverlap: true })
    expect(forced.status).toBe(200)
    ids.b = forced.json.event.id
    // outra sala no mesmo horário: sem problema
    expect((await call(events.POST, 'POST', { orgId }, { title: 'TI', kind: 'reuniao', start: t0, end: t1, roomId: 'ti' })).status).toBe(200)
  })

  it('toda a empresa vê as reservas do dia; o título só quem participa', async () => {
    const salas = await import('../app/api/orgs/[orgId]/salas/route')
    as = users.eva
    const seen = (await call(salas.GET, 'GET', { orgId })).json.bookings
    const planning = seen.find((b: { id: string }) => b.id === ids.a)
    expect(planning).toMatchObject({ roomId: 'reunioes', mine: false })
    expect(planning.title).toBeUndefined()
    as = users.rui
    const mine = (await call(salas.GET, 'GET', { orgId })).json.bookings.find((b: { id: string }) => b.id === ids.a)
    expect(mine).toMatchObject({ title: 'Planeamento', mine: true })
  })

  it('quando começa, cada participante diz como participa; presencial muda-o para a sala', async () => {
    const one = await import('../app/api/orgs/[orgId]/events/[eventId]/route')
    const { read } = await import('../app/lib/server/store')
    as = users.eva
    expect((await call(one.PATCH, 'PATCH', { orgId, eventId: ids.a }, { action: 'attend', mode: 'presencial' })).status).toBe(403)
    as = users.rui
    const res = await call(one.PATCH, 'PATCH', { orgId, eventId: ids.a }, { action: 'attend', mode: 'presencial' })
    expect(res.status).toBe(200)
    expect(res.json.event.attendance).toEqual({ 'm-rui': 'presencial' })
    const rui = (await read('all')).members.find(x => x.id === 'm-rui')!
    expect(rui.meeting).toMatchObject({ eventId: ids.a, roomId: 'reunioes', mode: 'presencial' })
    expect(whereIs(rui, office).kind).toBe('meeting')

    as = users.ana
    await call(one.PATCH, 'PATCH', { orgId, eventId: ids.a }, { action: 'attend', mode: 'online' })
    const ana = (await read('all')).members.find(x => x.id === 'm-ana')!
    expect(ana.meeting).toMatchObject({ mode: 'online' })
    expect(ana.meeting!.roomId).toBeUndefined()
  })

  it('o lugar de quem foi à reunião fica guardado: ninguém se senta lá', async () => {
    const lugar = await import('../app/api/orgs/[orgId]/lugar/route')
    as = users.eva
    const res = await call(lugar.POST, 'POST', { orgId }, { seatId: 't2' })
    expect(res.status).toBe(409)
    expect(res.json.error).toContain('reunião')
  })

  it('não se responde antes de a reunião começar', async () => {
    as = users.ana
    const events = await import('../app/api/orgs/[orgId]/events/route')
    const later = await call(events.POST, 'POST', { orgId }, { title: 'Amanhã', kind: 'reuniao', start: Date.now() + 86400e3, end: Date.now() + 86400e3 + 3600e3 })
    const one = await import('../app/api/orgs/[orgId]/events/[eventId]/route')
    const res = await call(one.PATCH, 'PATCH', { orgId, eventId: later.json.event.id }, { action: 'attend', mode: 'online' })
    expect(res.status).toBe(400)
  })

  it('cancelar a reunião devolve as pessoas aos seus lugares', async () => {
    as = users.ana
    const one = await import('../app/api/orgs/[orgId]/events/[eventId]/route')
    expect((await call(one.DELETE, 'DELETE', { orgId, eventId: ids.a })).status).toBe(200)
    const { read } = await import('../app/lib/server/store')
    const rui = (await read('all')).members.find(x => x.id === 'm-rui')!
    expect(rui.meeting).toBeUndefined()
  })
})
