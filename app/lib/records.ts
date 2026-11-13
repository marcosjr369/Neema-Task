import { completedTime, isCompleted } from './points'
import { presenceTotals } from './org'
import { startOfDay } from './stats'
import type { Org, PresenceSegment, PresenceStatus, Session, Task } from '../types'

export const DEFAULT_DAILY_GOAL_HOURS = 8
export const GOAL_MARGIN = 15 * 60
export const ACTIVE_STATES: PresenceStatus[] = ['trabalho', 'reuniao', 'formacao']

export const goalSecondsOf = (org: Pick<Org, 'dailyGoalHours'>) => (org.dailyGoalHours ?? DEFAULT_DAILY_GOAL_HOURS) * 3600

export type GoalBand = 'abaixo' | 'meta' | 'acima'
export const GOAL_BANDS: { id: GoalBand; label: string; color: string }[] = [
  { id: 'abaixo', label: 'Abaixo da meta', color: '#FF8A3D' },
  { id: 'meta', label: 'Na meta', color: '#12B5A6' },
  { id: 'acima', label: 'Acima da meta', color: '#7B61FF' },
]

export function bandOf(seconds: number, goal: number): GoalBand | null {
  if (seconds <= 0) return null
  if (seconds < goal - GOAL_MARGIN) return 'abaixo'
  if (seconds > goal + GOAL_MARGIN) return 'acima'
  return 'meta'
}

export function activeSeconds(segments: PresenceSegment[], from: number, to: number, now: number) {
  const t = presenceTotals(segments, from, to, now)
  return ACTIVE_STATES.reduce((a, s) => a + (t[s] ?? 0), 0)
}

export type RecordPeriod = 'dia' | 'semana' | 'mes' | 'ano'
export const RECORD_PERIODS: { id: RecordPeriod; label: string }[] = [
  { id: 'dia', label: 'Diário' },
  { id: 'semana', label: 'Semanal' },
  { id: 'mes', label: 'Mensal' },
  { id: 'ano', label: 'Anual' },
]

export function periodRange(p: RecordPeriod, offset: number, now: number) {
  const a = new Date(startOfDay(now))
  if (p === 'dia') a.setDate(a.getDate() + offset)
  if (p === 'semana') a.setDate(a.getDate() - ((a.getDay() + 6) % 7) + offset * 7)
  if (p === 'mes') { a.setDate(1); a.setMonth(a.getMonth() + offset) }
  if (p === 'ano') { a.setMonth(0, 1); a.setFullYear(a.getFullYear() + offset) }
  const b = new Date(a)
  if (p === 'dia') b.setDate(b.getDate() + 1)
  if (p === 'semana') b.setDate(b.getDate() + 7)
  if (p === 'mes') b.setMonth(b.getMonth() + 1)
  if (p === 'ano') b.setFullYear(b.getFullYear() + 1)
  const from = a.getTime()
  const to = b.getTime()
  const fmt = (d: Date, o: Intl.DateTimeFormatOptions) => d.toLocaleDateString('pt-PT', o)
  const last = new Date(to - 1)
  const label =
    p === 'dia' ? (offset === 0 ? 'Hoje' : offset === -1 ? 'Ontem' : fmt(a, { weekday: 'long', day: 'numeric', month: 'short' }))
    : p === 'semana' ? `${fmt(a, { day: 'numeric', month: 'short' })} – ${fmt(last, { day: 'numeric', month: 'short' })}`
    : p === 'mes' ? fmt(a, { month: 'long', year: 'numeric' })
    : String(a.getFullYear())
  return { from, to, label }
}

export function daysIn(from: number, to: number, now: number) {
  const out: number[] = []
  for (let d = new Date(from); d.getTime() < to && d.getTime() <= now; d.setDate(d.getDate() + 1)) out.push(d.getTime())
  return out
}

export type Factor = { id: 'meta' | 'prazos' | 'qualidade' | 'foco' | 'entregas'; label: string; hint: string; value: number | null }

export type MemberAnalysis = {
  memberId: string
  perDay: { day: number; seconds: number; band: GoalBand }[]
  daysByBand: Record<GoalBand, number>
  activeSeconds: number
  avgPerDay: number
  band: GoalBand | null
  bestDay: { day: number; seconds: number } | null
  focusSeconds: number
  done: number
  beforeDeadline: number
  late: number
  reviewed: number
  firstTry: number
  records: number
  factors: Factor[]
  score: number | null
}

