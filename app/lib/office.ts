import type { ChairStyle, DeskStyle, Member, OfficeItem, OfficeMap, OfficeRoom } from '../types'
import { WORKDAY_MS } from './org'

/* ─── Limites (validados no servidor; o editor respeita os mesmos) ─── */
export const MAX_ROOMS = 120
export const MAX_ITEMS = 1500
export const MIN_SIZE = 5
export const MAX_SIZE = 200
export const MAX_GUIDE = 8 * 1024 * 1024
export const GUIDE_TYPES = ['image/jpeg', 'image/png', 'image/webp']
/** grelha do editor, em metros */
export const SNAP = 0.25

export const ROOM_COLORS = ['#DCE7FF', '#DCF7F3', '#FFEDE0', '#EEEAFF', '#FDE6F2', '#FFF4D6', '#E5F6FD', '#F1F0F5']
export const CORRIDOR_COLOR = '#E9E7F2'

/** Cores das paredes das salas */
export const WALL_COLORS = ['#FFFFFF', '#F4F1EA', '#E8E6EF', '#DCE7FF', '#DCF7F3', '#FFE9D6', '#3D3A52', '#6E8B74']

/** Tamanho do mobiliário por omissão (metros): largura (x), fundo (z), altura */
export const MESA = { w: 1.4, d: 0.7, h: 0.75 }
export const CADEIRA = { w: 0.5, d: 0.5, h: 0.45 }

/** Tipos de mesa: tamanho por omissão e limites para o tamanho */
export const DESK_STYLES: Record<DeskStyle, { label: string; w: number; d: number; h: number; min: number; max: number }> = {
  escritorio: { label: 'Mesa de trabalho', w: 1.4, d: 0.7, h: 0.75, min: 0.8, max: 3 },
  reuniao: { label: 'Mesa de reunião', w: 2.4, d: 1.1, h: 0.75, min: 1, max: 8 },
  redonda: { label: 'Mesa redonda', w: 1.1, d: 1.1, h: 0.75, min: 0.6, max: 3 },
  balcao: { label: 'Balcão', w: 1.8, d: 0.6, h: 1.05, min: 0.8, max: 6 },
}
/** Tipos de cadeira (o tamanho é o do tipo) */
export const CHAIR_STYLES: Record<ChairStyle, { label: string; w: number; d: number; h: number }> = {
  escritorio: { label: 'Cadeira de escritório', w: 0.5, d: 0.5, h: 0.45 },
  simples: { label: 'Cadeira simples', w: 0.45, d: 0.45, h: 0.45 },
  poltrona: { label: 'Poltrona', w: 0.8, d: 0.75, h: 0.4 },
  banco: { label: 'Banco alto', w: 0.4, d: 0.4, h: 0.75 },
}
/** Acabamentos do tampo das mesas */
export const DESK_COLORS = [
  { color: '#E3CFAE', label: 'Madeira clara' },
  { color: '#8B5E3C', label: 'Madeira escura' },
  { color: '#F4F3F7', label: 'Branco' },
  { color: '#2E2C3A', label: 'Preto' },
]

export const deskStyle = (i: Pick<OfficeItem, 'style'>): DeskStyle => (i.style && i.style in DESK_STYLES ? (i.style as DeskStyle) : 'escritorio')
export const chairStyle = (i: Pick<OfficeItem, 'style'>): ChairStyle => (i.style && i.style in CHAIR_STYLES ? (i.style as ChairStyle) : 'escritorio')

/** Tamanho real da peça: o do tipo, ou o escolhido (só nas mesas); a mesa redonda tem w = d */
export function itemSize(i: Pick<OfficeItem, 'type' | 'style' | 'w' | 'd'>): { w: number; d: number; h: number } {
  if (i.type === 'cadeira') return CHAIR_STYLES[chairStyle(i)]
  const s = DESK_STYLES[deskStyle(i)]
  const w = i.w ?? s.w
  const d = deskStyle(i) === 'redonda' ? w : i.d ?? s.d
  return { w, d, h: s.h }
}

export const emptyOffice = (): OfficeMap => ({ width: 30, depth: 20, rooms: [], items: [] })
export const seatsOf = (map: OfficeMap | undefined) => (map?.items ?? []).filter(i => i.type === 'cadeira')
export const hasSeats = (map: OfficeMap | undefined) => seatsOf(map).length > 0

/** A sala onde está um ponto (as salas ganham aos corredores; a mais pequena ganha às maiores) */
export function roomAt(map: OfficeMap, x: number, z: number): OfficeRoom | undefined {
  const inside = map.rooms.filter(r => x >= r.x && x <= r.x + r.w && z >= r.z && z <= r.z + r.d)
  inside.sort((a, b) => (a.kind === b.kind ? a.w * a.d - b.w * b.d : a.kind === 'sala' ? -1 : 1))
  return inside[0]
}

export type Seat = { seat: OfficeItem; room?: OfficeRoom }

export function findSeat(map: OfficeMap | undefined, seatId: string | undefined): Seat | undefined {
  if (!map || !seatId) return undefined
  const seat = map.items.find(i => i.id === seatId && i.type === 'cadeira')
  return seat ? { seat, room: roomAt(map, seat.x, seat.z) } : undefined
}

