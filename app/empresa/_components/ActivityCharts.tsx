'use client'

import type { ReactNode } from 'react'
import { ChartCard, ColumnChart, DonutChart, LineChart, compact, type Point, type Series, type Slice } from '../../components/ui/Charts'
import { completedTime, isCompleted } from '../../lib/points'
import { formatDuration, formatShort, startOfDay } from '../../lib/stats'
import { PRESENCE_CONFIG, type PresenceSegment, type PresenceStatus, type Session, type Task } from '../../types'
import { presenceTotals, type RangeId } from './shared'

/* Gráficos de actividade (equipa ou um funcionário): anéis de tempo e tarefas, e evolução por dia ou por hora */

const STATES: PresenceStatus[] = ['trabalho', 'reuniao', 'formacao', 'pausa', 'almoco', 'ausente']
const PRESENCE_SERIES: Series[] = STATES.map(s => ({ key: s, name: PRESENCE_CONFIG[s].label, color: PRESENCE_CONFIG[s].color }))
const FOCUS: Series = { key: 'focus', name: 'Horas focadas', color: '#7B61FF' }
const DONE: Series[] = [{ key: 'done', name: 'Concluídas', color: '#4C7DFF' }]

/** Valores em horas; o texto sai em "45m" / "2,5h" */
const hours = (h: number) => formatShort(h * 3600)

type Bucket = { start: number; end: number; label: string; title: string }

/** Intervalos do gráfico: por hora no "Hoje", por dia nos outros períodos */
export function buckets(range: RangeId, from: number, now: number): Bucket[] {
  const out: Bucket[] = []
  if (range === 'hoje') {
    const day = startOfDay(now)
    const current = new Date(now).getHours()
    for (let h = Math.min(7, current); h <= current; h++) {
      const start = day + h * 3600000
      out.push({ start, end: start + 3600000, label: `${h}h`, title: `${h}h – ${h + 1}h` })
    }
    return out
  }
  for (let d = new Date(from); d.getTime() <= now; d.setDate(d.getDate() + 1)) {
    const start = d.getTime()
    const next = new Date(d)
    next.setDate(next.getDate() + 1)
    out.push({
      start,
      end: next.getTime(),
      label: range === '7d' ? d.toLocaleDateString('pt-PT', { weekday: 'short' }).replace('.', '') : `${d.getDate()}/${d.getMonth() + 1}`,
      title: d.toLocaleDateString('pt-PT', { weekday: 'long', day: 'numeric', month: 'short' }),
    })
  }
  return out
}

function DonutCard({ title, subtitle, children, footer }: { title: string; subtitle?: string; children: ReactNode; footer?: ReactNode }) {
  return (
    <section className="card min-w-0 p-4 sm:p-5">
      <h3 className="font-black text-ink">{title}</h3>
      {subtitle && <p className="mb-3 text-xs font-semibold text-muted">{subtitle}</p>}
      {children}
      {footer}
    </section>
  )
}

/** Anel com o tempo por estado (a trabalhar, reunião, almoço, ausente…) */
export function PresenceDonut({ totals, title, subtitle, footer }: { totals: Partial<Record<PresenceStatus, number>>; title: string; subtitle?: string; footer?: ReactNode }) {
  const slices: Slice[] = STATES.map(s => ({ key: s, label: PRESENCE_CONFIG[s].label, color: PRESENCE_CONFIG[s].color, value: totals[s] ?? 0 }))
  return (
    <DonutCard title={title} subtitle={subtitle} footer={footer}>
      <DonutChart slices={slices} format={formatDuration} centerLabel="registado" empty="Sem registo" />
    </DonutCard>
  )
}

/** Anel com o estado das tarefas: em aberto, por rever e concluídas no período */
export function TaskStatusDonut({ tasks, from, now, title = 'Estado das tarefas', periodLabel }: { tasks: Task[]; from: number; now: number; title?: string; periodLabel: string }) {
  const review = tasks.filter(t => t.status === 'done' && t.review?.status === 'pending').length
  const done = tasks.filter(t => isCompleted(t) && (completedTime(t) ?? 0) >= from).length
  const overdue = tasks.filter(t => t.deadline && t.status !== 'done' && new Date(t.deadline).getTime() < now).length
  const slices: Slice[] = [
    { key: 'todo', label: 'A fazer', color: '#A3A0B8', value: tasks.filter(t => t.status === 'todo').length },
    { key: 'doing', label: 'Em progresso', color: '#7B61FF', value: tasks.filter(t => t.status === 'doing').length },
    { key: 'review', label: 'À espera de revisão', color: '#FF8A3D', value: review },
    { key: 'done', label: `Concluídas (${periodLabel})`, color: '#4C7DFF', value: done },
  ]
  return (
    <DonutCard
      title={title}
      subtitle={`Em aberto agora e concluídas ${periodLabel === 'hoje' ? 'hoje' : `nos últimos ${periodLabel}`}`}
      footer={overdue > 0 && <p className="mt-3 text-xs font-extrabold text-danger">{overdue} em atraso</p>}
    >
      <DonutChart slices={slices} format={v => String(Math.round(v))} centerLabel="tarefas" empty="Sem tarefas" />
    </DonutCard>
  )
}

/** Evolução: estados empilhados, horas focadas em tarefas e tarefas concluídas */
export function TrendCharts({
  range, from, now, sessions, segments, tasks,
}: { range: RangeId; from: number; now: number; sessions: Session[]; segments: PresenceSegment[]; tasks: Task[] }) {
  const list = buckets(range, from, now)
  const perHour = range === 'hoje'
  const unit = perHour ? 'Hora' : 'Dia'
  const subtitle = perHour ? 'Hoje, por hora' : `Últimos ${list.length} dias`

  const presence: Point[] = list.map(b => {
    const t = presenceTotals(segments, b.start, Math.min(b.end, now + 1), now)
    return { label: b.label, title: b.title, values: Object.fromEntries(STATES.map(s => [s, (t[s] ?? 0) / 3600])) }
  })
  const focus: Point[] = list.map(b => ({
    label: b.label,
    title: b.title,
    values: { focus: sessions.reduce((a, s) => (s.start >= b.start && s.start < b.end ? a + s.seconds : a), 0) / 3600 },
  }))
  const done: Point[] = list.map(b => ({
    label: b.label,
    title: b.title,
    values: { done: tasks.filter(t => { const at = completedTime(t); return at !== undefined && at >= b.start && at < b.end }).length },
  }))

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="min-w-0 lg:col-span-2">
        <ChartCard title="Tempo por estado" subtitle={subtitle} series={PRESENCE_SERIES} points={presence} format={hours} firstCol={unit}>
          <ColumnChart points={presence} series={PRESENCE_SERIES} format={hours} axisFormat={hours} />
        </ChartCard>
      </div>
      <ChartCard title="Horas focadas em tarefas" subtitle={subtitle} series={[FOCUS]} points={focus} format={hours} firstCol={unit}>
        <LineChart points={focus} series={FOCUS} format={hours} axisFormat={hours} />
      </ChartCard>
      <ChartCard title="Tarefas concluídas" subtitle={subtitle} series={DONE} points={done} firstCol={unit}>
        <ColumnChart points={done} series={DONE} format={v => String(Math.round(v))} axisFormat={compact} />
      </ChartCard>
    </div>
  )
}
