'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { BuildingsIcon, CheckCircleIcon, ClockIcon, CrownIcon, EyeSlashIcon, LightningIcon } from '@phosphor-icons/react'
import Avatar from '../../../components/ui/Avatar'
import Mascot from '../../../components/ui/Mascot'
import { api, errorText } from '../../../lib/api'
import { formatShort, startOfDay } from '../../../lib/stats'
import type { RankMetric } from '../../../types'
import type { PanelRankEntry, RankKind } from '../../../lib/server/panelRanking'
import { usePanel } from '../_components/PanelShell'

/* Rankings no painel: empresas, contas pessoais e funcionários de cada empresa (com nomes reais) */

type Period = 'hoje' | 'semana' | 'mes' | 'sempre'

const KINDS: { id: RankKind; label: string }[] = [
  { id: 'empresas', label: 'Empresas' },
  { id: 'pessoais', label: 'Contas pessoais' },
  { id: 'funcionarios', label: 'Funcionários' },
]
const METRICS: { id: RankMetric; label: string; icon: typeof LightningIcon; color: string }[] = [
  { id: 'points', label: 'XP', icon: LightningIcon, color: '#E0A419' },
  { id: 'hours', label: 'Horas', icon: ClockIcon, color: '#0D9488' },
  { id: 'tasks', label: 'Tarefas', icon: CheckCircleIcon, color: '#7B61FF' },
]
const PERIODS: { id: Period; label: string }[] = [
  { id: 'hoje', label: 'Hoje' },
  { id: 'semana', label: 'Semana' },
  { id: 'mes', label: 'Mês' },
  { id: 'sempre', label: 'Sempre' },
]
const MEDALS = ['#FFC53D', '#C0C0C0', '#CD7F32']

function periodStart(p: Period) {
  if (p === 'sempre') return 0
  const d = new Date(startOfDay(Date.now()))
  if (p === 'semana') d.setDate(d.getDate() - ((d.getDay() + 6) % 7)) // segunda-feira
  if (p === 'mes') d.setDate(1)
  return d.getTime()
}

const value = (e: { seconds: number; tasks: number; points: number }, m: RankMetric) =>
  m === 'hours' ? formatShort(e.seconds) : m === 'tasks' ? String(e.tasks) : `${e.points} XP`

/** Valor por pessoa (ranking de empresas) */
const perPerson = (e: PanelRankEntry, m: RankMetric) =>
  e.members ? value({ seconds: e.seconds / e.members, tasks: Math.round((e.tasks / e.members) * 10) / 10, points: Math.round(e.points / e.members) }, m) : '—'

function Name({ e }: { e: PanelRankEntry }) {
  return e.href ? (
    <Link href={e.href} className="truncate font-black text-ink hover:text-brand">{e.name}</Link>
  ) : (
    <span className="truncate font-black text-ink">{e.name}</span>
  )
}