export const seatName = (s: Seat | undefined) => (s ? `${s.room?.name ?? 'Fora das salas'} · ${s.seat.label || 'Cadeira'}` : '')

/** A escolha (cadeira ou remoto) ainda vale: foi feita há menos de um dia de trabalho */
export const choiceValid = (m: Pick<Member, 'seatAt'>, now = Date.now()) => !!m.seatAt && now - m.seatAt < WORKDAY_MS

/** Está numa reunião presencial agora, numa sala do mapa (devolve a sala) */
export function meetingRoom(m: Pick<Member, 'meeting'>, map: OfficeMap | undefined, now = Date.now()): OfficeRoom | undefined {
  const mt = m.meeting
  if (!mt || mt.mode !== 'presencial' || !mt.roomId || now >= mt.until) return undefined
  return map?.rooms.find(r => r.id === mt.roomId)
}


/**
 * Onde está a pessoa agora. Só conta quem está activo e online. Numa reunião presencial está na
 * sala da reunião (o lugar dela fica guardado); senão, na cadeira que escolheu hoje (uma cadeira
 * que já não existe conta como "sem lugar").
 */
export function whereIs(m: Member, map: OfficeMap | undefined, now = Date.now()):
  { kind: 'seat'; at: Seat } | { kind: 'meeting'; room: OfficeRoom } | { kind: 'remote' } | { kind: 'none' } {
  if (m.status !== 'activo' || m.presence === 'offline') return { kind: 'none' }
  const room = meetingRoom(m, map, now)
  if (room) return { kind: 'meeting', room }
  if (!choiceValid(m, now)) return { kind: 'none' }
  const at = findSeat(map, m.seatId)
  if (at) return { kind: 'seat', at }
  return m.remote ? { kind: 'remote' } : { kind: 'none' }
}

/** Lugares de quem foi a uma reunião presencial: continuam dessa pessoa (ninguém se senta lá) */
export function reservedSeats(members: Member[], map: OfficeMap | undefined, now = Date.now()) {
  const out = new Map<string, Member>()
  for (const m of members) {
    if (m.seatId && choiceValid(m, now) && whereIs(m, map, now).kind === 'meeting' && findSeat(map, m.seatId)) out.set(m.seatId, m)
  }
  return out
}

/** Esta pessoa ainda tem de dizer onde está (há cadeiras no mapa e não escolheu hoje) */
export function mustChoose(m: Member, map: OfficeMap | undefined, now = Date.now()) {
  if (!hasSeats(map)) return false
  if (!choiceValid(m, now)) return true
  // a cadeira escolhida foi apagada do mapa: escolhe outra
  return !m.remote && !findSeat(map, m.seatId)
}

/**
 * Quem está sentado em cada cadeira agora (seatId → pessoa). Quem está numa reunião presencial
 * aparece nas cadeiras livres da sala da reunião (se houver cadeiras para todos).
 */
export function occupants(members: Member[], map: OfficeMap | undefined, now = Date.now()) {
  const out = new Map<string, Member>()
  const meetings = new Map<string, Member[]>()
  for (const m of members) {
    const w = whereIs(m, map, now)
    if (w.kind === 'seat' && !out.has(w.at.seat.id)) out.set(w.at.seat.id, m)
    if (w.kind === 'meeting') meetings.set(w.room.id, [...(meetings.get(w.room.id) ?? []), m])
  }
  if (!map || !meetings.size) return out
  const reserved = reservedSeats(members, map, now)
  for (const [roomId, people] of meetings) {
    const free = seatsOf(map)
      .filter(s => roomAt(map, s.x, s.z)?.id === roomId && !out.has(s.id) && !reserved.has(s.id))
      .sort((a, b) => (a.label ?? '').localeCompare(b.label ?? '', 'pt', { numeric: true }))
    // a ordem das pessoas é sempre a mesma (não trocam de cadeira a cada actualização)
    ;[...people].sort((a, b) => a.id.localeCompare(b.id)).forEach((m, k) => { if (free[k]) out.set(free[k].id, m) })
  }
  return out
}

/** Nome para a próxima cadeira ("Cadeira 7"): o primeiro número livre */
export function nextSeatLabel(items: OfficeItem[]) {
  const used = new Set(items.filter(i => i.type === 'cadeira').map(i => i.label))
  let n = 1
  while (used.has(`Cadeira ${n}`)) n++
  return `Cadeira ${n}`
}

export const snap = (v: number, step = SNAP) => Math.round(v / step) * step

/* ─── Espaço ocupado pelo mobiliário ─────────────────────────────────────
 * Nenhuma peça fica por cima de outra, as cadeiras ficam afastadas das mesas, nenhuma peça
 * atravessa uma parede (fica toda dentro ou toda fora de cada sala) e as cadeiras viram-se
 * para a mesa mais perto.
 */

/** folga entre a cadeira e a mesa (para a pessoa se sentar) */
export const CHAIR_DESK_GAP = 0.12
/** folga entre duas cadeiras */
export const CHAIR_GAP = 0.06
/** espessura das paredes (as peças não podem tocar nelas) */
export const WALL_MARGIN = 0.06
/** até onde uma cadeira pertence a uma mesa (distância à borda da mesa, em metros) */
export const DESK_REACH = 0.9

