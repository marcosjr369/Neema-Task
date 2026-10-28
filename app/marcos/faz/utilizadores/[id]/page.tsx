'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { BuildingsIcon, CheckCircleIcon, ProhibitIcon, TrashIcon } from '@phosphor-icons/react'
import Avatar from '../../../../components/ui/Avatar'
import { formatShort } from '../../../../lib/stats'
import { CATEGORY_CONFIG, PRESENCE_CONFIG, ROLE_LABEL } from '../../../../types'
import type { UserDetail } from '../../../../lib/server/panelDetail'
import { usePanel, usePanelFetch } from '../../_components/PanelShell'
import { BackLink, DetailState, InfoList, Section, Stat, TaskTable, WorkCharts } from '../../_components/Detail'
import { ago, date, dateTime, TYPE } from '../../_components/format'

const VISIBILITY = { nome: 'Nome completo', iniciais: 'Só iniciais', oculto: 'Escondido' } as const

/** Ficha de um utilizador: dados, estatísticas, empresas, tarefas e actividade recente */
export default function PanelUserPage() {
  const { id } = useParams<{ id: string }>()
  const { days, ask } = usePanel()
  const { data: d, error, loading } = usePanelFetch<UserDetail>(`/api/painel/utilizadores/${id}`)

  if (!d) return <div><BackLink href="/marcos/faz/utilizadores" label="Utilizadores" /><DetailState error={error} notFound="Este utilizador já não existe." /></div>
  const u = d.user
  const now = d.generatedAt
  const asTarget = { id: u.id, name: u.name, email: u.email, disabled: u.disabled, orgs: d.memberships.map(m => ({ id: m.orgId, name: m.orgName, role: m.role })) }
  const totalCat = d.categories.reduce((a, c) => a + c.seconds, 0)

  return (
    <div className={`space-y-4 transition-opacity ${loading ? 'opacity-60' : ''}`}>
      <BackLink href="/marcos/faz/utilizadores" label="Utilizadores" />

      {/* cabeçalho */}
      <section className={`card flex flex-wrap items-center gap-4 p-5 ${u.disabled ? 'border-danger/40 bg-danger-light/40' : ''}`}>
        <Avatar name={u.name} picture={u.picture} size={72} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="truncate text-2xl font-black text-ink">{u.name}</h2>
            <span className={`rounded-lg px-2 py-0.5 text-xs font-extrabold ${TYPE[u.type].cls}`}>{TYPE[u.type].label}</span>
            {u.disabled && <span className="rounded-lg bg-danger px-2 py-0.5 text-xs font-extrabold text-white">Desactivado</span>}
          </div>
          <p className="truncate font-semibold text-muted">{u.email}</p>
          <p className="mt-1 text-xs font-bold text-muted">Registo {date(u.createdAt)} · Última actividade {ago(d.lastActive, now)}</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => ask(asTarget, u.disabled ? 'enable' : 'disable')}
            className={`chip ${u.disabled ? 'border-accent! text-accent-dark!' : 'border-danger/40! text-danger!'}`}
          >
            {u.disabled ? <><CheckCircleIcon size={16} /> Reactivar</> : <><ProhibitIcon size={16} /> Desactivar</>}
          </button>
          <button onClick={() => ask(asTarget, 'delete')} className="chip border-danger/40! text-danger!">
            <TrashIcon size={16} /> Eliminar
          </button>
        </div>
      </section>

      {/* números de sempre e do período */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Stat label="Nível" value={String(d.allTime.level)} hint={`${d.allTime.xp} XP no total`} />
        <Stat label={`XP (${days}d)`} value={String(d.period.points)} />
        <Stat label="Foco total" value={formatShort(d.allTime.focusSeconds)} hint={`${formatShort(d.period.focusSeconds)} em ${days} dias`} />
        <Stat label="Tarefas feitas" value={String(d.allTime.tasksDone)} hint={`${d.period.tasksDone} em ${days} dias`} />
        <Stat label="Sequência" value={`${d.allTime.streak} d`} hint={`Melhor: ${d.allTime.bestStreak} dias`} />
        <Stat label="Dias activos" value={`${d.period.activeDays}/${days}`} />
      </div>

      <WorkCharts series={d.series} days={days} />

      <div className="grid gap-4 lg:grid-cols-3">
        <Section title="Dados da conta">
          <InfoList
            rows={[
              ['Email confirmado', u.emailVerified ? 'Sim' : 'Não'],
              ['Meta diária', `${u.dailyGoalMinutes} min`],
              ['No ranking', VISIBILITY[u.rankingVisibility]],
              ['Fuso horário', u.timezone ?? '—'],
              ['Notificações push', u.pushDevices ? `${u.pushDevices} dispositivo${u.pushDevices === 1 ? '' : 's'}` : 'Desligadas'],
              ...(u.disabledAt ? [['Desactivado em', dateTime(u.disabledAt)] as [string, string]] : []),
            ]}
          />
        </Section>

        <Section title={`Foco por categoria (${days}d)`}>
          {d.categories.length ? (
            <ul className="space-y-3 p-4">
              {d.categories.map(c => (
                <li key={c.category}>
                  <div className="flex justify-between text-sm font-extrabold">
                    <span className="text-body">{CATEGORY_CONFIG[c.category].label}</span>
                    <span className="tabular-nums text-ink">{formatShort(c.seconds)}</span>
                  </div>
                  <div className="mt-1 h-2 overflow-hidden rounded-full bg-snow">
                    <div className="h-full rounded-full" style={{ width: `${(c.seconds / totalCat) * 100}%`, background: CATEGORY_CONFIG[c.category].color }} />
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="p-6 text-center text-sm font-semibold text-muted">Sem foco neste período.</p>
          )}
        </Section>

        <Section title="Empresas">
          {d.memberships.length ? (
            <ul className="divide-y-2 divide-line">
              {d.memberships.map(m => (
                <li key={m.orgId} className="flex items-center gap-3 px-4 py-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent-light text-accent-dark"><BuildingsIcon size={20} /></span>
                  <span className="min-w-0 flex-1">
                    <Link href={`/marcos/faz/empresas/${m.orgId}`} className="block truncate font-black text-ink hover:text-brand">{m.orgName}</Link>
                    <span className="block truncate text-xs font-semibold text-muted">
                      {ROLE_LABEL[m.role]}{m.department ? ` · ${m.department}` : ''}{m.status === 'pendente' ? ' · pendente' : m.joinedAt ? ` · desde ${date(m.joinedAt)}` : ''}
                    </span>
                  </span>
                  <span className="rounded-lg px-2 py-0.5 text-xs font-extrabold" style={{ background: PRESENCE_CONFIG[m.presence].light, color: PRESENCE_CONFIG[m.presence].color }}>
                    {PRESENCE_CONFIG[m.presence].label}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="p-6 text-center text-sm font-semibold text-muted">{u.type === 'personal' ? 'Conta pessoal: não pertence a empresas.' : 'Sem empresa.'}</p>
          )}
        </Section>
      </div>

      <TaskTable tasks={d.tasks} showOrg={d.memberships.length > 0} />

      <Section title="Sessões de foco recentes">
        {d.recentSessions.length ? (
          <ul className="divide-y-2 divide-line">
            {d.recentSessions.map(s => (
              <li key={s.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                <span className="w-32 shrink-0 font-bold text-muted">{dateTime(s.start)}</span>
                <span className="min-w-0 flex-1 truncate font-extrabold text-ink">{s.taskTitle}</span>
                {s.orgName && <span className="hidden truncate text-xs font-bold text-muted sm:block">{s.orgName}</span>}
                <span className="font-black tabular-nums text-ink">{formatShort(s.seconds)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="p-6 text-center text-sm font-semibold text-muted">Ainda sem sessões de foco.</p>
        )}
      </Section>
    </div>
  )
}
