'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useRef } from 'react'
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

/** Cores das "unidades" (um dia de histórico cada), em ciclo */
const UNIT_COLORS = [
  { bg: '#7B61FF', dark: '#5B43D6' },
  { bg: '#12B5A6', dark: '#0D9488' },
  { bg: '#FF8A3D', dark: '#DB6A1F' },
  { bg: '#EC5BA6', dark: '#C93F87' },
  { bg: '#4C7DFF', dark: '#3461E0' },
]

/** "Ontem", "seg., 20 out." ou "Mais antigas" (tarefas sem data de conclusão) */
function dayName(day: number, today: number) {
  if (day === 0) return 'Mais antigas'
  const diff = Math.round((today - day) / 86_400_000)
  if (diff === 1) return 'Ontem'
  return new Date(day).toLocaleDateString('pt-PT', { weekday: 'long', day: 'numeric', month: 'long' })
}

/** Cabeçalho de cada dia do histórico, como as unidades do Duolingo */
function UnitBanner({ index, label, count, seconds }: { index: number; label: string; count: number; seconds: number }) {
  const c = UNIT_COLORS[index % UNIT_COLORS.length]
  return (
    <div className="flex items-center gap-3 rounded-2xl px-4 py-3 text-white" style={{ background: c.bg, boxShadow: `0 4px 0 ${c.dark}` }}>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-extrabold uppercase tracking-wider text-white/75">Dia {index + 1}</p>
        <h3 className="truncate text-lg font-black first-letter:uppercase">{label}</h3>
      </div>
      <span className="shrink-0 text-right text-xs font-extrabold text-white/85">
        {count} tarefa{count === 1 ? '' : 's'}
        {seconds > 0 && <span className="block">{formatDuration(seconds)} de foco</span>}
      </span>
    </div>
  )
}

/** Baú no fim de cada dia: dourado quando a meta de foco desse dia foi cumprida */
function Chest({ index, open, label, live = false }: { index: number; open: boolean; label: string; live?: boolean }) {
  return (
    <div style={{ transform: `translateX(${OFFSETS[index % OFFSETS.length]}px)` }}>
      <div className="flex flex-col items-center animate-rise">
        <div
          className={`flex h-[68px] w-[72px] items-center justify-center rounded-2xl ${open && live ? 'animate-bounce-soft animate-pulse-ring' : ''}`}
          style={{ background: open ? '#FFC53D' : '#E9E7F2', boxShadow: `0 7px 0 ${open ? '#E0A419' : '#D3D0E0'}` }}
        >
          <GiftIcon size={34} weight={open ? 'fill' : 'bold'} color={open ? '#fff' : '#A3A0B8'} />
        </div>
        <span className="mt-3 text-sm font-bold text-muted">{label}</span>
      </div>
    </div>
  )
}

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
    <div id={current ? 'caminho-actual' : undefined} className={highlight ? 'mt-10' : ''} style={{ transform: `translateX(${offset}px)` }}>
      <div className="relative flex flex-col items-center animate-rise" style={{ animationDelay: `${Math.min(index % 10, 6) * 80}ms` }}>
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
        {/* Udacha ao lado da tarefa actual, do lado oposto ao zigue-zague */}
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
  const doneToday = tasks
    .filter(t => t.status === 'done' && (t.completedAt ?? 0) >= dayStart)
    .sort((a, b) => (a.completedAt ?? 0) - (b.completedAt ?? 0))

  // histórico: tarefas concluídas em dias anteriores, agrupadas por dia (mais antigo primeiro)
  const pastByDay = new Map<number, Task[]>()
  for (const t of tasks) {
    if (t.status !== 'done' || (t.completedAt ?? 0) >= dayStart) continue
    const day = t.completedAt ? startOfDay(t.completedAt) : 0 // sem data: grupo "mais antigas"
    pastByDay.set(day, [...(pastByDay.get(day) ?? []), t])
  }
  const pastDays = [...pastByDay.entries()]
    .sort(([a], [b]) => a - b)
    .map(([day, list]) => ({ day, tasks: list.sort((a, b) => (a.completedAt ?? 0) - (b.completedAt ?? 0)) }))
  // foco por dia, para saber em que dias a meta foi cumprida (baú aberto)
  const focusByDay = new Map<number, number>()
  allSessions.forEach(s => { const d = startOfDay(s.start); focusByDay.set(d, (focusByDay.get(d) ?? 0) + s.seconds) })

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
  // nós do histórico antes de hoje (tarefas + um baú por dia): o zigue-zague continua a partir daí
  const todayStart = pastDays.reduce((a, d) => a + d.tasks.length + 1, 0)

  // com histórico, abre já na tarefa actual (como o Duolingo abre na lição em curso)
  const scrolled = useRef(false)
  useEffect(() => {
    if (scrolled.current || pastDays.length === 0) return
    scrolled.current = true
    const el = document.getElementById('caminho-actual') ?? document.getElementById('caminho-hoje')
    el?.scrollIntoView({ block: 'center' })
  }, [pastDays.length])

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
          <Link href="/empresa/tarefas" className="card flex items-center gap-3 border-b-4 border-warm/60 bg-warm-light p-3 hover:brightness-[1.02]">
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

        {/* Caminho: todo o histórico por dias e, no fim, o dia de hoje */}
        {path.length === 0 && pastDays.length === 0 ? (
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
          <section aria-label="Caminho">
            {pastDays.map((d, u) => {
              // o zigue-zague continua de um dia para o outro
              const start = pastDays.slice(0, u).reduce((a, x) => a + x.tasks.length + 1, 0)
              const secs = focusByDay.get(d.day) ?? 0
              return (
                <div key={d.day} className="pb-4">
                  <UnitBanner index={u} label={dayName(d.day, dayStart)} count={d.tasks.length} seconds={secs} />
                  <div className="flex flex-col items-center gap-7 py-6">
                    {d.tasks.map((t, i) => (
                      <PathNode key={t.id} task={t} index={start + i} done active={false} current={false} cheer={false} />
                    ))}
                    <Chest index={start + d.tasks.length} open={d.day > 0 && secs >= goal} label={d.day > 0 && secs >= goal ? 'Meta cumprida' : 'Meta por cumprir'} />
                  </div>
                </div>
              )
            })}

            {/* hoje: concluídas hoje, por fazer e o baú do objetivo diário */}
            <div className="flex items-center gap-3 py-2" id="caminho-hoje">
              <span className="h-0.5 flex-1 bg-line" />
              <h2 className="text-sm font-extrabold uppercase tracking-wider text-muted">
                Hoje · {doneToday.length}/{path.length}
              </h2>
              <span className="h-0.5 flex-1 bg-line" />
            </div>
            <div className="flex flex-col items-center gap-7 py-6">
              {path.map((t, i) => (
                <PathNode
                  key={t.id}
                  task={t}
                  index={todayStart + i}
                  done={t.status === 'done'}
                  active={timer?.taskId === t.id}
                  current={timer ? timer.taskId === t.id : t.id === next?.id}
                  cheer={doneToday.length > 0}
                />
              ))}
              <Chest
                index={todayStart + path.length}
                open={goalReached}
                live
                label={goalReached ? 'Objetivo cumprido!' : `Faltam ${formatDuration(goal - today)}`}
              />
            </div>
          </section>
        )}
      </div>
    </>
  )
}
