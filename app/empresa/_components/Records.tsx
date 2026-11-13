'use client'

import Link from 'next/link'
import { useState, type ReactNode } from 'react'
import {
  ArrowDownIcon, ArrowUpIcon, CaretLeftIcon, CaretRightIcon, CrownIcon, MedalIcon, MoonIcon, SealCheckIcon, SunIcon, TargetIcon, TimerIcon,
} from '@phosphor-icons/react'
import { useApp } from '../../context/AppContext'
import { useOrgRequired } from '../../context/OrgContext'
import { teamMembers } from '../../lib/org'
import {
  analyse, bandOf, daysIn, doneIn, GOAL_BANDS, goalSecondsOf, periodRange, RECORD_PERIODS, activeSeconds,
  type Factor, type GoalBand, type MemberAnalysis, type RecordPeriod,
} from '../../lib/records'
import { formatShort } from '../../lib/stats'
import type { Member, PresenceSegment, Session, Task } from '../../types'
import Avatar from '../../components/ui/Avatar'
import { ChartCard, ColumnChart, DonutChart, type Point, type Series } from '../../components/ui/Charts'
import { useTeamActivity } from './shared'
import { StatsSkeleton } from '../../components/ui/Skeleton'

const BAND_SERIES: Series[] = GOAL_BANDS.map(b => ({ key: b.id, name: b.label, color: b.color }))
const NO_RECORD = '#D3D0E0'
const BAND_ICON: Record<GoalBand, ReactNode> = {
  abaixo: <ArrowDownIcon size={22} weight="bold" />,
  meta: <TargetIcon size={22} weight="bold" />,
  acima: <ArrowUpIcon size={22} weight="bold" />,
}

type Sort = 'score' | 'records' | 'avg'
const SORTS: { id: Sort; label: string }[] = [
  { id: 'score', label: 'Pontuação' },
  { id: 'records', label: 'Recordes' },
  { id: 'avg', label: 'Média por dia' },
]

const scoreColor = (s: number | null) => (s === null ? '#A3A0B8' : s >= 75 ? '#12B5A6' : s >= 50 ? '#E0A419' : '#FF8A3D')

export function FactorBars({ factors, size = 'sm' }: { factors: Factor[]; size?: 'sm' | 'lg' }) {
  if (size === 'lg') {
    return (
      <ul className="space-y-2.5">
        {factors.map(f => (
          <li key={f.id}>
            <div className="flex items-baseline justify-between text-sm">
              <span className="font-bold text-body">{f.label} <span className="text-xs font-semibold text-muted">· {f.hint}</span></span>
              <span className="font-black text-ink tabular-nums">{f.value === null ? '—' : `${Math.round(f.value * 100)}%`}</span>
            </div>
            <div className="mt-1 h-2 overflow-hidden rounded-full bg-line">
              {f.value !== null && <div className="h-full rounded-full" style={{ width: `${f.value * 100}%`, background: scoreColor(f.value * 100) }} />}
            </div>
          </li>
        ))}
      </ul>
    )
  }
  return (
    <span className="flex h-6 items-end gap-0.5" aria-label={factors.map(f => `${f.label}: ${f.value === null ? 'sem dados' : `${Math.round(f.value * 100)}%`}`).join(', ')}>
      {factors.map(f => (
        <span key={f.id} title={`${f.label}: ${f.value === null ? 'sem dados' : `${Math.round(f.value * 100)}%`}`} className="flex h-full w-1.5 items-end rounded-sm bg-line">
          {f.value !== null && <span className="w-full rounded-sm" style={{ height: `${Math.max(8, f.value * 100)}%`, background: scoreColor(f.value * 100) }} />}
        </span>
      ))}
    </span>
  )
}

export function ScoreBadge({ score }: { score: number | null }) {
  return (
    <span className="inline-flex min-w-11 justify-center rounded-lg px-2 py-0.5 text-sm font-black text-white tabular-nums" style={{ background: scoreColor(score) }}>
      {score ?? '—'}
    </span>
  )
}