export type Box = { x0: number; z0: number; x1: number; z1: number }
type Piece = Pick<OfficeItem, 'type' | 'x' | 'z' | 'rot'> & Partial<Pick<OfficeItem, 'style' | 'w' | 'd'>>
type Floor = Pick<OfficeMap, 'width' | 'depth'> & { rooms?: OfficeRoom[] }

const rad = (deg: number) => (deg * Math.PI) / 180
const norm = (deg: number) => ((Math.round(deg) % 360) + 360) % 360

/** O rectângulo que a peça ocupa no chão (já com a rotação) */
export function footprint(i: Piece): Box {
  const size = itemSize(i)
  const c = Math.abs(Math.cos(rad(i.rot)))
  const s = Math.abs(Math.sin(rad(i.rot)))
  const hw = (size.w * c + size.d * s) / 2
  const hd = (size.w * s + size.d * c) / 2
  return { x0: i.x - hw, z0: i.z - hd, x1: i.x + hw, z1: i.z + hd }
}

/** Folga mínima entre duas peças: mesas podem encostar (formam bancadas); cadeiras não */
const gapBetween = (a: Piece, b: Piece) =>
  a.type === 'mesa' && b.type === 'mesa' ? 0 : a.type === 'cadeira' && b.type === 'cadeira' ? CHAIR_GAP : CHAIR_DESK_GAP

const touches = (a: Box, b: Box, gap: number) =>
  a.x0 < b.x1 + gap - 1e-6 && b.x0 < a.x1 + gap - 1e-6 && a.z0 < b.z1 + gap - 1e-6 && b.z0 < a.z1 + gap - 1e-6

/** A peça atravessa a parede de alguma sala (não está toda dentro nem toda fora dela) */
export function crossesWall(box: Box, rooms: OfficeRoom[] = []) {
  const m = WALL_MARGIN
  return rooms.some(r => {
    if (r.kind !== 'sala') return false
    const inside = box.x0 >= r.x + m && box.x1 <= r.x + r.w - m && box.z0 >= r.z + m && box.z1 <= r.z + r.d - m
    const outside = box.x1 <= r.x - m || box.x0 >= r.x + r.w + m || box.z1 <= r.z - m || box.z0 >= r.z + r.d + m
    return !inside && !outside
  })
}

/** A peça cabe ali: dentro do piso, sem atravessar paredes e afastada das outras (menos as de "ignore") */
export function fits(items: OfficeItem[], cand: Piece, map: Floor, ignore: Set<string> = new Set()) {
  const box = footprint(cand)
  if (box.x0 < 0 || box.z0 < 0 || box.x1 > map.width || box.z1 > map.depth) return false
  if (crossesWall(box, map.rooms)) return false
  return !items.some(o => !ignore.has(o.id) && touches(box, footprint(o), gapBetween(cand, o)))
}

/** As peças que estão por cima de outras (sem folga nenhuma): o servidor recusa estes mapas */
/**
 * Os pares de peças próximas (que partilham uma célula de 2 m de uma grelha), para não comparar
 * todas com todas: com 1500 peças seriam mais de um milhão de comparações a cada movimento.
 */
function nearPairs(boxes: Box[], visit: (i: number, j: number) => void) {
  const CELL = 2
  const reach = CHAIR_DESK_GAP
  const grid = new Map<number, number[]>()
  const key = (cx: number, cz: number) => cx * 100003 + cz
  boxes.forEach((b, i) => {
    for (let cx = Math.floor((b.x0 - reach) / CELL); cx <= Math.floor((b.x1 + reach) / CELL); cx++) {
      for (let cz = Math.floor((b.z0 - reach) / CELL); cz <= Math.floor((b.z1 + reach) / CELL); cz++) {
        const k = key(cx, cz)
        const list = grid.get(k)
        if (list) list.push(i)
        else grid.set(k, [i])
      }
    }
  })
  const seen = new Set<number>()
  for (const list of grid.values()) {
    for (let a = 0; a < list.length; a++) {
      for (let b = a + 1; b < list.length; b++) {
        const i = list[a]
        const j = list[b]
        const pair = i < j ? i * boxes.length + j : j * boxes.length + i
        if (seen.has(pair)) continue
        seen.add(pair)
        visit(Math.min(i, j), Math.max(i, j))
      }
    }
  }
}

export function overlapping(items: OfficeItem[]): Set<string> {
  const out = new Set<string>()
  const boxes = items.map(footprint)
  nearPairs(boxes, (i, j) => {
    if (touches(boxes[i], boxes[j], 0)) {
      out.add(items[i].id)
      out.add(items[j].id)
    }
  })
  return out
}

/** As peças mal postas (o editor mostra-as a vermelho): sobrepostas, coladas ou a atravessar paredes */
export function misplaced(map: Floor & { items: OfficeItem[] }): Set<string> {
  const out = new Set<string>()
  const boxes = map.items.map(footprint)
  boxes.forEach((b, i) => {
    if (b.x0 < 0 || b.z0 < 0 || b.x1 > map.width || b.z1 > map.depth || crossesWall(b, map.rooms)) out.add(map.items[i].id)
  })
  nearPairs(boxes, (i, j) => {
    if (touches(boxes[i], boxes[j], gapBetween(map.items[i], map.items[j]))) {
      out.add(map.items[i].id)
      out.add(map.items[j].id)
    }
  })
  return out
}

