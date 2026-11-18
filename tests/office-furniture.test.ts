import { describe, expect, it } from 'vitest'
import { CADEIRA, CHAIR_DESK_GAP, CHAIR_STYLES, DESK_STYLES, MESA, chairAtDesk, crossesWall, fits, footprint, freeSpot, itemSize, overlapping } from '../app/lib/office'
import type { OfficeItem, OfficeRoom } from '../app/types'

const floor = { width: 10, depth: 10 }
const mesa = (id: string, x: number, z: number, rot = 0): OfficeItem => ({ id, type: 'mesa', x, z, rot })
const cadeira = (id: string, x: number, z: number, rot = 0): OfficeItem => ({ id, type: 'cadeira', x, z, rot, label: id })
const sala: OfficeRoom = { id: 's', kind: 'sala', name: 'Sala', x: 2, z: 2, w: 4, d: 4, color: '#fff' }

describe('mesas e cadeiras: cada uma no seu espaço', () => {
  it('o espaço ocupado acompanha a rotação', () => {
    const a = footprint(mesa('m', 5, 5))
    expect(a.x1 - a.x0).toBeCloseTo(MESA.w)
    expect(a.z1 - a.z0).toBeCloseTo(MESA.d)
    const b = footprint(mesa('m', 5, 5, 90))
    expect(b.x1 - b.x0).toBeCloseTo(MESA.d)
    expect(b.z1 - b.z0).toBeCloseTo(MESA.w)
  })

  it('nada por cima de outra peça; cadeiras não ficam coladas às mesas; mesas podem encostar', () => {
    const items = [mesa('m', 5, 5), cadeira('c', 2, 2)]
    expect(fits(items, cadeira('n', 5, 5), floor)).toBe(false)
    expect(fits(items, cadeira('n', 2.2, 2), floor)).toBe(false)
    // colada à mesa (a 5 cm) não; à distância certa sim
    expect(fits(items, cadeira('n', 5, 5 + MESA.d / 2 + CADEIRA.d / 2 + 0.05), floor)).toBe(false)
    expect(fits(items, cadeira('n', 5, 5 + MESA.d / 2 + CADEIRA.d / 2 + CHAIR_DESK_GAP), floor)).toBe(true)
    // duas mesas lado a lado formam uma bancada
    expect(fits(items, mesa('n', 5 + MESA.w, 5), floor)).toBe(true)
    expect(fits(items, mesa('n', 0.2, 5), floor)).toBe(false)
    expect(fits(items, { ...items[0], x: 5.1 }, floor, new Set(['m']))).toBe(true)
  })

  it('nenhuma peça atravessa uma parede: ou fica toda dentro da sala, ou toda fora', () => {
    const map = { ...floor, rooms: [sala] }
    expect(crossesWall(footprint(mesa('m', 2.2, 4)), [sala])).toBe(true)
    expect(fits([], mesa('m', 2.2, 4), map)).toBe(false)
    expect(fits([], mesa('m', 3, 4), map)).toBe(true)
    expect(fits([], mesa('m', 8, 8), map)).toBe(true)
    // corredores não têm paredes
    expect(fits([], mesa('m', 2.2, 4), { ...floor, rooms: [{ ...sala, kind: 'corredor' }] })).toBe(true)
  })

  it('a cadeira junto a uma mesa fica à frente ou atrás dela, à distância certa e virada para a mesa', () => {
    const d = mesa('m', 5, 5)
    const front = chairAtDesk(d, 5.3, 5.4)
    expect(front).toMatchObject({ x: 5.3, rot: 0 })
    expect(front.z).toBeCloseTo(5 + MESA.d / 2 + CHAIR_DESK_GAP + CADEIRA.d / 2)
    const back = chairAtDesk(d, 4.8, 4.6)
    expect(back.rot).toBe(180)
    expect(back.z).toBeLessThan(5)
    // longe da ponta: fica dentro do comprimento da mesa
    expect(chairAtDesk(d, 9, 5.5).x).toBeCloseTo(5 + MESA.w / 2 - CADEIRA.w / 2)
    // mesa rodada 90°: a cadeira roda com ela
    expect(chairAtDesk(mesa('m', 5, 5, 90), 4, 5).rot).toBe(90)
    expect(fits([d], { type: 'cadeira', ...front }, floor)).toBe(true)
  })

  it('encontra o lugar livre mais perto', () => {
    const items = [mesa('m', 5, 5)]
    const spot = freeSpot(items, cadeira('n', 5, 5), floor)!
    expect(fits(items, { ...cadeira('n', 0, 0), ...spot }, floor)).toBe(true)
    expect(Math.hypot(spot.x - 5, spot.z - 5)).toBeLessThan(1.3)
  })

  it('o servidor não grava um mapa com peças umas por cima das outras', async () => {
    expect(overlapping([mesa('m', 5, 5), cadeira('c', 5, 5)]).size).toBe(2)
    const { cleanOffice } = await import('../app/lib/server/office')
    const db = { departments: [] } as unknown as Parameters<typeof cleanOffice>[0]
    expect(() => cleanOffice(db, 'o', { ...floor, rooms: [], items: [mesa('m', 5, 5), cadeira('c', 5, 5)] })).toThrow(/umas por cima das outras/)
    expect(cleanOffice(db, 'o', { ...floor, rooms: [], items: [mesa('m', 5, 5), cadeira('c', 5, 5.7)] }).items).toHaveLength(2)
    // o primeiro import do módulo do servidor (Clerk, base de dados) é lento com a suite inteira a correr
  }, 30_000)
})

