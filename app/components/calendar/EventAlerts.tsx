'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { BellRingingIcon, LinkIcon, MapPinIcon, XIcon } from '@phosphor-icons/react'
import { useApp, useClock } from '../../context/AppContext'
import { useOrg } from '../../context/OrgContext'
import { eventsBase, hhmm, involves, isLink, useEvents, whenText } from '../../lib/calendar'
import { pushNotification, sounds } from '../../lib/sounds'
import { EVENT_KINDS, EVENT_LEAD_MINUTES, type CalendarEvent } from '../../types'
import { KIND_ICON } from './EventCard'

type Stage = 'pre' | 'start'
type Alert = { key: string; event: CalendarEvent; stage: Stage }

const FIRED = 'udacha-event-alerts'
const SEEN = 'udacha-event-invites'
const LEAD = EVENT_LEAD_MINUTES * 60 * 1000

const readSet = (k: string) => {
  try {
    const raw = localStorage.getItem(k)
    return raw === null ? null : new Set<string>(JSON.parse(raw))
  } catch {
    return null
  }
}
const writeSet = (k: string, s: Set<string>) => localStorage.setItem(k, JSON.stringify([...s].slice(-300)))

const windowNow = () => {
  const t = Math.floor(Date.now() / (10 * 60 * 1000)) * 10 * 60 * 1000
  return { from: t - 30 * 60 * 1000, to: t + 26 * 3600 * 1000 }
}

export default function EventAlerts() {
  const { showToast } = useApp()
  const { now } = useClock()
  const org = useOrg()
  const router = useRouter()
  const [range, setRange] = useState(windowNow)
  const { events, loaded } = useEvents(eventsBase(org?.base), range.from, range.to)
  const [alerts, setAlerts] = useState<Alert[]>([])
  const fired = useRef<Set<string> | null>(null)
  const meId = org?.me.id

  useEffect(() => {
    const id = setInterval(() => setRange(windowNow()), 60 * 1000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    if (!loaded) return
    fired.current ??= readSet(FIRED) ?? new Set()
    const due: Alert[] = []
    for (const e of events) {
      if (!involves(e, meId) || (meId && e.responses?.[meId] === 'nao')) continue
      const stage: Stage | null = now >= e.start && now < e.start + LEAD ? 'start' : now >= e.start - LEAD && now < e.start ? 'pre' : null
      if (!stage) continue
      const key = `${e.id}:${e.start}:${stage}`
      if (fired.current.has(key)) continue
      fired.current.add(key)
      // à hora: o aviso "5 min antes" do mesmo evento já não interessa
      fired.current.add(`${e.id}:${e.start}:pre`)
      due.push({ key, event: e, stage })
    }
    if (!due.length) return
    writeSet(FIRED, fired.current)
    sounds.warning()
    for (const a of due) {
      const kind = EVENT_KINDS[a.event.kind].label
      pushNotification(
        a.stage === 'pre' ? `${kind} daqui a ${EVENT_LEAD_MINUTES} min` : `Está na hora: ${a.event.title}`,
        a.stage === 'pre' ? `${a.event.title} às ${hhmm(a.event.start)}` : `${kind} das ${hhmm(a.event.start)}`,
        `event-${a.stage}-${a.event.id}`,
        `/calendario?dia=${a.event.start}`,
      )
    }
    setAlerts(list => [...list.filter(x => !due.some(d => d.event.id === x.event.id)), ...due])
  }, [events, loaded, now, meId])

  useEffect(() => {
    if (!loaded || !meId) return
    const invites = events.filter(e => e.attendeeIds.includes(meId) && e.createdBy !== meId && e.end > Date.now())
    const seen = readSet(SEEN)
    // primeira vez neste dispositivo: não inunda com convites antigos
    if (!seen) return writeSet(SEEN, new Set(invites.map(e => e.id)))
    const fresh = invites.filter(e => !seen.has(e.id))
    if (!fresh.length) return
    fresh.forEach(e => {
      seen.add(e.id)
      showToast(`Convite: ${e.title} · ${whenText(e.start)}`, 'info')
    })
    writeSet(SEEN, seen)
  }, [events, loaded, meId, showToast])

  const close = (key: string) => setAlerts(list => list.filter(a => a.key !== key))
  if (!alerts.length) return null

  return (
    <div className="fixed inset-x-0 top-3 z-60 mx-auto flex w-full max-w-md flex-col gap-2 px-3 lg:left-auto lg:right-6 lg:top-6 lg:mx-0" role="alert">
      {alerts.map(({ key, event: e, stage }) => {
        const cfg = EVENT_KINDS[e.kind]
        const Icon = KIND_ICON[e.kind]
        const meeting = stage === 'start' && e.kind === 'reuniao' && !!org && !org.isCompany && org.presence !== 'reuniao'
        return (
          <div key={key} className="card animate-slide-up border-2 p-4 shadow-xl" style={{ borderColor: cfg.color }}>
            <div className="flex items-start gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl" style={{ background: cfg.light, color: cfg.color }}>
                {stage === 'start' ? <BellRingingIcon size={24} weight="fill" className="animate-bounce-soft" /> : <Icon size={24} />}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-extrabold uppercase tracking-wide" style={{ color: cfg.color }}>
                  {stage === 'pre' ? `${cfg.label} daqui a ${Math.max(1, Math.ceil((e.start - now) / 60000))} min` : 'Está na hora'}
                </p>
                <p className="truncate text-lg font-black text-ink">{e.title}</p>
                <p className="text-sm font-bold text-muted">{hhmm(e.start)} – {hhmm(e.end)}</p>
                {e.location && (
                  isLink(e.location) ? (
                    <a href={e.location.trim()} target="_blank" rel="noopener" className="mt-0.5 flex items-center gap-1 text-sm font-bold text-accent hover:underline">
                      <LinkIcon size={14} /> Entrar na chamada
                    </a>
                  ) : (
                    <p className="mt-0.5 flex items-center gap-1 truncate text-sm font-semibold text-muted"><MapPinIcon size={14} /> {e.location}</p>
                  )
                )}
              </div>
              <button onClick={() => close(key)} className="rounded-lg p-1 text-muted hover:bg-snow cursor-pointer" aria-label="Fechar aviso">
                <XIcon size={20} />
              </button>
            </div>
            <div className="mt-3 flex gap-2">
              <button onClick={() => { close(key); router.push(`/calendario?dia=${e.start}`) }} className="btn btn-ghost flex-1 text-sm">Ver</button>
              {meeting ? (
                <button onClick={() => { org!.setPresence('reuniao'); close(key) }} className="btn btn-primary flex-1 text-sm">Marcar “Em reunião”</button>
              ) : (
                <button onClick={() => close(key)} className="btn btn-primary flex-1 text-sm">Ok</button>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