/** Posição de um ponto no referencial da mesa: lx ao longo da mesa, lz para a frente (lado do teclado) */
function toDesk(desk: Piece, x: number, z: number) {
  const a = rad(desk.rot)
  const dx = x - desk.x
  const dz = z - desk.z
  return { lx: dx * Math.cos(a) + dz * Math.sin(a), lz: -dx * Math.sin(a) + dz * Math.cos(a) }
}
function fromDesk(desk: Piece, lx: number, lz: number) {
  const a = rad(desk.rot)
  return { x: desk.x + lx * Math.cos(a) - lz * Math.sin(a), z: desk.z + lx * Math.sin(a) + lz * Math.cos(a) }
}

/** A mesa mais perto de um ponto (até DESK_REACH da borda da mesa) */
export function nearestDesk(items: OfficeItem[], x: number, z: number, ignore?: string) {
  let best: OfficeItem | undefined
  let dist = DESK_REACH
  for (const d of items) {
    if (d.type !== 'mesa' || d.id === ignore) continue
    const s = itemSize(d)
    const { lx, lz } = toDesk(d, x, z)
    const dd = deskStyle(d) === 'redonda'
      ? Math.max(0, Math.hypot(x - d.x, z - d.z) - s.w / 2)
      : Math.hypot(Math.max(0, Math.abs(lx) - s.w / 2), Math.max(0, Math.abs(lz) - s.d / 2))
    if (dd < dist) {
      dist = dd
      best = d
    }
  }
  return best
}

/** Rotação para uma cadeira em (cx, cz) ficar virada para (tx, tz): com a rotação 0 vira-se para z− */
const facing = (cx: number, cz: number, tx: number, tz: number) => norm((Math.atan2(tx - cx, cz - tz) * 180) / Math.PI)
const cm = (v: number) => Math.round(v * 100) / 100

/**
 * Cadeira junto a uma mesa: à distância certa e virada para a mesa.
 * - mesa de trabalho e balcão: à frente ou atrás (do lado onde a cadeira está);
 * - mesa de reunião: também nas pontas;
 * - mesa redonda: à volta, na direcção onde a cadeira está.
 */
export function chairAtDesk(desk: Piece, x: number, z: number, chair: Pick<OfficeItem, 'style'> = {}): { x: number; z: number; rot: number } {
  const ds = itemSize(desk)
  const cs = itemSize({ type: 'cadeira', style: chair.style })
  const style = deskStyle(desk)
  if (style === 'redonda') {
    const r = ds.w / 2 + CHAIR_DESK_GAP + cs.d / 2
    const ang = x === desk.x && z === desk.z ? Math.PI / 2 : Math.atan2(z - desk.z, x - desk.x)
    const px = desk.x + Math.cos(ang) * r
    const pz = desk.z + Math.sin(ang) * r
    return { x: cm(px), z: cm(pz), rot: facing(px, pz, desk.x, desk.z) }
  }
  const { lx, lz } = toDesk(desk, x, z)
  const ends = style === 'reuniao' && Math.abs(lx) / (ds.w / 2) > Math.abs(lz) / (ds.d / 2)
  const clamp = (v: number, half: number) => Math.max(-Math.max(0, half - cs.w / 2), Math.min(Math.max(0, half - cs.w / 2), v))
  let p: { x: number; z: number }
  let edge: { x: number; z: number }
  if (ends) {
    const side = lx >= 0 ? 1 : -1
    const along = clamp(lz, ds.d / 2)
    p = fromDesk(desk, side * (ds.w / 2 + CHAIR_DESK_GAP + cs.d / 2), along)
    edge = fromDesk(desk, side * ds.w / 2, along)
  } else {
    const side = lz >= 0 ? 1 : -1
    const along = clamp(lx, ds.w / 2)
    p = fromDesk(desk, along, side * (ds.d / 2 + CHAIR_DESK_GAP + cs.d / 2))
    edge = fromDesk(desk, along, side * ds.d / 2)
  }
  return { x: cm(p.x), z: cm(p.z), rot: facing(p.x, p.z, edge.x, edge.z) }
}

/**
 * O lugar livre mais perto de (x, z) onde a peça cabe, procurando em espiral na grelha até
 * "radius" metros. Sem lugar: null.
 */
export function freeSpot(items: OfficeItem[], cand: Piece, map: Floor, ignore: Set<string> = new Set(), radius = 3) {
  if (fits(items, cand, map, ignore)) return { x: cand.x, z: cand.z }
  const steps = Math.round(radius / SNAP)
  for (let r = 1; r <= steps; r++) {
    const ring: { x: number; z: number; d: number }[] = []
    for (let dx = -r; dx <= r; dx++) {
      for (let dz = -r; dz <= r; dz++) {
        if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue
        ring.push({ x: snap(cand.x + dx * SNAP), z: snap(cand.z + dz * SNAP), d: dx * dx + dz * dz })
      }
    }
    ring.sort((a, b) => a.d - b.d)
    for (const p of ring) if (fits(items, { ...cand, x: p.x, z: p.z }, map, ignore)) return { x: p.x, z: p.z }
  }
  return null
}


/* ─── Lugares das mesas e "Organizar tudo" ───────────────────────────────── */

