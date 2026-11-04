import { useCallback, useEffect, useState } from 'react'
import { api } from './api'
import { startOfDay } from './stats'
import type { CalendarEvent, EventResponse } from '../types'

/* Calendário no cliente: datas, pedidos à API e lista de eventos de um intervalo */

export const DAY_MS = 24 * 3600 * 1000

/** Avisa todas as listas abertas (página, alertas, agenda de hoje) para recarregarem */
const CHANGED = 'udacha:events'
export const eventsChanged = () => window.dispatchEvent(new Event(CHANGED))

export const eventsBase = (orgBase?: string) => orgBase ?? '/api/personal'

/** Eventos que tocam o intervalo [from, to); recarrega a cada minuto e quando algo muda */
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
    const id = setInterval(reload, 60 * 1000)
    window.addEventListener(CHANGED, reload)
    window.addEventListener('focus', reload)
    return () => {
      clearInterval(id)
      window.removeEventListener(CHANGED, reload)
      window.removeEventListener('focus', reload)
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

// ─── Datas ──────────────────────────────────────────────────────────────────

const pad = (n: number) => String(n).padStart(2, '0')
/** "AAAA-MM-DD" local (para <input type="date">) */
export const dateInput = (ms: number) => { const d = new Date(ms); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` }
/** "HH:MM" local (para <input type="time">) */
export const timeInput = (ms: number) => { const d = new Date(ms); return `${pad(d.getHours())}:${pad(d.getMinutes())}` }
/** Junta data e hora locais */
export const fromInputs = (date: string, time: string) => new Date(`${date}T${time || '00:00'}`).getTime()

export const hhmm = (ms: number) => new Date(ms).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })
export const dayTitle = (ms: number) => new Date(ms).toLocaleDateString('pt-PT', { weekday: 'long', day: 'numeric', month: 'long' })

/** 6 semanas (segunda a domingo) que mostram o mês de "month" */
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

/** Eventos que tocam o dia */
export const eventsOn = (events: CalendarEvent[], day: number) => {
  const end = new Date(day)
  end.setDate(end.getDate() + 1)
  return events.filter(e => e.start < end.getTime() && e.end > day)
}

/** É um endereço (para abrir a chamada)? */
export const isLink = (s?: string) => !!s && /^https?:\/\//i.test(s.trim())
export const whenText = (ms: number) =>
  new Date(ms).toLocaleString('pt-PT', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
