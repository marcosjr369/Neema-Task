import { describe, expect, it } from 'vitest'
import { focusPoints, isCompleted, POINTS, rangeStats, taskPoints } from '../app/lib/points'
import { computeStreak, formatClock, formatDuration, formatShort, levelInfo, startOfDay } from '../app/lib/stats'
import type { Session, Task } from '../app/types'

const DAY = 86400000
const task = (p: Partial<Task>): Task => ({ id: 't', title: 'T', status: 'todo', priority: 'media', category: 'trabalho', createdAt: 0, ...p } as Task)
const session = (start: number, seconds: number): Session => ({ id: String(start), taskId: 't', category: 'trabalho', start, end: start + seconds * 1000, seconds } as Session)

describe('pontos', () => {
  it('foco: 1 ponto por cada 5 minutos completos', () => {
    expect(focusPoints(0)).toBe(0)
    expect(focusPoints(299)).toBe(0)
    expect(focusPoints(300)).toBe(1)
    expect(focusPoints(3600)).toBe(12)
  })
  it('tarefa concluída vale conforme a prioridade', () => {
    expect(taskPoints(task({ status: 'done', priority: 'baixa' }))).toBe(POINTS.task.baixa)
    expect(taskPoints(task({ status: 'done', priority: 'alta' }))).toBe(POINTS.task.alta)
  })
  it('tarefa por concluir não vale pontos', () => {
    expect(taskPoints(task({ status: 'doing' }))).toBe(0)
  })
  it('bónus por acabar dentro do prazo', () => {
    const deadline = new Date(2026, 0, 10, 18).toISOString()
    const onTime = task({ status: 'done', priority: 'media', deadline, completedAt: new Date(2026, 0, 10, 12).getTime() })
    const late = task({ status: 'done', priority: 'media', deadline, completedAt: new Date(2026, 0, 11, 12).getTime() })
    expect(taskPoints(onTime)).toBe(POINTS.task.media + POINTS.onTime)
    expect(taskPoints(late)).toBe(POINTS.task.media)
  })
  it('aprovação: só conta depois de aprovada; bónus à primeira; rejeições descontam', () => {
    const pending = task({ status: 'done', requiresApproval: true, review: { status: 'pending' } } as Partial<Task>)
    expect(isCompleted(pending)).toBe(false)
    const first = task({ status: 'done', requiresApproval: true, review: { status: 'approved', rejections: 0 } } as Partial<Task>)
    expect(taskPoints(first)).toBe(POINTS.task.media + POINTS.firstTryApproval)
    const third = task({ status: 'done', requiresApproval: true, review: { status: 'approved', rejections: 2 } } as Partial<Task>)
    expect(taskPoints(third)).toBe(POINTS.task.media + 2 * POINTS.rejection)
  })
  it('rangeStats só conta o que está no intervalo', () => {
    const s = [session(1000, 600), session(5 * DAY, 900)]
    const t = [task({ status: 'done', completedAt: 2000 }), task({ status: 'done', completedAt: 6 * DAY })]
    const r = rangeStats(s, t, 0, DAY)
    expect(r.seconds).toBe(600)
    expect(r.tasks).toBe(1)
    expect(r.points).toBe(focusPoints(600) + POINTS.task.media)
  })
})

describe('formatação de tempo', () => {
  it('relógio', () => {
    expect(formatClock(65)).toBe('01:05')
    expect(formatClock(3661)).toBe('1:01:01')
    expect(formatClock(-5)).toBe('00:00')
  })
  it('duração por extenso', () => {
    expect(formatDuration(0)).toBe('0 min')
    expect(formatDuration(30)).toBe('30s')
    expect(formatDuration(25 * 60)).toBe('25 min')
    expect(formatDuration(3600)).toBe('1h')
    expect(formatDuration(5400)).toBe('1h 30min')
  })
  it('duração curta (gráficos e números)', () => {
    expect(formatShort(0)).toBe('0m')
    expect(formatShort(45 * 60)).toBe('45m')
    expect(formatShort(90 * 60)).toBe('1,5h')
    expect(formatShort(10 * 3600)).toBe('10h')
    // quase uma hora: não deve aparecer "60m"
    expect(formatShort(59 * 60 + 50)).toBe('1h')
  })
})

describe('sequência e nível', () => {
  const now = new Date(2026, 5, 10, 15).getTime()
  const day = (n: number) => startOfDay(now) - n * DAY + 9 * 3600000
  it('conta dias seguidos com foco (hoje ainda pode não ter)', () => {
    expect(computeStreak([session(day(0), 600), session(day(1), 600), session(day(2), 600)], [], now).streak).toBe(3)
    expect(computeStreak([session(day(1), 600), session(day(2), 600)], [], now).streak).toBe(2)
  })
  it('um dia falhado parte a sequência', () => {
    expect(computeStreak([session(day(0), 600), session(day(2), 600)], [], now).streak).toBe(1)
  })
  it('menos de 1 minuto não conta', () => {
    expect(computeStreak([session(day(0), 30)], [], now).streak).toBe(0)
  })
  it('nível cresce com o XP', () => {
    expect(levelInfo(0).level).toBe(1)
    expect(levelInfo(24).level).toBe(1)
    expect(levelInfo(25).level).toBe(2)
    expect(levelInfo(100).level).toBe(3)
    const l = levelInfo(50)
    expect(l.progress).toBeGreaterThan(0)
    expect(l.progress).toBeLessThan(1)
  })
})
