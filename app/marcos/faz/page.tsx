'use client'

import Link from 'next/link'
import { useMemo } from 'react'
import { ArrowRightIcon, BuildingsIcon, PulseIcon, TimerIcon, UserPlusIcon, UsersThreeIcon, type Icon } from '@phosphor-icons/react'
import Avatar from '../../components/ui/Avatar'
import { formatShort } from '../../lib/stats'
import type { PanelOverview } from '../../lib/server/panelStats'
import { ChartCard, ColumnChart, LineChart, compact, type Point, type Series } from './_components/Charts'
import { usePanel } from './_components/PanelShell'
import { dayLabel } from './_components/format'

/* Visão geral: indicadores, gráficos por dia e resumos (registos recentes, empresas mais activas) */

const BRAND = '#7B61FF'
const TEAL = '#0D9488'

const SIGNUPS: Series[] = [
  { key: 'personal', name: 'Pessoais', color: BRAND },
  { key: 'business', name: 'Empresa', color: TEAL },
]
const ACTIVE: Series = { key: 'active', name: 'Utilizadores activos', color: BRAND }
const FOCUS: Series[] = [{ key: 'hours', name: 'Horas de foco', color: BRAND }]
const TASKS: Series[] = [{ key: 'tasks', name: 'Tarefas concluídas', color: TEAL }]

function Stat({ label, value, hint, icon: I, tint }: { label: string; value: string; hint?: string; icon: Icon; tint: string }) {
  return (
    <div className="card flex flex-col p-4">
      <div className="flex items-center justify-between">
        <p className="text-xs font-extrabold uppercase tracking-wide text-muted">{label}</p>
        <span className="flex h-8 w-8 items-center justify-center rounded-xl" style={{ background: `${tint}1f`, color: tint }}>
          <I size={18} weight="fill" />
        </span>
      </div>
      <p className="mt-2 text-3xl font-black tabular-nums text-ink">{value}</p>
      {hint && <p className="mt-auto pt-1 text-xs font-semibold text-muted">{hint}</p>}
    </div>
  )
}

/** Número principal: total de utilizadores e a composição por tipo de conta */
function UsersHero({ t }: { t: PanelOverview['totals'] }) {
  const parts = [
    { label: 'Pessoais', value: t.personal, color: BRAND },
    { label: 'Empresa', value: t.business, color: TEAL },
    { label: 'Por escolher', value: t.none, color: '#D3D0E0' },
  ].filter(p => p.value > 0)
  return (
    <div className="card flex flex-col p-4">
      <div className="flex items-center justify-between">
        <p className="text-xs font-extrabold uppercase tracking-wide text-muted">Utilizadores</p>
        <span className="flex h-8 w-8 items-center justify-center rounded-xl" style={{ background: `${BRAND}1f`, color: BRAND }}>
          <UsersThreeIcon size={18} weight="fill" />
        </span>
      </div>
      <p className="mt-2 text-3xl font-black tabular-nums text-ink">{compact(t.users)}</p>
      {/* composição por tipo de conta: 2px de intervalo entre segmentos */}
      <div className="mt-auto flex h-2 gap-0.5 overflow-hidden rounded-full bg-snow" title={parts.map(p => `${p.label}: ${p.value}`).join(' · ')}>
        {parts.map(p => <span key={p.label} className="h-full" style={{ width: `${(p.value / Math.max(1, t.users)) * 100}%`, background: p.color }} />)}
      </div>
      <p className="pt-1.5 text-xs font-semibold text-muted">
        {t.personal} pessoais · {t.business} empresa{t.none ? ` · ${t.none} por escolher` : ''}{t.disabled ? ` · ${t.disabled} desact.` : ''}
      </p>
    </div>
  )
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="pt-2 text-sm font-extrabold uppercase tracking-wider text-muted">{children}</h2>
}

function SummaryCard({ title, href, children }: { title: string; href: string; children: React.ReactNode }) {
  return (
    <section className="card overflow-hidden">
      <div className="flex items-center justify-between border-b-2 border-line px-4 py-3">
        <h3 className="font-black text-ink">{title}</h3>
        <Link href={href} className="flex shrink-0 items-center gap-1 whitespace-nowrap text-xs font-extrabold uppercase tracking-wide text-accent hover:underline">
          Ver tudo <ArrowRightIcon size={14} />
        </Link>
      </div>
      <ul className="divide-y-2 divide-line">{children}</ul>
    </section>
  )
}

