'use client'

import Link from 'next/link'
import { CheckCircleIcon, ClipboardTextIcon, ClockCountdownIcon, ClockIcon, UsersThreeIcon, WarningIcon } from '@phosphor-icons/react'
import { useApp } from '../../context/AppContext'
import { useOrgRequired } from '../../context/OrgContext'
import { formatDeadline, formatDuration, startOfDay } from '../../lib/stats'
import { isCompleted } from '../../lib/points'
import { PRESENCE_CONFIG, PRESENCE_STATUSES } from '../../types'
import Avatar from '../../components/ui/Avatar'
import { overworkAlerts, PresenceBar, presenceTotals, useTeamActivity } from './shared'
import { PresenceGlyph } from '../../components/ui/icons'

function Kpi({ icon, value, label, color, href }: { icon: React.ReactNode; value: string; label: string; color: string; href?: string }) {
  const body = (
    <>
      <span style={{ color }}>{icon}</span>
      <div className="min-w-0">
        <div className="truncate text-xl font-black leading-tight text-ink">{value}</div>
        <div className="truncate text-xs font-bold text-muted">{label}</div>
      </div>
    </>
  )
  return href ? (
    <Link href={href} className="card flex items-center gap-3 border-b-4 p-3 hover:bg-snow">{body}</Link>
  ) : (
    <div className="card flex items-center gap-3 p-3">{body}</div>
  )
}

