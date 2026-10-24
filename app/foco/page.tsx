'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { CheckIcon, CoffeeIcon, PauseIcon, PlayIcon, SkipForwardIcon, StopIcon, XIcon, TimerIcon } from '@phosphor-icons/react'
import { useApp } from '../context/AppContext'
import ProgressRing from '../components/ui/ProgressRing'
import Mascot from '../components/ui/Mascot'
import { CATEGORY_CONFIG } from '../types'
import { formatClock, formatDuration, phaseElapsed, taskSeconds } from '../lib/stats'
import { CategoryBadge, CategoryGlyph } from '../components/ui/icons'

function Header({ progress, color, right }: { progress: number; color: string; right?: React.ReactNode }) {
  const router = useRouter()
  return (
    <header className="flex items-center gap-4 px-4 pt-[calc(1rem+env(safe-area-inset-top))]">
      <button
        onClick={() => (window.history.length > 1 ? router.back() : router.push('/'))}
        aria-label="Fechar"
        className="text-muted hover:text-body cursor-pointer"
      >
        <XIcon size={28} />
      </button>
      <div className="h-4 flex-1 overflow-hidden rounded-full bg-line">
        <div className="relative h-full rounded-full transition-[width] duration-700" style={{ width: `${Math.min(100, progress * 100)}%`, background: color }}>
          <span className="absolute inset-x-2 top-1 h-1 rounded-full bg-white/30" />
        </div>
      </div>
      {right}
    </header>
  )
}

