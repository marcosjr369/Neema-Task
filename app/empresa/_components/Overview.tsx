'use client'

import Link from 'next/link'
import { useMemo, useState, type ReactNode } from 'react'
import { CaretRightIcon, CheckCircleIcon, ClipboardTextIcon, ClockCountdownIcon, ClockIcon, SealCheckIcon, UsersThreeIcon, WarningIcon } from '@phosphor-icons/react'
import { useMinute } from '../../context/AppContext'
import { useOrgRequired } from '../../context/OrgContext'
import { formatShort } from '../../lib/stats'
import { completedTime, isCompleted } from '../../lib/points'
import { PRESENCE_CONFIG, PRESENCE_STATUSES, type PresenceStatus } from '../../types'
import type { SectionId } from '../../lib/nav'
import Avatar from '../../components/ui/Avatar'
import { ColumnChart, LineChart, ChartCard, compact } from '../../components/ui/Charts'
import { overworkAlerts, PresenceBar, presenceTotals, RANGES, rangeFrom, useTeamActivity, type RangeId } from './shared'
import { DONE, FOCUS, hours, PRESENCE_SERIES, trendData } from './ActivityCharts'

/*
 * Visão geral da equipa: o que precisa de atenção, quatro números, uma tendência à escolha,
 * quem está agora e o resumo do período. Período e departamento mudam a página inteira.
 */

const BOX = 'rounded-2xl border border-line bg-white'
const PERIOD: Record<RangeId, string> = { hoje: 'hoje', '7d': 'nos últimos 7 dias', '30d': 'nos últimos 30 dias' }
const STATES = PRESENCE_STATUSES.filter(s => s !== 'offline') as Exclude<PresenceStatus, 'offline'>[]
const dotColor = (s: PresenceStatus) => (s === 'offline' ? '#C9C6D6' : PRESENCE_CONFIG[s].color)

type Metric = 'estado' | 'foco' | 'concluidas'
const METRICS: { id: Metric; label: string; title: string }[] = [
  { id: 'estado', label: 'Estados', title: 'Tempo por estado' },
  { id: 'foco', label: 'Foco', title: 'Horas focadas em tarefas' },
  { id: 'concluidas', label: 'Concluídas', title: 'Tarefas concluídas' },
]

function Segmented<T extends string>({ options, value, onChange, label }: { options: { id: T; label: string }[]; value: T; onChange: (v: T) => void; label: string }) {
  return (
    <div role="tablist" aria-label={label} className="inline-flex rounded-xl bg-snow p-1">
      {options.map(o => (
        <button key={o.id} role="tab" aria-selected={value === o.id} onClick={() => onChange(o.id)}
          className={`rounded-lg px-3 py-1.5 text-sm font-extrabold transition-colors cursor-pointer ${value === o.id ? 'bg-white text-ink shadow-[0_1px_3px_rgb(43_40_64/0.12)]' : 'text-muted hover:text-ink'}`}>
          {o.label}
        </button>
      ))}
    </div>
  )
}

function Stat({ icon, color, label, value, hint, onClick }: { icon: ReactNode; color: string; label: string; value: string; hint?: string; onClick?: () => void }) {
  const body = (
    <>
      <span className="flex items-center gap-1.5 text-sm font-bold text-muted"><span style={{ color }}>{icon}</span>{label}</span>
      <span className="mt-1 block text-2xl font-black tabular-nums text-ink">{value}</span>
      {hint && <span className="block truncate text-xs font-semibold text-muted">{hint}</span>}
    </>
  )
  return onClick
    ? <button onClick={onClick} className={`${BOX} p-4 text-left transition-colors hover:bg-snow cursor-pointer`}>{body}</button>
    : <div className={`${BOX} p-4`}>{body}</div>
}

function Section({ title, action, children, className = '' }: { title: string; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`${BOX} p-4 sm:p-5 ${className}`}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="font-black text-ink">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  )
}

type PendingItem = { id: string; href: string; title: string; who?: { name: string; picture?: string }; meta: string; danger?: boolean }
type PendingGroup = { key: string; title: string; icon: ReactNode; color: string; items: PendingItem[] }

const PER_GROUP = 3

