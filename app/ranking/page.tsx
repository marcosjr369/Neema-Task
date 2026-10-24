'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { CheckCircleIcon, ClockIcon, CrownIcon, InfoIcon, LightningIcon } from '@phosphor-icons/react'
import { useAccount } from '../context/AccountContext'
import { useApp } from '../context/AppContext'
import { useOrg } from '../context/OrgContext'
import { api, errorText } from '../lib/api'
import { POINTS_HELP } from '../lib/points'
import { formatDuration, formatShort, startOfDay } from '../lib/stats'
import Avatar from '../components/ui/Avatar'
import Mascot from '../components/ui/Mascot'
import type { RankEntry, RankMetric } from '../types'

type Period = 'semana' | 'mes' | 'sempre'
type DeptEntry = { id: string; name: string; color: string; members: number; seconds: number; tasks: number; points: number }

const METRICS: { id: RankMetric; label: string; icon: typeof LightningIcon; color: string }[] = [
  { id: 'points', label: 'Geral', icon: LightningIcon, color: '#FFC53D' },
  { id: 'hours', label: 'Horas', icon: ClockIcon, color: '#12B5A6' },
  { id: 'tasks', label: 'Tarefas', icon: CheckCircleIcon, color: '#7B61FF' },
]
const PERIODS: { id: Period; label: string }[] = [
  { id: 'semana', label: 'Semana' },
  { id: 'mes', label: 'Mês' },
  { id: 'sempre', label: 'Sempre' },
]

function periodStart(p: Period, now: number) {
  if (p === 'sempre') return 0
  const d = new Date(startOfDay(now))
  if (p === 'semana') d.setDate(d.getDate() - ((d.getDay() + 6) % 7)) // segunda-feira
  else d.setDate(1)
  return d.getTime()
}

const metricValue = (e: { seconds: number; tasks: number; points: number }, m: RankMetric) =>
  m === 'hours' ? formatShort(e.seconds) : m === 'tasks' ? String(e.tasks) : `${e.points} XP`

const MEDALS = ['#FFC53D', '#C0C0C0', '#CD7F32']

function Podium({ top, metric }: { top: RankEntry[]; metric: RankMetric }) {
  // ordem visual: 2º, 1º, 3º
  const order = [top[1], top[0], top[2]]
  const heights = [88, 120, 64]
  return (
    <div className="flex items-end justify-center gap-3 pt-6">
      {order.map((e, i) => {
        if (!e) return <div key={i} className="w-24" />
        const place = i === 1 ? 0 : i === 0 ? 1 : 2
        return (
          <div key={e.id} className="flex w-24 flex-col items-center sm:w-28">
            {place === 0 && <CrownIcon size={26} weight="fill" color="#FFC53D" className="mb-1" />}
            <div className="rounded-full p-1" style={{ background: MEDALS[place] }}>
              <Avatar name={e.name} picture={e.picture} size={place === 0 ? 64 : 52} />
            </div>
            <p className={`mt-2 w-full truncate text-center text-sm font-black ${e.isMe ? 'text-brand' : 'text-ink'}`}>{e.isMe ? 'Tu' : e.name}</p>
            <p className="text-xs font-extrabold text-muted">{metricValue(e, metric)}</p>
            <div
              className="mt-2 flex w-full items-start justify-center rounded-t-2xl pt-2 text-2xl font-black text-white"
              style={{ height: heights[i], background: MEDALS[place], boxShadow: 'inset 0 -6px 0 #0001' }}
            >
              {place + 1}
            </div>
          </div>
        )
      })}
    </div>
  )
}

