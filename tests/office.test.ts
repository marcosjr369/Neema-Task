import { rmSync } from 'fs'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import type { Member, OfficeMap, Org, User } from '../app/types'
import { findSeat, mustChoose, nextSeatLabel, occupants, roomAt, whereIs } from '../app/lib/office'
import { navGroups } from '../app/lib/nav'
import { lessonsFor } from '../app/lib/tutorial'

process.env.NEEMA_DATA_DIR = '.data-test/office'

const now = Date.now()
const office: OfficeMap = {
  width: 20,
  depth: 10,
  rooms: [
    { id: 'corr', kind: 'corredor', name: 'Corredor', x: 0, z: 4, w: 20, d: 2, color: '#E9E7F2' },
    { id: 'tech', kind: 'sala', name: 'Tecnologia', x: 0, z: 0, w: 8, d: 4, color: '#DCE7FF' },
    { id: 'big', kind: 'sala', name: 'Open space', x: 0, z: 0, w: 20, d: 10, color: '#DCF7F3' },
  ],
  items: [
    { id: 'c1', type: 'cadeira', label: 'Cadeira 1', x: 2, z: 2, rot: 0 },
    { id: 'c2', type: 'cadeira', label: 'Cadeira 2', x: 15, z: 8, rot: 0 },
    { id: 'm1', type: 'mesa', x: 2, z: 1.4, rot: 0 },
  ],
}
const person = (id: string, p: Partial<Member>) =>
  ({ id, orgId: 'o', email: `${id}@x.pt`, name: id, role: 'membro', status: 'activo', presence: 'trabalho', seatAt: now - 1000, ...p } as Member)

describe('mapa do escritório: regras', () => {
  it('a sala de um ponto: a sala mais pequena ganha; as salas ganham aos corredores', () => {
    expect(roomAt(office, 2, 2)!.id).toBe('tech')
    expect(roomAt(office, 10, 5)!.id).toBe('big')
    expect(findSeat(office, 'c2')!.room!.name).toBe('Open space')
    expect(findSeat(office, 'm1')).toBeUndefined()
  })

  it('quem está onde: só quem está online e escolheu hoje', () => {
    expect(whereIs(person('a', { seatId: 'c1' }), office, now).kind).toBe('seat')
    expect(whereIs(person('b', { remote: true }), office, now).kind).toBe('remote')
    expect(whereIs(person('c', { seatId: 'c1', presence: 'offline' }), office, now).kind).toBe('none')
    expect(whereIs(person('d', { seatId: 'c1', seatAt: now - 17 * 3600e3 }), office, now).kind).toBe('none')
    expect(whereIs(person('e', { seatId: 'apagada' }), office, now).kind).toBe('none')
    expect([...occupants([person('a', { seatId: 'c1' }), person('x', { seatId: 'c2', status: 'saiu' })], office, now).keys()]).toEqual(['c1'])
  })

  it('tem de escolher ao entrar: sem escolha hoje, ou com uma cadeira que já não existe; nunca sem cadeiras no mapa', () => {
    expect(mustChoose(person('a', { seatAt: undefined }), office, now)).toBe(true)
    expect(mustChoose(person('a', { seatId: 'c1', seatAt: now - 17 * 3600e3 }), office, now)).toBe(true)
    expect(mustChoose(person('a', { seatId: 'apagada' }), office, now)).toBe(true)
    expect(mustChoose(person('a', { seatId: 'c1' }), office, now)).toBe(false)
    expect(mustChoose(person('a', { remote: true }), office, now)).toBe(false)
    // terminou o trabalho (offline) mas já escolheu hoje: não volta a perguntar
    expect(mustChoose(person('a', { seatId: 'c1', presence: 'offline' }), office, now)).toBe(false)
    expect(mustChoose(person('a', {}), { ...office, items: [] }, now)).toBe(false)
    expect(mustChoose(person('a', {}), undefined, now)).toBe(false)
  })

  it('nome da próxima cadeira e menu/tutorial do Mapa', () => {
    expect(nextSeatLabel(office.items)).toBe('Cadeira 3')
    expect(navGroups('person', true).some(g => g.items.some(i => i.href === '/mapa'))).toBe(true)
    expect(navGroups('person', false).some(g => g.items.some(i => i.href === '/mapa'))).toBe(false)
    expect(lessonsFor('person', true).find(l => l.id === 'espacos')!.href).toBe('/mapa')
  })
})

/* ─── API ─── */

const base = { createdAt: 0, rankingVisibility: 'nome' as const, accountType: 'business' as const }
const users: Record<string, User> = {
  empresa: { ...base, id: 'u-emp', email: 'emp@x.pt', name: 'Acme', businessRole: 'company' },
  adm: { ...base, id: 'u-adm', email: 'adm@x.pt', name: 'Adm', businessRole: 'employee' },
  ana: { ...base, id: 'u-ana', email: 'ana@x.pt', name: 'Ana', businessRole: 'employee' },
  rui: { ...base, id: 'u-rui', email: 'rui@x.pt', name: 'Rui', businessRole: 'employee' },
}
let as: User = users.empresa

vi.mock('../app/lib/server/auth', () => ({ currentUser: async () => as }))
vi.mock('../app/lib/server/push', () => ({ sendToUser: async () => 0, pushConfigured: () => false }))

