import { CarriedHistory, Priority, Session, Task } from '../types'

/**
 * Regras de pontuação (XP). Partilhado entre cliente e servidor, por isso
 * não pode depender de nada do browser.
 */
export const POINTS = {
  /** 1 ponto por cada 5 minutos de foco */
  secondsPerPoint: 5 * 60,
  task: { baixa: 8, media: 10, alta: 15 } as Record<Priority, number>,
  onTime: 5,
  firstTryApproval: 15,
  rejection: -5,
}

/** A tarefa conta como concluída (nas de aprovação, só depois de aprovada) */
export function isCompleted(task: Task) {
  if (task.status !== 'done') return false
  return !task.requiresApproval || task.review?.status === 'approved'
}

/** Momento em que a tarefa passou a contar como concluída */
export function completedTime(task: Task) {
  if (!isCompleted(task)) return undefined
  return task.requiresApproval ? task.review?.at ?? task.completedAt : task.completedAt
}

export function taskPoints(task: Task) {
  const penalty = (task.review?.rejections ?? 0) * POINTS.rejection
  if (!isCompleted(task)) return penalty
  let pts = POINTS.task[task.priority] ?? POINTS.task.media
  if (task.deadline && task.completedAt && task.completedAt <= new Date(task.deadline).getTime()) pts += POINTS.onTime
  if (task.requiresApproval && (task.review?.rejections ?? 0) === 0) pts += POINTS.firstTryApproval
  return pts + penalty
}

export const focusPoints = (seconds: number) => Math.floor(seconds / POINTS.secondsPerPoint)

export type RangeStats = { seconds: number; tasks: number; points: number }

/** Horas, tarefas concluídas e pontos num intervalo [from, to) */
export function rangeStats(sessions: Session[], tasks: Task[], from = 0, to = Infinity): RangeStats {
  const seconds = sessions.reduce((a, s) => (s.start >= from && s.start < to ? a + s.seconds : a), 0)
  let done = 0
  let pts = focusPoints(seconds)
  for (const t of tasks) {
    const at = completedTime(t) ?? t.review?.at
    if (at === undefined || at < from || at >= to) continue
    if (isCompleted(t)) done++
    pts += taskPoints(t)
  }
  return { seconds, tasks: done, points: pts }
}

/** Soma o que a pessoa trouxe ao entrar na empresa; não tem datas, por isso só conta no total de sempre */
export function withHistory(stats: RangeStats, history: CarriedHistory | undefined, from = 0): RangeStats {
  if (!history || from > 0) return stats
  return { seconds: stats.seconds + history.seconds, tasks: stats.tasks + history.done, points: stats.points + history.xp }
}

export function totalPoints(sessions: Session[], tasks: Task[]) {
  return rangeStats(sessions, tasks).points
}

export const POINTS_HELP = [
  '1 XP por cada 5 min de foco',
  'Tarefa concluída: 8 / 10 / 15 XP (prioridade baixa / média / alta)',
  '+5 XP se terminares antes do prazo',
  '+15 XP se o supervisor aprovar à primeira',
  '−5 XP por cada rejeição',
]