export default function RankingPage() {
  const { user } = useAccount()
  const { now } = useApp()
  const org = useOrg()
  const [metric, setMetric] = useState<RankMetric>('points')
  const [period, setPeriod] = useState<Period>('semana')
  const [view, setView] = useState<'pessoas' | 'departamentos'>('pessoas')
  const [dept, setDept] = useState<string>('all')
  const [entries, setEntries] = useState<RankEntry[] | null>(null)
  const [depts, setDepts] = useState<DeptEntry[]>([])
  const [error, setError] = useState('')
  const [help, setHelp] = useState(false)

  const from = periodStart(period, now)
  const load = useCallback(async () => {
    if (!user) return
    try {
      const url = org ? `${org.base}/ranking?from=${from}&metric=${metric}` : `/api/ranking?from=${from}&metric=${metric}`
      const res = await api<{ entries: RankEntry[]; departments?: DeptEntry[] }>(url)
      setEntries(res.entries)
      setDepts(res.departments ?? [])
      setError('')
    } catch (err) {
      setError(errorText(err))
    }
  }, [user, org, from, metric])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carregar do servidor
    load()
    const id = setInterval(load, 30 * 1000)
    return () => clearInterval(id)
  }, [load])

  if (!user) {
    return (
      <div className="flex flex-col items-center px-6 py-16 text-center">
        <Mascot size={110} />
        <h1 className="mt-4 text-2xl font-black text-ink">Entra para ver o ranking</h1>
        <p className="mt-1 max-w-xs font-semibold text-muted">Compara horas de foco, tarefas concluídas e pontos com outras pessoas.</p>
        <Link href="/entrar" className="btn btn-primary mt-6">Entrar</Link>
      </div>
    )
  }

  const list = (entries ?? []).filter(e => dept === 'all' || e.departmentId === dept)
  const meIndex = list.findIndex(e => e.isMe)
  const sortedDepts = [...depts].sort((a, b) =>
    metric === 'hours' ? b.seconds - a.seconds : metric === 'tasks' ? b.tasks - a.tasks : b.points - a.points,
  )

  return (
    <div>
      <header className="sticky top-0 z-20 space-y-3 border-b-2 border-line bg-white/95 px-4 pb-3 pt-4 backdrop-blur lg:px-0 lg:pt-6">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-black text-ink lg:text-3xl">Ranking</h1>
          <span className="rounded-lg bg-snow px-2 py-0.5 text-xs font-extrabold uppercase text-muted">
            {org ? org.org.name : 'Global'}
          </span>
          <button onClick={() => setHelp(h => !h)} className="ml-auto rounded-xl p-2 text-muted hover:bg-snow cursor-pointer" aria-label="Como funcionam os pontos">
            <InfoIcon size={22} />
          </button>
        </div>
        {help && (
          <ul className="card space-y-1 bg-snow p-3 text-sm font-semibold text-body">
            {POINTS_HELP.map(h => <li key={h}>• {h}</li>)}
          </ul>
        )}
        <div className="grid grid-cols-3 gap-1 rounded-2xl bg-snow p-1" role="tablist" aria-label="Critério">
          {METRICS.map(m => (
            <button
              key={m.id}
              role="tab"
              aria-selected={metric === m.id}
              onClick={() => setMetric(m.id)}
              className={`flex items-center justify-center gap-1.5 rounded-xl py-2 text-sm font-extrabold cursor-pointer ${
                metric === m.id ? 'bg-white text-ink shadow-[0_2px_0_#E9E7F2]' : 'text-muted'
              }`}
            >
              <m.icon size={16} color={metric === m.id ? m.color : undefined} /> {m.label}
            </button>
          ))}
        </div>
        <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 lg:mx-0 lg:px-0">
          {PERIODS.map(p => (
            <button key={p.id} onClick={() => setPeriod(p.id)} className={`chip ${period === p.id ? 'border-brand! bg-brand-light! text-brand-dark!' : ''}`}>
              {p.label}
            </button>
          ))}
          {org && org.departments.length > 0 && (
            <>
              <span className="mx-1 w-0.5 shrink-0 bg-line" />
              <button onClick={() => setView(view === 'pessoas' ? 'departamentos' : 'pessoas')} className={`chip ${view === 'departamentos' ? 'border-accent! bg-accent-light! text-accent-dark!' : ''}`}>
                Por departamento
              </button>
              {view === 'pessoas' && (
                <select value={dept} onChange={e => setDept(e.target.value)} className="chip pr-2" aria-label="Filtrar departamento">
                  <option value="all">Todos</option>
                  {org.departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              )}
            </>
          )}
        </div>
      </header>

      <div className="px-4 pt-2 lg:px-0">
        {error && <p className="card mt-4 p-4 text-center font-bold text-danger">{error}</p>}
        {entries === null && !error ? (
          <div className="flex justify-center py-16"><Mascot size={80} className="animate-bounce-soft" /></div>
        ) : view === 'departamentos' && org ? (
          <ol className="card mt-4 divide-y-2 divide-line">
            {sortedDepts.map((d, i) => (
              <li key={d.id} className="flex items-center gap-3 px-4 py-3">
                <span className="w-6 text-center font-black text-muted">{i + 1}</span>
                <span className="h-9 w-9 shrink-0 rounded-xl" style={{ background: d.color }} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-black text-ink">{d.name}</span>
                  <span className="block text-xs font-bold text-muted">
                    {d.members} pessoa{d.members === 1 ? '' : 's'} · média {metricValue({ seconds: d.seconds / d.members, tasks: Math.round(d.tasks / d.members), points: Math.round(d.points / d.members) }, metric)}
                  </span>
                </span>
                <span className="font-black text-ink">{metricValue(d, metric)}</span>
              </li>
            ))}
            {sortedDepts.length === 0 && <li className="p-6 text-center font-semibold text-muted">Ainda sem departamentos com pessoas.</li>}
          </ol>
        ) : list.length === 0 ? (
          <div className="flex flex-col items-center py-14 text-center">
            <Mascot size={96} mood="sleepy" />
            <p className="mt-4 text-lg font-black text-ink">Ainda ninguém no ranking</p>
            <p className="mt-1 text-sm font-semibold text-muted">Liga o cronómetro e conclui tarefas para aparecer aqui.</p>
          </div>
        ) : (
          <>
            <Podium top={list.slice(0, 3)} metric={metric} />
            {meIndex >= 0 && (
              <div className="card mt-4 flex items-center gap-3 border-brand/40 bg-brand-light p-3">
                <span className="w-8 text-center text-lg font-black text-brand-dark">{meIndex + 1}º</span>
                <span className="flex-1 font-black text-brand-dark">A tua posição</span>
                <span className="font-black text-brand-dark">{metricValue(list[meIndex], metric)}</span>
              </div>
            )}
            <ol className="card mt-4 divide-y-2 divide-line">
              {list.map((e, i) => {
                const d = org?.deptById(e.departmentId)
                return (
                  <li key={e.id} className={`flex items-center gap-3 px-4 py-3 ${e.isMe ? 'bg-brand-light/60' : ''}`}>
                    <span className="w-6 text-center font-black" style={{ color: MEDALS[i] ?? '#A3A0B8' }}>{i + 1}</span>
                    <Avatar name={e.name} picture={e.picture} size={40} />
                    <span className="min-w-0 flex-1">
                      <span className={`block truncate font-black ${e.isMe ? 'text-brand-dark' : 'text-ink'}`}>{e.name}{e.isMe ? ' (tu)' : ''}</span>
                      <span className="block truncate text-xs font-bold text-muted">
                        {formatDuration(e.seconds)} · {e.tasks} tarefa{e.tasks === 1 ? '' : 's'} · {e.points} XP
                        {d ? ` · ${d.name}` : ''}
                      </span>
                    </span>
                    <span className="font-black text-ink">{metricValue(e, metric)}</span>
                  </li>
                )
              })}
            </ol>
            {!org && (
              <p className="mt-3 text-center text-xs font-semibold text-muted">
                Podes aparecer só com iniciais ou esconder-te do ranking no <Link href="/perfil" className="text-accent underline">Perfil</Link>.
              </p>
            )}
          </>
        )}
      </div>
    </div>
  )
}
