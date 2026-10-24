'use client'

import Link from 'next/link'
import { CoffeeIcon, PauseIcon, PlayIcon } from '@phosphor-icons/react'
import { useApp } from '../../context/AppContext'
import { CATEGORY_CONFIG } from '../../types'
import { formatClock, phaseElapsed } from '../../lib/stats'
import { CategoryGlyph } from '../ui/icons'

/** Barra flutuante com o temporizador activo, visível em todas as páginas */
export default function MiniTimer() {
  const { timer, activeTask, now, pauseTimer, resumeTimer } = useApp()
  if (!timer || !activeTask) return null

  const cat = CATEGORY_CONFIG[activeTask.category]
  const isBreak = timer.phase === 'break'
  const elapsed = phaseElapsed(timer, now)
  const shown = isBreak ? timer.breakSeconds - elapsed : elapsed
  const paused = !timer.segmentStart
  const accent = isBreak ? '#12B5A6' : cat.color

  return (
    <div className="card pointer-events-auto flex w-full items-center gap-3 border-b-4 p-2 pr-3 shadow-lg animate-slide-up">
      <Link href="/foco" className="flex min-w-0 flex-1 items-center gap-3">
        <span
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
          style={{ background: isBreak ? '#DCF7F3' : cat.light, color: isBreak ? '#0D9488' : cat.dark }}
        >
          {isBreak ? <CoffeeIcon size={24} weight="duotone" /> : <CategoryGlyph category={activeTask.category} size={24} />}
        </span>
        <span className="min-w-0">
          <span className="block text-[11px] font-extrabold uppercase tracking-wider" style={{ color: accent }}>
            {isBreak ? 'Pausa' : paused ? 'Em pausa' : 'A focar'}
          </span>
          <span className="block truncate text-sm font-bold text-ink">{activeTask.title}</span>
        </span>
      </Link>
      <span className="font-mono text-lg font-bold tabular-nums text-ink">{formatClock(Math.max(0, shown))}</span>
      <button
        onClick={paused ? resumeTimer : pauseTimer}
        aria-label={paused ? 'Retomar' : 'Pausar'}
        className={`btn h-10 w-10 rounded-xl p-0 ${paused ? 'btn-primary' : 'btn-ghost text-body'}`}
      >
        {paused ? <PlayIcon size={18} weight="fill" /> : <PauseIcon size={18} weight="fill" />}
      </button>
    </div>
  )
}
