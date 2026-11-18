import { describe, expect, it } from 'vitest'
import { DESK_STYLES, SEAT_LIMITS, arrangeDesk, deskSeats, misplaced, organizeAll, salaOf, seatSlots, sizeForSeats } from '../app/lib/office'
import type { OfficeItem, OfficeMap, OfficeRoom } from '../app/types'

const sala = (id: string, x: number, z: number, w: number, d: number): OfficeRoom => ({ id, kind: 'sala', name: id, x, z, w, d, color: '#fff' })
const corredor: OfficeRoom = { id: 'corr', kind: 'corredor', name: 'Corredor', x: 0, z: 10, w: 30, d: 2, color: '#eee' }
const mesa = (id: string, x: number, z: number, extra: Partial<OfficeItem> = {}): OfficeItem => ({ id, type: 'mesa', x, z, rot: 0, ...extra })
const cadeira = (id: string, x: number, z: number, rot = 0): OfficeItem => ({ id, type: 'cadeira', x, z, rot, label: id })

describe('lugares das mesas', () => {
  it('cada tipo tem os seus lugares por omissão, dentro dos limites', () => {
    expect(deskSeats({})).toBe(1)
    expect(deskSeats({ style: 'reuniao' })).toBe(SEAT_LIMITS.reuniao.def)
    expect(deskSeats({ style: 'redonda', seats: 99 })).toBe(SEAT_LIMITS.redonda.max)
  })

  it('a mesa cresce para caberem os lugares (nunca encolhe)', () => {
    expect(sizeForSeats({ type: 'mesa', seats: 3 }).w).toBeCloseTo(2.1)
    expect(sizeForSeats({ type: 'mesa', seats: 1, w: 2 }).w).toBe(2)
    expect(sizeForSeats({ type: 'mesa', style: 'redonda', seats: 8 }).w).toBe(DESK_STYLES.redonda.w)
    expect(sizeForSeats({ type: 'mesa', style: 'redonda', seats: 10 }).w).toBeGreaterThan(DESK_STYLES.redonda.w)
  })

  it('mesa de trabalho: todas as cadeiras à frente, viradas para a mesa', () => {
    const slots = seatSlots(mesa('m', 5, 5, { seats: 3, w: 2.1 }))
    expect(slots).toHaveLength(3)
    expect(slots.every(s => s.z > 5 && s.rot === 0)).toBe(true)
    expect(new Set(slots.map(s => s.x)).size).toBe(3)
  })

  it('mesa de reunião: frente, trás e pontas; redonda: à volta', () => {
    const meeting = seatSlots(mesa('m', 5, 5, { style: 'reuniao', seats: 8, w: 3 }))
    expect(meeting.filter(s => s.z > 5.4)).toHaveLength(3)
    expect(meeting.filter(s => s.z < 4.6)).toHaveLength(3)
    expect(meeting.filter(s => Math.abs(s.z - 5) < 0.01).map(s => s.rot).sort()).toEqual([270, 90].sort())
    const round = seatSlots(mesa('r', 5, 5, { style: 'redonda', seats: 4 }))
    expect(round).toHaveLength(4)
    // todas à mesma distância do centro
    const dist = round.map(s => Math.hypot(s.x - 5, s.z - 5))
    expect(Math.max(...dist) - Math.min(...dist)).toBeLessThan(0.02)
  })
})