/** "Atrasada há 3 dias" (ou há horas, se for de hoje) */
function lateText(deadline: string, now: number) {
  const ms = now - new Date(deadline).getTime()
  const days = Math.floor(ms / 86400000)
  if (days >= 1) return 'Atrasada há ' + days + (days === 1 ? ' dia' : ' dias')
  const h = Math.max(1, Math.floor(ms / 3600000))
  return 'Atrasada há ' + h + ' h'
}

/** O que espera por alguém: por rever, atrasadas e sinais de sobrecarga, agrupado por tipo */
function Pending({ groups, onAll }: { groups: PendingGroup[]; onAll: () => void }) {
  const shown = groups.filter(g => g.items.length > 0)
  const total = shown.reduce((a, g) => a + g.items.length, 0)
  const more = shown.some(g => g.items.length > PER_GROUP)
  return (
    <Section
      title="Pendentes"
      action={total > 0
        ? <span className="rounded-full bg-snow px-2.5 py-0.5 text-xs font-black tabular-nums text-body">{total}</span>
        : undefined}
    >
      {total === 0 ? (
        <p className="flex items-center gap-2 text-sm font-semibold text-muted">
          <SealCheckIcon size={18} weight="fill" className="text-accent" /> Nada por rever nem atrasado.
        </p>
      ) : (
        <div className="space-y-4">
          {shown.map(g => (
            <div key={g.key}>
              <p className="mb-1 flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wider text-muted">
                <span style={{ color: g.color }}>{g.icon}</span> {g.title} <span className="tabular-nums">· {g.items.length}</span>
              </p>
              <ul className="-mx-2">
                {g.items.slice(0, PER_GROUP).map(it => (
                  <li key={it.id}>
                    <Link href={it.href} className="flex items-center gap-3 rounded-xl px-2 py-1.5 transition-colors hover:bg-snow">
                      {it.who ? <Avatar name={it.who.name} picture={it.who.picture} size={28} /> : <span className="h-7 w-7 rounded-full bg-snow" />}
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-bold text-ink">{it.title}</span>
                        {it.who && it.who.name !== it.title && <span className="block truncate text-xs font-semibold text-muted">{it.who.name}</span>}
                      </span>
                      <span className={`shrink-0 text-xs font-bold ${it.danger ? 'text-danger' : 'text-muted'}`}>{it.meta}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
          {more && <button onClick={onAll} className="text-sm font-extrabold text-accent hover:underline cursor-pointer">Ver todas as tarefas</button>}
        </div>
      )}
    </Section>
  )
}

export default function Overview({ goTo }: { goTo: (section: SectionId) => void }) {
  const org = useOrgRequired()
  const now = useMinute()
  const [range, setRange] = useState<RangeId>('7d')
  const [dept, setDept] = useState<string>('all')
  const [metric, setMetric] = useState<Metric>('estado')
  const from = rangeFrom(range, now)
  const { sessions, segments } = useTeamActivity(from)

  // departamentos que esta pessoa pode ver
  const depts = useMemo(() => {
    const scope = org.scope
    return [...org.departments].filter(d => scope === 'all' || scope.has(d.id)).sort((a, b) => a.name.localeCompare(b.name))
  }, [org.departments, org.scope])

  const team = useMemo(() => {
    const scope = org.scope
    return org.members.filter(m =>
      m.status === 'activo' &&
      (scope === 'all' || m.id === org.me.id || (!!m.departmentId && scope.has(m.departmentId))) &&
      (dept === 'all' || m.departmentId === dept))
  }, [org.members, org.scope, org.me.id, dept])

  const ids = useMemo(() => new Set(team.map(m => m.id)), [team])
  const tasks = useMemo(() => org.teamTasks.filter(t => !!t.assigneeId && ids.has(t.assigneeId)), [org.teamTasks, ids])
  const mySessions = useMemo(() => sessions.filter(s => !!s.memberId && ids.has(s.memberId)), [sessions, ids])
  const mySegments = useMemo(() => segments.filter(s => ids.has(s.memberId)), [segments, ids])

  /* números */
  const online = team.filter(m => m.presence !== 'offline')
  const focused = mySessions.reduce((a, s) => (s.start >= from ? a + s.seconds : a), 0)
  const doneInPeriod = tasks.filter(t => isCompleted(t) && (completedTime(t) ?? 0) >= from)
  const pending = tasks.filter(t => t.status === 'done' && t.review?.status === 'pending')
  const overdue = tasks.filter(t => t.deadline && t.status !== 'done' && new Date(t.deadline).getTime() < now)
  const strain = team.map(m => ({ m, list: overworkAlerts(mySegments, m.id, now) })).filter(x => x.list.length > 0)

  /* tendência escolhida */
  const trend = trendData(range, from, now, mySessions, mySegments, tasks)
  const chosen = METRICS.find(m => m.id === metric)!
  // só os estados com tempo no período (cada estado mantém sempre a sua cor)
  const usedStates = PRESENCE_SERIES.filter(x => trend.presence.some(p => (p.values[x.key] ?? 0) > 0))
  const stateSeries = usedStates.length ? usedStates : PRESENCE_SERIES

  /* resumo do período */
  const totals = presenceTotals(mySegments, from, now + 1, now)
  const totalTime = STATES.reduce((a, s) => a + (totals[s] ?? 0), 0)
  const taskRows = [
    { label: 'A fazer', n: tasks.filter(t => t.status === 'todo').length, color: '#A3A0B8' },
    { label: 'Em progresso', n: tasks.filter(t => t.status === 'doing').length, color: '#7B61FF' },
    { label: 'Por rever', n: pending.length, color: '#FF8A3D' },
    { label: 'Concluídas', n: doneInPeriod.length, color: '#4C7DFF' },
  ]

  const people = [...team].sort((a, b) => Number(b.presence !== 'offline') - Number(a.presence !== 'offline') || a.name.localeCompare(b.name))
  const pendingGroups: PendingGroup[] = [
    {
      key: 'rever', title: 'Por rever', icon: <ClipboardTextIcon size={14} weight="bold" />, color: '#DB6A1F',
      items: pending.map(t => ({ id: t.id, href: '/tarefas/' + t.id, title: t.title, who: org.memberById(t.assigneeId), meta: 'Aguarda aprovação' })),
    },
    {
      key: 'atraso', title: 'Atrasadas', icon: <ClockCountdownIcon size={14} weight="bold" />, color: '#CF3540',
      items: overdue.map(t => ({ id: t.id, href: '/tarefas/' + t.id, title: t.title, who: org.memberById(t.assigneeId), meta: lateText(t.deadline!, now), danger: true })),
    },
    {
      key: 'equilibrio', title: 'Equilíbrio', icon: <WarningIcon size={14} weight="bold" />, color: '#CF3540',
      items: strain.map(({ m, list }) => ({ id: m.id, href: '/empresa/membro/' + m.id, title: m.name, who: m, meta: list.join(' · '), danger: true })),
    },
  ]

  return (
    <div className="space-y-5">
      {/* opções */}
      <div className="flex flex-wrap items-center gap-2">
        <Segmented label="Período" options={RANGES} value={range} onChange={setRange} />
        {depts.length > 0 && (
          <select value={dept} onChange={e => setDept(e.target.value)} aria-label="Departamento"
            className="rounded-xl border border-line bg-white px-3 py-2 text-sm font-extrabold text-body outline-none transition-colors hover:bg-snow focus:border-accent cursor-pointer">
            <option value="all">Toda a equipa</option>
            {depts.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        )}
        <span className="ml-auto text-xs font-bold text-muted">Actualiza a cada minuto</span>
      </div>

      {/* números */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat icon={<UsersThreeIcon size={16} weight="bold" />} color="#12B5A6" label="Online agora" value={`${online.length}/${team.length}`}
          hint={online.length ? online.slice(0, 3).map(m => m.name.split(' ')[0]).join(', ') + (online.length > 3 ? '…' : '') : 'Ninguém online'} />
        <Stat icon={<ClockIcon size={16} weight="bold" />} color="#7B61FF" label="Horas focadas" value={formatShort(focused)} hint={PERIOD[range]} />
        <Stat icon={<CheckCircleIcon size={16} weight="bold" />} color="#4C7DFF" label="Concluídas" value={String(doneInPeriod.length)} hint={PERIOD[range]} />
        <Stat icon={<ClipboardTextIcon size={16} weight="bold" />} color="#FF8A3D" label="Por rever" value={String(pending.length)}
          hint={overdue.length ? `${overdue.length} em atraso` : 'nenhuma em atraso'} onClick={() => goTo('tarefas')} />
      </div>

      {/* tendência à escolha */}
      <ChartCard
        className={BOX}
        title={chosen.title}
        subtitle={trend.subtitle}
        firstCol={trend.unit}
        series={metric === 'estado' ? stateSeries : metric === 'foco' ? [FOCUS] : DONE}
        points={metric === 'estado' ? trend.presence : metric === 'foco' ? trend.focus : trend.done}
        format={metric === 'concluidas' ? v => String(Math.round(v)) : hours}
        actions={<Segmented label="O que mostrar" options={METRICS} value={metric} onChange={setMetric} />}
      >
        <div key={metric} className="animate-fade-in">
          {metric === 'estado' && <ColumnChart points={trend.presence} series={stateSeries} format={hours} axisFormat={hours} />}
          {metric === 'foco' && <LineChart points={trend.focus} series={FOCUS} format={hours} axisFormat={hours} />}
          {metric === 'concluidas' && <ColumnChart points={trend.done} series={DONE} format={v => String(Math.round(v))} axisFormat={compact} />}
        </div>
      </ChartCard>

      <div className="grid gap-5 lg:grid-cols-2 lg:items-start">
        {/* agora */}
        <Section title="Agora" action={team.length > 8 ? <button onClick={() => goTo('pessoas')} className="text-sm font-extrabold text-accent hover:underline cursor-pointer">Ver todos</button> : undefined}>
          {team.length === 0 ? (
            <p className="text-sm font-semibold text-muted">Sem pessoas neste departamento.</p>
          ) : (
            <ul className="-mx-2">
              {people.slice(0, 8).map(m => (
                <li key={m.id}>
                  <Link href={`/empresa/membro/${m.id}`} className="flex items-center gap-3 rounded-xl px-2 py-2 transition-colors hover:bg-snow">
                    <Avatar name={m.name} picture={m.picture} size={32} presence={m.presence} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-bold text-ink">{m.name}</span>
                      <span className="block truncate text-xs font-semibold text-muted">{org.deptById(m.departmentId)?.name ?? m.jobTitle ?? '—'}</span>
                    </span>
                    <span className="flex shrink-0 items-center gap-1.5 text-xs font-bold text-body">
                      <span className="h-2 w-2 rounded-full" style={{ background: dotColor(m.presence) }} />
                      {PRESENCE_CONFIG[m.presence].label}
                    </span>
                    <CaretRightIcon size={14} className="shrink-0 text-muted" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <div className="space-y-5">
          <Pending groups={pendingGroups} onAll={() => goTo('tarefas')} />

        {/* resumo do período */}
        <Section title={`Resumo ${range === 'hoje' ? 'de hoje' : `dos últimos ${range === '7d' ? '7' : '30'} dias`}`}
          action={<button onClick={() => goTo('relatorios')} className="text-sm font-extrabold text-accent hover:underline cursor-pointer">Relatórios</button>}>
          <p className="text-xs font-extrabold uppercase tracking-wider text-muted">Tempo da equipa · {formatShort(totalTime)}</p>
          <div className="mt-2"><PresenceBar totals={totals} height={10} /></div>
          <ul className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5">
            {STATES.filter(s => (totals[s] ?? 0) > 0).map(s => (
              <li key={s} className="flex items-center gap-2 text-sm">
                <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: PRESENCE_CONFIG[s].color }} />
                <span className="min-w-0 flex-1 truncate font-semibold text-body">{PRESENCE_CONFIG[s].label}</span>
                <span className="font-bold tabular-nums text-ink">{formatShort(totals[s] ?? 0)}</span>
              </li>
            ))}
            {totalTime === 0 && <li className="col-span-2 text-sm font-semibold text-muted">Sem registo de presença neste período.</li>}
          </ul>

          <p className="mt-5 text-xs font-extrabold uppercase tracking-wider text-muted">Tarefas</p>
          <ul className="mt-2 grid grid-cols-4 gap-2">
            {taskRows.map(r => (
              <li key={r.label} className="rounded-xl bg-snow px-2 py-2 text-center">
                <span className="block text-lg font-black tabular-nums text-ink">{r.n}</span>
                <span className="flex items-center justify-center gap-1 text-[11px] font-bold text-muted">
                  <span className="h-1.5 w-1.5 rounded-full" style={{ background: r.color }} />{r.label}
                </span>
              </li>
            ))}
          </ul>
        </Section>
        </div>
      </div>
    </div>
  )
}
