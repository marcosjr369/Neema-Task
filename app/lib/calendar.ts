import { useCallback, useEffect, useState } from 'react'
import { api, keepIfSame, throttled, whenVisible } from './api'
import { startOfDay } from './stats'
import type { AttendanceMode, CalendarEvent, EventResponse } from '../types'

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
      const next = r.events.sort((a, b) => a.start - b.start)
      setEvents(prev => keepIfSame(prev, next))
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

export type EventData = Pick<CalendarEvent, 'title' | 'kind' | 'start' | 'end'> &
  Partial<Pick<CalendarEvent, 'description' | 'location' | 'attendeeIds' | 'roomId'>> & { allowOverlap?: boolean }

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

/** Como participo numa reunião que começou (presencial na sala, online, ou não vou) */
export async function attendEvent(base: string, id: string, mode: AttendanceMode) {
  const r = await api<{ event: CalendarEvent }>(`${base}/events/${id}`, { method: 'PATCH', body: { action: 'attend', mode } })
  eventsChanged()
  return r.event
}

/** Reserva de uma sala do mapa, vista por toda a empresa (sem detalhes para quem não participa) */
export type RoomBooking = { id: string; roomId: string; start: number; end: number; title?: string; mine: boolean; present: number }

/** As reservas das salas (de hoje e amanhã, por omissão); actualiza a cada minuto e quando os eventos mudam */
export function useRoomBookings(orgBase: string | undefined, from?: number, to?: number) {
  const [bookings, setBookings] = useState<RoomBooking[]>([])
  const reload = useCallback(async () => {
    if (!orgBase) return
    try {
      const q = from && to ? `?from=${from}&to=${to}` : ''
      const r = await api<{ bookings: RoomBooking[] }>(`${orgBase}/salas${q}`)
      setBookings(prev => keepIfSame(prev, r.bookings))
    } catch { /* offline: mantém o que há */ }
  }, [orgBase, from, to])
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carregar do servidor
    reload()
    const id = setInterval(whenVisible(reload), 60 * 1000)
    window.addEventListener(CHANGED, reload)
    return () => {
      clearInterval(id)
      window.removeEventListener(CHANGED, reload)
    }
  }, [reload])
  return bookings
}

/** As reservas que se cruzam com [start, end) numa sala */
export const bookingClashes = (bookings: RoomBooking[], roomId: string, start: number, end: number, ignoreId?: string) =>
  bookings.filter(b => b.roomId === roomId && b.id !== ignoreId && b.start < end && b.end > start)