/** Quantos lugares tem cada tipo de mesa: por omissão e no máximo */
export const SEAT_LIMITS: Record<DeskStyle, { def: number; max: number }> = {
  escritorio: { def: 1, max: 6 },
  balcao: { def: 1, max: 4 },
  reuniao: { def: 6, max: 16 },
  redonda: { def: 4, max: 10 },
}
/** Espaço de cada lugar ao longo da mesa, em metros */
export const SEAT_PITCH = 0.7
/** Cadeira que cada tipo de mesa leva quando o organizador cria lugares novos */
export const CHAIR_FOR_DESK: Record<DeskStyle, ChairStyle> = { escritorio: 'escritorio', balcao: 'banco', reuniao: 'simples', redonda: 'simples' }

export const deskSeats = (d: Pick<OfficeItem, 'style' | 'seats'>) => {
  const lim = SEAT_LIMITS[deskStyle(d)]
  return Math.max(1, Math.min(lim.max, Math.round(d.seats ?? lim.def)))
}

/** Lugares de uma mesa de reunião: nas pontas (a partir de 6) e o resto à frente e atrás */
function meetingSplit(n: number) {
  const ends = n >= 6 ? 2 : 0
  const rest = n - ends
  return { ends, front: Math.ceil(rest / 2), back: Math.floor(rest / 2) }
}

/** O tamanho mínimo para a mesa ter os seus lugares (nunca a encolhe) */
export function sizeForSeats(desk: Pick<OfficeItem, 'type' | 'style' | 'w' | 'd' | 'seats'>): { w: number; d: number } {
  const style = deskStyle(desk)
  const s = DESK_STYLES[style]
  const cur = itemSize(desk)
  const n = deskSeats(desk)
  const round = (v: number) => Math.round(v * 10) / 10
  if (style === 'redonda') {
    // os centros das cadeiras ficam num círculo com SEAT_PITCH entre elas
    const ring = (n * SEAT_PITCH) / (2 * Math.PI)
    const w = Math.max(cur.w, round(2 * (ring - CHAIR_DESK_GAP - CHAIR_STYLES.simples.d / 2)))
    return { w: Math.min(s.max, w), d: Math.min(s.max, w) }
  }
  const perSide = style === 'reuniao' ? meetingSplit(n).front : n
  const w = Math.min(s.max, Math.max(cur.w, round(perSide * SEAT_PITCH + (style === 'reuniao' ? 0.3 : 0))))
  return { w, d: cur.d }
}

/**
 * Onde ficam as cadeiras de uma mesa (posição e rotação), conforme o tipo e o número de lugares:
 * - mesa de trabalho e balcão: todas à frente, espaçadas ao longo da mesa;
 * - mesa de reunião: à frente e atrás e, a partir de 6, uma em cada ponta;
 * - mesa redonda: à volta, a começar pela frente.
 * Todas viradas para a mesa.
 */
export function seatSlots(desk: OfficeItem, chair: ChairStyle = CHAIR_FOR_DESK[deskStyle(desk)]): { x: number; z: number; rot: number }[] {
  const style = deskStyle(desk)
  const { w, d } = itemSize(desk)
  const cs = CHAIR_STYLES[chair]
  const n = deskSeats(desk)
  const out = (local: { lx: number; lz: number }[], toward: (p: { lx: number; lz: number }) => { lx: number; lz: number }) =>
    local.map(p => {
      const at = fromDesk(desk, p.lx, p.lz)
      const t = fromDesk(desk, toward(p).lx, toward(p).lz)
      return { x: cm(at.x), z: cm(at.z), rot: facing(at.x, at.z, t.x, t.z) }
    })
  const off = CHAIR_DESK_GAP + cs.d / 2
  const along = (k: number, count: number) => -w / 2 + (w / count) * (k + 0.5)
  if (style === 'redonda') {
    const r = w / 2 + off
    const local = Array.from({ length: n }, (_, k) => {
      const a = Math.PI / 2 + (k * 2 * Math.PI) / n
      return { lx: Math.cos(a) * r, lz: Math.sin(a) * r }
    })
    return out(local, () => ({ lx: 0, lz: 0 }))
  }
  if (style === 'reuniao') {
    const { ends, front, back } = meetingSplit(n)
    const local = [
      ...Array.from({ length: front }, (_, k) => ({ lx: along(k, front), lz: d / 2 + off })),
      ...Array.from({ length: back }, (_, k) => ({ lx: along(k, back), lz: -(d / 2 + off) })),
      ...(ends ? [{ lx: w / 2 + off, lz: 0 }, { lx: -(w / 2 + off), lz: 0 }] : []),
    ]
    return out(local, p => (Math.abs(p.lz) < 1e-6 ? { lx: Math.sign(p.lx) * (w / 2), lz: 0 } : { lx: p.lx, lz: Math.sign(p.lz) * (d / 2) }))
  }
  const local = Array.from({ length: n }, (_, k) => ({ lx: along(k, n), lz: d / 2 + off }))
  return out(local, p => ({ lx: p.lx, lz: d / 2 }))
}

