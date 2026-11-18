'use client'

import { useMemo, useState } from 'react'
import { ArmchairIcon, HouseLineIcon, XIcon } from '@phosphor-icons/react'
import { useApp } from '../../context/AppContext'
import { useOrgRequired, type SeatChoice } from '../../context/OrgContext'
import { errorText } from '../../lib/api'
import { findSeat, occupants, reservedSeats, roomAt, seatName, seatsOf } from '../../lib/office'
import type { OfficeItem, OfficeMap } from '../../types'
import Avatar from '../ui/Avatar'
import Mascot from '../ui/Mascot'
import { Busy } from '../ui/Spinner'
import OfficeScene from './OfficeScene'

/** As cadeiras agrupadas por sala (as que estão fora das salas ficam no fim) */
export function seatsByRoom(map: OfficeMap) {
  const groups = new Map<string, { id: string; name: string; seats: OfficeItem[] }>()
  for (const s of seatsOf(map)) {
    const r = roomAt(map, s.x, s.z)
    const key = r?.id ?? '_fora'
    if (!groups.has(key)) groups.set(key, { id: key, name: r?.name ?? 'Fora das salas', seats: [] })
    groups.get(key)!.seats.push(s)
  }
  return [...groups.values()].map(g => ({ ...g, seats: g.seats.sort((a, b) => (a.label ?? '').localeCompare(b.label ?? '', 'pt', { numeric: true })) }))
}

/**
 * "Onde estás sentado?": escolher a sala e a cadeira (ou trabalho remoto). Obrigatório ao entrar
 * na plataforma ("required": não se pode fechar); também abre com o botão Trocar.
 */
