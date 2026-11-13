'use client'

import { useEffect, useRef, useState } from 'react'
import { ArrowCounterClockwiseIcon, PauseIcon, PlayIcon } from '@phosphor-icons/react'
import { SCENES } from './scenes'
import type { Lesson } from '../../lib/tutorial'

/** Duração de cada fase da cena */
export const STEP_MS = 5200

const reducedMotion = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

/**
 * Leitor de uma lição: a cena animada e as fases, em sincronia.
 * A barra de cada fase enche-se com uma animação CSS; quando acaba, passa à fase seguinte
 * (assim pausar a animação também pausa o avanço).
 *
 * - "page": as fases ficam numa lista por baixo (só a actual mostra a explicação);
 * - "compact": só a fase actual, para janelas pequenas (boas-vindas).
 */
export default function LessonPlayer({ lesson, variant = 'page', loop = true, onComplete }: {
  lesson: Lesson
  variant?: 'page' | 'compact'
  /** recomeça no fim (senão pára na última fase) */
  loop?: boolean
  /** chamado quando a última fase acaba */
  onComplete?: () => void
}) {
  const Scene = SCENES[lesson.id]
  const total = lesson.steps.length
  const [step, setStep] = useState(0)
  const [playing, setPlaying] = useState(() => !reducedMotion())
  // muda para recomeçar a cena (mesmo passo, animações do início)
  const [run, setRun] = useState(0)
  const done = useRef(false)
  const loopTimer = useRef<number | undefined>(undefined)
  useEffect(() => () => clearTimeout(loopTimer.current), [])

  const go = (n: number) => {
    clearTimeout(loopTimer.current)
    setStep(Math.max(0, Math.min(total - 1, n)))
    setRun(r => r + 1)
  }

  const next = () => {
    if (step < total - 1) return go(step + 1)
    if (!done.current) { done.current = true; onComplete?.() }
    if (loop) loopTimer.current = window.setTimeout(() => go(0), 900)
    else setPlaying(false)
  }

  const s = lesson.steps[step]
  const atEnd = step === total - 1 && !playing

  return (
    <div className="w-full">
      <div className={`relative ${playing ? '' : '[&_*]:![animation-play-state:paused]'}`}>
        <Scene key={`${lesson.id}-${run}`} step={step} />
        {!playing && (
          <button onClick={() => (atEnd ? (go(0), setPlaying(true)) : setPlaying(true))} aria-label="Ver a animação"
            className="absolute inset-0 flex items-center justify-center rounded-2xl bg-white/40 transition-colors hover:bg-white/20 cursor-pointer">
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-ink shadow-md transition-transform hover:scale-105">
              {atEnd ? <ArrowCounterClockwiseIcon size={20} /> : <PlayIcon size={20} weight="fill" />}
            </span>
          </button>
        )}
      </div>

      {/* progresso por fase + pausa */}
      <div className="mt-3 flex items-center gap-3">
        <div className="flex flex-1 gap-1" role="tablist" aria-label="Fases">
          {lesson.steps.map((x, i) => (
            <button key={i} role="tab" aria-selected={i === step} aria-label={`Fase ${i + 1}: ${x.title}`} onClick={() => go(i)}
              className="h-1 flex-1 cursor-pointer overflow-hidden rounded-full bg-line">
              {i < step && <span className="block h-full w-full rounded-full" style={{ background: lesson.color }} />}
              {i === step && (
                <span key={run} className="block h-full w-full origin-left rounded-full"
                  style={{ background: lesson.color, animation: `tut-progress ${STEP_MS}ms linear both`, animationPlayState: playing ? 'running' : 'paused' }}
                  onAnimationEnd={next} />
              )}
            </button>
          ))}
        </div>
        <button onClick={() => setPlaying(v => !v)} aria-label={playing ? 'Pausar' : 'Reproduzir'}
          className="rounded-full p-1.5 text-muted transition-colors hover:bg-snow hover:text-ink cursor-pointer">
          {playing ? <PauseIcon size={16} weight="fill" /> : <PlayIcon size={16} weight="fill" />}
        </button>
      </div>

      {variant === 'compact' ? (
        <div key={step} className="mt-3 animate-fade-in" aria-live="polite">
          <p className="font-black text-ink">{s.title}</p>
          <p className="text-sm font-semibold text-muted">{s.text}</p>
        </div>
      ) : (
        <ol className="mt-5 space-y-1">
          {lesson.steps.map((x, i) => {
            const on = i === step
            return (
              <li key={x.title}>
                <button onClick={() => go(i)} aria-current={on}
                  className="flex w-full gap-3 rounded-xl px-2 py-2 text-left transition-colors hover:bg-snow cursor-pointer">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-black transition-colors duration-300"
                    style={on || i < step ? { background: lesson.color, color: '#fff' } : { background: '#F0EEF7', color: '#A3A0B8' }}>{i + 1}</span>
                  <span className="min-w-0">
                    <span className={`block font-extrabold transition-colors ${on ? 'text-ink' : 'text-muted'}`}>{x.title}</span>
                    {on && <span className="block text-sm font-semibold text-body animate-fade-in" aria-live="polite">{x.text}</span>}
                  </span>
                </button>
              </li>
            )
          })}
        </ol>
      )}
    </div>
  )
}