type Input = { memberId: string; segments: PresenceSegment[]; sessions: Session[]; tasks: Task[] }

export const doneIn = (tasks: Task[], from: number, to: number) =>
  tasks.filter(t => { const at = completedTime(t); return at !== undefined && at >= from && at < to }).length

export function analyse(people: Input[], from: number, to: number, now: number, goal: number, maxDone?: number | null): MemberAnalysis[] {
  const days = daysIn(from, to, now)
  const end = Math.min(to, now + 1)
  const inRange = (at: number | undefined) => at !== undefined && at >= from && at < to

  const base = people.map(({ memberId, segments, sessions, tasks }) => {
    const perDay = days
      .map(day => {
        const seconds = activeSeconds(segments, day, Math.min(day + 86400000, end), now)
        return { day, seconds, band: bandOf(seconds, goal) }
      })
      .filter((d): d is { day: number; seconds: number; band: GoalBand } => d.band !== null)
    const daysByBand = { abaixo: 0, meta: 0, acima: 0 }
    perDay.forEach(d => daysByBand[d.band]++)
    const total = perDay.reduce((a, d) => a + d.seconds, 0)
    const avgPerDay = perDay.length ? total / perDay.length : 0
    const bestDay = perDay.reduce<{ day: number; seconds: number } | null>((b, d) => (!b || d.seconds > b.seconds ? d : b), null)
    const focusSeconds = sessions.reduce((a, s) => (s.start >= from && s.start < to ? a + s.seconds : a), 0)

    const doneTasks = tasks.filter(t => isCompleted(t) && inRange(completedTime(t)))
    // prazo cumprido: entregue (completedAt) até ao prazo, mesmo que aprovada depois
    const withDeadline = doneTasks.filter(t => t.deadline)
    const beforeDeadline = withDeadline.filter(t => (t.completedAt ?? Infinity) <= new Date(t.deadline!).getTime()).length
    const overdueOpen = tasks.filter(t => t.status !== 'done' && t.deadline && inRange(new Date(t.deadline).getTime()) && new Date(t.deadline).getTime() < now).length
    const late = withDeadline.length - beforeDeadline + overdueOpen
    const reviewed = tasks.filter(t => t.review && t.review.status !== 'pending' && inRange(t.review.at))
    const firstTry = reviewed.filter(t => t.review?.status === 'approved' && t.review.rejections === 0).length

    return {
      memberId, perDay, daysByBand, activeSeconds: total, avgPerDay, band: bandOf(avgPerDay, goal), bestDay, focusSeconds,
      done: doneTasks.length, beforeDeadline, late, reviewed: reviewed.length, firstTry,
      records: beforeDeadline + firstTry + daysByBand.meta + daysByBand.acima,
    }
  })

  const best = maxDone === null ? 0 : Math.max(maxDone ?? 0, ...base.map(b => b.done))
  return base.map(b => {
    const ratio = (n: number, d: number) => (d > 0 ? Math.min(1, n / d) : null)
    const factors: Factor[] = [
      { id: 'meta', label: 'Meta diária', hint: 'Dias com a meta cumprida', value: ratio(b.daysByBand.meta + b.daysByBand.acima, b.perDay.length) },
      { id: 'prazos', label: 'Prazos', hint: 'Tarefas com prazo entregues a tempo', value: ratio(b.beforeDeadline, b.beforeDeadline + b.late) },
      { id: 'qualidade', label: 'Qualidade', hint: 'Aprovadas à primeira', value: ratio(b.firstTry, b.reviewed) },
      { id: 'foco', label: 'Foco', hint: 'Tempo activo passado em tarefas', value: ratio(b.focusSeconds, b.activeSeconds) },
      { id: 'entregas', label: 'Entregas', hint: 'Concluídas, face a quem mais concluiu', value: best > 0 ? b.done / best : null },
    ]
    const known = factors.filter(f => f.value !== null)
    const score = known.length ? Math.round((known.reduce((a, f) => a + f.value!, 0) / known.length) * 100) : null
    return { ...b, factors, score }
  })
}
