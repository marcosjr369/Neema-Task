import { useCallback, useEffect, useState } from 'react'
import { api, throttled, whenVisible } from './api'
import { startOfDay } from './stats'
import type { CalendarEvent, EventResponse } from '../types'

export const DAY_MS = 24 * 3600 * 1000

const CHANGED = 'udacha:events'
export const eventsChanged = () => window.dispatchEvent(new Event(CHANGED))

export const eventsBase = (orgBase?: string) => orgBase ?? '/api/personal'

/**
 * Participo no evento (agendei ou fui convidado)? Supervisores e administradores também
 * veem os eventos da equipa, mas os avisos são só para quem participa.
 */
export const involves = (e: CalendarEvent, meId?: string) => !meId || e.createdBy === meId || e.attendeeIds.includes(meId)

export function useEvents(base: string, from: number, to: number) {
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [loaded, setLoaded] = useState(false)

  const reload = useCallback(async () => {
    try {
      const r = await api<{ events: CalendarEvent[] }>(`${base}/events?from=${from}&to=${to}`)
      setEvents(r.events.sort((a, b) => a.start - b.start))
    } catch { /* offline: mantém o que há */ }
    setLoaded(true)
  }, [base, from, to])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carregar do servidor
    reload()
    const id = setInterval(whenVisible(reload), 60 * 1000)
    const onFocus = throttled(reload)
    window.addEventListener(CHANGED, reload)
    window.addEventListener('focus', onFocus)
    return () => {
      clearInterval(id)
      window.removeEventListener(CHANGED, reload)
      window.removeEventListener('focus', onFocus)
    }
  }, [reload])

  return { events, loaded, reload }
}

export type EventData = Pick<CalendarEvent, 'title' | 'kind' | 'start' | 'end'> & Partial<Pick<CalendarEvent, 'description' | 'location' | 'attendeeIds'>>

export async function saveEvent(base: string, id: string | null, data: EventData) {
  const r = id
    ? await api<{ event: CalendarEvent }>(`${base}/events/${id}`, { method: 'PATCH', body: { action: 'update', patch: data } })
    : await api<{ event: CalendarEvent }>(`${base}/events`, { body: data })
  eventsChanged()
  return r.event
}

export async function deleteEvent(base: string, id: string) {
  await api(`${base}/events/${id}`, { method: 'DELETE' })
  eventsChanged()
}

export async function respondEvent(base: string, id: string, response: EventResponse) {
  await api(`${base}/events/${id}`, { method: 'PATCH', body: { action: 'respond', response } })
  eventsChanged()
}

const pad = (n: number) => String(n).padStart(2, '0')
export const dateInput = (ms: number) => { const d = new Date(ms); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` }
export const timeInput = (ms: number) => { const d = new Date(ms); return `${pad(d.getHours())}:${pad(d.getMinutes())}` }
export const fromInputs = (date: string, time: string) => new Date(`${date}T${time || '00:00'}`).getTime()

export const hhmm = (ms: number) => new Date(ms).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })
export const dayTitle = (ms: number) => new Date(ms).toLocaleDateString('pt-PT', { weekday: 'long', day: 'numeric', month: 'long' })

export function monthGrid(month: number) {
  const first = new Date(month)
  first.setDate(1)
  const start = new Date(startOfDay(first.getTime()))
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7))
  const days: number[] = []
  for (let i = 0; i < 42; i++) {
    const d = new Date(start)
    d.setDate(start.getDate() + i)
    days.push(d.getTime())
  }
  return days
}

export const eventsOn = (events: CalendarEvent[], day: number) => {
  const end = new Date(day)
  end.setDate(end.getDate() + 1)
  return events.filter(e => e.start < end.getTime() && e.end > day)
}

export const isLink = (s?: string) => !!s && /^https?:\/\//i.test(s.trim())
export const whenText = (ms: number) =>
  new Date(ms).toLocaleString('pt-PT', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