function Highlight({ icon, color, title, m, value }: { icon: ReactNode; color: string; title: string; m?: Member; value: string }) {
  return (
    <div className="card flex items-center gap-3 p-3">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl" style={{ background: `${color}22`, color }}>{icon}</span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-extrabold uppercase tracking-wide text-muted">{title}</p>
        {m ? (
          <Link href={`/empresa/membro/${m.id}`} className="flex items-center gap-1.5 hover:underline">
            <Avatar name={m.name} picture={m.picture} size={20} />
            <span className="truncate font-black text-ink">{m.name}</span>
          </Link>
        ) : (
          <p className="font-bold text-muted">—</p>
        )}
      </div>
      {m && <span className="shrink-0 font-black text-ink tabular-nums">{value}</span>}
    </div>
  )
}

export default function Records() {
  const org = useOrgRequired()
  const { now } = useApp()
  const [period, setPeriod] = useState<RecordPeriod>('semana')
  const [offset, setOffset] = useState(0)
  const [dept, setDept] = useState('all')
  const [sort, setSort] = useState<Sort>('score')
  const { from, to, label } = periodRange(period, offset, now)
  const { sessions, segments, loaded } = useTeamActivity(from, to)
  const goal = goalSecondsOf(org.org)

  const scope = org.scope
  const people = teamMembers(org.members, org.org)
    .filter(m => m.status === 'activo')
    .filter(m => scope === 'all' || m.id === org.me.id || (!!m.departmentId && scope.has(m.departmentId)))
    .filter(m => dept === 'all' || m.departmentId === dept)

  const list = analyse(
    people.map(m => ({
      memberId: m.id,
      segments: segments.filter(s => s.memberId === m.id),
      sessions: sessions.filter(s => s.memberId === m.id),
      tasks: org.teamTasks.filter(t => t.assigneeId === m.id),
    })),
    from, to, now, goal,
  )
  const byId = new Map(list.map(a => [a.memberId, a]))
  const rows = [...people].sort((a, b) => {
    const x = byId.get(a.id)!
    const y = byId.get(b.id)!
    if (sort === 'records') return y.records - x.records || (y.score ?? -1) - (x.score ?? -1)
    if (sort === 'avg') return y.avgPerDay - x.avgPerDay
    return (y.score ?? -1) - (x.score ?? -1) || y.records - x.records
  })

  const counts = { abaixo: 0, meta: 0, acima: 0, none: 0 }
  list.forEach(a => counts[a.band ?? 'none']++)
  const days = daysIn(from, to, now)

  let points: Point[] = []
  if (period === 'ano') {
    const months: Point[] = []
    for (let i = 0; i < 12; i++) {
      const d = new Date(from)
      d.setMonth(i)
      if (d.getTime() > now) break
      months.push({ label: d.toLocaleDateString('pt-PT', { month: 'short' }).replace('.', ''), title: d.toLocaleDateString('pt-PT', { month: 'long', year: 'numeric' }), values: { abaixo: 0, meta: 0, acima: 0 } })
    }
    list.forEach(a => a.perDay.forEach(d => { const p = months[new Date(d.day).getMonth()]; if (p) p.values[d.band]++ }))
    points = months
  } else if (period !== 'dia') {
    points = days.map(day => {
      const values: Record<string, number> = { abaixo: 0, meta: 0, acima: 0 }
      people.forEach(m => {
        const band = bandOf(activeSeconds(segments.filter(s => s.memberId === m.id), day, Math.min(day + 86400000, now + 1), now), goal)
        if (band) values[band]++
      })
      const d = new Date(day)
      return {
        label: period === 'semana' ? d.toLocaleDateString('pt-PT', { weekday: 'short' }).replace('.', '') : String(d.getDate()),
        title: d.toLocaleDateString('pt-PT', { weekday: 'long', day: 'numeric', month: 'short' }),
        values,
      }
    })
  }

  const top = (key: (a: MemberAnalysis) => number) => {
    const best = list.reduce<MemberAnalysis | null>((b, a) => (key(a) > 0 && (!b || key(a) > key(b)) ? a : b), null)
    return best ? { m: org.memberById(best.memberId), a: best } : null
  }
  const mostRecords = top(a => a.records)
  const bestScore = top(a => a.score ?? 0)
  const mostOnTime = top(a => a.beforeDeadline)
  const longestDay = top(a => a.bestDay?.seconds ?? 0)
  const totals = list.reduce((t, a) => ({ prazo: t.prazo + a.beforeDeadline, primeira: t.primeira + a.firstTry, meta: t.meta + a.daysByBand.meta + a.daysByBand.acima }), { prazo: 0, primeira: 0, meta: 0 })
  const unit = period === 'ano' ? 'Mês' : 'Dia'
  const multiDay = period !== 'dia'

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="flex gap-1 rounded-xl bg-snow p-1" role="tablist" aria-label="Período">
          {RECORD_PERIODS.map(p => (
            <button
              key={p.id}
              role="tab"
              aria-selected={period === p.id}
              onClick={() => { setPeriod(p.id); setOffset(0) }}
              className={`flex-1 rounded-lg px-4 py-1.5 text-sm font-extrabold cursor-pointer ${period === p.id ? 'bg-white text-accent shadow-[0_2px_0_#E9E7F2]' : 'text-muted'}`}
            >
              {p.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => setOffset(o => o - 1)} className="rounded-lg p-1.5 text-muted hover:bg-snow cursor-pointer" aria-label="Período anterior">
            <CaretLeftIcon size={20} weight="bold" />
          </button>
          <span className="min-w-36 text-center font-black capitalize text-ink">{label}</span>
          <button onClick={() => setOffset(o => Math.min(0, o + 1))} disabled={offset === 0} className="rounded-lg p-1.5 text-muted hover:bg-snow disabled:opacity-30 cursor-pointer" aria-label="Período seguinte">
            <CaretRightIcon size={20} weight="bold" />
          </button>
        </div>
        {org.departments.length > 0 && (
          <select value={dept} onChange={e => setDept(e.target.value)} className="input py-2 lg:ml-auto lg:w-56" aria-label="Departamento">
            <option value="all">Todos os departamentos</option>
            {org.departments.filter(d => scope === 'all' || scope.has(d.id)).map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        )}
      </div>

      <p className="text-sm font-semibold text-muted">
        Meta diária: <span className="font-black text-ink">{formatShort(goal)}</span> de trabalho activo por pessoa (a trabalhar, reunião e formação), com 15 min de margem.
        {org.isAdmin && <> <Link href="/empresa/definicoes" className="font-extrabold text-accent">Alterar</Link></>}
        {multiDay && ' Cada pessoa conta pela média dos dias em que teve registo.'}
      </p>

      {!loaded ? (
        <StatsSkeleton />
      ) : (
        <>
          <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {GOAL_BANDS.map(b => (
              <div key={b.id} className="card flex items-center gap-3 p-3">
                <span style={{ color: b.color }}>{BAND_ICON[b.id]}</span>
                <div className="min-w-0">
                  <div className="text-xl font-black leading-tight text-ink">{counts[b.id]} <span className="text-sm text-muted">pessoa{counts[b.id] === 1 ? '' : 's'}</span></div>
                  <div className="truncate text-xs font-bold text-muted">{b.label}</div>
                </div>
              </div>
            ))}
            <div className="card flex items-center gap-3 p-3">
              <span className="text-muted"><MoonIcon size={22} weight="bold" /></span>
              <div className="min-w-0">
                <div className="text-xl font-black leading-tight text-ink">{counts.none} <span className="text-sm text-muted">pessoa{counts.none === 1 ? '' : 's'}</span></div>
                <div className="truncate text-xs font-bold text-muted">Sem registo</div>
              </div>
            </div>
          </section>

          <div className="grid gap-4 lg:grid-cols-2">
            {multiDay ? (
              <ChartCard
                title={period === 'ano' ? 'Meta diária por mês' : 'Meta diária por dia'}
                subtitle={period === 'ano' ? 'Dias-pessoa em cada faixa' : 'Pessoas em cada faixa'}
                series={BAND_SERIES}
                points={points}
                format={v => String(Math.round(v))}
                firstCol={unit}
              >
                <ColumnChart points={points} series={BAND_SERIES} format={v => String(Math.round(v))} />
              </ChartCard>
            ) : (
              <section className="card min-w-0 p-4 sm:p-5">
                <h3 className="font-black text-ink">Meta diária</h3>
                <p className="mb-3 text-xs font-semibold text-muted">Pessoas em cada faixa</p>
                <DonutChart
                  slices={[
                    ...GOAL_BANDS.map(b => ({ key: b.id, label: b.label, color: b.color, value: counts[b.id] })),
                    { key: 'none', label: 'Sem registo', color: NO_RECORD, value: counts.none },
                  ]}
                  format={v => String(Math.round(v))}
                  centerLabel="pessoas"
                />
              </section>
            )}
            <section className="card min-w-0 p-4 sm:p-5">
              <h3 className="font-black text-ink">Recordes da equipa</h3>
              <p className="mb-3 text-xs font-semibold text-muted">{totals.prazo + totals.primeira + totals.meta} recordes batidos no período</p>
              <DonutChart
                slices={[
                  { key: 'prazo', label: 'Antes do prazo', color: '#4C7DFF', value: totals.prazo },
                  { key: 'primeira', label: 'Aprovadas à 1ª', color: '#EC5BA6', value: totals.primeira },
                  { key: 'meta', label: 'Dias com meta cumprida', color: '#12B5A6', value: totals.meta },
                ]}
                format={v => String(Math.round(v))}
                centerLabel="recordes"
                empty="Ainda nenhum"
              />
            </section>
          </div>

          <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Highlight icon={<CrownIcon size={22} weight="fill" />} color="#E0A419" title="Melhor pontuação" m={bestScore?.m} value={String(bestScore?.a.score ?? '')} />
            <Highlight icon={<MedalIcon size={22} weight="fill" />} color="#7B61FF" title="Mais recordes" m={mostRecords?.m} value={String(mostRecords?.a.records ?? '')} />
            <Highlight icon={<TimerIcon size={22} weight="fill" />} color="#4C7DFF" title="Mais antes do prazo" m={mostOnTime?.m} value={String(mostOnTime?.a.beforeDeadline ?? '')} />
            <Highlight icon={<SunIcon size={22} weight="fill" />} color="#12B5A6" title="Dia mais longo" m={longestDay?.m} value={longestDay?.a.bestDay ? formatShort(longestDay.a.bestDay.seconds) : ''} />
          </section>

          <section className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="mr-auto text-lg font-black text-ink">Funcionários</h2>
              <span className="text-xs font-bold text-muted">Ordenar:</span>
              {SORTS.map(s => (
                <button key={s.id} onClick={() => setSort(s.id)} className={`chip text-xs ${sort === s.id ? 'border-accent! bg-accent-light! text-accent-dark!' : ''}`}>
                  {s.label}
                </button>
              ))}
            </div>

            <ul className="space-y-3 lg:hidden">
              {rows.map((m, i) => {
                const a = byId.get(m.id)!
                return (
                  <li key={m.id}>
                    <Link href={`/empresa/membro/${m.id}`} className="card block border-b-4 p-4 hover:bg-snow">
                      <div className="flex items-center gap-3">
                        <span className="w-5 text-center font-black text-muted">{i + 1}</span>
                        <Avatar name={m.name} picture={m.picture} size={40} presence={m.presence} />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-black text-ink">{m.name}</span>
                          <span className="block text-xs font-bold text-muted">{org.deptById(m.departmentId)?.name ?? '—'}</span>
                        </span>
                        <ScoreBadge score={a.score} />
                      </div>
                      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs font-bold text-muted">
                        <span><b className="text-ink">{a.records}</b> recordes</span>
                        <span><b className="text-ink">{a.beforeDeadline}</b> antes do prazo</span>
                        <span><b className="text-ink">{a.firstTry}</b> à 1ª</span>
                        <span><b className="text-ink">{formatShort(a.avgPerDay)}</b>/dia</span>
                      </div>
                      <div className="mt-2"><BandDays a={a} /></div>
                    </Link>
                  </li>
                )
              })}
            </ul>

            <div className="card hidden overflow-x-auto lg:block">
              <table className="w-full text-left text-sm">
                <thead className="border-b-2 border-line text-xs font-extrabold uppercase tracking-wide text-muted">
                  <tr>
                    <th className="px-4 py-3">Funcionário</th>
                    <th className="px-2 py-3 text-center">Pontuação</th>
                    <th className="px-2 py-3" title="Meta, prazos, qualidade, foco, entregas">Factores</th>
                    <th className="px-2 py-3 text-right">Recordes</th>
                    <th className="px-2 py-3 text-right">Antes do prazo</th>
                    <th className="px-2 py-3 text-right">À 1ª</th>
                    <th className="px-2 py-3">Dias (abaixo · meta · acima)</th>
                    <th className="px-2 py-3 text-right">Média/dia</th>
                    <th className="px-4 py-3 text-right">Melhor dia</th>
                  </tr>
                </thead>
                <tbody className="divide-y-2 divide-line font-semibold text-body">
                  {rows.map((m, i) => {
                    const a = byId.get(m.id)!
                    return (
                      <tr key={m.id} className="hover:bg-snow">
                        <td className="px-4 py-2.5">
                          <Link href={`/empresa/membro/${m.id}`} className="flex items-center gap-3">
                            <span className="w-5 text-center font-black text-muted">{i + 1}</span>
                            <Avatar name={m.name} picture={m.picture} size={32} presence={m.presence} />
                            <span className="min-w-0">
                              <span className="block truncate font-black text-ink">{m.name}</span>
                              <span className="block truncate text-xs text-muted">{org.deptById(m.departmentId)?.name ?? '—'}</span>
                            </span>
                          </Link>
                        </td>
                        <td className="px-2 text-center"><ScoreBadge score={a.score} /></td>
                        <td className="px-2"><FactorBars factors={a.factors} /></td>
                        <td className="px-2 text-right font-black text-ink tabular-nums">{a.records}</td>
                        <td className="px-2 text-right tabular-nums">{a.beforeDeadline}{a.late > 0 && <span className="text-xs text-danger"> ({a.late} tarde)</span>}</td>
                        <td className="px-2 text-right tabular-nums">{a.reviewed ? `${a.firstTry}/${a.reviewed}` : '—'}</td>
                        <td className="px-2"><BandDays a={a} /></td>
                        <td className="px-2 text-right tabular-nums" style={{ color: a.band ? GOAL_BANDS.find(b => b.id === a.band)!.color : undefined }}>
                          {a.perDay.length ? formatShort(a.avgPerDay) : '—'}
                        </td>
                        <td className="px-4 text-right tabular-nums">
                          {a.bestDay ? (
                            <span title={new Date(a.bestDay.day).toLocaleDateString('pt-PT', { weekday: 'long', day: 'numeric', month: 'short' })}>{formatShort(a.bestDay.seconds)}</span>
                          ) : '—'}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            {rows.length === 0 && <p className="card p-6 text-center font-semibold text-muted">Sem funcionários neste filtro.</p>}
            <p className="flex items-start gap-1.5 text-xs font-semibold text-muted">
              <SealCheckIcon size={16} className="mt-px shrink-0" />
              <span>
                Recordes: tarefas entregues até ao prazo, aprovadas à primeira e dias com a meta cumprida. A pontuação (0–100) é a média dos
                factores que se aplicam: meta diária, prazos, qualidade (aprovadas à 1ª), foco (tempo activo em tarefas) e entregas (face a quem mais concluiu).
              </span>
            </p>
          </section>
        </>
      )}
    </div>
  )
}

export function MemberRecordsCard({
  memberId, from, now, sessions, segments, tasks, periodText,
}: { memberId: string; from: number; now: number; sessions: Session[]; segments: PresenceSegment[]; tasks: Task[]; periodText: string }) {
  const org = useOrgRequired()
  const goal = goalSecondsOf(org.org)
  const to = now + 1
  // entregas comparadas com a equipa visível (quem não gere não vê as tarefas dos colegas)
  const maxDone = org.isManager
    ? Math.max(0, ...teamMembers(org.members, org.org).map(m => doneIn(org.teamTasks.filter(t => t.assigneeId === m.id), from, to)))
    : null
  const [a] = analyse([{ memberId, segments, sessions, tasks }], from, to, now, goal, maxDone)

  return (
    <section className="card p-4 sm:p-5">
      <div className="mb-4 flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-black text-ink">Recordes e desempenho</h2>
          <p className="text-xs font-semibold text-muted">{periodText} · meta diária de {formatShort(goal)}</p>
        </div>
        <div className="text-center">
          <ScoreBadge score={a.score} />
          <p className="mt-0.5 text-[11px] font-bold text-muted">pontuação</p>
        </div>
      </div>
      <div className="grid gap-5 lg:grid-cols-2">
        <div>
          <div className="grid grid-cols-2 gap-2">
            {[
              { label: 'Recordes batidos', value: a.records, color: '#7B61FF' },
              { label: 'Antes do prazo', value: a.beforeDeadline, color: '#4C7DFF' },
              { label: 'Aprovadas à 1ª', value: a.firstTry, color: '#EC5BA6' },
              { label: 'Dias com meta cumprida', value: a.daysByBand.meta + a.daysByBand.acima, color: '#12B5A6' },
            ].map(k => (
              <div key={k.label} className="rounded-xl bg-snow p-3">
                <div className="text-xl font-black text-ink tabular-nums">{k.value}</div>
                <div className="flex items-center gap-1.5 text-xs font-bold text-muted">
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: k.color }} /> {k.label}
                </div>
              </div>
            ))}
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm font-bold text-muted">
            <span className="flex items-center gap-2">Dias: <BandDays a={a} /></span>
            {a.perDay.length > 0 && <span>Média <b className="text-ink">{formatShort(a.avgPerDay)}</b>/dia</span>}
            {a.bestDay && <span>Melhor dia <b className="text-ink">{formatShort(a.bestDay.seconds)}</b></span>}
            {a.late > 0 && <span className="text-danger">{a.late} fora do prazo</span>}
          </div>
        </div>
        <FactorBars factors={a.factors} size="lg" />
      </div>
    </section>
  )
}

export function BandDays({ a }: { a: MemberAnalysis }) {
  if (!a.perDay.length) return <span className="text-xs font-bold text-muted">Sem registo</span>
  return (
    <span className="flex gap-1">
      {GOAL_BANDS.map(b => (
        <span
          key={b.id}
          title={`${b.label}: ${a.daysByBand[b.id]} dia${a.daysByBand[b.id] === 1 ? '' : 's'}`}
          className="min-w-7 rounded-md px-1.5 text-center text-xs font-black tabular-nums"
          style={{ background: a.daysByBand[b.id] ? b.color : '#F1F0F6', color: a.daysByBand[b.id] ? '#fff' : '#A3A0B8' }}
        >
          {a.daysByBand[b.id]}
        </span>
      ))}
    </span>
  )
}
