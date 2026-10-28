'use client'

import Link from 'next/link'
import { useMemo, useState, type ReactNode } from 'react'
import { ArrowLeftIcon, PaperclipIcon } from '@phosphor-icons/react'
import Mascot from '../../../components/ui/Mascot'
import { formatShort } from '../../../lib/stats'
import { CATEGORY_CONFIG, PRIORITY_CONFIG, STATUS_LABEL, type TaskStatus } from '../../../types'
import type { DayWork, PanelTask } from '../../../lib/server/panelDetail'
import { ChartCard, ColumnChart, compact, type Point, type Series } from './Charts'
import { date, dayLabel } from './format'

/* Peças das fichas de detalhe (utilizador e empresa) */

export function BackLink({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} className="inline-flex items-center gap-1.5 text-sm font-extrabold text-muted hover:text-body">
      <ArrowLeftIcon size={16} /> {label}
    </Link>
  )
}

export function DetailState({ error, notFound }: { error: string; notFound: string }) {
  if (error) {
    return (
      <div className="flex flex-col items-center py-16 text-center">
        <Mascot size={90} mood="sad" />
        <p className="mt-3 text-lg font-black text-ink">{error.includes('não encontrad') ? notFound : error}</p>
      </div>
    )
  }
  return <div className="flex justify-center py-20"><Mascot size={80} className="animate-bounce-soft" /></div>
}

export function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="card p-4">
      <p className="text-xs font-extrabold uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-1 text-2xl font-black tabular-nums text-ink">{value}</p>
      {hint && <p className="mt-0.5 text-xs font-semibold text-muted">{hint}</p>}
    </div>
  )
}

/** Lista de pares rótulo → valor (dados da ficha) */
export function InfoList({ rows }: { rows: [string, ReactNode][] }) {
  return (
    <dl className="divide-y-2 divide-line">
      {rows.map(([k, v]) => (
        <div key={k} className="flex items-start justify-between gap-4 px-4 py-2.5 text-sm">
          <dt className="font-bold text-muted">{k}</dt>
          <dd className="min-w-0 text-right font-extrabold text-ink">{v}</dd>
        </div>
      ))}
    </dl>
  )
}

export function Section({ title, right, children, className = '' }: { title: string; right?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`card overflow-hidden ${className}`}>
      <div className="flex items-center gap-3 border-b-2 border-line px-4 py-3">
        <h3 className="mr-auto font-black text-ink">{title}</h3>
        {right}
      </div>
      {children}
    </section>
  )
}

const FOCUS: Series[] = [{ key: 'hours', name: 'Horas de foco', color: '#7B61FF' }]
const DONE: Series[] = [{ key: 'tasks', name: 'Tarefas concluídas', color: '#0D9488' }]

/** Foco e tarefas por dia, lado a lado (duas medidas, dois gráficos) */
export function WorkCharts({ series, days }: { series: DayWork[]; days: number }) {
  const points = useMemo(() => {
    const mk = (v: (d: DayWork) => Record<string, number>): Point[] =>
      series.map(d => ({ label: dayLabel(d.day), title: dayLabel(d.day, true), values: v(d) }))
    return {
      focus: mk(d => ({ hours: Math.round((d.focusSeconds / 3600) * 10) / 10 })),
      tasks: mk(d => ({ tasks: d.tasksDone })),
    }
  }, [series])
  const hours = (v: number) => `${compact(v)} h`
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <ChartCard title="Horas de foco por dia" subtitle={`Últimos ${days} dias`} series={FOCUS} points={points.focus} format={hours}>
        <ColumnChart points={points.focus} series={FOCUS} format={hours} />
      </ChartCard>
      <ChartCard title="Tarefas concluídas por dia" subtitle={`Últimos ${days} dias`} series={DONE} points={points.tasks}>
        <ColumnChart points={points.tasks} series={DONE} />
      </ChartCard>
    </div>
  )
}

const STATUS_CLS: Record<TaskStatus, string> = {
  todo: 'bg-snow text-muted',
  doing: 'bg-gold/20 text-gold-dark',
  done: 'bg-accent-light text-accent-dark',
}
const REVIEW = { pending: 'Em revisão', approved: 'Aprovada', rejected: 'Devolvida' } as const

