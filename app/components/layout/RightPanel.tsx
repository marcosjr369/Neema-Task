'use client'

import Link from 'next/link'
import { CalendarBlankIcon, FireIcon, LightningIcon, TimerIcon } from '@phosphor-icons/react'
import { useApp } from '../../context/AppContext'
import {
  computeStreak,
  dailySeries,
  formatDeadline,
  formatDuration,
  formatShort,
  levelInfo,
  todaySeconds,
  totalXp,
} from '../../lib/stats'
import MiniTimer from '../focus/MiniTimer'
import { CategoryBadge } from '../ui/icons'

/** Coluna lateral direita (desktop): resumo, temporizador, objetivo, prazos */
export default function RightPanel() {
  const { allSessions, tasks, now, settings, timer } = useApp()
  const { streak, activeToday } = computeStreak(allSessions, tasks, now)
  const xp = totalXp(allSessions, tasks)
  const lvl = levelInfo(xp)
  const today = todaySeconds(allSessions, now)
  const goal = settings.dailyGoalMinutes * 60
  const week = dailySeries(allSessions, tasks, now, 7)
  const upcoming = tasks
    .filter(t => t.deadline && t.status !== 'done')
    .sort((a, b) => new Date(a.deadline!).getTime() - new Date(b.deadline!).getTime())
    .slice(0, 4)

  return (
    <aside className="sticky top-0 hidden h-dvh w-[340px] shrink-0 space-y-5 overflow-y-auto py-6 lg:block">
      <div className="flex items-center justify-between px-1">
        <Link href="/perfil" className="flex items-center gap-2 font-extrabold text-brand-dark" aria-label={`Nível ${lvl.level}`}>
          <span className="flex h-8 min-w-8 items-center justify-center rounded-lg bg-brand px-2 text-sm font-black text-white">{lvl.level}</span>
          Nível
        </Link>
        <span className="flex items-center gap-1 font-extrabold" style={{ color: activeToday ? '#FF8A3D' : '#A3A0B8' }}>
          <FireIcon size={22} weight="fill" /> {streak}
        </span>
        <span className="flex items-center gap-1 font-extrabold text-gold-dark">
          <LightningIcon size={22} weight="fill" color="#FFC53D" /> {xp}
        </span>
        <span className="flex items-center gap-1 font-extrabold" style={{ color: timer ? '#F2545B' : '#12B5A6' }}>
          <TimerIcon size={22} /> {formatShort(today)}
        </span>
      </div>

      {timer ? (
        <MiniTimer />
      ) : (
        <Link href="/foco" className="card flex items-center gap-3 border-b-4 p-4 hover:bg-snow">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-danger-light text-danger">
            <TimerIcon size={24} />
          </span>
          <span>
            <span className="block font-extrabold text-ink">Nenhum foco activo</span>
            <span className="block text-sm font-semibold text-muted">Escolhe uma tarefa e começa</span>
          </span>
        </Link>
      )}

      <section className="card p-4">
        <div className="flex items-baseline justify-between">
          <h2 className="font-black text-ink">Objetivo diário</h2>
          <span className="text-sm font-bold text-muted">{Math.floor(today / 60)}/{settings.dailyGoalMinutes} min</span>
        </div>
        <div className="mt-3 h-4 overflow-hidden rounded-full bg-line">
          <div className="relative h-full rounded-full bg-gold transition-[width] duration-700" style={{ width: `${Math.max(3, Math.min(100, (today / goal) * 100))}%` }}>
            <span className="absolute inset-x-2 top-1 h-1 rounded-full bg-white/40" />
          </div>
        </div>
        <div className="mt-4 flex justify-between">
          {week.map((d, i) => {
            const met = d.seconds >= goal
            const any = d.seconds > 0
            return (
              <div key={d.start} className="flex flex-col items-center gap-1" title={`${d.label}: ${formatDuration(d.seconds)}`}>
                <span
                  className="flex h-8 w-8 items-center justify-center rounded-full"
                  style={{
                    background: met ? '#FF8A3D' : any ? '#FFEDE0' : '#F1F0F6',
                    outline: i === week.length - 1 ? '2px solid #FF8A3D' : undefined,
                    outlineOffset: 2,
                  }}
                >
                  <FireIcon size={16} weight="fill" color={met ? '#fff' : any ? '#FF8A3D' : '#D3D0E0'} />
                </span>
                <span className="text-[11px] font-bold capitalize text-muted">{d.label}</span>
              </div>
            )
          })}
        </div>
      </section>

      <section className="card p-4">
        <h2 className="mb-3 font-black text-ink">Próximos prazos</h2>
        {upcoming.length === 0 ? (
          <p className="text-sm font-semibold text-muted">Sem prazos marcados.</p>
        ) : (
          <ul className="space-y-3">
            {upcoming.map(t => {
              const d = formatDeadline(t.deadline!, now)
              return (
                <li key={t.id}>
                  <Link href={`/tarefas/${t.id}`} className="flex items-center gap-3">
                    <CategoryBadge category={t.category} size={36} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-bold text-ink">{t.title}</span>
                      <span className={`flex items-center gap-1 text-xs font-bold ${d.late ? 'text-danger' : 'text-muted'}`}>
                        <CalendarBlankIcon size={12} /> {d.text}
                      </span>
                    </span>
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </aside>
  )
}
