'use client'

import { useCallback, useEffect, useState } from 'react'
import { useOrgRequired } from '../../context/OrgContext'
import { api } from '../../lib/api'
import { presenceTotals } from '../../lib/org'
import { startOfDay } from '../../lib/stats'
import { PRESENCE_CONFIG, PRESENCE_STATUSES, type PresenceSegment, type PresenceStatus, type Session } from '../../types'

/** Sessões e presença da equipa visível, num intervalo */
export function useTeamActivity(from: number, to?: number, memberId?: string) {
  const { base } = useOrgRequired()
  const [sessions, setSessions] = useState<Session[]>([])
  const [segments, setSegments] = useState<PresenceSegment[]>([])
  const [loaded, setLoaded] = useState(false)

  const reload = useCallback(async () => {
    const q = new URLSearchParams({ from: String(from) })
    if (to) q.set('to', String(to))
    if (memberId) q.set('memberId', memberId)
    try {
      const [s, p] = await Promise.all([
        api<{ sessions: Session[] }>(`${base}/sessions?scope=team&from=${from}`),
        api<{ segments: PresenceSegment[] }>(`${base}/presence?${q}`),
      ])
      setSessions(memberId ? s.sessions.filter(x => x.memberId === memberId) : s.sessions)
      setSegments(p.segments)
    } catch { /* offline */ }
    setLoaded(true)
  }, [base, from, to, memberId])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carregar do servidor
    reload()
    const id = setInterval(reload, 60 * 1000)
    return () => clearInterval(id)
  }, [reload])

  return { sessions, segments, loaded, reload }
}

export type RangeId = 'hoje' | '7d' | '30d'
export const RANGES: { id: RangeId; label: string }[] = [
  { id: 'hoje', label: 'Hoje' },
  { id: '7d', label: '7 dias' },
  { id: '30d', label: '30 dias' },
]

export function rangeFrom(id: RangeId, now: number) {
  const d = new Date(startOfDay(now))
  if (id === '7d') d.setDate(d.getDate() - 6)
  if (id === '30d') d.setDate(d.getDate() - 29)
  return d.getTime()
}

/** Barra empilhada com o tempo por estado */
export function PresenceBar({ totals, height = 12 }: { totals: Partial<Record<PresenceStatus, number>>; height?: number }) {
  const sum = Object.values(totals).reduce((a, b) => a + (b ?? 0), 0)
  if (!sum) return <div className="w-full rounded-full bg-line" style={{ height }} />
  return (
    <div className="flex w-full overflow-hidden rounded-full bg-line" style={{ height }}>
      {PRESENCE_STATUSES.map(s =>
        totals[s] ? (
          <span
            key={s}
            title={`${PRESENCE_CONFIG[s].label}: ${Math.round((totals[s] ?? 0) / 60)} min`}
            style={{ width: `${((totals[s] ?? 0) / sum) * 100}%`, background: PRESENCE_CONFIG[s].color }}
          />
        ) : null,
      )}
    </div>
  )
}

export function PresenceLegend() {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs font-bold text-muted">
      {PRESENCE_STATUSES.filter(s => s !== 'offline').map(s => (
        <span key={s} className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-sm" style={{ background: PRESENCE_CONFIG[s].color }} /> {PRESENCE_CONFIG[s].label}
        </span>
      ))}
    </div>
  )
}

/** Linha do tempo de um dia: blocos coloridos por estado */
export function DayTimeline({ segments, day, now }: { segments: PresenceSegment[]; day: number; now: number }) {
  const end = new Date(day)
  end.setDate(end.getDate() + 1)
  const dayEnd = end.getTime()
  // janela visível: das 6h às 22h, alargada se houver actividade fora
  const inDay = segments.filter(s => s.start < dayEnd && (s.end ?? now) > day)
  let startH = 6
  let endH = 22
  inDay.forEach(s => {
    startH = Math.min(startH, new Date(Math.max(s.start, day)).getHours())
    endH = Math.max(endH, Math.ceil((Math.min(s.end ?? now, dayEnd) - day) / 3600000))
  })
  const from = day + startH * 3600000
  const to = day + Math.min(24, endH) * 3600000
  const span = to - from
  const hours = []
  for (let h = startH; h <= Math.min(24, endH); h += 2) hours.push(h)

  return (
    <div>
      <div className="relative h-8 overflow-hidden rounded-lg bg-snow">
        {inDay.map(s => {
          const a = Math.max(s.start, from)
          const b = Math.min(s.end ?? now, to)
          if (b <= a) return null
          return (
            <span
              key={s.id}
              className="absolute inset-y-0"
              title={`${PRESENCE_CONFIG[s.status].label}: ${new Date(s.start).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })} – ${
                s.end ? new Date(s.end).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' }) : 'agora'
              }`}
              style={{ left: `${((a - from) / span) * 100}%`, width: `${Math.max(0.4, ((b - a) / span) * 100)}%`, background: PRESENCE_CONFIG[s.status].color }}
            />
          )
        })}
      </div>
      <div className="relative mt-1 h-4">
        {hours.map(h => (
          <span key={h} className="absolute -translate-x-1/2 text-[10px] font-bold text-muted" style={{ left: `${((h - startH) / (Math.min(24, endH) - startH)) * 100}%` }}>
            {h}h
          </span>
        ))}
      </div>
    </div>
  )
}

export { presenceTotals }

/** Alertas de excesso de trabalho: mais de 10h activo hoje ou 3h seguidas sem pausa */
export function overworkAlerts(segments: PresenceSegment[], memberId: string, now: number) {
  const mine = segments.filter(s => s.memberId === memberId)
  const today = presenceTotals(mine, startOfDay(now), now + 1, now)
  const active = (today.trabalho ?? 0) + (today.reuniao ?? 0) + (today.formacao ?? 0)
  const alerts: string[] = []
  if (active > 10 * 3600) alerts.push(`${Math.floor(active / 3600)}h activo hoje`)
  const open = mine.find(s => s.end === null && s.status === 'trabalho')
  if (open && now - open.start > 3 * 3600000) alerts.push(`Sem pausa há ${Math.floor((now - open.start) / 3600000)}h`)
  return alerts
}
