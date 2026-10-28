import { ActiveTimer, Session, Task, TaskCategory } from '../types'
import { totalPoints } from './points'

const DAY = 24 * 60 * 60 * 1000

// ─── Formatação ─────────────────────────────────────────────────────────────

const pad = (n: number) => String(n).padStart(2, '0')

/** 1:05:09 ou 05:09 */
export function formatClock(totalSeconds: number) {
  const s = Math.max(0, Math.floor(totalSeconds))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${pad(m)}:${pad(sec)}`
}

/** 45 min · 2h 10min */
export function formatDuration(totalSeconds: number) {
  const m = Math.floor(totalSeconds / 60)
  if (m < 1) return totalSeconds > 0 ? `${Math.floor(totalSeconds)}s` : '0 min'
  if (m < 60) return `${m} min`
  const h = Math.floor(m / 60)
  const r = m % 60
  return r ? `${h}h ${r}min` : `${h}h`
}

/** Versão curta para eixos e chips: 45m · 2,5h */
export function formatShort(totalSeconds: number) {
  const m = totalSeconds / 60
  if (m < 60) return `${Math.round(m)}m`
  return `${(m / 60).toFixed(1).replace('.', ',').replace(',0', '')}h`
}

export function formatDeadline(deadline: string, now: number) {
  const d = new Date(deadline)
  const diff = d.getTime() - now
  const time = d.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })
  if (diff < 0) return { text: 'Atrasada', late: true }
  const today = startOfDay(now)
  const day = startOfDay(d.getTime())
  if (day === today) return { text: `Hoje, ${time}`, late: false }
  if (day === today + DAY) return { text: `Amanhã, ${time}`, late: false }
  return {
    text: d.toLocaleDateString('pt-PT', { day: '2-digit', month: 'short' }) + `, ${time}`,
    late: false,
  }
}

// ─── Datas ──────────────────────────────────────────────────────────────────

export function startOfDay(ts: number) {
  const d = new Date(ts)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

// ─── Temporizador ───────────────────────────────────────────────────────────

/** Segundos decorridos na fase actual do temporizador */
export function phaseElapsed(t: ActiveTimer, now: number) {
  return t.accumulated + (t.segmentStart ? Math.max(0, (now - t.segmentStart) / 1000) : 0)
}

/** Sessão "virtual" para o segmento de foco que está a correr agora */
export function liveSession(t: ActiveTimer | null, tasks: Task[], now: number): Session | null {
  if (!t || t.phase !== 'focus' || !t.segmentStart) return null
  const task = tasks.find(x => x.id === t.taskId)
  return {
    id: 'live',
    taskId: t.taskId,
    category: task?.category ?? 'outro',
    start: t.segmentStart,
    end: now,
    seconds: Math.max(0, (now - t.segmentStart) / 1000),
  }
}

// ─── Agregações ─────────────────────────────────────────────────────────────

export const sumSeconds = (sessions: Session[]) =>
  sessions.reduce((acc, s) => acc + s.seconds, 0)

export function taskSeconds(sessions: Session[], taskId: string) {
  return sumSeconds(sessions.filter(s => s.taskId === taskId))
}

export function secondsInRange(sessions: Session[], from: number, to: number) {
  return sumSeconds(sessions.filter(s => s.start >= from && s.start < to))
}

export function todaySeconds(sessions: Session[], now: number) {
  const from = startOfDay(now)
  return secondsInRange(sessions, from, from + DAY)
}

export type DayPoint = { start: number; label: string; seconds: number; tasksDone: number }

export function dailySeries(sessions: Session[], tasks: Task[], now: number, days: number): DayPoint[] {
  const today = startOfDay(now)
  const out: DayPoint[] = []
  for (let i = days - 1; i >= 0; i--) {
    // setDate lida bem com mudanças de hora (DST)
    const d = new Date(today)
    d.setDate(d.getDate() - i)
    const start = d.getTime()
    const next = new Date(d)
    next.setDate(next.getDate() + 1)
    const end = next.getTime()
    out.push({
      start,
      label:
        days <= 7
          ? d.toLocaleDateString('pt-PT', { weekday: 'short' }).replace('.', '').slice(0, 3)
          : String(d.getDate()),
      seconds: secondsInRange(sessions, start, end),
      tasksDone: tasks.filter(t => t.completedAt && t.completedAt >= start && t.completedAt < end).length,
    })
  }
  return out
}

/** Dias consecutivos (até hoje ou ontem) com tempo focado ou tarefas concluídas */
export function computeStreak(sessions: Session[], tasks: Task[], now: number) {
  const active = new Set<number>()
  sessions.forEach(s => { if (s.seconds >= 60) active.add(startOfDay(s.start)) })
  tasks.forEach(t => { if (t.completedAt) active.add(startOfDay(t.completedAt)) })

  const d = new Date(startOfDay(now))
  if (!active.has(d.getTime())) d.setDate(d.getDate() - 1)
  let streak = 0
  while (active.has(d.getTime())) {
    streak++
    d.setDate(d.getDate() - 1)
  }
  return { streak, activeToday: active.has(startOfDay(now)) }
}

export function bestStreak(sessions: Session[], tasks: Task[]) {
  const days = new Set<number>()
  sessions.forEach(s => { if (s.seconds >= 60) days.add(startOfDay(s.start)) })
  tasks.forEach(t => { if (t.completedAt) days.add(startOfDay(t.completedAt)) })
  const sorted = [...days].sort((a, b) => a - b)
  let best = 0
  let run = 0
  let prev: number | null = null
  for (const day of sorted) {
    if (prev !== null) {
      const expected = new Date(prev)
      expected.setDate(expected.getDate() + 1)
      run = expected.getTime() === day ? run + 1 : 1
    } else run = 1
    best = Math.max(best, run)
    prev = day
  }
  return best
}

/** Números de que dependem as conquistas (sem ícones: também corre no servidor) */
export type AchievementProgress = { done: number; hours: number; record: number; longest: number }

export function achievementProgress(sessions: Session[], tasks: Task[]): AchievementProgress {
  return {
    done: tasks.filter(t => t.status === 'done' && t.review?.status !== 'pending').length,
    hours: sumSeconds(sessions) / 3600,
    record: bestStreak(sessions, tasks),
    longest: sessions.reduce((m, s) => Math.max(m, s.seconds), 0) / 60,
  }
}

export function totalXp(sessions: Session[], tasks: Task[]) {
  return Math.max(0, totalPoints(sessions, tasks))
}

/** Nível cresce quadraticamente: nível n começa em 25·(n-1)² XP */
export function levelInfo(xp: number) {
  const level = Math.floor(Math.sqrt(xp / 25)) + 1
  const base = 25 * (level - 1) ** 2
  const next = 25 * level ** 2
  return { level, base, next, progress: (xp - base) / (next - base) }
}

export function categoryBreakdown(sessions: Session[]) {
  const map = new Map<TaskCategory, number>()
  sessions.forEach(s => map.set(s.category, (map.get(s.category) ?? 0) + s.seconds))
  return [...map.entries()]
    .map(([category, seconds]) => ({ category, seconds }))
    .sort((a, b) => b.seconds - a.seconds)
}

/** Hora do dia (0-23) com mais tempo focado */
export function peakHour(sessions: Session[]) {
  const hours = new Array(24).fill(0)
  sessions.forEach(s => { hours[new Date(s.start).getHours()] += s.seconds })
  const max = Math.max(...hours)
  return max > 0 ? hours.indexOf(max) : null
}