export default function SeatChooser({ required = false, onClose }: { required?: boolean; onClose?: () => void }) {
  const org = useOrgRequired()
  const { showToast } = useApp()
  const map = org.org.office!
  const taken = useMemo(() => occupants(org.members, map), [org.members, map])
  // os lugares de quem está numa reunião presencial continuam dessas pessoas
  const reserved = useMemo(() => reservedSeats(org.members, map), [org.members, map])
  const ownerOf = (id: string) => taken.get(id) ?? reserved.get(id)
  const groups = useMemo(() => seatsByRoom(map), [map])
  const mine = findSeat(map, org.me.seatId)
  const [roomId, setRoomId] = useState<string | null>(() => {
    if (mine) return mine.room?.id ?? '_fora'
    const ofDept = map.rooms.find(r => r.departmentId && r.departmentId === org.me.departmentId)
    return ofDept && groups.some(g => g.id === ofDept.id) ? ofDept.id : groups[0]?.id ?? null
  })
  const [seat, setSeat] = useState<OfficeItem | null>(mine?.seat ?? null)
  const [busy, setBusy] = useState<'seat' | 'remote' | null>(null)
  const [error, setError] = useState('')
  const group = groups.find(g => g.id === roomId)
  const room = map.rooms.find(r => r.id === roomId)
  const focus = useMemo(() => {
    if (seat) return { x: seat.x, z: seat.z, zoom: 7 }
    if (room) return { x: room.x + room.w / 2, z: room.z + room.d / 2, zoom: Math.max(8, Math.max(room.w, room.d) * 1.3) }
    return null
  }, [seat, room])

  const pick = (s: OfficeItem) => {
    const who = ownerOf(s.id)
    if (who && who.id !== org.me.id) {
      setError(`${s.label} está ocupada por ${who.name}.`)
      return
    }
    setError('')
    setSeat(s)
    setRoomId(roomAt(map, s.x, s.z)?.id ?? '_fora')
  }

  const choose = async (choice: SeatChoice, key: 'seat' | 'remote') => {
    setBusy(key)
    setError('')
    try {
      await org.setSeat(choice)
      showToast('seatId' in choice ? `Estás em ${seatName(findSeat(map, choice.seatId))}` : 'Estás em trabalho remoto', 'success')
      onClose?.()
    } catch (err) {
      setError(errorText(err, 'Não foi possível guardar o teu lugar. Tenta outra vez.'))
      org.refresh()
    }
    setBusy(null)
  }

  const free = (g: { seats: OfficeItem[] }) => g.seats.filter(s => !ownerOf(s.id) || ownerOf(s.id)!.id === org.me.id).length

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/45 sm:items-center sm:p-4 animate-fade-in" role="dialog" aria-modal aria-label="Onde estás sentado?">
      <div className="flex h-[94dvh] w-full max-w-6xl flex-col overflow-hidden rounded-t-3xl bg-white sm:h-[90dvh] sm:rounded-3xl animate-slide-up">
        <div className="flex items-start gap-3 border-b-2 border-line px-5 py-4">
          <Mascot size={44} />
          <div className="min-w-0 flex-1">
            <h2 className="text-xl font-black text-ink">Onde estás sentado?</h2>
            <p className="text-sm font-semibold text-muted">
              {required ? 'Antes de começar, escolhe a sala e a cadeira onde estás hoje.' : 'Escolhe a sala e a cadeira para onde mudaste.'}
            </p>
          </div>
          {!required && onClose && (
            <button onClick={onClose} className="rounded-xl p-2 text-muted hover:bg-snow cursor-pointer" aria-label="Fechar"><XIcon size={22} /></button>
          )}
        </div>

        <div className="grid min-h-0 flex-1 grid-rows-[auto_minmax(0,1fr)] lg:grid-cols-[280px_minmax(0,1fr)] lg:grid-rows-1">
          {/* salas e cadeiras */}
          <div className="min-h-0 overflow-y-auto border-b-2 border-line p-3 max-lg:max-h-[38dvh] lg:border-b-0 lg:border-r-2">
            <p className="mb-2 px-1 text-xs font-extrabold uppercase tracking-wider text-muted">Salas</p>
            <ul className="space-y-1.5">
              {groups.map(g => {
                const on = g.id === roomId
                const n = free(g)
                return (
                  <li key={g.id}>
                    <button
                      onClick={() => { setRoomId(g.id); setSeat(null); setError('') }}
                      className={`flex w-full items-center gap-2 rounded-xl border-2 px-3 py-2 text-left cursor-pointer ${on ? 'border-brand bg-brand-light' : 'border-line hover:bg-snow'}`}
                    >
                      <span className="min-w-0 flex-1 truncate font-bold text-ink">{g.name}</span>
                      <span className={`text-xs font-extrabold ${n ? 'text-accent-dark' : 'text-muted'}`}>{n} livre{n === 1 ? '' : 's'}</span>
                    </button>
                    {on && (
                      <ul className="mt-1.5 grid grid-cols-2 gap-1.5 pl-1">
                        {g.seats.map(s => {
                          const who = ownerOf(s.id)
                          const other = who && who.id !== org.me.id
                          const sel = seat?.id === s.id
                          return (
                            <li key={s.id}>
                              <button
                                onClick={() => pick(s)}
                                disabled={!!other}
                                className={`flex w-full items-center gap-1.5 rounded-lg border-2 px-2 py-1.5 text-left text-xs font-bold ${
                                  sel ? 'border-brand bg-brand text-white' : other ? 'border-line bg-snow text-muted' : 'border-accent/40 text-ink hover:bg-accent-light cursor-pointer'
                                }`}
                                title={other ? `Ocupada por ${who!.name}` : 'Livre'}
                              >
                                {other ? <Avatar name={who!.name} picture={who!.picture} size={16} /> : <ArmchairIcon size={14} className={sel ? '' : 'text-accent'} />}
                                <span className="min-w-0 truncate">{other ? who!.name.split(' ')[0] : s.label}</span>
                              </button>
                            </li>
                          )
                        })}
                      </ul>
                    )}
                  </li>
                )
              })}
            </ul>
          </div>

          {/* o escritório em 3D */}
          <div className="min-h-0 p-3">
            <OfficeScene map={map} taken={taken} meId={org.me.id} mode="pick" selected={seat?.id} focus={focus} onSeat={pick} className="h-full min-h-[220px]" />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 border-t-2 border-line px-5 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-3">
          <button onClick={() => choose({ remote: true }, 'remote')} disabled={!!busy} aria-busy={busy === 'remote'} className="btn btn-ghost">
            <HouseLineIcon size={18} /> Trabalho remoto
          </button>
          {error && <p className="min-w-0 flex-1 text-sm font-bold text-danger">{error}</p>}
          <span className="flex-1" />
          <button onClick={() => seat && choose({ seatId: seat.id }, 'seat')} disabled={!seat || !!busy} className="btn btn-primary">
            <Busy busy={busy === 'seat'} text="A guardar…">{seat ? `Sentar em ${group?.name ?? ''} · ${seat.label}` : 'Escolhe uma cadeira'}</Busy>
          </button>
        </div>
      </div>
    </div>
  )
}