/** A sala (só salas, com paredes) que contém toda a peça; a mais pequena, se houver várias */
export function salaOf(map: Pick<OfficeMap, 'rooms'>, it: Piece): OfficeRoom | undefined {
  const b = footprint(it)
  const m = WALL_MARGIN
  return map.rooms
    .filter(r => r.kind === 'sala' && b.x0 >= r.x + m && b.x1 <= r.x + r.w - m && b.z0 >= r.z + m && b.z1 <= r.z + r.d - m)
    .sort((a, b2) => a.w * a.d - b2.w * b2.d)[0]
}
/** A sala onde está o centro da peça (mesmo que a peça atravesse a parede) */
const salaAt = (map: Pick<OfficeMap, 'rooms'>, x: number, z: number) =>
  map.rooms.filter(r => r.kind === 'sala' && x >= r.x && x <= r.x + r.w && z >= r.z && z <= r.z + r.d).sort((a, b) => a.w * a.d - b.w * b.d)[0]

/** Procura em espiral o lugar mais perto onde "ok" aceita a peça */
function search(cand: Piece, ok: (p: Piece) => boolean, radius: number): { x: number; z: number } | null {
  if (ok(cand)) return { x: cand.x, z: cand.z }
  const steps = Math.round(radius / SNAP)
  for (let r = 1; r <= steps; r++) {
    const ring: { x: number; z: number; d: number }[] = []
    for (let dx = -r; dx <= r; dx++) {
      for (let dz = -r; dz <= r; dz++) {
        if (Math.max(Math.abs(dx), Math.abs(dz)) === r) ring.push({ x: snap(cand.x + dx * SNAP), z: snap(cand.z + dz * SNAP), d: dx * dx + dz * dz })
      }
    }
    ring.sort((a, b) => a.d - b.d)
    for (const p of ring) if (ok({ ...cand, x: p.x, z: p.z })) return { x: p.x, z: p.z }
  }
  return null
}

export type OrganizeReport = {
  items: OfficeItem[]
  /** peças removidas (mesas + cadeiras) */
  removed: number
  removedDesks?: number
  removedChairs?: number
  added: number
  moved: number
  /** lugares que não couberam */
  skipped: number
}

/**
 * Põe as cadeiras de uma mesa nos lugares dela, reaproveitando cadeiras que já existiam (mantêm
 * o id e o nome: quem lá estava sentado continua no seu lugar): primeiro as que eram desta mesa
 * (mesmo que a mesa tenha mudado de sítio), depois a mais perto do lugar, entre as da sala.
 * Devolve as cadeiras postas e quantos lugares não couberam.
 */
function seatDesk(
  desk: OfficeItem,
  placed: OfficeItem[],
  pool: OfficeItem[],
  map: OfficeMap,
  room: OfficeRoom | undefined,
  labels: OfficeItem[],
  owned: Set<string> = new Set(),
) {
  const chairs: OfficeItem[] = []
  let skipped = 0
  let added = 0
  const slots = seatSlots(desk)
  for (const [k, slot] of slots.entries()) {
    // a mais perto deste lugar: primeiro entre as cadeiras desta mesa; senão, qualquer uma da sala
    // (melhor do que criar uma nova e tirar o lugar a alguém)
    const nearest = (only: boolean) => {
      let found = -1
      let dist = Infinity
      pool.forEach((c, j) => {
        if (only && !owned.has(c.id)) return
        const dd = Math.hypot(c.x - slot.x, c.z - slot.z)
        if (dd < dist) { dist = dd; found = j }
      })
      return found
    }
    let best = nearest(true)
    if (best < 0) best = nearest(false)
    const reused = best >= 0 ? pool[best] : undefined
    const style = reused ? reused.style : CHAIR_FOR_DESK[deskStyle(desk)]
    // o mesmo lugar, à distância certa para este tipo de cadeira
    const fit = seatSlots(desk, chairStyle({ style }))[k] ?? slot
    const cand: OfficeItem = {
      id: reused?.id ?? `o${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`,
      type: 'cadeira',
      ...fit,
      label: reused?.label,
      ...(style && style !== 'escritorio' ? { style } : {}),
    }
    const inRoom = !room || salaOf(map, cand)?.id === room.id
    if (!inRoom || !fits(placed, cand, map)) {
      skipped++
      continue
    }
    if (reused) pool.splice(best, 1)
    else {
      cand.label = nextSeatLabel(labels)
      added++
    }
    placed.push(cand)
    labels.push(cand)
    chairs.push(cand)
  }
  return { chairs, skipped, added }
}

/* ─── Disposição em filas ─── */

/** distância às paredes, corredor entre filas e espaço entre mesas da mesma fila (metros) */
const ROOM_MARGIN = 0.4
const ROW_AISLE = 0.9
const COL_GAP = 0.3

/**
 * O "bloco" que uma mesa ocupa com as suas cadeiras, numa fila: largura ao longo da fila (bu),
 * fundo entre filas (bv) e onde fica o centro da mesa dentro do bloco (cu, cv). Na fila, as
 * mesas de trabalho e os balcões têm as cadeiras do lado de baixo (a frente).
 */
function block(desk: OfficeItem) {
  const style = deskStyle(desk)
  const { w, d } = itemSize(desk)
  const chair = CHAIR_STYLES[CHAIR_FOR_DESK[style]].d + CHAIR_DESK_GAP
  if (style === 'redonda') {
    const s = w + 2 * chair
    return { bu: s, bv: s, cu: s / 2, cv: s / 2 }
  }
  if (style === 'reuniao') {
    const ends = meetingSplit(deskSeats(desk)).ends ? chair : 0
    return { bu: w + 2 * ends, bv: d + 2 * chair, cu: w / 2 + ends, cv: d / 2 + chair }
  }
  return { bu: w, bv: d + chair, cu: w / 2, cv: d / 2 }
}

