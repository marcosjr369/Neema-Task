'use client'

import { useState } from 'react'
import { BellIcon, MapPinIcon } from '@phosphor-icons/react'
import { useApp } from '../../context/AppContext'
import { useOrg } from '../../context/OrgContext'
import { errorText } from '../../lib/api'
import { dateInput, eventsBase, fromInputs, saveEvent, timeInput } from '../../lib/calendar'
import { EVENT_KINDS, EVENT_LEAD_MINUTES, type CalendarEvent, type EventKind } from '../../types'
import Modal from '../ui/Modal'
import MemberPicker from '../ui/MemberPicker'
import { KIND_ICON } from './EventCard'
import { Busy } from '../ui/Spinner'

const DURATIONS = [15, 30, 45, 60, 90, 120]

function defaultStart(day: number) {
  const now = Date.now()
  const d = new Date(day)
  if (dateInput(day) === dateInput(now)) {
    const n = new Date(now)
    n.setMinutes(n.getMinutes() < 30 ? 30 : 60, 0, 0)
    return n.getTime()
  }
  d.setHours(9, 0, 0, 0)
  return d.getTime()
}

export default function EventForm({ event, day, onClose }: { event: CalendarEvent | null; day: number; onClose: () => void }) {
  const org = useOrg()
  const { showToast } = useApp()
  const start0 = event?.start ?? defaultStart(day)
  const [title, setTitle] = useState(event?.title ?? '')
  const [kind, setKind] = useState<EventKind>(event?.kind ?? (org?.isManager ? 'reuniao' : 'compromisso'))
  const [date, setDate] = useState(dateInput(start0))
  const [start, setStart] = useState(timeInput(start0))
  const [end, setEnd] = useState(timeInput(event?.end ?? start0 + 30 * 60 * 1000))
  const [location, setLocation] = useState(event?.location ?? '')
  const [description, setDescription] = useState(event?.description ?? '')
  const [attendees, setAttendees] = useState<string[]>(event?.attendeeIds ?? [])
  const [busy, setBusy] = useState(false)
  const canInvite = !!org
  const people = org ? org.members.filter(m => m.status === 'activo' && m.id !== org.me.id) : []

  const startMs = fromInputs(date, start)
  const endMs = fromInputs(date, end)
  const duration = Math.round((endMs - startMs) / 60000)
  const setDuration = (min: number) => setEnd(timeInput(startMs + min * 60000))

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) return
    if (endMs <= startMs) {
      showToast('O fim tem de ser depois do início (no mesmo dia)', 'danger')
      return
    }
    setBusy(true)
    try {
      await saveEvent(eventsBase(org?.base), event?.id ?? null, {
        title: title.trim(),
        kind,
        start: startMs,
        end: endMs,
        location: location.trim(),
        description: description.trim(),
        ...(org && canInvite ? { attendeeIds: attendees } : {}),
      })
      showToast(event ? 'Evento actualizado' : attendees.length ? `Agendado e enviado a ${attendees.length} pessoa${attendees.length === 1 ? '' : 's'}` : 'Agendado', 'success')
      onClose()
    } catch (err) {
      showToast(errorText(err), 'danger')
    }
    setBusy(false)
  }

  return (
    <Modal
      title={event ? 'Editar evento' : 'Agendar'}
      onClose={onClose}
      footer={
        <button type="submit" form="event-form" disabled={busy || !title.trim()} className={`btn w-full ${title.trim() ? 'btn-primary' : 'btn-disabled'}`}>
          <Busy busy={busy} text="A guardar…">{event ? 'Guardar alterações' : attendees.length ? `Agendar com ${attendees.length} pessoa${attendees.length === 1 ? '' : 's'}` : 'Agendar'}</Busy>
        </button>
      }
    >
      <form id="event-form" onSubmit={submit} className="space-y-5">
        <div>
          <label className="label" htmlFor="ev-title">O quê?</label>
          <input id="ev-title" autoFocus={!event} className="input text-lg" placeholder="Ex: Reunião de equipa" value={title} onChange={e => setTitle(e.target.value)} maxLength={120} required />
        </div>

        <div>
          <span className="label">Tipo</span>
          <div className="grid grid-cols-3 gap-2">
            {(Object.keys(EVENT_KINDS) as EventKind[]).map(k => {
              const Icon = KIND_ICON[k]
              const sel = kind === k
              return (
                <button
                  type="button"
                  key={k}
                  onClick={() => setKind(k)}
                  className="flex flex-col items-center gap-1 rounded-2xl border-2 border-b-4 py-2 text-xs font-bold cursor-pointer"
                  style={{ borderColor: sel ? EVENT_KINDS[k].color : '#E9E7F2', background: sel ? EVENT_KINDS[k].light : '#fff', color: sel ? EVENT_KINDS[k].color : '#6E6A85' }}
                >
                  <Icon size={24} />
                  {EVENT_KINDS[k].label}
                </button>
              )
            })}
          </div>
        </div>

        <div className="grid grid-cols-[1fr_auto_auto] gap-2">
          <div>
            <label className="label" htmlFor="ev-date">Dia</label>
            <input id="ev-date" type="date" className="input" value={date} onChange={e => setDate(e.target.value)} required />
          </div>
          <div>
            <label className="label" htmlFor="ev-start">Início</label>
            <input
              id="ev-start"
              type="time"
              className="input"
              value={start}
              onChange={e => {
                const keep = duration > 0 ? duration : 30
                setStart(e.target.value)
                setEnd(timeInput(fromInputs(date, e.target.value) + keep * 60000))
              }}
              required
            />
          </div>
          <div>
            <label className="label" htmlFor="ev-end">Fim</label>
            <input id="ev-end" type="time" className="input" value={end} onChange={e => setEnd(e.target.value)} required />
          </div>
        </div>
        <div className="-mt-2 flex flex-wrap gap-2">
          {DURATIONS.map(d => (
            <button type="button" key={d} onClick={() => setDuration(d)} className={`chip text-xs ${duration === d ? 'border-accent! bg-accent-light! text-accent-dark!' : ''}`}>
              {d < 60 ? `${d} min` : d % 60 ? `${Math.floor(d / 60)}h${d % 60}` : `${d / 60}h`}
            </button>
          ))}
        </div>

        <div>
          <label className="label" htmlFor="ev-loc">Local ou link</label>
          <div className="relative">
            <MapPinIcon size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input id="ev-loc" className="input pl-10" placeholder="Sala, endereço ou link da chamada" value={location} onChange={e => setLocation(e.target.value)} maxLength={300} />
          </div>
        </div>

        <div>
          <label className="label" htmlFor="ev-desc">Notas</label>
          <textarea id="ev-desc" className="input min-h-20 resize-none" placeholder="Agenda, documentos, o que preparar…" value={description} onChange={e => setDescription(e.target.value)} />
        </div>

        {org && canInvite && (
          <MemberPicker
            people={people}
            value={attendees}
            onChange={setAttendees}
            label="Participantes"
            summary={n => (n === 0 ? 'Só tu' : `${n} convidado${n === 1 ? '' : 's'}`)}
          />
        )}

        <p className="flex items-center gap-2 rounded-xl bg-snow px-3 py-2 text-xs font-bold text-muted">
          <BellIcon size={16} className="shrink-0" />
          Avisamos {attendees.length ? 'todos ' : ''}{EVENT_LEAD_MINUTES} minutos antes e outra vez à hora marcada.
        </p>
      </form>
    </Modal>
  )
}
