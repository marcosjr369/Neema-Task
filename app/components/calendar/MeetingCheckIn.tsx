'use client'

import dynamic from 'next/dynamic'
import { useEffect, useRef, useState } from 'react'
import { ArmchairIcon, DesktopIcon, HouseLineIcon, UsersThreeIcon, XCircleIcon, type Icon } from '@phosphor-icons/react'
import { useApp } from '../../context/AppContext'
import { useOrg } from '../../context/OrgContext'
import { ApiError, errorText } from '../../lib/api'
import { attendEvent, hhmm, involves } from '../../lib/calendar'
import { findSeat } from '../../lib/office'
import type { AttendanceMode, CalendarEvent } from '../../types'
import { Busy } from '../ui/Spinner'

// a escolha de outro lugar tem o mapa em 3D: só é descarregada se for precisa
const SeatChooser = dynamic(() => import('../office/SeatChooser'), { ssr: false })

/** pode dizer como participa um minuto antes da hora (o servidor aceita até 10) */
const EARLY = 60 * 1000

/** A reunião que começou agora e em que ainda não disse como participa */
export function pendingCheckIn(events: CalendarEvent[], meId: string | undefined, now: number) {
  if (!meId) return undefined
  return events.find(e =>
    e.kind === 'reuniao' && involves(e, meId) && e.responses?.[meId] !== 'nao' &&
    now >= e.start - EARLY && now < e.end && !e.attendance?.[meId])
}

/**
 * Quando uma reunião começa, cada participante diz como participa: presencial na sala (o mapa
 * mostra-o lá), online do seu lugar, online noutro lugar (escolhe onde) ou que não vai.
 * Quem participa fica "Em reunião"; quando a reunião acaba, volta a "A trabalhar".
 */
export default function MeetingCheckIn({ events, now }: { events: CalendarEvent[]; now: number }) {
  const org = useOrg()
  const { showToast } = useApp()
  const [busy, setBusy] = useState<AttendanceMode | 'elsewhere' | null>(null)
  const [choosing, setChoosing] = useState(false)
  const [skipped, setSkipped] = useState<string | null>(null)
  const meId = org?.me.id
  const event = org && !org.isCompany && org.me.consentAt ? pendingCheckIn(events, meId, now) : undefined

  // a reunião acabou: quem estava "Em reunião" volta a "A trabalhar" (uma vez por reunião)
  const ended = useRef<string | null>(null)
  const meeting = org?.me.meeting
  useEffect(() => {
    if (!org || !meeting || now < meeting.until || ended.current === meeting.eventId) return
    ended.current = meeting.eventId
    if (org.presence === 'reuniao') org.setPresence('trabalho')
    org.refresh()
  }, [org, meeting, now])

  if (choosing) return <SeatChooser onClose={() => setChoosing(false)} />
  if (!org || !event || skipped === `${event.id}:${event.start}`) return null

  const room = event.roomId ? org.org.office?.rooms.find(r => r.id === event.roomId) : undefined
  const mySeat = findSeat(org.org.office, org.me.seatId)
  const canBeThere = !!room || !!event.location

  const choose = async (mode: AttendanceMode, elsewhere = false) => {
    setBusy(elsewhere ? 'elsewhere' : mode)
    try {
      await attendEvent(org.base, event.id, mode)
      if (mode !== 'ausente') org.setPresence('reuniao')
      await org.refresh()
      showToast(mode === 'presencial' ? `Estás na reunião${room ? ` · ${room.name}` : ''}` : mode === 'online' ? 'Estás na reunião, online' : 'Não vais participar', 'success')
      if (elsewhere) setChoosing(true)
    } catch (err) {
      // a reunião foi cancelada ou mudou de hora entretanto: deixa de perguntar
      if (err instanceof ApiError && (err.status === 404 || err.status === 400)) setSkipped(`${event.id}:${event.start}`)
      showToast(errorText(err, 'Não foi possível guardar a tua resposta. Tenta outra vez.'), 'danger')
    }
    setBusy(null)
  }

  const options: { key: AttendanceMode | 'elsewhere'; icon: Icon; title: string; text: string; run: () => void; hidden?: boolean }[] = [
    {
      key: 'presencial',
      icon: UsersThreeIcon,
      title: room ? `Presencial · ${room.name}` : 'Presencial',
      text: room ? 'O mapa mostra-te na sala da reunião; o teu lugar fica guardado.' : event.location ?? '',
      run: () => choose('presencial'),
      hidden: !canBeThere,
    },
    {
      key: 'online',
      icon: DesktopIcon,
      title: 'Online, do meu lugar',
      text: mySeat ? `Ficas em ${mySeat.room?.name ?? 'Escritório'} · ${mySeat.seat.label}.` : org.me.remote ? 'Ficas em trabalho remoto.' : 'Ficas onde estás.',
      run: () => choose('online'),
    },
    {
      key: 'elsewhere',
      icon: ArmchairIcon,
      title: 'Online, noutro lugar',
      text: 'Escolhes no mapa a sala e a cadeira de onde participas.',
      run: () => choose('online', true),
      hidden: !org.org.office?.items.some(i => i.type === 'cadeira'),
    },
    { key: 'ausente', icon: XCircleIcon, title: 'Não vou participar', text: 'Continuas no teu trabalho.', run: () => choose('ausente') },
  ]

  return (
    <div className="fixed inset-0 z-[65] flex items-end justify-center bg-black/45 sm:items-center sm:p-4 animate-fade-in" role="dialog" aria-modal aria-label="Como vais participar na reunião?">
      <div className="w-full max-w-md rounded-t-3xl bg-white p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-2xl sm:rounded-3xl animate-slide-up">
        <p className="text-xs font-extrabold uppercase tracking-wide text-brand">{now < event.start ? 'A reunião vai começar' : 'A reunião começou'}</p>
        <h2 className="mt-0.5 text-xl font-black text-ink">{event.title}</h2>
        <p className="text-sm font-bold text-muted">{hhmm(event.start)} – {hhmm(event.end)}{room ? ` · ${room.name}` : ''}</p>
        <p className="mt-3 font-bold text-body">Como vais participar?</p>
        <ul className="mt-2 space-y-2">
          {options.filter(o => !o.hidden).map(o => (
            <li key={o.key}>
              <button
                onClick={o.run}
                disabled={!!busy}
                aria-busy={busy === o.key}
                className={`flex w-full items-center gap-3 rounded-2xl border-2 px-3 py-2.5 text-left hover:bg-snow cursor-pointer ${o.key === 'ausente' ? 'border-line' : 'border-brand/30'}`}
              >
                <o.icon size={24} className={`shrink-0 ${o.key === 'ausente' ? 'text-muted' : 'text-brand'}`} />
                <span className="min-w-0 flex-1">
                  <span className="block font-extrabold text-ink"><Busy busy={busy === o.key} text="A guardar…">{o.title}</Busy></span>
                  {o.text && <span className="block text-xs font-semibold text-muted">{o.text}</span>}
                </span>
              </button>
            </li>
          ))}
        </ul>
        {org.me.remote && !room && <p className="mt-3 flex items-center gap-1.5 text-xs font-semibold text-muted"><HouseLineIcon size={14} /> Estás em trabalho remoto hoje.</p>}
      </div>
    </div>
  )
}