/**
 * Arruma as mesas de uma sala em filas alinhadas, todas viradas para o mesmo lado e com um
 * corredor entre filas, centradas na sala. Tenta filas ao comprido e ao alto e fica com a que
 * leva mais mesas (em empate, ao comprido). Devolve as mesas na nova posição e as que não couberam.
 */
function layoutRoom(room: OfficeRoom, desks: OfficeItem[]): { placed: OfficeItem[]; overflow: OfficeItem[] } {
  const inner = ROOM_MARGIN + WALL_MARGIN
  const attempt = (vertical: boolean) => {
    // u: ao longo das filas; v: de fila em fila
    const U = (vertical ? room.d : room.w) - 2 * inner
    const V = (vertical ? room.w : room.d) - 2 * inner
    // ordem de leitura (fila a fila), para as mesas manterem a vizinhança
    const order = [...desks].sort((a, b) => {
      const [ua, va] = vertical ? [a.z, -a.x] : [a.x, a.z]
      const [ub, vb] = vertical ? [b.z, -b.x] : [b.x, b.z]
      return Math.round(va) - Math.round(vb) || ua - ub
    })
    const rows: { items: { desk: OfficeItem; u: number; b: ReturnType<typeof block> }[]; v: number; h: number; used: number }[] = []
    const overflow: OfficeItem[] = []
    let row = { items: [] as { desk: OfficeItem; u: number; b: ReturnType<typeof block> }[], v: 0, h: 0, used: 0 }
    for (const desk of order) {
      const b = block(desk)
      if (b.bu > U || b.bv > V) { overflow.push(desk); continue }
      const at = row.used ? row.used + COL_GAP : 0
      if (at + b.bu > U) {
        if (row.items.length) rows.push(row)
        row = { items: [], v: row.v + row.h + (row.items.length ? ROW_AISLE : 0), h: 0, used: 0 }
      }
      if (row.v + b.bv > V) { overflow.push(desk); continue }
      const u = row.used ? row.used + COL_GAP : 0
      row.items.push({ desk, u, b })
      row.used = u + b.bu
      row.h = Math.max(row.h, b.bv)
    }
    if (row.items.length) rows.push(row)
    const usedV = rows.length ? rows[rows.length - 1].v + rows[rows.length - 1].h : 0
    const offV = (V - usedV) / 2
    const placed: OfficeItem[] = []
    for (const r of rows) {
      const offU = (U - r.used) / 2
      for (const { desk, u, b } of r.items) {
        const lu = inner + offU + u + b.cu
        const lv = inner + offV + r.v + b.cv
        // filas ao comprido: rotação 0 (a frente para z+); ao alto: rotação 90 (a frente para x−)
        const pos = vertical
          ? { x: room.x + room.w - lv, z: room.z + lu, rot: 90 }
          : { x: room.x + lu, z: room.z + lv, rot: 0 }
        placed.push({ ...desk, x: cm(pos.x), z: cm(pos.z), rot: pos.rot })
      }
    }
    return { placed, overflow }
  }
  const across = attempt(false)
  if (!across.overflow.length) return across
  const down = attempt(true)
  return down.placed.length > across.placed.length ? down : across
}

/**
 * Organizar tudo, de uma vez. No fim, todas as mesas têm cadeiras e todas as cadeiras são de
 * uma mesa:
 * 1. em cada sala, as mesas ficam em filas alinhadas, todas viradas para o mesmo lado, com
 *    corredores entre filas e centradas (cada mesa com o tamanho para os seus lugares);
 * 2. cada mesa recebe as suas cadeiras, nos lugares certos e viradas para ela (as cadeiras que
 *    já lá estavam acompanham a mesa: quem lá estava sentado não perde o lugar). Se não houver
 *    espaço para todos os lugares, a mesa fica com os que cabem; sem nenhum, a mesa sai;
 * 3. saem as mesas fora das salas e as que não cabem na sala;
 * 4. saem todas as cadeiras que não são de uma mesa (fora das salas, a mais, soltas).
 */