export default function PanelRankingPage() {
  const { data } = usePanel()
  const [kind, setKind] = useState<RankKind>('empresas')
  const [metric, setMetric] = useState<RankMetric>('points')
  const [period, setPeriod] = useState<Period>('semana')
  const [org, setOrg] = useState('')
  const [entries, setEntries] = useState<PanelRankEntry[] | null>(null)
  const [error, setError] = useState('')

  const orgs = data?.orgs ?? []
  const orgId = org || orgs[0]?.id || ''

  useEffect(() => {
    if (kind === 'funcionarios' && !orgId) return
    let alive = true
    const q = new URLSearchParams({ tipo: kind, metric, from: String(periodStart(period)) })
    if (kind === 'funcionarios') q.set('org', orgId)
    api<{ entries: PanelRankEntry[] }>(`/api/painel/ranking?${q}`)
      .then(r => { if (alive) { setEntries(r.entries); setError('') } })
      .catch(err => { if (alive) setError(errorText(err)) })
    return () => { alive = false }
  }, [kind, metric, period, orgId])

  const list = kind === 'funcionarios' && !orgId ? [] : entries
  const top = (list ?? []).slice(0, 3)

  return (
    <div className="space-y-4">
      {/* filtros numa linha: tipo, critério, período (e empresa nos funcionários) */}
      <div className="card space-y-3 p-4">
        <div className="grid grid-cols-3 gap-2" role="tablist" aria-label="Ranking">
          {KINDS.map(k => (
            <button
              key={k.id}
              role="tab"
              aria-selected={kind === k.id}
              onClick={() => { setKind(k.id); setEntries(null) }}
              className={`rounded-2xl border-2 border-b-4 py-2.5 text-sm font-black cursor-pointer ${kind === k.id ? 'border-brand bg-brand-light text-brand-dark' : 'border-line text-muted hover:bg-snow'}`}
            >
              {k.label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex gap-1 rounded-2xl bg-snow p-1" role="radiogroup" aria-label="Critério">
            {METRICS.map(m => (
              <button
                key={m.id}
                role="radio"
                aria-checked={metric === m.id}
                onClick={() => setMetric(m.id)}
                className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-sm font-extrabold cursor-pointer ${metric === m.id ? 'bg-white text-ink shadow-[0_2px_0_#E9E7F2]' : 'text-muted'}`}
              >
                <m.icon size={16} color={metric === m.id ? m.color : undefined} /> {m.label}
              </button>
            ))}
          </div>
          {PERIODS.map(p => (
            <button key={p.id} onClick={() => setPeriod(p.id)} className={`chip ${period === p.id ? 'border-brand! bg-brand-light! text-brand-dark!' : ''}`}>
              {p.label}
            </button>
          ))}
          {kind === 'funcionarios' && orgs.length > 0 && (
            <select value={orgId} onChange={e => setOrg(e.target.value)} className="chip ml-auto pr-2" aria-label="Empresa">
              {orgs.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
          )}
        </div>
      </div>

      {error && <p className="card p-4 font-bold text-danger">{error}</p>}

      {kind === 'funcionarios' && orgs.length === 0 ? (
        <p className="card p-8 text-center font-semibold text-muted">Ainda não há empresas.</p>
      ) : list === null ? (
        <div className="flex justify-center py-16"><Mascot size={80} className="animate-bounce-soft" /></div>
      ) : list.length === 0 ? (
        <div className="card flex flex-col items-center p-10 text-center">
          <Mascot size={90} mood="sleepy" />
          <p className="mt-3 text-lg font-black text-ink">Ninguém neste ranking</p>
        </div>
      ) : (
        <>
          {/* pódio */}
          <div className="grid gap-3 sm:grid-cols-3">
            {top.map((e, i) => (
              <div key={e.id} className="card flex items-center gap-3 p-4" style={{ borderColor: MEDALS[i] }}>
                <span className="relative">
                  {kind === 'empresas' ? (
                    <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent-light text-accent-dark"><BuildingsIcon size={26} /></span>
                  ) : (
                    <Avatar name={e.name} picture={e.picture} size={48} />
                  )}
                  <span className="absolute -right-1.5 -top-1.5 flex h-6 w-6 items-center justify-center rounded-full text-xs font-black text-white" style={{ background: MEDALS[i] }}>
                    {i === 0 ? <CrownIcon size={14} weight="fill" /> : i + 1}
                  </span>
                </span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <Name e={e} />
                  <span className="truncate text-xs font-semibold text-muted">{e.sub}</span>
                </span>
                <span className="text-right font-black tabular-nums text-ink">{kind === 'empresas' ? perPerson(e, metric) : value(e, metric)}</span>
              </div>
            ))}
          </div>

          <div className="card overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="bg-snow text-left text-xs font-extrabold uppercase tracking-wide text-muted">
                <tr>
                  <th className="w-12 px-4 py-2.5">#</th>
                  <th className="px-3 py-2.5">{kind === 'empresas' ? 'Empresa' : 'Pessoa'}</th>
                  {kind === 'empresas' && <th className="px-3 py-2.5 text-right">Pessoas</th>}
                  {kind === 'funcionarios' && <th className="px-3 py-2.5">Departamento</th>}
                  <th className="px-3 py-2.5 text-right">Horas</th>
                  <th className="px-3 py-2.5 text-right">Tarefas</th>
                  <th className="px-3 py-2.5 text-right">XP</th>
                  {kind === 'empresas' && <th className="px-4 py-2.5 text-right">Por pessoa</th>}
                </tr>
              </thead>
              <tbody className="divide-y-2 divide-line">
                {list.map((e, i) => (
                  <tr key={e.id}>
                    <td className="px-4 py-2.5 font-black" style={{ color: MEDALS[i] ?? '#A3A0B8' }}>{i + 1}</td>
                    <td className="px-3 py-2.5">
                      <span className="flex items-center gap-3">
                        {kind === 'empresas' ? (
                          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-accent-light text-accent-dark"><BuildingsIcon size={18} /></span>
                        ) : (
                          <Avatar name={e.name} picture={e.picture} size={32} />
                        )}
                        <span className="flex min-w-0 flex-col">
                          <span className="flex items-center gap-1.5">
                            <Name e={e} />
                            {e.hidden && <EyeSlashIcon size={14} className="shrink-0 text-muted" aria-label="Escondido do ranking público" />}
                          </span>
                          <span className="truncate text-xs font-semibold text-muted">{e.sub}</span>
                        </span>
                      </span>
                    </td>
                    {kind === 'empresas' && <td className="px-3 py-2.5 text-right font-bold tabular-nums text-ink">{e.members}</td>}
                    {kind === 'funcionarios' && <td className="px-3 py-2.5 font-semibold text-body">{e.department ?? '—'}</td>}
                    <td className={`px-3 py-2.5 text-right tabular-nums ${metric === 'hours' ? 'font-black text-ink' : 'font-semibold text-body'}`}>{formatShort(e.seconds)}</td>
                    <td className={`px-3 py-2.5 text-right tabular-nums ${metric === 'tasks' ? 'font-black text-ink' : 'font-semibold text-body'}`}>{e.tasks}</td>
                    <td className={`px-3 py-2.5 text-right tabular-nums ${metric === 'points' ? 'font-black text-ink' : 'font-semibold text-body'}`}>{e.points}</td>
                    {kind === 'empresas' && <td className="px-4 py-2.5 text-right font-black tabular-nums text-ink">{perPerson(e, metric)}</td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-center text-xs font-semibold text-muted">
            {kind === 'empresas' ? 'Empresas ordenadas pela média por pessoa, como no ranking da app. ' : ''}
            <EyeSlashIcon size={12} className="inline" /> = escondido do ranking público (o painel vê na mesma).
          </p>
        </>
      )}
    </div>
  )
}
