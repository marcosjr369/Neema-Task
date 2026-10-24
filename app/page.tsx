'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { BellIcon, ChartBarIcon, CheckIcon, ClipboardTextIcon, CoffeeIcon, GiftIcon, PlayIcon } from '@phosphor-icons/react'
import { useApp } from './context/AppContext'
import { useAccount } from './context/AccountContext'
import { useOrg } from './context/OrgContext'
import TopBar from './components/layout/TopBar'
import Mascot from './components/ui/Mascot'
import { CategoryBadge, CategoryGlyph } from './components/ui/icons'
import { CATEGORY_CONFIG, PRIORITY_CONFIG, Task } from './types'
import { formatClock, formatDuration, phaseElapsed, startOfDay, todaySeconds } from './lib/stats'

/** Deslocamento horizontal dos nós, em zigue-zague */
const OFFSETS = [0, 44, 66, 44, 0, -44, -66, -44]

function greeting(now: number) {
  const h = new Date(now).getHours()
  if (h < 6) return 'Boa madrugada'
  if (h < 13) return 'Bom dia'
  if (h < 20) return 'Boa tarde'
  return 'Boa noite'
}

const PRIORITY_ORDER = { alta: 0, media: 1, baixa: 2 }

function PathNode({
  task, index, done, active, current, cheer,
}: { task: Task; index: number; done: boolean; active: boolean; current: boolean; cheer: boolean }) {
  const router = useRouter()
  const cat = CATEGORY_CONFIG[task.category]
  const color = done ? '#FFC53D' : cat.color
  const dark = done ? '#E0A419' : cat.dark
  const offset = OFFSETS[index % OFFSETS.length]
  const highlight = active || current

  return (
    // o deslocamento fica no invólucro; a animação de entrada no filho (as duas usam transform)
    <div className={highlight ? 'mt-10' : ''} style={{ transform: `translateX(${offset}px)` }}>
      <div className="relative flex flex-col items-center animate-rise" style={{ animationDelay: `${index * 90}ms` }}>
        {highlight && (
          <span className="absolute -top-11 z-10 animate-bounce-soft">
            <span
              className={`relative block whitespace-nowrap rounded-xl border-2 bg-white px-3 py-1.5 text-xs font-black uppercase tracking-wide ${active ? 'border-danger/40 text-danger' : 'border-line'}`}
              style={active ? undefined : { color: cat.dark }}
            >
              {active ? 'A focar' : 'Começar'}
              <span className={`absolute -bottom-1.5 left-1/2 h-2.5 w-2.5 -translate-x-1/2 rotate-45 border-b-2 border-r-2 bg-white ${active ? 'border-danger/40' : 'border-line'}`} />
            </span>
          </span>
        )}
        {/* Marcos ao lado da tarefa actual, do lado oposto ao zigue-zague */}
        {current && (
          <span className={`pointer-events-none absolute top-0 ${offset > 0 ? 'right-full mr-4' : 'left-full ml-4'}`}>
            <Mascot size={88} animated wave={cheer} mood={cheer ? 'excited' : 'happy'} />
          </span>
        )}
        <button
          onClick={() => router.push(`/tarefas/${task.id}`)}
          aria-label={task.title}
          className={`group relative flex h-[68px] w-[72px] items-center justify-center rounded-[50%] transition-transform hover:scale-105 active:translate-y-[4px] cursor-pointer ${current && !active ? 'animate-pulse-ring' : ''}`}
          style={{
            background: color,
            boxShadow: `0 ${active ? 4 : 7}px 0 ${dark}`,
            outline: highlight ? `6px solid ${cat.light}` : undefined,
          }}
        >
          <span className="transition-transform group-hover:animate-wiggle">
            {done ? <CheckIcon size={34} weight="bold" color="#fff" /> : <CategoryGlyph category={task.category} size={34} weight="fill" color="#fff" />}
          </span>
          {task.priority === 'alta' && !done && (
            <span className="absolute -right-1 -top-1 h-4 w-4 rounded-full border-2 border-white" style={{ background: PRIORITY_CONFIG.alta.color }} />
          )}
        </button>
        <span className={`mt-3 max-w-36 truncate text-center text-sm font-bold ${done ? 'text-muted' : 'text-body'}`}>
          {task.title}
        </span>
      </div>
    </div>
  )
}

