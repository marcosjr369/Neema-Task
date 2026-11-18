import type { OfficeItem, OfficeMap, OfficeRoom } from '../../types'
import { CHAIR_STYLES, CORRIDOR_COLOR, DESK_STYLES, SEAT_LIMITS, MAX_ITEMS, MAX_ROOMS, MAX_SIZE, MIN_SIZE, ROOM_COLORS, overlapping } from '../office'
import { isCompanyAccount } from '../org'
import { fail, requireMember } from './api'
import { newId, type DB } from './store'

/** Só a conta da empresa (o administrador principal) desenha o mapa */
export async function requireCompany(orgId: string) {
  const access = await requireMember(orgId)
  if (!isCompanyAccount(access.me, access.org)) fail(403, 'Só a conta da empresa pode criar e editar o mapa do escritório')
  return access
}

const num = (v: unknown, min: number, max: number, what: string) => {
  const n = Number(v)
  if (!Number.isFinite(n)) fail(400, `${what} inválido`)
  return Math.round(Math.min(max, Math.max(min, n)) * 100) / 100
}
const idOf = (v: unknown, seen: Set<string>) => {
  let id = typeof v === 'string' && /^[\w-]{1,40}$/.test(v) ? v : newId()
  if (seen.has(id)) id = newId()
  seen.add(id)
  return id
}
const color = (v: unknown, fallback: string) => (typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v) ? v : fallback)

/**
 * O mapa enviado pelo editor, limpo: tamanhos dentro do piso, salas com pelo menos 0,5 m,
 * mobiliário dentro do piso, ids únicos e departamentos que existem.
 */
export function cleanOffice(db: DB, orgId: string, input: Partial<OfficeMap>, keepGuide?: string): OfficeMap {
  if (!input || typeof input !== 'object') fail(400, 'Mapa inválido')
  const width = num(input.width, MIN_SIZE, MAX_SIZE, 'Comprimento do piso')
  const depth = num(input.depth, MIN_SIZE, MAX_SIZE, 'Largura do piso')
  const rooms = Array.isArray(input.rooms) ? input.rooms : []
  const items = Array.isArray(input.items) ? input.items : []
  if (rooms.length > MAX_ROOMS) fail(400, `No máximo ${MAX_ROOMS} salas e corredores`)
  if (items.length > MAX_ITEMS) fail(400, `No máximo ${MAX_ITEMS} mesas e cadeiras`)
  const depts = new Set(db.departments.filter(d => d.orgId === orgId).map(d => d.id))
  const seen = new Set<string>()

  const cleanRooms: OfficeRoom[] = rooms.map((r, i) => {
    const kind = r.kind === 'corredor' ? 'corredor' : 'sala'
    const x = num(r.x, 0, width - 0.5, 'Posição da sala')
    const z = num(r.z, 0, depth - 0.5, 'Posição da sala')
    const room: OfficeRoom = {
      id: idOf(r.id, seen),
      kind,
      name: (typeof r.name === 'string' ? r.name.trim() : '').slice(0, 40) || (kind === 'corredor' ? 'Corredor' : `Sala ${i + 1}`),
      x,
      z,
      w: num(r.w, 0.5, width - x, 'Tamanho da sala'),
      d: num(r.d, 0.5, depth - z, 'Tamanho da sala'),
      color: color(r.color, kind === 'corredor' ? CORRIDOR_COLOR : ROOM_COLORS[i % ROOM_COLORS.length]),
    }
    if (typeof r.departmentId === 'string' && depts.has(r.departmentId)) room.departmentId = r.departmentId
    if (kind === 'sala' && typeof r.wallColor === 'string' && /^#[0-9a-f]{6}$/i.test(r.wallColor)) room.wallColor = r.wallColor
    return room
  })

  const cleanItems: OfficeItem[] = items.map(it => {
    const item: OfficeItem = {
      id: idOf(it.id, seen),
      type: it.type === 'mesa' ? 'mesa' : 'cadeira',
      x: num(it.x, 0, width, 'Posição'),
      z: num(it.z, 0, depth, 'Posição'),
      rot: ((Math.round(Number(it.rot) || 0) % 360) + 360) % 360,
    }
    if (item.type === 'cadeira') {
      item.label = (typeof it.label === 'string' ? it.label.trim() : '').slice(0, 24) || 'Cadeira'
      if (typeof it.style === 'string' && it.style !== 'escritorio' && it.style in CHAIR_STYLES) item.style = it.style
    } else {
      // mesa: tipo, tamanho (dentro dos limites do tipo) e acabamento
      const style = typeof it.style === 'string' && it.style in DESK_STYLES ? (it.style as keyof typeof DESK_STYLES) : 'escritorio'
      const s = DESK_STYLES[style]
      if (style !== 'escritorio') item.style = style
      if (it.w !== undefined) item.w = num(it.w, s.min, s.max, 'Comprimento da mesa')
      if (it.d !== undefined && style !== 'redonda') item.d = num(it.d, 0.4, Math.max(s.d, s.max / 2), 'Largura da mesa')
      if (typeof it.color === 'string' && /^#[0-9a-f]{6}$/i.test(it.color)) item.color = it.color
      if (it.seats !== undefined) item.seats = Math.round(num(it.seats, 1, SEAT_LIMITS[style].max, 'Lugares da mesa'))
    }
    return item
  })

  // uma mesa ou cadeira não pode ocupar o lugar de outra
  if (overlapping(cleanItems).size) fail(400, 'Há mesas ou cadeiras umas por cima das outras. Usa "Arrumar automaticamente" no editor.')

  const map: OfficeMap = { width, depth, rooms: cleanRooms, items: cleanItems, updatedAt: Date.now() }
  if (keepGuide) map.guideId = keepGuide
  return map
}