export default function Overview({ goTo }: { goTo: (tab: string) => void }) {
  const org = useOrgRequired()
  const { now } = useApp()
  const dayStart = startOfDay(now)
  const { sessions, segments } = useTeamActivity(dayStart)

  const scope = org.scope
  const team = org.members.filter(
    m => m.status === 'activo' && (scope === 'all' || m.id === org.me.id || (!!m.departmentId && scope.has(m.departmentId))),
  )
  const online = team.filter(m => m.presence !== 'offline')
  const byStatus = PRESENCE_STATUSES.filter(s => s !== 'offline').map(s => ({ s, n: team.filter(m => m.presence === s).length }))
  const workedToday = sessions.reduce((a, s) => a + s.seconds, 0)
  const pending = org.teamTasks.filter(t => t.status === 'done' && t.review?.status === 'pending')
  const overdue = org.teamTasks.filter(t => t.deadline && t.status !== 'done' && new Date(t.deadline).getTime() < now)
  const doneToday = org.teamTasks.filter(t => isCompleted(t) && (t.review?.at ?? t.completedAt ?? 0) >= dayStart).length
  const alerts = team
    .map(m => ({ m, list: overworkAlerts(segments, m.id, now) }))
    .filter(x => x.list.length > 0)
  const totals = presenceTotals(segments, dayStart, now + 1, now)

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi icon={<UsersThreeIcon size={26} />} color="#12B5A6" value={`${online.length}/${team.length}`} label="Online agora" />
        <Kpi icon={<ClockIcon size={26} />} color="#7B61FF" value={formatDuration(workedToday)} label="Em tarefas hoje" />
        <Kpi icon={<ClipboardTextIcon size={26} />} color="#FF8A3D" value={String(pending.length)} label="À espera de revisão" />
        <Kpi icon={<CheckCircleIcon size={26} />} color="#4C7DFF" value={String(doneToday)} label="Concluídas hoje" />
      </div>

      {alerts.length > 0 && (
        <section className="card border-danger/40 bg-danger-light p-4">
          <h2 className="flex items-center gap-2 font-black text-danger-dark">
            <WarningIcon size={20} /> Atenção ao equilíbrio
          </h2>
          <ul className="mt-2 space-y-1 text-sm font-bold text-body">
            {alerts.map(({ m, list }) => (
              <li key={m.id}>
                <Link href={`/empresa/membro/${m.id}`} className="underline">{m.name}</Link>: {list.join(' · ')}
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="space-y-6 lg:grid lg:grid-cols-2 lg:items-start lg:gap-6 lg:space-y-0">
        <section className="card p-4">
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="text-lg font-black text-ink">Agora</h2>
            <span className="text-xs font-bold text-muted">actualiza a cada minuto</span>
          </div>
          <div className="mb-4 flex flex-wrap gap-2">
            {byStatus.filter(x => x.n > 0).map(({ s, n }) => (
              <span key={s} className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-extrabold" style={{ background: PRESENCE_CONFIG[s].light, color: '#2B2840' }}>
                <PresenceGlyph status={s} size={14} weight="bold" /> {n} {PRESENCE_CONFIG[s].label.toLowerCase()}
              </span>
            ))}
            {online.length === 0 && <span className="text-sm font-semibold text-muted">Ninguém online neste momento.</span>}
          </div>
          <ul className="divide-y-2 divide-line">
            {[...team].sort((a, b) => Number(b.presence !== 'offline') - Number(a.presence !== 'offline') || a.name.localeCompare(b.name)).map(m => (
              <li key={m.id}>
                <Link href={`/empresa/membro/${m.id}`} className="flex items-center gap-3 py-2.5 hover:bg-snow">
                  <Avatar name={m.name} picture={m.picture} size={36} presence={m.presence} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-bold text-ink">{m.name}</span>
                    <span className="block truncate text-xs font-semibold text-muted">{org.deptById(m.departmentId)?.name ?? m.jobTitle ?? '—'}</span>
                  </span>
                  <span className="text-xs font-extrabold" style={{ color: PRESENCE_CONFIG[m.presence].color === '#D3D0E0' ? '#A3A0B8' : PRESENCE_CONFIG[m.presence].color }}>
                    {PRESENCE_CONFIG[m.presence].label}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <div className="space-y-6">
          <section className="card p-4">
            <h2 className="mb-3 text-lg font-black text-ink">Tempo da equipa hoje</h2>
            <PresenceBar totals={totals} height={16} />
            <ul className="mt-3 grid grid-cols-2 gap-2 text-sm">
              {PRESENCE_STATUSES.filter(s => totals[s]).map(s => (
                <li key={s} className="flex items-center gap-2 font-bold text-body">
                  <span className="h-3 w-3 rounded-sm" style={{ background: PRESENCE_CONFIG[s].color }} />
                  {PRESENCE_CONFIG[s].label}
                  <span className="ml-auto text-ink">{formatDuration(totals[s] ?? 0)}</span>
                </li>
              ))}
            </ul>
            <button onClick={() => goTo('relatorios')} className="mt-4 text-sm font-extrabold uppercase tracking-wide text-accent cursor-pointer">
              Ver relatórios →
            </button>
          </section>

          <section className="card p-4">
            <div className="mb-3 flex items-baseline justify-between">
              <h2 className="text-lg font-black text-ink">Por rever</h2>
              {pending.length > 0 && (
                <button onClick={() => goTo('tarefas')} className="text-sm font-extrabold text-accent cursor-pointer">Ver todas</button>
              )}
            </div>
            {pending.length === 0 ? (
              <p className="text-sm font-semibold text-muted">Nenhuma tarefa à espera de aprovação.</p>
            ) : (
              <ul className="space-y-2">
                {pending.slice(0, 5).map(t => (
                  <li key={t.id}>
                    <Link href={`/tarefas/${t.id}`} className="flex items-center gap-3 rounded-xl p-2 hover:bg-snow">
                      <Avatar name={org.memberById(t.assigneeId)?.name ?? '?'} picture={org.memberById(t.assigneeId)?.picture} size={32} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-bold text-ink">{t.title}</span>
                        <span className="block text-xs font-semibold text-muted">
                          {org.memberById(t.assigneeId)?.name} · {t.attachments?.length ?? 0} anexo{t.attachments?.length === 1 ? '' : 's'}
                        </span>
                      </span>
                      <span className="rounded-lg bg-warm-light px-2 py-1 text-xs font-extrabold text-warm-dark">Rever</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {overdue.length > 0 && (
            <section className="card p-4">
              <h2 className="mb-3 flex items-center gap-2 text-lg font-black text-ink">
                <ClockCountdownIcon size={20} className="text-danger" /> Atrasadas
              </h2>
              <ul className="space-y-2">
                {overdue.slice(0, 5).map(t => (
                  <li key={t.id}>
                    <Link href={`/tarefas/${t.id}`} className="flex items-center gap-3 rounded-xl p-2 hover:bg-snow">
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-bold text-ink">{t.title}</span>
                        <span className="block text-xs font-semibold text-muted">{org.memberById(t.assigneeId)?.name}</span>
                      </span>
                      <span className="text-xs font-extrabold text-danger">{formatDeadline(t.deadline!, now).text}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </div>
    </div>
  )
}