export default function HomePage() {
  const {
    tasks, allSessions, settings, now, timer, activeTask,
    openTaskSheet, startTimer, notificationPermission, requestNotifications,
  } = useApp()
  const { user } = useAccount()
  const firstName = user?.name.split(' ')[0] ?? ''
  const org = useOrg()
  const toReview = org?.teamTasks.filter(t => t.status === 'done' && t.review?.status === 'pending').length ?? 0

  const today = todaySeconds(allSessions, now)
  const goal = settings.dailyGoalMinutes * 60
  const goalProgress = Math.min(1, today / goal)
  const goalReached = today >= goal

  const dayStart = startOfDay(now)
  const doneToday = tasks.filter(t => t.status === 'done' && (t.completedAt ?? 0) >= dayStart)
  const open = tasks
    .filter(t => t.status !== 'done')
    .sort((a, b) => {
      if (a.status !== b.status) return a.status === 'doing' ? -1 : 1
      if (a.priority !== b.priority) return PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]
      const da = a.deadline ? new Date(a.deadline).getTime() : Infinity
      const db = b.deadline ? new Date(b.deadline).getTime() : Infinity
      return da - db
    })
  const path = [...doneToday, ...open]
  const next = open[0]

  return (
    <>
      <TopBar />

      <div className="space-y-5 px-4 pt-5">
        {/* Objetivo diário — banner ao estilo "unidade" */}
        <section className="flex overflow-hidden rounded-2xl bg-brand text-white shadow-[0_4px_0_#5B43D6] animate-rise">
          <div className="flex shrink-0 items-end pb-1 pl-3 pt-4">
            <Mascot size={68} animated wave={goalReached} mood={goalReached ? 'excited' : 'happy'} />
          </div>
          <div className="min-w-0 flex-1 p-4 pl-2">
            <p className="text-xs font-extrabold uppercase tracking-wider text-white/80">
              {greeting(now)}, {firstName}
            </p>
            <h1 className="mt-0.5 text-xl font-black leading-tight">
              {goalReached ? 'Objetivo diário cumprido!' : 'Objetivo diário de foco'}
            </h1>
            <div className="mt-3 flex items-center gap-3">
              <div className="h-4 flex-1 overflow-hidden rounded-full bg-black/15">
                <div
                  className="relative h-full rounded-full bg-gold transition-[width] duration-700"
                  style={{ width: `${Math.max(goalProgress * 100, 4)}%` }}
                >
                  <span className="absolute inset-x-2 top-1 h-1 rounded-full bg-white/40" />
                </div>
              </div>
              <span className="text-sm font-extrabold tabular-nums">
                {Math.floor(today / 60)}/{settings.dailyGoalMinutes} min
              </span>
            </div>
          </div>
          <Link
            href="/estatisticas"
            aria-label="Ver estatísticas"
            className="flex w-16 items-center justify-center border-l-2 border-black/10 hover:bg-black/5"
          >
            <ChartBarIcon size={26} />
          </Link>
        </section>

        {toReview > 0 && (
          <Link href="/empresa?tab=tarefas" className="card flex items-center gap-3 border-b-4 border-warm/60 bg-warm-light p-3 hover:brightness-[1.02]">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-warm text-white">
              <ClipboardTextIcon size={22} />
            </span>
            <span className="flex-1">
              <span className="block font-extrabold text-ink">{toReview} tarefa{toReview === 1 ? '' : 's'} por rever</span>
              <span className="block text-xs font-semibold text-muted">A tua equipa está à espera de aprovação</span>
            </span>
          </Link>
        )}

        {notificationPermission === 'default' && (
          <button
            onClick={requestNotifications}
            className="card flex w-full items-center gap-3 border-b-4 p-3 text-left hover:bg-snow cursor-pointer"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-warm-light text-warm">
              <BellIcon size={22} weight="fill" />
            </span>
            <span className="flex-1">
              <span className="block font-extrabold text-ink">Activar notificações</span>
              <span className="block text-xs font-semibold text-muted">Alertas de pausa e de prazos, mesmo noutra janela</span>
            </span>
          </button>
        )}

        {/* Continuar / próxima tarefa */}
        {timer && activeTask ? (
          <Link
            href="/foco"
            className="card flex items-center gap-3 border-b-4 p-4"
            style={{ borderColor: CATEGORY_CONFIG[activeTask.category].color }}
          >
            {timer.phase === 'break' ? (
              <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent-light text-accent-dark"><CoffeeIcon size={26} weight="duotone" /></span>
            ) : (
              <CategoryBadge category={activeTask.category} size={48} />
            )}
            <span className="min-w-0 flex-1">
              <span className="block text-xs font-extrabold uppercase tracking-wider text-danger">
                {timer.phase === 'break' ? 'Em pausa' : 'A decorrer'}
              </span>
              <span className="block truncate font-black text-ink">{activeTask.title}</span>
            </span>
            <span className="font-mono text-xl font-bold tabular-nums text-ink">
              {formatClock(timer.phase === 'break' ? timer.breakSeconds - phaseElapsed(timer, now) : phaseElapsed(timer, now))}
            </span>
          </Link>
        ) : next ? (
          <div className="card flex items-center gap-3 border-b-4 p-4">
            <CategoryBadge category={next.category} size={48} />
            <span className="min-w-0 flex-1">
              <span className="block text-xs font-extrabold uppercase tracking-wider text-muted">Próxima</span>
              <span className="block truncate font-black text-ink">{next.title}</span>
            </span>
            <button onClick={() => startTimer(next.id)} className="btn btn-primary shrink-0 px-3 py-2.5 text-sm">
              <PlayIcon size={16} weight="fill" /> Começar
            </button>
          </div>
        ) : null}

        {/* Caminho do dia */}
        {path.length === 0 ? (
          <section className="flex flex-col items-center px-4 py-10 text-center">
            <Mascot size={130} animated wave />
            <h2 className="mt-4 text-2xl font-black text-ink">Vamos começar?</h2>
            <p className="mt-1 max-w-xs font-semibold text-muted">
              Cria uma tarefa, liga o cronómetro e vê quanto tempo trabalhas e estudas.
            </p>
            <button onClick={() => openTaskSheet()} className="btn btn-primary mt-6 w-full max-w-xs">
              Criar primeira tarefa
            </button>
          </section>
        ) : (
          <section aria-label="Caminho de hoje">
            <div className="flex items-center gap-3 py-2">
              <span className="h-0.5 flex-1 bg-line" />
              <h2 className="text-sm font-extrabold uppercase tracking-wider text-muted">
                Caminho de hoje · {doneToday.length}/{path.length}
              </h2>
              <span className="h-0.5 flex-1 bg-line" />
            </div>
            <div className="flex flex-col items-center gap-7 py-6">
              {path.map((t, i) => (
                <PathNode
                  key={t.id}
                  task={t}
                  index={i}
                  done={t.status === 'done'}
                  active={timer?.taskId === t.id}
                  current={timer ? timer.taskId === t.id : t.id === next?.id}
                  cheer={doneToday.length > 0}
                />
              ))}
              {/* Baú: recompensa do objetivo diário */}
              <div style={{ transform: `translateX(${OFFSETS[path.length % OFFSETS.length]}px)` }}>
              <div className="flex flex-col items-center animate-rise" style={{ animationDelay: `${path.length * 90}ms` }}>
                <div
                  className={`flex h-[68px] w-[72px] items-center justify-center rounded-2xl ${goalReached ? 'animate-bounce-soft animate-pulse-ring' : ''}`}
                  style={{
                    background: goalReached ? '#FFC53D' : '#E9E7F2',
                    boxShadow: `0 7px 0 ${goalReached ? '#E0A419' : '#D3D0E0'}`,
                  }}
                >
                  <GiftIcon size={34} color={goalReached ? '#fff' : '#A3A0B8'} />
                </div>
                <span className="mt-3 text-sm font-bold text-muted">
                  {goalReached ? 'Objetivo cumprido!' : `Faltam ${formatDuration(goal - today)}`}
                </span>
              </div>
              </div>
            </div>
          </section>
        )}
      </div>
    </>
  )
}
