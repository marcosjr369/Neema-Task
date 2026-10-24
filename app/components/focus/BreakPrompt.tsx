'use client'

import { useApp } from '../../context/AppContext'
import { formatDuration, phaseElapsed } from '../../lib/stats'
import Mascot from '../ui/Mascot'

/** Painel inferior (estilo "feedback" de lição) que pede para pausar / voltar */
export default function BreakPrompt() {
  const { prompt, timer, activeTask, now, settings, startBreak, extendFocus, backToFocus, stopTimer, setStatus } = useApp()
  if (!prompt || !timer || !activeTask) return null

  const elapsed = phaseElapsed(timer, now)
  const nextIsLong = (timer.pomodoros + 1) % Math.max(1, settings.longBreakEvery) === 0

  const content = {
    break: {
      bg: '#FFEDE0',
      color: '#DB6A1F',
      mood: 'sleepy' as const,
      title: 'Hora de pausar!',
      text: `Já focaste ${formatDuration(elapsed)} em "${activeTask.title}". ${
        nextIsLong ? 'Mereces uma pausa longa.' : 'Levanta-te, bebe água e estica as pernas.'
      }`,
      primary: { label: 'Fazer pausa', className: 'btn-warm', action: startBreak },
      secondary: { label: '+5 minutos', action: () => extendFocus(5) },
    },
    breakOver: {
      bg: '#DCF7F3',
      color: '#0D9488',
      mood: 'excited' as const,
      title: 'Pausa terminada!',
      text: `Recarregado? Vamos voltar a "${activeTask.title}".`,
      primary: { label: 'Voltar ao foco', className: 'btn-accent', action: backToFocus },
      secondary: { label: 'Terminar por agora', action: stopTimer },
    },
    restDone: {
      bg: '#EEEAFF',
      color: '#5B43D6',
      mood: 'happy' as const,
      title: 'Tempo planeado terminado',
      text: `Passaste ${formatDuration(elapsed)} em "${activeTask.title}".`,
      primary: { label: 'Concluir tarefa', className: 'btn-primary', action: () => setStatus(activeTask.id, 'done') },
      secondary: { label: '+10 minutos', action: () => extendFocus(10) },
    },
  }[prompt]

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center sm:p-6 animate-fade-in" role="alertdialog" aria-labelledby="prompt-title">
      <div className="w-full max-w-lg rounded-t-3xl sm:rounded-3xl px-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] pt-5 animate-slide-up" style={{ background: content.bg }}>
        <div className="mb-4 flex items-center gap-4">
          <Mascot size={72} mood={content.mood} className="shrink-0" />
          <div>
            <h2 id="prompt-title" className="text-2xl font-black" style={{ color: content.color }}>
              {content.title}
            </h2>
            <p className="mt-1 font-semibold" style={{ color: content.color }}>
              {content.text}
            </p>
          </div>
        </div>
        <button onClick={content.primary.action} className={`btn w-full ${content.primary.className}`}>
          {content.primary.label}
        </button>
        <button
          onClick={content.secondary.action}
          className="mt-3 w-full py-2 text-[15px] font-extrabold uppercase tracking-wide cursor-pointer"
          style={{ color: content.color }}
        >
          {content.secondary.label}
        </button>
      </div>
    </div>
  )
}