describe('Organizar tudo', () => {
  const map = (): OfficeMap => ({
    width: 30,
    depth: 20,
    rooms: [sala('ti', 0, 0, 10, 10), sala('espera', 20, 0, 6, 6), corredor],
    items: [
      mesa('m1', 3, 3, { seats: 2 }),
      cadeira('a', 3.2, 3.6, 45), // da m1, torta
      cadeira('b', 8, 8, 120), // a mais na sala de TI
      cadeira('c', 15, 11), // no corredor
      cadeira('d', 22, 2, 37), // sala sem mesas: uma cadeira sem mesa sai
      mesa('m2', 9.8, 5), // atravessa a parede
    ],
  })

  it('cada mesa com as suas cadeiras; tira o que está fora das salas e o que sobra; endireita', () => {
    const before = map()
    const r = organizeAll(before)
    const after = { ...before, items: r.items }
    expect(misplaced(after).size).toBe(0)

    const desks = r.items.filter(i => i.type === 'mesa')
    expect(desks.every(d => salaOf(after, d))).toBe(true)
    // m1 tem 2 lugares, m2 tem 1: 3 cadeiras na sala de TI (a "a" e a "b" reaproveitadas, 1 nova)
    const ti = r.items.filter(i => i.type === 'cadeira' && salaOf(after, i)?.id === 'ti')
    expect(ti).toHaveLength(3)
    expect(ti.some(c => c.id === 'a')).toBe(true)
    // quem estava sentado na "a" continua com a mesma cadeira (o mesmo id e nome)
    expect(r.items.find(i => i.id === 'a')!.label).toBe('a')
    // a cadeira do corredor saiu
    expect(r.items.some(i => i.id === 'c')).toBe(false)
    // a "b" foi reaproveitada (é um dos lugares das mesas da sala), sem criar cadeiras a mais
    expect(r.items.some(i => i.id === 'b')).toBe(true)
    // nenhuma cadeira fica sem mesa (nem na sala sem mesas)
    expect(r.items.some(i => i.id === 'd')).toBe(false)
    // todas as cadeiras das mesas viradas para elas: a "a" fica à frente da m1, rotação 0
    expect(r.items.find(i => i.id === 'a')!.rot).toBe(0)
    expect(r).toMatchObject({ removed: 2, removedChairs: 2, removedDesks: 0 })
    expect(r.added).toBe(1)
    expect(r.skipped).toBe(0)
  })

  it('organizar duas vezes não muda mais nada', () => {
    const once = organizeAll(map())
    const twice = organizeAll({ ...map(), items: once.items })
    expect(twice.items).toEqual(once.items)
    expect(twice.removed + twice.added + twice.moved).toBe(0)
  })

  it('mudar os lugares de uma mesa faz-lhe crescer o tamanho e dá-lhe as cadeiras', () => {
    const base = organizeAll(map())
    const m = { ...base.items.find(i => i.id === 'm1')!, seats: 4 }
    const items = base.items.map(i => (i.id === 'm1' ? m : i))
    const r = arrangeDesk({ ...map(), items }, 'm1')!
    const desk = r.items.find(i => i.id === 'm1')!
    expect(desk.w).toBeGreaterThanOrEqual(2.8)
    expect(r.items.filter(i => i.type === 'cadeira' && Math.abs(i.z - desk.z) < 1 && Math.abs(i.x - desk.x) < desk.w! / 2 + 0.5)).toHaveLength(4)
    expect(misplaced({ ...map(), items: r.items }).size).toBe(0)
  })
})

describe('servidor', () => {
  it('guarda os lugares das mesas dentro dos limites do tipo', async () => {
    const { cleanOffice } = await import('../app/lib/server/office')
    const db = { departments: [] } as unknown as Parameters<typeof cleanOffice>[0]
    const out = cleanOffice(db, 'o', {
      width: 20,
      depth: 20,
      rooms: [],
      items: [mesa('a', 5, 5, { seats: 40 }), mesa('b', 12, 12, { style: 'reuniao', seats: 8.6 })],
    })
    expect(out.items[0].seats).toBe(SEAT_LIMITS.escritorio.max)
    expect(out.items[1].seats).toBe(9)
  }, 30_000)
})

describe('Organizar tudo: alinhamento', () => {
  it('mesas espalhadas e tortas ficam em filas alinhadas, viradas para o mesmo lado e igualmente espaçadas', () => {
    const items: OfficeItem[] = [
      mesa('a', 2.3, 1.7, { rot: 17 }), mesa('b', 6.1, 2.4, { rot: 92 }), mesa('c', 4, 5.2),
      mesa('d', 8.4, 6.3, { rot: 180 }), mesa('e', 1.5, 7.9, { rot: 270 }), mesa('f', 7.2, 8.6, { rot: 45 }),
    ]
    const map: OfficeMap = { width: 12, depth: 12, rooms: [sala('s', 0, 0, 12, 12)], items }
    const r = organizeAll(map)
    const desks = r.items.filter(i => i.type === 'mesa')
    expect(new Set(desks.map(d => d.rot))).toEqual(new Set([0]))
    // em filas: poucas posições diferentes de z, e as mesas da mesma fila com o mesmo espaçamento
    const rows = [...new Set(desks.map(d => d.z))].sort((x, y) => x - y)
    expect(rows.length).toBeLessThanOrEqual(3)
    for (const z of rows) {
      const xs = desks.filter(d => d.z === z).map(d => d.x).sort((x, y) => x - y)
      const steps = xs.slice(1).map((x, k) => Math.round((x - xs[k]) * 100))
      expect(new Set(steps).size).toBeLessThanOrEqual(1)
    }
    // cada mesa com a sua cadeira, à frente e direita; nada mal posto; e estável
    const chairs = r.items.filter(i => i.type === 'cadeira')
    expect(chairs).toHaveLength(6)
    expect(chairs.every(c => c.rot === 0)).toBe(true)
    expect(misplaced({ ...map, items: r.items }).size).toBe(0)
    expect(organizeAll({ ...map, items: r.items }).items).toEqual(r.items)
  })

  it('sala estreita e comprida: as filas ficam ao alto', () => {
    const items = [mesa('a', 1, 2), mesa('b', 1.2, 6), mesa('c', 0.9, 10), mesa('d', 1.1, 14)]
    const map: OfficeMap = { width: 4, depth: 20, rooms: [sala('s', 0, 0, 2.3, 20)], items }
    const r = organizeAll(map)
    const desks = r.items.filter(i => i.type === 'mesa')
    expect(desks.every(d => d.rot === 90)).toBe(true)
    expect(new Set(desks.map(d => d.x)).size).toBe(1)
    expect(misplaced({ ...map, items: r.items }).size).toBe(0)
  })

  it('as cadeiras de uma mesa acompanham-na quando ela muda de sítio (quem lá estava não perde o lugar)', () => {
    const map: OfficeMap = { width: 12, depth: 12, rooms: [sala('s', 0, 0, 12, 12)], items: [mesa('m', 9, 9), cadeira('x', 9, 9.72)] }
    const r = organizeAll(map)
    expect(r.items.some(i => i.id === 'x')).toBe(true)
    expect(r.added).toBe(0)
  })
})