describe('tipos de mesa e cadeira, tamanhos e cores', () => {
  it('o tamanho vem do tipo, ou do escolhido (só nas mesas); a mesa redonda é sempre redonda', () => {
    expect(itemSize({ type: 'mesa' })).toMatchObject({ w: 1.4, d: 0.7 })
    expect(itemSize({ type: 'mesa', style: 'reuniao', w: 3 })).toMatchObject({ w: 3, d: DESK_STYLES.reuniao.d })
    expect(itemSize({ type: 'mesa', style: 'redonda', w: 1.4, d: 0.5 })).toMatchObject({ w: 1.4, d: 1.4 })
    expect(itemSize({ type: 'cadeira', style: 'poltrona', w: 3 })).toMatchObject({ w: CHAIR_STYLES.poltrona.w })
    // uma mesa maior ocupa mais espaço
    const big = footprint({ type: 'mesa', style: 'reuniao', w: 4, d: 1.5, x: 5, z: 5, rot: 0 })
    expect(big.x1 - big.x0).toBeCloseTo(4)
  })

  it('cadeiras à volta da mesa redonda e nas pontas da mesa de reunião, sempre viradas para a mesa', () => {
    const round: OfficeItem = { id: 'r', type: 'mesa', style: 'redonda', x: 5, z: 5, rot: 0 }
    const east = chairAtDesk(round, 7, 5)
    expect(east.x).toBeCloseTo(5 + 1.1 / 2 + CHAIR_DESK_GAP + CADEIRA.d / 2)
    expect(east.z).toBeCloseTo(5)
    expect(east.rot).toBe(270) // virada para oeste (para o centro da mesa)
    const meeting: OfficeItem = { id: 'm', type: 'mesa', style: 'reuniao', x: 5, z: 5, rot: 0 }
    const end = chairAtDesk(meeting, 7, 5.1)
    expect(end.x).toBeGreaterThan(5 + 2.4 / 2)
    expect(end.rot).toBe(270)
    // na mesa de trabalho não há lugares nas pontas
    expect(chairAtDesk(mesa('w', 5, 5), 7, 5.1).rot).toBe(0)
    // a poltrona fica mais longe (é maior)
    const arm = chairAtDesk(mesa('w', 5, 5), 5, 6, { style: 'poltrona' })
    expect(arm.z).toBeCloseTo(5 + MESA.d / 2 + CHAIR_DESK_GAP + CHAIR_STYLES.poltrona.d / 2)
  })

  it('o servidor guarda tipos, tamanhos (dentro dos limites) e cores válidos, e ignora o resto', async () => {
    const { cleanOffice } = await import('../app/lib/server/office')
    const db = { departments: [] } as unknown as Parameters<typeof cleanOffice>[0]
    const out = cleanOffice(db, 'o', {
      width: 20,
      depth: 20,
      rooms: [{ id: 's', kind: 'sala', name: 'S', x: 0, z: 0, w: 10, d: 10, color: '#DCE7FF', wallColor: '#3D3A52' }, { id: 'c', kind: 'corredor', name: 'C', x: 10, z: 0, w: 2, d: 10, color: '#E9E7F2', wallColor: '#000000' }],
      items: [
        { id: 'a', type: 'mesa', style: 'reuniao', w: 99, d: 1.2, x: 5, z: 3, rot: 0, color: '#8B5E3C' },
        { id: 'b', type: 'mesa', style: 'nave' as never, x: 15, z: 15, rot: 0, color: 'vermelho' },
        { id: 'c1', type: 'cadeira', style: 'banco', x: 15, z: 17, rot: 0 },
        { id: 'c2', type: 'cadeira', style: 'trono' as never, x: 17, z: 17, rot: 0 },
      ],
    })
    expect(out.rooms[0].wallColor).toBe('#3D3A52')
    expect(out.rooms[1].wallColor).toBeUndefined()
    expect(out.items[0]).toMatchObject({ style: 'reuniao', w: DESK_STYLES.reuniao.max, d: 1.2, color: '#8B5E3C' })
    expect(out.items[1].style).toBeUndefined()
    expect(out.items[1].color).toBeUndefined()
    expect(out.items[2].style).toBe('banco')
    expect(out.items[3].style).toBeUndefined()
  }, 30_000)
})
