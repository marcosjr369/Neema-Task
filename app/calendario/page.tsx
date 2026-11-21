'use client'

import { Suspense, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { CaretLeftIcon, CaretRightIcon, PlusIcon } from '@phosphor-icons/react'
import { useMinute } from '../context/AppContext'
import { useOrg } from '../context/OrgContext'
import { CreateLocked, useCan } from '../components/layout/useCan'
import { dayTitle, DAY_MS, eventsBase, eventsOn, hhmm, monthGrid, useEvents } from '../lib/calendar'
import { startOfDay } from '../lib/stats'
import { EVENT_KINDS, type CalendarEvent } from '../types'
import EventCard from '../components/calendar/EventCard'
import EventForm from '../components/calendar/EventForm'
import Mascot from '../components/ui/Mascot'
import { ListSkeleton } from '../components/ui/Skeleton'

const WEEKDAYS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom']

function Calendar() {
  const now = useMinute()
  const org = useOrg()
  // marcar reuniões na empresa pode estar reservado (Definições → Permissões)
  const canCreate = useCan('reunioes')
  const params = useSearchParams()
  const initial = startOfDay(Number(params.get('dia')) || now)
  const [day, setDay] = useState(initial)
  const [month, setMonth] = useState(initial)
  const [form, setForm] = useState<{ event: CalendarEvent | null } | null>(null)

  const grid = monthGrid(month)
  const { events, loaded } = useEvents(eventsBase(org?.base), grid[0], grid[41] + DAY_MS)
  const today = startOfDay(now)
  const curMonth = new Date(month).getMonth()
  const dayEvents = eventsOn(events, day)
  const upcoming = events.filter(e => e.end > now && startOfDay(e.start) !== day).slice(0, 5)

  const shiftMonth = (n: number) => {
    const d = new Date(month)
    d.setDate(1)
    d.setMonth(d.getMonth() + n)
    setMonth(d.getTime())
  }
  const goToday = () => {
    setDay(today)
    setMonth(today)
  }

  return (
    <div className="px-4 pb-6 pt-5 lg:px-0 lg:pt-6">
      <header className="mb-4 flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-black text-ink">Calendário</h1>
          <p className="text-sm font-bold text-muted">
            {org?.isManager ? 'As tuas reuniões e as da tua equipa' : org ? 'Agenda reuniões com colegas ou compromissos teus' : 'Reuniões e compromissos, com aviso 5 minutos antes'}
          </p>
        </div>
        {canCreate && (
          <button onClick={() => setForm({ event: null })} className="btn btn-primary shrink-0">
            <PlusIcon size={18} /> <span className="hidden sm:inline">Agendar</span>
          </button>
        )}
      </header>
      <CreateLocked feature="reunioes" />

      <div className="space-y-5 lg:grid lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start lg:gap-6 lg:space-y-0">
        <section className="card p-3 sm:p-4">
          <div className="mb-3 flex items-center gap-1">
            <h2 className="flex-1 text-lg font-black capitalize text-ink">
              {new Date(month).toLocaleDateString('pt-PT', { month: 'long', year: 'numeric' })}
            </h2>
            <button onClick={goToday} className="chip text-xs">Hoje</button>
            <button onClick={() => shiftMonth(-1)} className="rounded-lg p-1.5 text-muted hover:bg-snow cursor-pointer" aria-label="Mês anterior">
              <CaretLeftIcon size={20} weight="bold" />
            </button>
            <button onClick={() => shiftMonth(1)} className="rounded-lg p-1.5 text-muted hover:bg-snow cursor-pointer" aria-label="Mês seguinte">
              <CaretRightIcon size={20} weight="bold" />
            </button>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-extrabold uppercase tracking-wide text-muted">
            {WEEKDAYS.map(w => <span key={w} className="py-1">{w}</span>)}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {grid.map(d => {
              const list = eventsOn(events, d)
              const inMonth = new Date(d).getMonth() === curMonth
              const selected = d === day
              const isToday = d === today
              return (
                <button
                  key={d}
                  onClick={() => setDay(d)}
                  onDoubleClick={() => { setDay(d); if (canCreate) setForm({ event: null }) }}
                  aria-label={`${dayTitle(d)}${list.length ? `, ${list.length} evento${list.length === 1 ? '' : 's'}` : ''}`}
                  aria-pressed={selected}
                  className={`flex min-h-14 flex-col items-stretch rounded-xl border-2 p-1 text-left transition-colors cursor-pointer lg:min-h-24 ${
                    selected ? 'border-brand bg-brand-light/40' : 'border-transparent hover:bg-snow'
                  } ${inMonth ? '' : 'opacity-40'}`}
                >
                  <span
                    className={`mx-auto flex h-7 w-7 items-center justify-center rounded-full text-sm font-black lg:mx-0 ${
                      isToday ? 'bg-brand text-white' : 'text-ink'
                    }`}
                  >
                    {new Date(d).getDate()}
                  </span>
                  <span className="mt-1 flex justify-center gap-0.5 lg:hidden">
                    {list.slice(0, 3).map(e => <span key={e.id} className="h-1.5 w-1.5 rounded-full" style={{ background: EVENT_KINDS[e.kind].color }} />)}
                  </span>
                  <span className="mt-0.5 hidden space-y-0.5 lg:block">
                    {list.slice(0, 2).map(e => (
                      <span
                        key={e.id}
                        className="block truncate rounded-md px-1 text-[11px] font-bold"
                        style={{ background: EVENT_KINDS[e.kind].light, color: EVENT_KINDS[e.kind].color }}
                      >
                        {hhmm(e.start)} {e.title}
                      </span>
                    ))}
                    {list.length > 2 && <span className="block px-1 text-[11px] font-bold text-muted">+{list.length - 2}</span>}
                  </span>
                </button>
              )
            })}
          </div>
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs font-bold text-muted">
            {Object.values(EVENT_KINDS).map(k => (
              <span key={k.label} className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{ background: k.color }} /> {k.label}</span>
            ))}
          </div>
        </section>

        <div className="space-y-5">
          <section>
            <div className="mb-2 flex items-baseline justify-between">
              <h2 className="text-lg font-black capitalize text-ink">{day === today ? 'Hoje' : dayTitle(day)}</h2>
              {canCreate && <button onClick={() => setForm({ event: null })} className="text-sm font-extrabold uppercase tracking-wide text-accent cursor-pointer">+ Agendar</button>}
            </div>
            {!loaded ? (
              <ListSkeleton rows={3} />
            ) : dayEvents.length === 0 ? (
              <div className="card flex flex-col items-center p-6 text-center">
                <Mascot size={64} mood="sleepy" />
                <p className="mt-2 font-black text-ink">Nada agendado</p>
                <p className="text-sm font-semibold text-muted">Toca em “Agendar” para marcar uma reunião ou um compromisso.</p>
              </div>
            ) : (
              <ul className="space-y-2">
                {dayEvents.map(e => (
                  <li key={e.id}><EventCard event={e} now={now} onEdit={ev => setForm({ event: ev })} /></li>
                ))}
              </ul>
            )}
          </section>

          {upcoming.length > 0 && (
            <section>
              <h2 className="label">Próximos</h2>
              <ul className="space-y-2">
                {upcoming.map(e => (
                  <li key={e.id}>
                    <button onClick={() => { setDay(startOfDay(e.start)); setMonth(e.start) }} className="w-full text-left cursor-pointer">
                      <span className="mb-1 block text-xs font-extrabold capitalize text-muted">{dayTitle(e.start)}</span>
                    </button>
                    <EventCard event={e} now={now} compact />
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </div>

      {form && <EventForm key={form.event?.id ?? `novo-${day}`} event={form.event} day={day} onClose={() => setForm(null)} />}
    </div>
  )
}

export default function CalendarPage() {
  return (
    <Suspense fallback={null}>
      <Calendar />
    </Suspense>
  )
}
