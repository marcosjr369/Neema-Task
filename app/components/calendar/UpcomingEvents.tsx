'use client'

import Link from 'next/link'
import { useState } from 'react'
import { CalendarBlankIcon } from '@phosphor-icons/react'
import { useApp } from '../../context/AppContext'
import { useOrg } from '../../context/OrgContext'
import { DAY_MS, eventsBase, hhmm, useEvents } from '../../lib/calendar'
import { startOfDay } from '../../lib/stats'
import { EVENT_KINDS } from '../../types'

export default function UpcomingEvents() {
  const { now } = useApp()
  const org = useOrg()
  const [day] = useState(() => startOfDay(Date.now()))
  const { events } = useEvents(eventsBase(org?.base), day, day + DAY_MS)
  const left = events.filter(e => e.end > now && (!org || e.responses?.[org.me.id] !== 'nao'))

  return (
    <Link href="/calendario" className="card block border-b-4 p-3 hover:bg-snow">
      <span className="flex items-center gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#E0F6FD] text-[#22A6CF]">
          <CalendarBlankIcon size={22} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-extrabold text-ink">Agenda de hoje</span>
          <span className="block text-xs font-semibold text-muted">
            {left.length ? `${left.length} evento${left.length === 1 ? '' : 's'} por acontecer` : 'Nada agendado · toca para agendar'}
          </span>
        </span>
      </span>
      {left.length > 0 && (
        <ul className="mt-2 space-y-1">
          {left.slice(0, 3).map(e => (
            <li key={e.id} className="flex items-center gap-2 text-sm">
              <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: EVENT_KINDS[e.kind].color }} />
              <span className="w-12 shrink-0 font-black tabular-nums text-ink">{hhmm(e.start)}</span>
              <span className="truncate font-bold text-body">{e.title}</span>
              {now >= e.start && <span className="ml-auto shrink-0 rounded-md bg-danger px-1.5 text-[11px] font-extrabold text-white">agora</span>}
            </li>
          ))}
        </ul>
      )}
    </Link>
  )
}
