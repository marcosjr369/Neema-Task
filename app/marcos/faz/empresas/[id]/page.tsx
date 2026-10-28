'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { BuildingsIcon, EyeSlashIcon } from '@phosphor-icons/react'
import Avatar from '../../../../components/ui/Avatar'
import { formatShort } from '../../../../lib/stats'
import { PRESENCE_CONFIG, ROLE_LABEL } from '../../../../types'
import type { OrgDetail } from '../../../../lib/server/panelDetail'
import { usePanel, usePanelFetch } from '../../_components/PanelShell'
import { BackLink, DetailState, InfoList, Section, Stat, TaskTable, WorkCharts } from '../../_components/Detail'
import { ago, date } from '../../_components/format'

/** Ficha de uma empresa: dados, funcionários, departamentos, presença, tarefas e estatísticas */
export default function PanelOrgPage() {
  const { id } = useParams<{ id: string }>()
  const { days } = usePanel()
  const { data: d, error, loading } = usePanelFetch<OrgDetail>(`/api/painel/empresas/${id}`)

  if (!d) return <div><BackLink href="/marcos/faz/empresas" label="Empresas" /><DetailState error={error} notFound="Esta empresa já não existe." /></div>
  const o = d.org
  const now = d.generatedAt
  const presentTotal = d.presenceNow.reduce((a, p) => a + p.count, 0)

  return (
    <div className={`space-y-4 transition-opacity ${loading ? 'opacity-60' : ''}`}>
      <BackLink href="/marcos/faz/empresas" label="Empresas" />

      <section className="card flex flex-wrap items-center gap-4 p-5">
        <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-accent-light text-accent-dark"><BuildingsIcon size={34} /></span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="truncate text-2xl font-black text-ink">{o.name}</h2>
            {o.hidden && (
              <span className="flex items-center gap-1 rounded-lg bg-snow px-2 py-0.5 text-xs font-extrabold text-muted"><EyeSlashIcon size={13} /> Fora do ranking</span>
            )}
          </div>
          <p className="font-semibold text-muted">{[o.sector, o.size ? `${o.size} pessoas` : ''].filter(Boolean).join(' · ') || 'Sem sector'}</p>
          <p className="mt-1 text-xs font-bold text-muted">
            Criada {date(o.createdAt)}
            {o.createdBy && <> por <Link href={`/marcos/faz/utilizadores/${o.createdBy.id}`} className="text-accent hover:underline">{o.createdBy.name}</Link></>}
          </p>
        </div>
      </section>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Stat label="Funcionários" value={String(d.totals.members)} hint={d.totals.pending ? `+${d.totals.pending} pendentes` : undefined} />
        <Stat label={`Activos (${days}d)`} value={String(d.period.activeMembers)} />
        <Stat label={`Foco (${days}d)`} value={formatShort(d.period.focusSeconds)} />
        <Stat label={`XP (${days}d)`} value={String(d.period.points)} />
        <Stat label="Tarefas por fazer" value={String(d.totals.tasksOpen)} hint={`${d.totals.tasksDone} concluídas no total`} />
        <Stat label="Em revisão" value={String(d.totals.awaitingReview)} />
      </div>

      <WorkCharts series={d.series} days={days} />

      <div className="grid gap-4 lg:grid-cols-3">
        <Section title="Dados da empresa">
          <InfoList
            rows={[
              ['Código de convite', <span key="c" className="font-mono tracking-widest">{o.inviteCode}</span>],
              ['Domínio de email', o.domain ? `@${o.domain}` : '—'],
              ['Departamentos', String(d.totals.departments)],
              ['Ranking geral', o.hidden ? 'Escondida' : 'Visível'],
            ]}
          />
        </Section>

        <Section title="Agora">
          {presentTotal ? (
            <ul className="space-y-2 p-4">
              {d.presenceNow.map(p => (
                <li key={p.status} className="flex items-center gap-3 text-sm font-extrabold">
                  <span className="h-3 w-3 rounded-full" style={{ background: PRESENCE_CONFIG[p.status].color }} />
                  <span className="flex-1 text-body">{PRESENCE_CONFIG[p.status].label}</span>
                  <span className="tabular-nums text-ink">{p.count}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="p-6 text-center text-sm font-semibold text-muted">Sem funcionários activos.</p>
          )}
        </Section>

        <Section title="Departamentos">
          {d.departments.length ? (
            <ul className="divide-y-2 divide-line">
              {d.departments.map(dep => (
                <li key={dep.id} className="flex items-center gap-3 px-4 py-2.5">
                  <span className="h-8 w-8 shrink-0 rounded-xl" style={{ background: dep.color }} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-black text-ink">{dep.name}</span>
                    <span className="block truncate text-xs font-semibold text-muted">
                      {dep.members} pessoa{dep.members === 1 ? '' : 's'}{dep.supervisors.length ? ` · sup. ${dep.supervisors.join(', ')}` : ''}
                    </span>
                  </span>
                  <span className="text-right text-xs font-bold text-muted">
                    <span className="block font-black text-ink">{dep.points} XP</span>
                    {formatShort(dep.focusSeconds)}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="p-6 text-center text-sm font-semibold text-muted">Sem departamentos.</p>
          )}
        </Section>
      </div>

      <Section title={`Funcionários (${d.members.length})`}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-sm">
            <thead className="bg-snow text-left text-xs font-extrabold uppercase tracking-wide text-muted">
              <tr>
                <th className="px-4 py-2.5">Pessoa</th>
                <th className="px-3 py-2.5">Papel</th>
                <th className="px-3 py-2.5">Departamento</th>
                <th className="px-3 py-2.5">Estado</th>
                <th className="px-3 py-2.5">Visto</th>
                <th className="px-3 py-2.5 text-right">Foco ({days}d)</th>
                <th className="px-3 py-2.5 text-right">Tarefas</th>
                <th className="px-4 py-2.5 text-right">XP</th>
              </tr>
            </thead>
            <tbody className="divide-y-2 divide-line">
              {d.members.map(m => (
                <tr key={m.id} className={m.status === 'pendente' ? 'opacity-60' : ''}>
                  <td className="px-4 py-2.5">
                    <span className="flex items-center gap-3">
                      <Avatar name={m.name || m.email} picture={m.picture} size={34} />
                      <span className="min-w-0">
                        {m.userId ? (
                          <Link href={`/marcos/faz/utilizadores/${m.userId}`} className="block max-w-[220px] truncate font-black text-ink hover:text-brand">{m.name}</Link>
                        ) : (
                          <span className="block max-w-[220px] truncate font-black text-ink">{m.name || m.email}</span>
                        )}
                        <span className="block max-w-[220px] truncate text-xs font-semibold text-muted">{m.jobTitle ? `${m.jobTitle} · ` : ''}{m.email}</span>
                      </span>
                    </span>
                  </td>
                  <td className="px-3 py-2.5 font-semibold text-body">{ROLE_LABEL[m.role]}</td>
                  <td className="px-3 py-2.5 font-semibold text-body">{m.department ?? '—'}</td>
                  <td className="px-3 py-2.5">
                    {m.status === 'pendente' ? (
                      <span className="rounded-lg bg-snow px-2 py-0.5 text-xs font-extrabold text-muted">Convite pendente</span>
                    ) : (
                      <span className="rounded-lg px-2 py-0.5 text-xs font-extrabold" style={{ background: PRESENCE_CONFIG[m.presence].light, color: PRESENCE_CONFIG[m.presence].color }}>
                        {PRESENCE_CONFIG[m.presence].label}
                      </span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 font-semibold text-body">{m.status === 'pendente' ? '—' : ago(m.lastSeen, now)}</td>
                  <td className="px-3 py-2.5 text-right font-bold tabular-nums text-ink">{formatShort(m.focusSeconds)}</td>
                  <td className="px-3 py-2.5 text-right font-bold tabular-nums text-ink">{m.tasksDone}</td>
                  <td className="px-4 py-2.5 text-right font-bold tabular-nums text-ink">{m.points}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <TaskTable tasks={d.tasks} showAssignee />
    </div>
  )
}
