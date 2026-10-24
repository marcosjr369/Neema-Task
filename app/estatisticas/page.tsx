'use client'

import Link from 'next/link'
import { useState } from 'react'
import { CheckCircleIcon, ClockIcon, FireIcon, LightningIcon } from '@phosphor-icons/react'
import { useApp } from '../context/AppContext'
import { CATEGORY_CONFIG } from '../types'
import {
  bestStreak,
  categoryBreakdown,
  computeStreak,
  dailySeries,
  formatDuration,
  formatShort,
  peakHour,
  sumSeconds,
  totalXp,
  type DayPoint,
} from '../lib/stats'
import { CategoryBadge, CategoryGlyph } from '../components/ui/icons'

const RANGES = [
  { days: 7, label: '7 dias' },
  { days: 30, label: '30 dias' },
]

function DailyChart({ data, goalSeconds }: { data: DayPoint[]; goalSeconds: number }) {
  const [hover, setHover] = useState<number | null>(null)
  const max = Math.max(goalSeconds, ...data.map(d => d.seconds), 60)
  const goalPct = (goalSeconds / max) * 100
  const dense = data.length > 10
  const shown = hover !== null ? data[hover] : null

  return (
    <div>
      <div className="mb-2 h-10">
        {shown ? (
          <div>
            <div className="text-xs font-bold uppercase text-muted">
              {new Date(shown.start).toLocaleDateString('pt-PT', { weekday: 'long', day: 'numeric', month: 'short' })}
            </div>
            <div className="font-black text-ink">
              {formatDuration(shown.seconds)}
              <span className="ml-2 text-sm font-bold text-muted">· {shown.tasksDone} concluída{shown.tasksDone === 1 ? '' : 's'}</span>
            </div>
          </div>
        ) : (
          <div className="pt-2 text-sm font-bold text-muted">Passa o rato ou toca numa barra para ver o detalhe</div>
        )}
      </div>

      <div className="relative h-44" onMouseLeave={() => setHover(null)}>
        {/* linha do objetivo */}
        <div className="pointer-events-none absolute inset-x-0 border-t-2 border-dashed border-line" style={{ bottom: `${goalPct}%` }}>
          <span className="absolute -top-5 right-0 bg-white pl-1 text-[11px] font-extrabold uppercase text-muted">
            Objetivo {formatShort(goalSeconds)}
          </span>
        </div>
        <div className={`absolute inset-0 flex items-end ${dense ? 'gap-0.5' : 'gap-2'}`} role="list">
          {data.map((d, i) => {
            const h = (d.seconds / max) * 100
            const met = d.seconds >= goalSeconds
            const isToday = i === data.length - 1
            return (
              <button
                key={d.start}
                role="listitem"
                aria-label={`${d.label}: ${formatDuration(d.seconds)}`}
                onMouseEnter={() => setHover(i)}
                onFocus={() => setHover(i)}
                onClick={() => setHover(hover === i ? null : i)}
                className="flex h-full flex-1 items-end justify-center cursor-pointer"
              >
                <span
                  className="w-full max-w-9 rounded-t transition-[height,opacity] duration-500"
                  style={{
                    height: `${Math.max(h, d.seconds > 0 ? 2 : 0.8)}%`,
                    background: d.seconds === 0 ? '#E9E7F2' : met ? '#7B61FF' : isToday ? '#12B5A6' : '#8EDDD5',
                    opacity: hover === null || hover === i ? 1 : 0.45,
                  }}
                />
              </button>
            )
          })}
        </div>
      </div>
      <div className={`mt-2 flex ${dense ? 'gap-0.5' : 'gap-2'}`}>
        {data.map((d, i) => (
          <span key={d.start} className="flex-1 text-center text-[11px] font-bold capitalize text-muted">
            {!dense || i % 5 === 0 || i === data.length - 1 ? d.label : ''}
          </span>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap gap-4 text-xs font-bold text-muted">
        <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-sm bg-brand" /> Objetivo cumprido</span>
        <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-sm bg-[#8EDDD5]" /> Abaixo do objetivo</span>
      </div>
    </div>
  )
}

function StatTile({ icon, value, label, color }: { icon: React.ReactNode; value: string; label: string; color: string }) {
  return (
    <div className="card flex items-center gap-3 p-3">
      <span style={{ color }}>{icon}</span>
      <div className="min-w-0">
        <div className="truncate text-lg font-black leading-tight text-ink">{value}</div>
        <div className="truncate text-xs font-bold text-muted">{label}</div>
      </div>
    </div>
  )
}

export default function StatsPage() {
  const { allSessions, tasks, now, settings } = useApp()
  const [days, setDays] = useState(7)

  const series = dailySeries(allSessions, tasks, now, days)
  const from = series[0].start
  const inRange = allSessions.filter(s => s.start >= from)
  const rangeSeconds = sumSeconds(inRange)
  const rangeDone = series.reduce((a, d) => a + d.tasksDone, 0)
  const activeDays = series.filter(d => d.seconds > 0).length
  const best = series.reduce((b, d) => (d.seconds > b.seconds ? d : b), series[0])
  const { streak } = computeStreak(allSessions, tasks, now)
  const record = bestStreak(allSessions, tasks)
  const xp = totalXp(allSessions, tasks)
  const cats = categoryBreakdown(inRange)
  const peak = peakHour(inRange)
  const goalDays = series.filter(d => d.seconds >= settings.dailyGoalMinutes * 60).length

  const topTasks = tasks
    .map(t => ({ task: t, seconds: sumSeconds(inRange.filter(s => s.taskId === t.id)) }))
    .filter(x => x.seconds > 0)
    .sort((a, b) => b.seconds - a.seconds)
    .slice(0, 5)

  return (
    <div>
      <header className="sticky top-0 z-20 flex items-center justify-between border-b-2 border-line bg-white/95 px-4 py-4 backdrop-blur lg:px-0 lg:pt-6">
        <h1 className="text-2xl font-black text-ink">Estatísticas</h1>
        <div className="flex gap-1 rounded-xl bg-snow p-1" role="tablist" aria-label="Período">
          {RANGES.map(r => (
            <button
              key={r.days}
              role="tab"
              aria-selected={days === r.days}
              onClick={() => setDays(r.days)}
              className={`rounded-lg px-3 py-1 text-sm font-extrabold cursor-pointer ${
                days === r.days ? 'bg-white text-accent shadow-[0_2px_0_#E9E7F2]' : 'text-muted'
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </header>

      <div className="space-y-6 px-4 pt-5 lg:px-0">
        <section>
          <h2 className="mb-3 text-lg font-black text-ink">Resumo</h2>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatTile icon={<FireIcon size={28} weight="fill" />} color="#FF8A3D" value={`${streak} dia${streak === 1 ? '' : 's'}`} label={`Recorde: ${record}`} />
            <StatTile icon={<LightningIcon size={28} weight="fill" />} color="#FFC53D" value={`${xp} XP`} label="Total de XP" />
            <StatTile icon={<ClockIcon size={28} />} color="#12B5A6" value={formatDuration(rangeSeconds)} label={`Focado em ${days} dias`} />
            <StatTile icon={<CheckCircleIcon size={28} weight="fill" />} color="#7B61FF" value={String(rangeDone)} label="Tarefas concluídas" />
          </div>
        </section>

        <section className="card p-4">
          <div className="mb-1 flex items-baseline justify-between">
            <h2 className="text-lg font-black text-ink">Tempo focado por dia</h2>
            <span className="text-sm font-bold text-muted">{goalDays}/{days} objetivos</span>
          </div>
          <DailyChart data={series} goalSeconds={settings.dailyGoalMinutes * 60} />
        </section>

        <section className="grid grid-cols-3 gap-2">
          {[
            { label: 'Média/dia', value: formatShort(activeDays ? rangeSeconds / activeDays : 0) },
            { label: 'Melhor dia', value: best.seconds ? formatShort(best.seconds) : '—' },
            { label: 'Hora forte', value: peak === null ? '—' : `${peak}h` },
          ].map(s => (
            <div key={s.label} className="card p-3 text-center">
              <div className="text-xl font-black text-ink">{s.value}</div>
              <div className="text-[11px] font-bold uppercase text-muted">{s.label}</div>
            </div>
          ))}
        </section>

        <div className="space-y-6 lg:grid lg:grid-cols-2 lg:items-start lg:gap-6 lg:space-y-0">
        <section>
          <h2 className="mb-3 text-lg font-black text-ink">Por categoria</h2>
          {cats.length === 0 ? (
            <p className="card p-4 text-center text-sm font-semibold text-muted">Sem tempo registado neste período.</p>
          ) : (
            <ul className="card space-y-4 p-4">
              {cats.map(({ category, seconds }) => {
                const cfg = CATEGORY_CONFIG[category]
                const pct = rangeSeconds ? (seconds / rangeSeconds) * 100 : 0
                return (
                  <li key={category}>
                    <div className="mb-1.5 flex items-center justify-between text-sm">
                      <span className="flex items-center gap-2 font-bold text-body"><CategoryGlyph category={category} size={18} /> {cfg.label}</span>
                      <span className="font-bold text-muted">
                        <span className="text-ink">{formatDuration(seconds)}</span> · {Math.round(pct)}%
                      </span>
                    </div>
                    <div className="h-3 overflow-hidden rounded-full bg-snow">
                      <div className="h-full rounded-full" style={{ width: `${Math.max(pct, 2)}%`, background: cfg.color }} />
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </section>

        <section>
          <h2 className="mb-3 text-lg font-black text-ink">Tarefas com mais tempo</h2>
          {topTasks.length === 0 ? (
            <p className="card p-4 text-center text-sm font-semibold text-muted">Liga o cronómetro numa tarefa para aparecer aqui.</p>
          ) : (
            <ol className="card divide-y-2 divide-line">
              {topTasks.map(({ task, seconds }, i) => (
                <li key={task.id}>
                  <Link href={`/tarefas/${task.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-snow">
                    <span
                      className="flex h-7 w-7 items-center justify-center rounded-full text-sm font-black text-white"
                      style={{ background: i === 0 ? '#FFC53D' : i === 1 ? '#C0C0C0' : i === 2 ? '#CD7F32' : '#E9E7F2', color: i > 2 ? '#6E6A85' : '#fff' }}
                    >
                      {i + 1}
                    </span>
                    <CategoryBadge category={task.category} size={32} />
                    <span className="flex-1 truncate font-bold text-ink">{task.title}</span>
                    <span className="font-black text-body">{formatDuration(seconds)}</span>
                  </Link>
                </li>
              ))}
            </ol>
          )}
        </section>
        </div>
      </div>
    </div>
  )
}