const orgId = 'org-o'
const call = async (handler: unknown, method: string, body?: unknown, form?: FormData) => {
  const req = new Request('http://t/x', form ? { method, body: form } : { method, headers: { 'content-type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) })
  const res = await (handler as (r: Request, c: unknown) => Promise<Response>)(req, { params: Promise.resolve({ orgId }) })
  return { status: res.status, json: await res.json().catch(() => null) }
}
const m = (id: string, userId: string, role: Member['role'], name: string): Member =>
  ({ id, orgId, userId, email: `${id}@x.pt`, name, role, status: 'activo', presence: 'trabalho', lastSeen: Date.now(), joinedAt: 1, consentAt: 1 })

beforeAll(async () => {
  rmSync('.data-test/office', { recursive: true, force: true })
  const { mutate } = await import('../app/lib/server/store')
  const org: Org = { id: orgId, name: 'Acme', sector: 'Outro', inviteCode: 'ACMEO1', createdAt: 0, createdBy: 'u-emp' }
  await mutate('all', db => {
    db.users.push(...Object.values(users))
    db.orgs.push(org)
    db.members.push(m('m-emp', 'u-emp', 'admin', 'Acme'), m('m-adm', 'u-adm', 'admin', 'Adm'), m('m-ana', 'u-ana', 'membro', 'Ana'), m('m-rui', 'u-rui', 'membro', 'Rui'))
  })
})

describe('API do mapa', () => {
  it('só a conta da empresa cria o mapa (nem outro administrador)', async () => {
    const route = await import('../app/api/orgs/[orgId]/mapa/route')
    as = users.adm
    expect((await call(route.PUT, 'PUT', office)).status).toBe(403)
    as = users.empresa
    const res = await call(route.PUT, 'PUT', {
      ...office,
      rooms: [...office.rooms, { id: 'x', kind: 'sala', name: '', x: 18, z: 8, w: 50, d: 50 }],
      items: [...office.items, { id: 'c1', type: 'cadeira', x: 999, z: -3, rot: 450 }],
    })
    expect(res.status).toBe(200)
    const saved: OfficeMap = res.json.office
    // salas dentro do piso, nomes por omissão, ids únicos e mobiliário limitado ao piso
    const x = saved.rooms.find(r => r.id === 'x')!
    expect(x).toMatchObject({ x: 18, z: 8, w: 2, d: 2, name: 'Sala 4' })
    const dup = saved.items[saved.items.length - 1]
    expect(dup.id).not.toBe('c1')
    expect(dup).toMatchObject({ x: 20, z: 0, rot: 90, label: 'Cadeira' })
  })

  it('escolher a cadeira; outra pessoa não se senta na mesma; remoto também vale', async () => {
    const lugar = await import('../app/api/orgs/[orgId]/lugar/route')
    as = users.ana
    expect((await call(lugar.POST, 'POST', {})).status).toBe(400)
    const ok = await call(lugar.POST, 'POST', { seatId: 'c1' })
    expect(ok.status).toBe(200)
    expect(ok.json.seatAt).toBeGreaterThan(0)

    as = users.rui
    const clash = await call(lugar.POST, 'POST', { seatId: 'c1' })
    expect(clash.status).toBe(409)
    expect(clash.json.error).toContain('Tecnologia · Cadeira 1')
    expect(clash.json.error).toContain('Ana')
    expect((await call(lugar.POST, 'POST', { seatId: 'm1' })).status).toBe(404)
    expect((await call(lugar.POST, 'POST', { remote: true })).json).toMatchObject({ seatId: null, remote: true })

    as = users.empresa
    expect((await call(lugar.POST, 'POST', { seatId: 'c2' })).status).toBe(403)
  })

  it('a cadeira de quem está offline fica livre', async () => {
    const { mutate } = await import('../app/lib/server/store')
    await mutate('all', db => { db.members.find(x => x.id === 'm-ana')!.lastSeen = Date.now() - 10 * 60e3 })
    as = users.rui
    const lugar = await import('../app/api/orgs/[orgId]/lugar/route')
    expect((await call(lugar.POST, 'POST', { seatId: 'c1' })).status).toBe(200)
  })

  it('a planta de guia: só imagens, só a conta da empresa', async () => {
    const guia = await import('../app/api/orgs/[orgId]/mapa/guia/route')
    const form = (type: string) => {
      const f = new FormData()
      f.append('file', new File([new Uint8Array([1, 2, 3])], 'planta', { type }))
      return f
    }
    as = users.ana
    expect((await call(guia.POST, 'POST', undefined, form('image/png'))).status).toBe(403)
    as = users.empresa
    expect((await call(guia.POST, 'POST', undefined, form('text/plain'))).status).toBe(400)
    const up = await call(guia.POST, 'POST', undefined, form('image/png'))
    expect(up.status).toBe(200)
    expect(up.json.office.guideId).toMatch(/^planta-.*\.png$/)
    // gravar o desenho depois não apaga a planta
    const route = await import('../app/api/orgs/[orgId]/mapa/route')
    expect((await call(route.PUT, 'PUT', office)).json.office.guideId).toBe(up.json.office.guideId)
    expect((await call(guia.DELETE, 'DELETE')).json.office.guideId).toBeUndefined()
  })
})

describe('dados da empresa: o mapa só vai quando mudou', () => {
  it('com a versão que o cliente já tem, o mapa não é enviado outra vez', async () => {
    const route = await import('../app/api/orgs/[orgId]/route')
    as = users.ana
    const get = async (q = '') => {
      const res = await (route.GET as unknown as (r: Request, c: unknown) => Promise<Response>)(new Request(`http://t/x${q}`), { params: Promise.resolve({ orgId }) })
      return res.json()
    }
    const first = await get()
    expect(first.sameMap).toBe(false)
    const version = first.org.office.updatedAt
    expect(version).toBeGreaterThan(0)
    const again = await get(`?mapa=${version}`)
    expect(again.sameMap).toBe(true)
    expect(again.org.office).toBeUndefined()
    // versão antiga: o mapa vem
    const old = await get('?mapa=1')
    expect(old.sameMap).toBe(false)
    expect(old.org.office.items.length).toBeGreaterThan(0)
  })
})