describe('Organizar tudo: nenhuma mesa sem cadeiras, nenhuma cadeira sem mesa', () => {
  const ok = (map: OfficeMap, items: OfficeItem[]) => {
    const desks = items.filter(i => i.type === 'mesa')
    const chairs = items.filter(i => i.type === 'cadeira')
    // cada mesa tem exactamente os seus lugares em cadeiras, e cada cadeira está num lugar de uma mesa
    for (const d of desks) {
      const mine = chairs.filter(c => seatSlots(d, (c.style as never) ?? undefined).some(s => Math.abs(s.x - c.x) < 0.01 && Math.abs(s.z - c.z) < 0.01))
      expect(mine.length).toBe(deskSeats(d))
    }
    const atDesks = chairs.filter(c => desks.some(d => seatSlots(d).some(s => Math.abs(s.x - c.x) < 0.01 && Math.abs(s.z - c.z) < 0.01)))
    expect(atDesks).toHaveLength(chairs.length)
    expect(misplaced({ ...map, items }).size).toBe(0)
  }

  it('mesas fora das salas e cadeiras soltas saem', () => {
    const map: OfficeMap = {
      width: 30, depth: 20,
      rooms: [sala('s', 0, 0, 10, 10), corredor],
      items: [mesa('dentro', 3, 3), mesa('corredor', 15, 11), cadeira('solta', 8, 8), cadeira('rua', 25, 18)],
    }
    const r = organizeAll(map)
    expect(r.items.filter(i => i.type === 'mesa').map(i => i.id)).toEqual(['dentro'])
    expect(r.removedDesks).toBe(1)
    ok(map, r.items)
  })

  it('sala pequena demais: as mesas ficam com os lugares que cabem; sem nenhum, a mesa sai', () => {
    // sala de 3,4 × 3,2 m: uma mesa de reunião de 8 lugares não cabe com todos
    const map: OfficeMap = { width: 10, depth: 10, rooms: [sala('s', 0, 0, 3.4, 3.2)], items: [mesa('r', 1.7, 1.6, { style: 'reuniao', seats: 8, w: 1.2, d: 0.8 }), mesa('w', 1, 1)] }
    const r = organizeAll(map)
    for (const d of r.items.filter(i => i.type === 'mesa')) expect(deskSeats(d)).toBeGreaterThanOrEqual(1)
    ok(map, r.items)
    expect(r.items.some(i => i.type === 'mesa')).toBe(true)
  })

  it('num escritório grande e desarrumado, no fim está tudo certo', () => {
    const rooms = [sala('a', 0, 0, 9, 7), sala('b', 10, 0, 6, 7), sala('c', 0, 8, 16, 5)]
    const items: OfficeItem[] = []
    let n = 0
    for (const r of rooms) {
      for (let k = 0; k < 7; k++) {
        const x = r.x + 1 + ((k * 2.3) % (r.w - 2)), z = r.z + 1 + ((k * 1.7) % (r.d - 2))
        items.push(mesa(`d${n++}`, x, z, { seats: 1 + (k % 3), rot: (k * 37) % 360 }))
        items.push(cadeira(`c${n++}`, x + 0.3, z + 0.8, k * 50))
      }
    }
    items.push(cadeira('corredor', 9.5, 7.5))
    const map: OfficeMap = { width: 16, depth: 13, rooms, items }
    const r = organizeAll(map)
    ok(map, r.items)
    expect(organizeAll({ ...map, items: r.items }).items).toEqual(r.items)
  })
})
