'use client'

import { useState } from 'react'
import { BellIcon, CalendarCheckIcon, CheckIcon, DoorOpenIcon, LinkIcon, MapPinIcon, PencilSimpleIcon, TrashIcon, UsersThreeIcon, XIcon } from '@phosphor-icons/react'
import { useApp } from '../../context/AppContext'
import { useOrg } from '../../context/OrgContext'
import { errorText } from '../../lib/api'
import { deleteEvent, eventsBase, hhmm, isLink, respondEvent } from '../../lib/calendar'
import { EVENT_KINDS, type CalendarEvent, type EventResponse } from '../../types'
import Avatar from '../ui/Avatar'

export const KIND_ICON = { reuniao: UsersThreeIcon, compromisso: CalendarCheckIcon, lembrete: BellIcon }

export default function EventCard({ event: e, now, onEdit, compact = false }: { event: CalendarEvent; now: number; onEdit?: (e: CalendarEvent) => void; compact?: boolean }) {
  const org = useOrg()
  const { showToast } = useApp()
  const [busy, setBusy] = useState(false)
  // a resposta a ser enviada (para o spinner aparecer só no botão carregado)
  const [answering, setAnswering] = useState<EventResponse | null>(null)
  const base = eventsBase(org?.base)
  const cfg = EVENT_KINDS[e.kind]
  const Icon = KIND_ICON[e.kind]
  const mine = !org || e.createdBy === org.me.id
  const canEdit = mine || !!org?.isAdmin
  const invited = !!org && e.attendeeIds.includes(org.me.id)
  const myResponse = invited ? e.responses?.[org!.me.id] : undefined
  const creator = org?.memberById(e.createdBy)
  const live = now >= e.start && now < e.end
  const past = now >= e.end
  const room = e.roomId ? org?.org.office?.rooms.find(r => r.id === e.roomId) : undefined
  const present = Object.values(e.attendance ?? {}).filter(a => a === 'presencial').length
  const myMode = org ? e.attendance?.[org.me.id] : undefined

  const act = async (fn: () => Promise<unknown>, ok?: string) => {
    setBusy(true)
    try {
      await fn()
      if (ok) showToast(ok, 'success')
    } catch (err) {
      showToast(errorText(err, 'Não foi possível actualizar o evento. Tenta outra vez.'), 'danger')
    }
    setBusy(false)
  }
  const respond = async (r: EventResponse) => {
    setAnswering(r)
    await act(() => respondEvent(base, e.id, r), r === 'sim' ? 'Presença confirmada' : 'Convite recusado')
    setAnswering(null)
  }

  return (
    <article className={`card overflow-hidden border-l-4 p-3 ${past ? 'opacity-60' : ''}`} style={{ borderLeftColor: cfg.color }}>
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl" style={{ background: cfg.light, color: cfg.color }}>
          <Icon size={20} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-x-2 text-xs font-extrabold" style={{ color: cfg.color }}>
            {hhmm(e.start)} – {hhmm(e.end)} · {cfg.label}
            {live && <span className="rounded-md bg-danger px-1.5 text-white">A decorrer</span>}
          </p>
          <h3 className="truncate font-black text-ink">{e.title}</h3>
          {room && (
            <p className="mt-0.5 flex items-center gap-1 truncate text-sm font-semibold text-muted">
              <DoorOpenIcon size={14} className="shrink-0" /> <span className="truncate">{room.name}</span>
              {live && present > 0 && <span className="shrink-0 text-xs font-bold text-brand-dark">· {present} na sala</span>}
            </p>
          )}
          {live && myMode && (
            <p className="mt-0.5 text-xs font-bold text-brand-dark">
              Participas {myMode === 'presencial' ? 'presencialmente' : myMode === 'online' ? 'online' : '— disseste que não vais'}
            </p>
          )}
          {e.location && (
            <p className="mt-0.5 flex items-center gap-1 truncate text-sm font-semibold text-muted">
              {isLink(e.location) ? (
                <a href={e.location.trim()} target="_blank" rel="noopener" className="flex min-w-0 items-center gap-1 text-accent hover:underline">
                  <LinkIcon size={14} className="shrink-0" /> <span className="truncate">Entrar na chamada</span>
                </a>
              ) : (
                <><MapPinIcon size={14} className="shrink-0" /> <span className="truncate">{e.location}</span></>
              )}
            </p>
          )}
          {!compact && e.description && <p className="mt-1 whitespace-pre-wrap text-sm font-semibold text-body">{e.description}</p>}
          {org && (e.attendeeIds.length > 0 || !mine) && (
            <div className="mt-2 flex flex-wrap items-center gap-1">
              {[e.createdBy, ...e.attendeeIds].slice(0, compact ? 6 : 30).map(id => {
                const m = org.memberById(id)
                const r = id === e.createdBy ? 'sim' : e.responses?.[id]
                return (
                  <span key={id} className="relative" title={`${m?.name ?? 'Removido'}${id === e.createdBy ? ' (agendou)' : r === 'sim' ? ' · vai' : r === 'nao' ? ' · não vai' : ' · sem resposta'}`}>
                    <Avatar name={m?.name ?? '?'} picture={m?.picture} size={24} />
                    {r && (
                      <span className={`absolute -bottom-0.5 -right-0.5 flex h-3 w-3 items-center justify-center rounded-full ring-2 ring-white ${r === 'sim' ? 'bg-accent' : 'bg-danger'}`}>
                        {r === 'sim' ? <CheckIcon size={8} weight="bold" color="#fff" /> : <XIcon size={8} weight="bold" color="#fff" />}
                      </span>
                    )}
                  </span>
                )
              })}
              {!mine && creator && <span className="ml-1 text-xs font-bold text-muted">por {creator.name}</span>}
            </div>
          )}
        </div>
        {canEdit && !compact && (
          <div className="flex shrink-0 gap-0.5">
            {onEdit && !past && (
              <button onClick={() => onEdit(e)} className="rounded-lg p-1.5 text-muted hover:bg-snow cursor-pointer" aria-label="Editar">
                <PencilSimpleIcon size={18} />
              </button>
            )}
            <button
              onClick={() => confirm(e.attendeeIds.length && !past ? 'Cancelar este evento? Os convidados são avisados.' : 'Apagar este evento?') && act(() => deleteEvent(base, e.id), 'Evento removido')}
              disabled={busy}
              className="rounded-lg p-1.5 text-muted hover:bg-danger-light hover:text-danger cursor-pointer"
              aria-label="Apagar"
            >
              <TrashIcon size={18} />
            </button>
          </div>
        )}
      </div>
      {invited && !past && !compact && (
        <div className="mt-3 flex items-center gap-2 border-t-2 border-line pt-2.5">
          <span className="flex-1 text-xs font-bold text-muted">{myResponse === 'sim' ? 'Vais participar' : myResponse === 'nao' ? 'Recusaste' : 'Vais participar?'}</span>
          <button onClick={() => respond('nao')} disabled={busy} aria-busy={answering === 'nao'} className={`chip text-xs ${myResponse === 'nao' ? 'border-danger! bg-danger-light! text-danger!' : ''}`}>
            <XIcon size={14} /> Não
          </button>
          <button onClick={() => respond('sim')} disabled={busy} aria-busy={answering === 'sim'} className={`chip text-xs ${myResponse === 'sim' ? 'border-accent! bg-accent-light! text-accent-dark!' : ''}`}>
            <CheckIcon size={14} /> Sim
          </button>
        </div>
      )}
    </article>
  )
}