/** Escolha de tarefa quando não há temporizador activo */
function Picker() {
  const { tasks, allSessions, startTimer, openTaskSheet } = useApp()
  const open = tasks.filter(t => t.status !== 'done')

  return (
    <div className="flex min-h-dvh flex-col">
      <Header progress={0} color="#7B61FF" />
      <div className="flex-1 px-4 pt-6">
        <div className="flex items-center gap-4">
          <Mascot size={80} />
          <div className="relative rounded-2xl border-2 border-line px-4 py-3 font-bold text-body">
            Em que vais focar agora?
            <span className="absolute -left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 rotate-45 border-b-2 border-l-2 border-line bg-white" />
          </div>
        </div>

        <div className="mt-6 space-y-3 pb-8">
          {open.length === 0 && (
            <div className="card p-6 text-center">
              <p className="font-bold text-muted">Não tens tarefas por fazer.</p>
              <button onClick={() => openTaskSheet()} className="btn btn-primary mt-4 w-full">Criar tarefa</button>
            </div>
          )}
          {open.map(t => {
            return (
              <button
                key={t.id}
                onClick={() => startTimer(t.id)}
                className="card flex w-full items-center gap-3 border-b-4 p-3 text-left transition-transform active:translate-y-[2px] active:border-b-2 hover:bg-snow cursor-pointer"
              >
                <CategoryBadge category={t.category} size={48} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-bold text-ink">{t.title}</span>
                  <span className="block text-xs font-bold text-muted">
                    {formatDuration(taskSeconds(allSessions, t.id))} registados · blocos de {t.focusDuration} min
                  </span>
                </span>
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-brand text-white shadow-[0_3px_0_#5B43D6]">
                  <PlayIcon size={18} weight="fill" className="ml-0.5" />
                </span>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export default function FocusPage() {
  const {
    timer, activeTask, now, allSessions,
    pauseTimer, resumeTimer, stopTimer, startBreak, backToFocus, setStatus,
  } = useApp()

  if (!timer || !activeTask) return <Picker />

  const cat = CATEGORY_CONFIG[activeTask.category]
  const isBreak = timer.phase === 'break'
  const paused = !timer.segmentStart
  const elapsed = phaseElapsed(timer, now)
  const limit = isBreak ? timer.breakSeconds : timer.blockSeconds
  const progress = elapsed / limit
  const overtime = !isBreak && elapsed > timer.blockSeconds
  const color = isBreak ? '#12B5A6' : overtime ? '#FF8A3D' : cat.color
  const total = taskSeconds(allSessions, activeTask.id)

  return (
    <div className={`flex min-h-dvh flex-col transition-colors ${isBreak ? 'bg-accent-light' : 'bg-white'}`}>
      <Header
        progress={progress}
        color={color}
        right={
          <span className="flex items-center gap-1 text-sm font-black text-danger" aria-label={`${timer.pomodoros} pausas feitas`}>
            <TimerIcon size={16} weight="fill" /> {timer.pomodoros}
          </span>
        }
      />

      <div className="flex flex-1 flex-col px-5 pt-6">
        <span className="flex items-center gap-2 text-sm font-extrabold uppercase tracking-wider" style={{ color: isBreak ? '#0D9488' : cat.dark }}>
          {isBreak ? <><CoffeeIcon size={18} /> Pausa</> : <><CategoryGlyph category={activeTask.category} size={18} color="currentColor" /> {cat.label}</>}
        </span>
        <Link href={`/tarefas/${activeTask.id}`} className="mt-1 text-2xl font-black text-ink hover:underline">
          {isBreak ? 'Descansa um pouco' : activeTask.title}
        </Link>

        <div className="flex flex-1 flex-col items-center justify-center py-8">
          <ProgressRing size={260} stroke={18} progress={progress} color={color} track={isBreak ? '#FFFFFF' : cat.light}>
            {isBreak ? (
              <Mascot size={70} mood="sleepy" />
            ) : (
              <Mascot size={70} mood={paused ? 'sleepy' : 'happy'} className={paused ? '' : 'animate-bounce-soft'} />
            )}
            <span className="mt-1 font-mono text-5xl font-bold tabular-nums text-ink">
              {formatClock(isBreak ? limit - elapsed : elapsed)}
            </span>
            <span className="text-sm font-bold" style={{ color: overtime ? '#DB6A1F' : '#A3A0B8' }}>
              {isBreak
                ? `de ${formatDuration(limit)}`
                : overtime
                  ? `+${formatClock(elapsed - limit)} além do bloco`
                  : `pausa em ${formatClock(limit - elapsed)}`}
            </span>
          </ProgressRing>

          <div className="mt-6 grid w-full grid-cols-2 gap-3">
            <div className="card bg-white/70 p-3 text-center">
              <div className="text-lg font-black text-ink">{formatDuration(total)}</div>
              <div className="text-xs font-bold uppercase text-muted">Total na tarefa</div>
            </div>
            <div className="card bg-white/70 p-3 text-center">
              <div className="text-lg font-black text-ink">{paused ? 'Pausado' : isBreak ? 'A descansar' : 'A focar'}</div>
              <div className="text-xs font-bold uppercase text-muted">Estado</div>
            </div>
          </div>
        </div>
      </div>

      <div className="border-t-2 border-line bg-white px-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] pt-4">
        {isBreak ? (
          <>
            <button onClick={backToFocus} className="btn btn-accent w-full">
              <SkipForwardIcon size={18} weight="fill" /> Saltar pausa
            </button>
            <button onClick={paused ? resumeTimer : pauseTimer} className="btn btn-ghost mt-3 w-full">
              {paused ? 'Retomar pausa' : 'Congelar pausa'}
            </button>
          </>
        ) : (
          <>
            <button onClick={paused ? resumeTimer : pauseTimer} className={`btn w-full ${paused ? 'btn-primary' : 'btn-warm'}`}>
              {paused ? <PlayIcon size={18} weight="fill" /> : <PauseIcon size={18} weight="fill" />}
              {paused ? 'Continuar' : 'Pausar'}
            </button>
            <div className="mt-3 grid grid-cols-3 gap-2">
              {!cat.isRest && (
                <button onClick={startBreak} className="btn btn-ghost px-2 text-xs">
                  <CoffeeIcon size={16} /> Pausa
                </button>
              )}
              <button onClick={stopTimer} className={`btn btn-ghost px-2 text-xs text-body ${cat.isRest ? 'col-span-2' : ''}`}>
                <StopIcon size={14} weight="fill" /> Parar
              </button>
              <button onClick={() => setStatus(activeTask.id, 'done')} className="btn btn-ghost px-2 text-xs text-brand-dark">
                <CheckIcon size={16} /> Concluir
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