export function organizeAll(map: OfficeMap): OrganizeReport {
  const desks = map.items.filter(i => i.type === 'mesa')
  const chairs = map.items.filter(i => i.type === 'cadeira')
  const placed: OfficeItem[] = []
  const labels: OfficeItem[] = [...chairs]
  let moved = 0
  let skipped = 0
  let added = 0

  // de que mesa era cada cadeira (antes de as mesas mudarem de sítio)
  const ownerOf = new Map<string, string>()
  for (const c of chairs) {
    const d = nearestDesk(map.items, c.x, c.z)
    if (d) ownerOf.set(c.id, d.id)
  }

  // 1. mesas: em filas, sala a sala (as que estão fora das salas não têm onde pôr cadeiras: saem)
  const byRoom = new Map<string, OfficeItem[]>()
  for (const d of desks) {
    const room = salaAt(map, d.x, d.z)
    if (room) byRoom.set(room.id, [...(byRoom.get(room.id) ?? []), { ...d, ...sizeForSeats(d) }])
  }
  const changed = (a: OfficeItem, b: OfficeItem) => a.x !== b.x || a.z !== b.z || a.rot !== b.rot || a.w !== b.w
  const deskRoom = new Map<string, OfficeRoom>()
  const pending: { desk: OfficeItem; room: OfficeRoom }[] = []
  for (const [roomId, list] of byRoom) {
    const room = map.rooms.find(r => r.id === roomId)!
    const { placed: rowDesks, overflow } = layoutRoom(room, list)
    for (const d of rowDesks) {
      placed.push(d)
      deskRoom.set(d.id, room)
      if (changed(d, desks.find(o => o.id === d.id)!)) moved++
    }
    // as que não couberam nas filas tratam-se depois (passo 3), já com as cadeiras das outras postas
    for (const d of overflow) pending.push({ desk: d, room })
  }

  // 2. as cadeiras de cada mesa
  const pools = new Map<string, OfficeItem[]>()
  for (const c of chairs) {
    const r = salaAt(map, c.x, c.z)
    if (r) pools.set(r.id, [...(pools.get(r.id) ?? []), c])
  }
  /**
   * Dá à mesa (já em "placed") os seus lugares; se não couberem todos, menos lugares (as cadeiras
   * ficam bem distribuídas). Sem nenhum lugar, a mesa sai logo (e deixa o espaço às outras).
   */
  const seat = (d: OfficeItem, room: OfficeRoom) => {
    const owned = new Set(chairs.filter(c => ownerOf.get(c.id) === d.id).map(c => c.id))
    const pool = pools.get(room.id) ?? []
    const want = deskSeats(d)
    for (let n = want; n >= 1; n--) {
      const tryPlaced = [...placed]
      const tryPool = [...pool]
      const tryLabels = [...labels]
      const res = seatDesk({ ...d, seats: n }, tryPlaced, tryPool, map, room, tryLabels, owned)
      if (res.skipped) continue
      if (n < want) {
        d.seats = n
        skipped += want - n
      }
      placed.splice(0, placed.length, ...tryPlaced)
      pool.splice(0, pool.length, ...tryPool)
      labels.splice(0, labels.length, ...tryLabels)
      added += res.added
      return true
    }
    placed.splice(placed.indexOf(d), 1)
    return false
  }
  for (const d of placed.filter(i => i.type === 'mesa')) seat(d, deskRoom.get(d.id)!)

  // 3. as mesas que não couberam nas filas: só ficam onde caibam com pelo menos um lugar
  const seatsOne = (p: OfficeItem, room: OfficeRoom) =>
    seatDesk({ ...p, seats: 1 }, [...placed, p], [...(pools.get(room.id) ?? [])], map, room, [...labels]).skipped === 0
  for (const { desk, room } of pending) {
    const spot = search(desk, p => fits(placed, p, map) && salaOf(map, p)?.id === room.id && seatsOne({ ...desk, ...p } as OfficeItem, room), 6)
    if (!spot) continue
    const d = { ...desk, ...spot }
    placed.push(d)
    deskRoom.set(d.id, room)
    if (seat(d, room)) moved++
  }

  // 3 e 4. ficam só as mesas com cadeiras e as cadeiras das mesas
  const final = placed
  const byId = new Map(final.map(i => [i.id, i]))
  const kept = map.items.filter(i => byId.has(i.id)).map(i => byId.get(i.id)!)
  const fresh = final.filter(i => !map.items.some(o => o.id === i.id))
  const items = [...kept, ...fresh]
  const removedDesks = desks.filter(d => !byId.has(d.id)).length
  const removedChairs = chairs.filter(c => !byId.has(c.id)).length
  return { items, removed: removedDesks + removedChairs, removedDesks, removedChairs, added, moved, skipped }
}

/**
 * Arruma só uma mesa (ao mudar os lugares, o tipo ou o tamanho dela): a mesa cresce se for
 * preciso e recebe as suas cadeiras; as que lhe pertenciam e já não têm lugar saem.
 */
export function arrangeDesk(map: OfficeMap, deskId: string): OrganizeReport | null {
  const desk = map.items.find(i => i.id === deskId && i.type === 'mesa')
  if (!desk) return null
  const others = map.items.filter(i => i.id !== deskId)
  // as cadeiras desta mesa: as que estão mais perto dela do que de qualquer outra
  const own = others.filter(c => c.type === 'cadeira' && nearestDesk(map.items, c.x, c.z)?.id === deskId)
  const rest = others.filter(i => !own.includes(i))
  const sized = { ...desk, ...sizeForSeats(desk) }
  const room = salaAt(map, desk.x, desk.z)
  const spot = search(sized, p => fits(rest, p, map) && (!room || salaOf(map, p)?.id === room.id), 3)
  if (!spot) return null
  const next = { ...sized, ...spot }
  const placed = [...rest, next]
  const res = seatDesk(next, placed, [...own], map, room, [...map.items])
  const items = map.items.flatMap(i => (i.id === deskId ? [next] : own.includes(i) ? res.chairs.filter(c => c.id === i.id) : [i]))
  const fresh = res.chairs.filter(c => !map.items.some(o => o.id === c.id))
  return { items: [...items, ...fresh], removed: own.length - (res.chairs.length - fresh.length), added: fresh.length, moved: 0, skipped: res.skipped }
}