/** Tarefas (pessoais ou de empresa), com filtro por estado */
export function TaskTable({ tasks, showOrg = false, showAssignee = false }: { tasks: PanelTask[]; showOrg?: boolean; showAssignee?: boolean }) {
  const [filter, setFilter] = useState<'todas' | 'abertas' | TaskStatus>('abertas')
  const rows = tasks.filter(t => filter === 'todas' || (filter === 'abertas' ? t.status !== 'done' : t.status === filter))
  const count = (f: typeof filter) => tasks.filter(t => f === 'todas' || (f === 'abertas' ? t.status !== 'done' : t.status === f)).length
  return (
    <Section
      title={`Tarefas (${tasks.length})`}
      right={
        <div className="no-scrollbar flex gap-1.5 overflow-x-auto">
          {(['abertas', 'done', 'todas'] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)} className={`chip shrink-0 text-xs ${filter === f ? 'border-brand! bg-brand-light! text-brand-dark!' : ''}`}>
              {f === 'abertas' ? 'Por fazer' : f === 'done' ? 'Concluídas' : 'Todas'} · {count(f)}
            </button>
          ))}
        </div>
      }
    >
      <div className="max-h-[480px] overflow-auto">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="sticky top-0 bg-snow text-left text-xs font-extrabold uppercase tracking-wide text-muted">
            <tr>
              <th className="px-4 py-2">Tarefa</th>
              {showOrg && <th className="px-3 py-2">Empresa</th>}
              {showAssignee && <th className="px-3 py-2">Responsável</th>}
              <th className="px-3 py-2">Estado</th>
              <th className="px-3 py-2">Prazo</th>
              <th className="px-3 py-2 text-right">Foco</th>
              <th className="px-4 py-2">Criada</th>
            </tr>
          </thead>
          <tbody className="divide-y-2 divide-line">
            {rows.map(t => (
              <tr key={t.id}>
                <td className="px-4 py-2.5">
                  <span className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: CATEGORY_CONFIG[t.category].color }} title={CATEGORY_CONFIG[t.category].label} />
                    <span className={`max-w-[280px] truncate font-extrabold ${t.status === 'done' ? 'text-muted line-through' : 'text-ink'}`}>{t.title}</span>
                    {t.attachments > 0 && <span className="flex items-center text-xs font-bold text-muted"><PaperclipIcon size={13} />{t.attachments}</span>}
                  </span>
                  <span className="ml-[18px] block text-xs font-semibold text-muted">
                    {CATEGORY_CONFIG[t.category].label} · prioridade {PRIORITY_CONFIG[t.priority].label.toLowerCase()}{t.departmentName ? ` · ${t.departmentName}` : ''}
                  </span>
                </td>
                {showOrg && <td className="px-3 py-2.5 font-semibold text-body">{t.orgName ?? <span className="text-muted">Pessoal</span>}</td>}
                {showAssignee && <td className="px-3 py-2.5 font-semibold text-body">{t.assigneeName ?? <span className="text-muted">—</span>}</td>}
                <td className="px-3 py-2.5">
                  <span className={`rounded-lg px-2 py-0.5 text-xs font-extrabold ${STATUS_CLS[t.status]}`}>{STATUS_LABEL[t.status]}</span>
                  {t.review && <span className="ml-1 text-xs font-bold text-muted">{REVIEW[t.review]}</span>}
                </td>
                <td className="whitespace-nowrap px-3 py-2.5 font-semibold text-body">{t.deadline ? new Date(t.deadline).toLocaleDateString('pt-PT', { day: '2-digit', month: 'short' }) : '—'}</td>
                <td className="px-3 py-2.5 text-right font-bold tabular-nums text-ink">{t.focusSeconds ? formatShort(t.focusSeconds) : '—'}</td>
                <td className="whitespace-nowrap px-4 py-2.5 font-semibold text-body">{date(t.createdAt)}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={7} className="p-8 text-center font-semibold text-muted">Sem tarefas aqui.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </Section>
  )
}
