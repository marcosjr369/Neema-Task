'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useApp, useClock } from '../../context/AppContext'
import { phaseElapsed } from '../../lib/stats'
import Mascot from '../ui/Mascot'

/** Segundos até levar a pessoa de volta à tarefa sem ela tocar em nada. */
export const BREAK_OVER_REDIRECT_SECONDS = 10

/**
 * Durante uma pausa os jogos ficam livres; quando a pausa termina, o jogo é bloqueado
 * (deixa de estar montado, por isso não aceita mais toques nem teclas) e a pessoa é levada
 * de volta à tarefa em que estava a focar.
 */
export default function BreakOverLock({ children }: { children: ReactNode }) {
  const { timer, activeTask } = useApp()
  const { now } = useClock()
  const breakOver = !!timer && !!activeTask && timer.phase === 'break' && phaseElapsed(timer, now) >= timer.breakSeconds
  if (!breakOver || !activeTask) return <>{children}</>
  return <LockScreen taskId={activeTask.id} title={activeTask.title} />
}

function LockScreen({ taskId, title }: { taskId: string; title: string }) {
  const { backToFocus, stopTimer } = useApp()
  const router = useRouter()
  const [left, setLeft] = useState(BREAK_OVER_REDIRECT_SECONDS)
  const done = useRef(false)

  const goBack = (resume: boolean) => {
    if (done.current) return
    done.current = true
    if (resume) backToFocus()
    else stopTimer()
    router.push(`/tarefas/${taskId}`)
  }
  const goBackRef = useRef(goBack)
  useEffect(() => { goBackRef.current = goBack })

  useEffect(() => {
    const id = setInterval(() => setLeft(s => Math.max(0, s - 1)), 1000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    if (left === 0) goBackRef.current(true)
  }, [left])

  return (
    <div className="flex min-h-[70dvh] items-center justify-center px-5 py-10" role="alertdialog" aria-labelledby="lock-title" aria-describedby="lock-text">
      <div className="w-full max-w-md rounded-3xl bg-[#DCF7F3] px-6 py-7 text-center animate-slide-up">
        <Mascot size={88} mood="excited" className="mx-auto" />
        <h1 id="lock-title" className="mt-3 text-2xl font-black text-[#0D9488]">Pausa terminada!</h1>
        <p id="lock-text" className="mt-2 font-semibold text-[#0D9488]">
          O jogo fica por aqui. Vamos voltar a &ldquo;{title}&rdquo;.
        </p>
        <p className="mt-1 text-sm font-semibold text-[#0D9488]/80" aria-live="polite">
          A voltar à tarefa em {left} s…
        </p>
        <button onClick={() => goBack(true)} className="btn btn-accent mt-5 w-full">
          Voltar à tarefa agora
        </button>
        <button
          onClick={() => goBack(false)}
          className="mt-3 w-full cursor-pointer py-2 text-[15px] font-extrabold uppercase tracking-wide text-[#0D9488]"
        >
          Terminar por agora
        </button>
      </div>
    </div>
  )
}
