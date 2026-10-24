'use client'

import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { useState } from 'react'
import { CaretLeftIcon, EnvelopeSimpleIcon, PhoneIcon } from '@phosphor-icons/react'
import { useApp } from '../../../context/AppContext'
import { useOrg } from '../../../context/OrgContext'
import { completedTime, isCompleted, rangeStats } from '../../../lib/points'
import { formatDuration, startOfDay } from '../../../lib/stats'
import { PRESENCE_CONFIG, PRESENCE_STATUSES, ROLE_LABEL } from '../../../types'
import Avatar from '../../../components/ui/Avatar'
import Mascot from '../../../components/ui/Mascot'
import { ReviewBadge } from '../../../components/tasks/ReviewBadge'
import { DayTimeline, PresenceBar, PresenceLegend, presenceTotals, RANGES, rangeFrom, useTeamActivity, type RangeId } from '../../_components/shared'
import { PresenceGlyph } from '../../../components/ui/icons'

function Report({ memberId }: { memberId: string }) {
  const org = useOrg()!
  const { now, tasks: myTasks } = useApp()
  const [range, setRange] = useState<RangeId>('7d')
  const from = rangeFrom(range, now)
  const { sessions, segments, loaded } = useTeamActivity(from, undefined, memberId)
  const m = org.memberById(memberId)!
  const dept = org.deptById(m.departmentId)
  const isMe = m.id === org.me.id
  const tasks = (isMe ? myTasks : org.teamTasks).filter(t => t.assigneeId === memberId)

  const totals = presenceTotals(segments, from, now + 1, now)
  const stats = rangeStats(sessions, tasks, from)
  const reviewed = tasks.filter(t => t.review && t.review.status !== 'pending' && (t.review.at ?? 0) >= from)
  const firstTry = reviewed.filter(t => t.review?.status === 'approved' && t.review.rejections === 0).length
  const recentDone = tasks
    .filter(t => isCompleted(t) || t.review?.status === 'pending')
    .sort((a, b) => (completedTime(b) ?? b.completedAt ?? 0) - (completedTime(a) ?? a.completedAt ?? 0))
    .slice(0, 8)
  const open = tasks.filter(t => t.status !== 'done')

  // dias do mais recente para o mais antigo (no máximo 7 linhas do tempo)
  const days: number[] = []
  for (let d = new Date(startOfDay(now)); d.getTime() >= from && days.length < 7; d.setDate(d.getDate() - 1)) days.push(d.getTime())

  return (
    <div className="space-y-5 px-4 pt-5 lg:px-0">
      <section className="flex items-center gap-4">
        <Avatar name={m.name} picture={m.picture} size={72} presence={m.presence} />
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-2xl font-black text-ink">{m.name}{isMe ? ' (tu)' : ''}</h1>
          <p className="truncate font-bold text-muted">{[m.jobTitle, dept?.name, ROLE_LABEL[m.role]].filter(Boolean).join(' · ')}</p>
          <div className="mt-1 flex flex-wrap gap-x-4 text-sm font-semibold text-muted">
            <span className="flex items-center gap-1" style={{ color: PRESENCE_CONFIG[m.presence].color === '#D3D0E0' ? undefined : PRESENCE_CONFIG[m.presence].color }}>
              <PresenceGlyph status={m.presence} size={16} weight="fill" /> {PRESENCE_CONFIG[m.presence].label}
            </span>
            {m.email && <a href={`mailto:${m.email}`} className="flex items-center gap-1 hover:text-body"><EnvelopeSimpleIcon size={14} /> {m.email}</a>}
            {m.phone && <a href={`tel:${m.phone}`} className="flex items-center gap-1 hover:text-body"><PhoneIcon size={14} /> {m.phone}</a>}
          </div>
        </div>
      </section>

      <div className="flex gap-1 rounded-xl bg-snow p-1 lg:w-fit" role="tablist" aria-label="Período">
        {RANGES.map(r => (
          <button
            key={r.id}
            role="tab"
            aria-selected={range === r.id}
            onClick={() => setRange(r.id)}
            className={`flex-1 rounded-lg px-4 py-1.5 text-sm font-extrabold cursor-pointer ${range === r.id ? 'bg-white text-accent shadow-[0_2px_0_#E9E7F2]' : 'text-muted'}`}
          >
            {r.label}
          </button>
        ))}
      </div>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: 'A trabalhar', value: formatDuration(totals.trabalho ?? 0), color: PRESENCE_CONFIG.trabalho.color },
          { label: 'Em tarefas', value: formatDuration(stats.seconds), color: '#7B61FF' },
          { label: 'Concluídas', value: String(stats.tasks), color: '#4C7DFF' },
          { label: 'Aprovadas à 1ª', value: reviewed.length ? `${Math.round((firstTry / reviewed.length) * 100)}%` : '—', color: '#FF8A3D' },
        ].map(k => (
          <div key={k.label} className="card p-3">
            <div className="text-xl font-black text-ink">{k.value}</div>
            <div className="flex items-center gap-1.5 text-xs font-bold text-muted">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: k.color }} /> {k.label}
            </div>
          </div>
        ))}
      </section>

      <section className="card p-4">
        <h2 className="mb-3 text-lg font-black text-ink">Distribuição do tempo</h2>
        <PresenceBar totals={totals} height={16} />
        <ul className="mt-3 grid grid-cols-2 gap-2 text-sm sm:grid-cols-3">
          {PRESENCE_STATUSES.filter(s => s !== 'offline').map(s => (
            <li key={s} className="flex items-center gap-2 font-bold text-body">
              <PresenceGlyph status={s} size={18} />
              {PRESENCE_CONFIG[s].label}
              <span className="ml-auto text-ink">{formatDuration(totals[s] ?? 0)}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="card p-4">
        <h2 className="mb-1 text-lg font-black text-ink">Linha do tempo</h2>
        <div className="mb-4"><PresenceLegend /></div>
        {!loaded ? (
          <p className="text-sm font-semibold text-muted">A carregar…</p>
        ) : (
          <ul className="space-y-4">
            {days.map(day => {
              const dayTotals = presenceTotals(segments, day, day + 86400000, now)
              const active = (dayTotals.trabalho ?? 0) + (dayTotals.reuniao ?? 0) + (dayTotals.formacao ?? 0)
              const daySegs = segments.filter(s => s.start < day + 86400000 && (s.end ?? now) > day)
              const first = daySegs.length ? Math.max(day, Math.min(...daySegs.map(s => s.start))) : null
              return (
                <li key={day}>
                  <div className="mb-1 flex items-baseline justify-between text-sm">
                    <span className="font-black capitalize text-ink">
                      {new Date(day).toLocaleDateString('pt-PT', { weekday: 'long', day: 'numeric', month: 'short' })}
                    </span>
                    <span className="font-bold text-muted">
                      {first ? `entrada ${new Date(first).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })} · ` : ''}
                      {formatDuration(active)} activo
                    </span>
                  </div>
                  <DayTimeline segments={segments} day={day} now={now} />
                </li>
              )
            })}
          </ul>
        )}
      </section>

      <div className="space-y-5 pb-4 lg:grid lg:grid-cols-2 lg:items-start lg:gap-5 lg:space-y-0">
        <section className="card p-4">
          <h2 className="mb-3 text-lg font-black text-ink">Em aberto ({open.length})</h2>
          {open.length === 0 ? <p className="text-sm font-semibold text-muted">Nada em aberto.</p> : (
            <ul className="space-y-1">
              {open.slice(0, 8).map(t => (
                <li key={t.id}>
                  <Link href={`/tarefas/${t.id}`} className="flex items-center gap-2 rounded-lg p-2 hover:bg-snow">
                    <span className="flex-1 truncate font-bold text-ink">{t.title}</span>
                    <ReviewBadge task={t} />
                    <span className="text-xs font-bold text-muted">{t.status === 'doing' ? 'Em curso' : 'A fazer'}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section className="card p-4">
          <h2 className="mb-3 text-lg font-black text-ink">Concluídas recentemente</h2>
          {recentDone.length === 0 ? <p className="text-sm font-semibold text-muted">Ainda nada concluído.</p> : (
            <ul className="space-y-1">
              {recentDone.map(t => (
                <li key={t.id}>
                  <Link href={`/tarefas/${t.id}`} className="flex items-center gap-2 rounded-lg p-2 hover:bg-snow">
                    <span className="flex-1 truncate font-bold text-ink">{t.title}</span>
                    <ReviewBadge task={t} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  )
}

export default function MemberPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const org = useOrg()
  const m = org?.memberById(id)
  const scope = org?.scope
  const allowed = !!m && (m.id === org?.me.id || scope === 'all' || (!!m.departmentId && !!scope && scope.has(m.departmentId)))

  return (
    <div>
      <header className="sticky top-0 z-20 flex items-center gap-2 border-b-2 border-line bg-white/95 px-2 py-2 backdrop-blur lg:px-0">
        <button onClick={() => router.back()} className="rounded-xl p-2 text-muted hover:bg-snow cursor-pointer" aria-label="Voltar">
          <CaretLeftIcon size={28} />
        </button>
        <span className="text-sm font-extrabold uppercase tracking-wider text-muted">Relatório de tempo</span>
      </header>
      {allowed ? (
        <Report memberId={id} />
      ) : (
        <div className="flex flex-col items-center px-6 py-16 text-center">
          <Mascot size={96} mood="sleepy" />
          <p className="mt-4 text-xl font-black text-ink">{m ? 'Sem acesso a este relatório' : 'Funcionário não encontrado'}</p>
          <Link href="/empresa" className="btn btn-accent mt-6">Voltar à empresa</Link>
        </div>
      )}
    </div>
  )
}
