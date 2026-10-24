'use client'

import Link from 'next/link'
import { useState } from 'react'
import { CheckCircleIcon, DownloadSimpleIcon, TimerIcon } from '@phosphor-icons/react'
import { useApp } from '../../context/AppContext'
import { useOrgRequired } from '../../context/OrgContext'
import { completedTime, isCompleted } from '../../lib/points'
import { formatDuration, formatShort } from '../../lib/stats'
import { PRESENCE_CONFIG, type PresenceStatus } from '../../types'
import Avatar from '../../components/ui/Avatar'
import { PresenceBar, PresenceLegend, presenceTotals, RANGES, rangeFrom, useTeamActivity, type RangeId } from './shared'
import { PresenceGlyph } from '../../components/ui/icons'

const ACTIVE: PresenceStatus[] = ['trabalho', 'reuniao', 'formacao']
const COLUMNS: PresenceStatus[] = ['trabalho', 'reuniao', 'formacao', 'pausa', 'almoco', 'ausente']

export default function Reports() {
  const org = useOrgRequired()
  const { now } = useApp()
  const [range, setRange] = useState<RangeId>('hoje')
  const [dept, setDept] = useState('all')
  const from = rangeFrom(range, now)
  const { sessions, segments, loaded } = useTeamActivity(from)

  const scope = org.scope
  const people = org.members
    .filter(m => m.status === 'activo')
    .filter(m => scope === 'all' || m.id === org.me.id || (!!m.departmentId && scope.has(m.departmentId)))
    .filter(m => dept === 'all' || m.departmentId === dept)

  const rows = people
    .map(m => {
      const totals = presenceTotals(segments.filter(s => s.memberId === m.id), from, now + 1, now)
      const active = ACTIVE.reduce((a, s) => a + (totals[s] ?? 0), 0)
      const inTasks = sessions.filter(s => s.memberId === m.id).reduce((a, s) => a + s.seconds, 0)
      const mine = org.teamTasks.filter(t => t.assigneeId === m.id)
      const done = mine.filter(t => isCompleted(t) && (completedTime(t) ?? 0) >= from).length
      const reviewed = mine.filter(t => t.review && (t.review.at ?? 0) >= from && t.review.status !== 'pending')
      const firstTry = reviewed.filter(t => t.review?.status === 'approved' && t.review.rejections === 0).length
      return { m, totals, active, inTasks, done, approvalRate: reviewed.length ? firstTry / reviewed.length : null }
    })
    .sort((a, b) => b.active - a.active)

  const exportCsv = () => {
    const head = ['Nome', 'Email', 'Departamento', 'Cargo', ...COLUMNS.map(s => `${PRESENCE_CONFIG[s].label} (h)`), 'Em tarefas (h)', 'Tarefas concluídas', 'Aprovadas à primeira (%)']
    const h = (s: number) => (s / 3600).toFixed(2).replace('.', ',')
    const lines = rows.map(r => [
      r.m.name,
      r.m.email,
      org.deptById(r.m.departmentId)?.name ?? '',
      r.m.jobTitle ?? '',
      ...COLUMNS.map(s => h(r.totals[s] ?? 0)),
      h(r.inTasks),
      String(r.done),
      r.approvalRate === null ? '' : String(Math.round(r.approvalRate * 100)),
    ])
    const csv = [head, ...lines].map(l => l.map(c => `"${String(c).replace(/"/g, '""')}"`).join(';')).join('\n')
    const url = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `relatorio-${org.org.name.toLowerCase().replace(/\s+/g, '-')}-${range}-${new Date(now).toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="flex gap-1 rounded-xl bg-snow p-1" role="tablist" aria-label="Período">
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
        {org.departments.length > 0 && (
          <select value={dept} onChange={e => setDept(e.target.value)} className="input py-2 lg:w-56" aria-label="Departamento">
            <option value="all">Todos os departamentos</option>
            {org.departments.filter(d => scope === 'all' || scope.has(d.id)).map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        )}
        <button onClick={exportCsv} disabled={rows.length === 0} className="btn btn-ghost lg:ml-auto">
          <DownloadSimpleIcon size={18} /> Exportar CSV
        </button>
      </div>

      <PresenceLegend />

      {!loaded ? (
        <p className="card p-6 text-center font-semibold text-muted">A carregar…</p>
      ) : (
        <>
          {/* Mobile: cartões */}
          <ul className="space-y-3 lg:hidden">
            {rows.map(r => (
              <li key={r.m.id}>
                <Link href={`/empresa/membro/${r.m.id}`} className="card block border-b-4 p-4 hover:bg-snow">
                  <div className="flex items-center gap-3">
                    <Avatar name={r.m.name} picture={r.m.picture} size={40} presence={r.m.presence} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-black text-ink">{r.m.name}</span>
                      <span className="block text-xs font-bold text-muted">{org.deptById(r.m.departmentId)?.name ?? '—'}</span>
                    </span>
                    <span className="text-right">
                      <span className="block font-black text-ink">{formatShort(r.active)}</span>
                      <span className="block text-[11px] font-bold uppercase text-muted">activo</span>
                    </span>
                  </div>
                  <div className="mt-3"><PresenceBar totals={r.totals} /></div>
                  <div className="mt-2 flex flex-wrap gap-x-3 text-xs font-bold text-muted">
                    <span className="flex items-center gap-1"><PresenceGlyph status="pausa" size={14} /> {formatShort(r.totals.pausa ?? 0)}</span>
                    <span className="flex items-center gap-1"><PresenceGlyph status="almoco" size={14} /> {formatShort(r.totals.almoco ?? 0)}</span>
                    <span className="flex items-center gap-1"><PresenceGlyph status="reuniao" size={14} /> {formatShort(r.totals.reuniao ?? 0)}</span>
                    <span className="flex items-center gap-1"><TimerIcon size={14} /> {formatShort(r.inTasks)} em tarefas</span>
                    <span className="flex items-center gap-1"><CheckCircleIcon size={14} /> {r.done}</span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>

          {/* Desktop: tabela */}
          <div className="card hidden overflow-x-auto lg:block">
            <table className="w-full text-left text-sm">
              <thead className="border-b-2 border-line text-xs font-extrabold uppercase tracking-wide text-muted">
                <tr>
                  <th className="px-4 py-3">Funcionário</th>
                  <th className="px-2 py-3">Distribuição</th>
                  {COLUMNS.map(s => <th key={s} className="px-2 py-3 text-right" title={PRESENCE_CONFIG[s].label}><span className="inline-flex"><PresenceGlyph status={s} size={18} /></span></th>)}
                  <th className="px-2 py-3 text-right">Em tarefas</th>
                  <th className="px-2 py-3 text-right">Concluídas</th>
                  <th className="px-4 py-3 text-right">À 1ª</th>
                </tr>
              </thead>
              <tbody className="divide-y-2 divide-line font-semibold text-body">
                {rows.map(r => (
                  <tr key={r.m.id} className="hover:bg-snow">
                    <td className="px-4 py-2.5">
                      <Link href={`/empresa/membro/${r.m.id}`} className="flex items-center gap-3">
                        <Avatar name={r.m.name} picture={r.m.picture} size={32} presence={r.m.presence} />
                        <span className="min-w-0">
                          <span className="block truncate font-black text-ink">{r.m.name}</span>
                          <span className="block truncate text-xs text-muted">{org.deptById(r.m.departmentId)?.name ?? '—'}</span>
                        </span>
                      </Link>
                    </td>
                    <td className="w-40 px-2"><PresenceBar totals={r.totals} /></td>
                    {COLUMNS.map(s => (
                      <td key={s} className={`px-2 text-right tabular-nums ${s === 'trabalho' ? 'font-black text-ink' : ''}`}>
                        {r.totals[s] ? formatShort(r.totals[s]!) : '—'}
                      </td>
                    ))}
                    <td className="px-2 text-right tabular-nums">{formatShort(r.inTasks)}</td>
                    <td className="px-2 text-right tabular-nums">{r.done}</td>
                    <td className="px-4 text-right tabular-nums">{r.approvalRate === null ? '—' : `${Math.round(r.approvalRate * 100)}%`}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {rows.length === 0 && <p className="card p-6 text-center font-semibold text-muted">Sem funcionários neste filtro.</p>}
          <p className="text-xs font-semibold text-muted">
            Tempo activo = {ACTIVE.map(s => PRESENCE_CONFIG[s].label.toLowerCase()).join(' + ')}. “Em tarefas” é o tempo contado pelo cronómetro. Total do período: {formatDuration(rows.reduce((a, r) => a + r.active, 0))} activo.
          </p>
        </>
      )}
    </div>
  )
}
