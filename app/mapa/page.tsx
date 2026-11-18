'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { CalendarBlankIcon, HouseLineIcon, MagnifyingGlassIcon, MoonIcon, PencilSimpleIcon, PlusIcon } from '@phosphor-icons/react'
import { useOrg } from '../context/OrgContext'
import { hhmm, useRoomBookings, type RoomBooking } from '../lib/calendar'
import { useMinute } from '../context/AppContext'
import { findSeat, occupants, seatsOf, whereIs } from '../lib/office'
import { PRESENCE_CONFIG, type Member } from '../types'
import Avatar from '../components/ui/Avatar'
import Mascot from '../components/ui/Mascot'
import OfficeScene from '../components/office/OfficeScene'
import dynamic from 'next/dynamic'
// o editor só é usado pela conta da empresa: não vai no carregamento da página para os outros
const OfficeEditor = dynamic(() => import('../components/office/OfficeEditor'), { ssr: false })
import { SeatButton } from '../components/office/SeatGate'

/** O escritório em 3D: as salas, os corredores e quem está sentado em cada cadeira */
export default function MapPage() {
  const org = useOrg()
  const now = useMinute()
  const [editing, setEditing] = useState(false)
  const [focus, setFocus] = useState<{ x: number; z: number; zoom?: number } | null>(null)
  const [query, setQuery] = useState('')

  // dados frescos ao abrir a página
  const refresh = org?.refresh
  useEffect(() => { refresh?.() }, [refresh])

  const map = org?.org.office
  const people = useMemo(() => (org ? org.members.filter(m => m.status === 'activo' && !(org.isCompany && m.id === org.me.id)) : []), [org])
  const taken = useMemo(() => occupants(people, map, now), [people, map, now])
  // reservas das salas (toda a empresa as vê; detalhes só para quem participa)
  const bookings = useRoomBookings(map?.rooms.length ? org?.base : undefined)
  const busyRooms = useMemo(() => {
    const out = new Map<string, string>()
    for (const b of bookings) if (b.start <= now && now < b.end) out.set(b.roomId, `Em reunião até ${hhmm(b.end)}`)
    return out
  }, [bookings, now])
  // ao abrir, a câmara vira-se para a minha sala (como na escolha do lugar); sem lugar, vista geral
  const myRoom = map && org ? findSeat(map, org.me.seatId)?.room : undefined
  const startFocus = useMemo(
    () => (myRoom ? { x: myRoom.x + myRoom.w / 2, z: myRoom.z + myRoom.d / 2, zoom: Math.max(8, Math.max(myRoom.w, myRoom.d) * 1.3) } : null),
    // só muda se eu mudar de sala (não a cada actualização dos dados)
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [myRoom?.id],
  )

  if (!org) {
    return (
      <div className="flex flex-col items-center px-6 py-16 text-center">
        <Mascot size={100} />
        <h1 className="mt-4 text-2xl font-black text-ink">Mapa do escritório</h1>
        <p className="mt-1 max-w-sm font-semibold text-muted">O mapa mostra onde está cada pessoa no escritório. Só existe nas contas de empresa.</p>
        <Link href="/" className="btn btn-primary mt-6">Voltar ao início</Link>
      </div>
    )
  }

  if (editing && org.isCompany) return <OfficeEditor onClose={() => setEditing(false)} />

  if (!map || (!map.rooms.length && !map.items.length)) {
    return (
      <div className="px-4 pb-6 pt-5 lg:px-0 lg:pt-6">
        <h1 className="mb-5 text-2xl font-black text-ink">Mapa do escritório</h1>
        <div className="card flex flex-col items-center px-6 py-12 text-center">
          <Mascot size={90} mood="thinking" />
          <p className="mt-3 text-lg font-black text-ink">Ainda não há mapa</p>
          <p className="mt-1 max-w-md text-sm font-semibold text-muted">
            {org.isCompany
              ? 'Cria a planta da empresa: carrega a planta ou uma foto como guia, desenha as salas e os corredores, e põe as mesas e as cadeiras. Fica tudo em 3D.'
              : 'Quando a conta da empresa criar o mapa do escritório, vais escolher aqui a sala e a cadeira onde estás.'}
          </p>
          {org.isCompany && <button onClick={() => setEditing(true)} className="btn btn-primary mt-5"><PlusIcon size={18} /> Criar o mapa da empresa</button>}
        </div>
      </div>
    )
  }

  const q = query.trim().toLowerCase()
  const match = (m: Member) => !q || `${m.name} ${m.jobTitle ?? ''}`.toLowerCase().includes(q)
  const byRoom = new Map<string, Member[]>()
  const remote: Member[] = []
  const away: Member[] = []
  for (const m of people) {
    const w = whereIs(m, map, now)
    if (w.kind === 'seat' || w.kind === 'meeting') {
      // numa reunião presencial, está na sala da reunião
      const key = w.kind === 'meeting' ? w.room.id : w.at.room?.id ?? '_fora'
      byRoom.set(key, [...(byRoom.get(key) ?? []), m])
    } else if (w.kind === 'remote') remote.push(m)
    else away.push(m)
  }
  const inOffice = [...byRoom.values()].reduce((s, l) => s + l.length, 0)
  const rooms = [...map.rooms.filter(r => r.kind === 'sala'), { id: '_fora', name: 'Fora das salas', x: 0, z: 0, w: map.width, d: map.depth }]
  const totalSeats = seatsOf(map).length
  // departamentos com salas no mapa, com o rectângulo que abrange todas as salas deles
  const depts = org.departments.flatMap(dept => {
    const own = map.rooms.filter(r => r.kind === 'sala' && r.departmentId === dept.id)
    if (!own.length) return []
    const x = Math.min(...own.map(r => r.x))
    const z = Math.min(...own.map(r => r.z))
    const box = { x, z, w: Math.max(...own.map(r => r.x + r.w)) - x, d: Math.max(...own.map(r => r.z + r.d)) - z }
    return [{ dept, box }]
  })

  const roomFocus = (r: { x: number; z: number; w: number; d: number }) => ({ x: r.x + r.w / 2, z: r.z + r.d / 2, zoom: Math.max(8, Math.max(r.w, r.d) * 1.3) })
  const locate = (m: Member) => {
    const w = whereIs(m, map, now)
    if (w.kind === 'seat') setFocus({ x: w.at.seat.x, z: w.at.seat.z, zoom: 6 })
    if (w.kind === 'meeting') setFocus(roomFocus(w.room))
  }

  const Person = ({ m }: { m: Member }) => {
    const w = whereIs(m, map, now)
    // em reunião online: fica no seu lugar, mas diz que está numa reunião
    const online = m.meeting && m.meeting.mode === 'online' && now < m.meeting.until
    return (
      <li>
        <button onClick={() => locate(m)} disabled={w.kind !== 'seat' && w.kind !== 'meeting'} className="flex w-full items-center gap-2.5 rounded-xl px-1.5 py-1.5 text-left enabled:hover:bg-snow enabled:cursor-pointer">
          <Avatar name={m.name} picture={m.picture} size={32} presence={m.presence} />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-bold text-ink">{m.id === org.me.id ? `${m.name} (eu)` : m.name}</span>
            <span className="block truncate text-xs font-semibold text-muted">
              {w.kind === 'meeting'
                ? 'Em reunião (presencial)'
                : w.kind === 'seat'
                  ? `${w.at.seat.label} · ${online ? 'Em reunião (online)' : PRESENCE_CONFIG[m.presence].label}`
                  : online ? 'Em reunião (online)' : m.jobTitle || PRESENCE_CONFIG[m.presence].label}
            </span>
          </span>
        </button>
      </li>
    )
  }

  return (
    <div className="px-4 pb-6 pt-5 lg:px-0 lg:pt-6">
      <header className="mb-4 flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-black text-ink">Mapa do escritório</h1>
          <p className="text-sm font-bold text-muted">{inOffice} no escritório · {remote.length} remoto · {totalSeats - taken.size} cadeira{totalSeats - taken.size === 1 ? '' : 's'} livre{totalSeats - taken.size === 1 ? '' : 's'}</p>
        </div>
        {org.isCompany ? (
          <button onClick={() => setEditing(true)} className="btn btn-primary shrink-0"><PencilSimpleIcon size={18} /> Editar mapa</button>
        ) : (
          <div className="w-full sm:w-72"><SeatButton /></div>
        )}
      </header>

      {depts.length > 0 && (
        <div className="no-scrollbar -mx-4 mb-3 flex gap-2 overflow-x-auto px-4 lg:mx-0 lg:px-0" aria-label="Aproximar de um departamento">
          {depts.map(({ dept, box }) => (
            <button
              key={dept.id}
              onClick={() => setFocus({ x: box.x + box.w / 2, z: box.z + box.d / 2, zoom: Math.max(8, Math.max(box.w, box.d) * 1.3) })}
              className="chip"
              title={`Aproximar de ${dept.name}`}
            >
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: dept.color }} /> {dept.name}
            </button>
          ))}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
        <OfficeScene map={map} taken={taken} meId={org.me.id} focus={focus ?? startFocus} busyRooms={busyRooms} className="h-[60dvh] min-h-[380px] lg:h-[calc(100dvh-170px)]" />

        <aside className="space-y-3 lg:max-h-[calc(100dvh-170px)] lg:overflow-y-auto">
          <div className="relative">
            <MagnifyingGlassIcon size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input className="input py-2.5 pl-10" placeholder="Procurar pessoa" value={query} onChange={e => setQuery(e.target.value)} />
          </div>
          {!q && (
            <TodayMeetings
              bookings={bookings}
              now={now}
              roomName={id => map.rooms.find(r => r.id === id)?.name ?? 'Sala'}
              onRoom={id => { const r = map.rooms.find(x => x.id === id); if (r) setFocus(roomFocus(r)) }}
            />
          )}
          {rooms.map(r => {
            const list = (byRoom.get(r.id) ?? []).filter(match)
            const seats = r.id === '_fora' ? 0 : seatsOf(map).filter(s => s.x >= r.x && s.x <= r.x + r.w && s.z >= r.z && s.z <= r.z + r.d).length
            if (!list.length && (q || r.id === '_fora')) return null
            return (
              <section key={r.id} className="card p-3">
                <button
                  onClick={() => r.id !== '_fora' && setFocus({ x: r.x + r.w / 2, z: r.z + r.d / 2, zoom: Math.max(8, Math.max(r.w, r.d) * 1.3) })}
                  className="mb-1 flex w-full items-center gap-2 px-1 text-left cursor-pointer"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-black text-ink">{r.name}</span>
                    {'departmentId' in r && org.deptById(r.departmentId) && (
                      <span className="block truncate text-xs font-bold text-muted">{org.deptById(r.departmentId)!.name}</span>
                    )}
                  </span>
                  <span className="text-xs font-bold text-muted">{(byRoom.get(r.id) ?? []).length}{seats ? `/${seats}` : ''}</span>
                </button>
                <ul>{list.map(m => <Person key={m.id} m={m} />)}</ul>
                {!list.length && <p className="px-1 text-sm font-semibold text-muted">Ninguém agora</p>}
              </section>
            )
          })}
          {[{ id: 'remote', title: 'Remoto', icon: HouseLineIcon, list: remote }, { id: 'away', title: 'Offline ou sem lugar', icon: MoonIcon, list: away }].map(g => {
            const list = g.list.filter(match)
            if (!list.length && q) return null
            return (
              <section key={g.id} className="card p-3">
                <h2 className="mb-1 flex items-center gap-2 px-1 font-black text-ink"><g.icon size={16} className="text-muted" /> {g.title} <span className="text-xs font-bold text-muted">{g.list.length}</span></h2>
                <ul className="max-h-64 overflow-y-auto">{list.map(m => <Person key={m.id} m={m} />)}</ul>
                {!list.length && <p className="px-1 text-sm font-semibold text-muted">Ninguém</p>}
              </section>
            )
          })}
        </aside>
      </div>
    </div>
  )
}