export default function PanelOverviewPage() {
  const { data, days } = usePanel()

  const points = useMemo(() => {
    if (!data) return null
    const mk = (values: (d: PanelOverview['series'][number]) => Record<string, number>): Point[] =>
      data.series.map(d => ({ label: dayLabel(d.day), title: dayLabel(d.day, true), values: values(d) }))
    return {
      signups: mk(d => ({ personal: d.signupsPersonal, business: d.signupsBusiness })),
      active: mk(d => ({ active: d.activeUsers })),
      focus: mk(d => ({ hours: Math.round((d.focusSeconds / 3600) * 10) / 10 })),
      tasks: mk(d => ({ tasks: d.tasksDone })),
    }
  }, [data])

  if (!data || !points) return null
  const t = data.totals
  const hours = (v: number) => `${compact(v)} h`

  return (
    <div className="space-y-4">
      <div className="grid auto-rows-fr grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <UsersHero t={t} />
        <Stat label="Activos hoje" value={compact(t.activeToday)} hint={`${t.active7} em 7 dias · ${t.active30} em 30`} icon={PulseIcon} tint={TEAL} />
        <Stat label="Empresas" value={compact(t.orgs)} hint={`${t.members} funcionários activos`} icon={BuildingsIcon} tint="#4C7DFF" />
        <Stat label="Registos" value={compact(data.period.signups)} hint={`${data.period.deletions} eliminados · ${days} dias`} icon={UserPlusIcon} tint={BRAND} />
        <Stat label="Foco" value={formatShort(data.period.focusSeconds)} hint={`${data.period.tasksDone} tarefas · ${days} dias`} icon={TimerIcon} tint="#F2545B" />
      </div>

      <SectionTitle>Crescimento e actividade</SectionTitle>
      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard title="Novos registos por dia" subtitle="Por tipo de conta" series={SIGNUPS} points={points.signups}>
          <ColumnChart points={points.signups} series={SIGNUPS} />
        </ChartCard>
        <ChartCard title="Utilizadores activos por dia" subtitle={`Média de ${data.period.avgActive} por dia`} series={[ACTIVE]} points={points.active}>
          <LineChart points={points.active} series={ACTIVE} />
        </ChartCard>
      </div>

      <SectionTitle>Trabalho feito</SectionTitle>
      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard title="Horas de foco por dia" subtitle="Contas pessoais e empresas" series={FOCUS} points={points.focus} format={hours}>
          <ColumnChart points={points.focus} series={FOCUS} format={hours} />
        </ChartCard>
        <ChartCard title="Tarefas concluídas por dia" series={TASKS} points={points.tasks}>
          <ColumnChart points={points.tasks} series={TASKS} />
        </ChartCard>
      </div>

      <SectionTitle>Destaques</SectionTitle>
      <div className="grid gap-4 lg:grid-cols-2">
        <SummaryCard title="Registos recentes" href="/marcos/faz/utilizadores">
          {data.users.slice(0, 5).map(u => (
            <li key={u.id} className="flex items-center gap-3 px-4 py-2.5">
              <Avatar name={u.name} picture={u.picture} size={32} />
              <span className="min-w-0 flex-1">
                <Link href={`/marcos/faz/utilizadores/${u.id}`} className="block truncate font-black text-ink hover:text-brand">{u.name}</Link>
                <span className="block truncate text-xs font-semibold text-muted">{u.email}</span>
              </span>
              <span className="text-xs font-bold text-muted">{new Date(u.createdAt).toLocaleDateString('pt-PT', { day: 'numeric', month: 'short' })}</span>
            </li>
          ))}
          {data.users.length === 0 && <li className="p-6 text-center text-sm font-semibold text-muted">Ainda sem utilizadores.</li>}
        </SummaryCard>
        <SummaryCard title={`Empresas mais activas (${days} dias)`} href="/marcos/faz/empresas">
          {data.orgs.slice(0, 5).map(o => (
            <li key={o.id} className="flex items-center gap-3 px-4 py-2.5">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-accent-light text-accent-dark"><BuildingsIcon size={18} /></span>
              <span className="min-w-0 flex-1">
                <Link href={`/marcos/faz/empresas/${o.id}`} className="block truncate font-black text-ink hover:text-brand">{o.name}</Link>
                <span className="block truncate text-xs font-semibold text-muted">{o.members} pessoa{o.members === 1 ? '' : 's'} · {formatShort(o.focusSeconds)} de foco</span>
              </span>
              <span className="font-black tabular-nums text-ink">{o.points} XP</span>
            </li>
          ))}
          {data.orgs.length === 0 && <li className="p-6 text-center text-sm font-semibold text-muted">Ainda sem empresas.</li>}
        </SummaryCard>
      </div>
    </div>
  )
}