/**
 * As reuniões de hoje nas salas do mapa, para toda a empresa: a sala, o horário e se já está a
 * decorrer. O título só aparece a quem participa (os outros veem "Reunião").
 */
function TodayMeetings({ bookings, now, roomName, onRoom }: {
  bookings: RoomBooking[]
  now: number
  roomName: (id: string) => string
  onRoom: (id: string) => void
}) {
  const today = new Date(now)
  today.setHours(0, 0, 0, 0)
  const end = today.getTime() + 24 * 3600 * 1000
  const list = bookings.filter(b => b.end > now && b.start < end)
  return (
    <section className="card p-3">
      <h2 className="mb-1 flex items-center gap-2 px-1 font-black text-ink">
        <CalendarBlankIcon size={16} className="text-muted" /> Reuniões de hoje <span className="text-xs font-bold text-muted">{list.length}</span>
      </h2>
      {list.length === 0 ? (
        <p className="px-1 text-sm font-semibold text-muted">Nenhuma sala reservada para o resto do dia.</p>
      ) : (
        <ul className="space-y-1">
          {list.map(b => {
            const live = b.start <= now
            return (
              <li key={b.id}>
                <button onClick={() => onRoom(b.roomId)} className="flex w-full items-center gap-2.5 rounded-xl px-1.5 py-1.5 text-left hover:bg-snow cursor-pointer">
                  <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${live ? 'bg-brand animate-pulse' : 'bg-line'}`} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-bold text-ink">{roomName(b.roomId)}</span>
                    <span className="block truncate text-xs font-semibold text-muted">
                      {hhmm(b.start)}–{hhmm(b.end)} · {b.mine && b.title ? b.title : 'Reunião'}
                      {live && b.present > 0 ? ` · ${b.present} na sala` : ''}
                    </span>
                  </span>
                  {live && <span className="shrink-0 rounded-md bg-brand-light px-1.5 py-0.5 text-[11px] font-extrabold text-brand-dark">A decorrer</span>}
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
